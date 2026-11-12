package com.aurafit.offline;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.webkit.WebViewAssetLoader;

import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;

/**
 * Air-gapped training shell: JavaScript/CSS/exercise catalog served from APK.
 * No INTERNET permission, no external navigation, no file:// and no remote JS.
 * Only bridge: explicit user-selected Android backup export through SAF.
 * WebView localStorage is NOT shared with Chrome/TWA.
 */
public final class OfflineActivity extends Activity {
    private static final String LOCAL_HOST = "appassets.androidplatform.net";
    private static final String START_URL =
        "https://" + LOCAL_HOST + "/assets/web/index.html";
    private static final String BACKUP_STATE = "aura_pending_backup_file";
    private static final int CHOOSE_BACKUP = 4121;
    private static final int SAVE_BACKUP = 4122;
    private WebView webView;
    private ValueCallback<Uri[]> fileChooser;
    private File pendingExport;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        if (state != null && state.getString(BACKUP_STATE) != null) {
            File candidate = new File(state.getString(BACKUP_STATE));
            if (candidate.getParentFile() != null &&
                candidate.getParentFile().equals(getCacheDir()) &&
                candidate.getName().startsWith("aura_backup_") && candidate.isFile()) {
                pendingExport = candidate;
            }
        }

        webView = new WebView(this);
        webView.setLayoutParams(new ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        ));
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        // Exercise MP4 loops must start when the workout timer advances,
        // not only after tapping each separate video. Only APK/user-selected
        // local media can load, and the HTML player is always muted.
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(false);
        // The Android system document picker returns content:// URIs.
        // A false value makes the restore form unable to read selected JSON.
        // Only bundled HTTPS app assets can navigate, and network loads stay blocked.
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setBlockNetworkLoads(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        webView.setOverScrollMode(WebView.OVER_SCROLL_NEVER);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, false);
        webView.addJavascriptInterface(new LocalBackupBridge(), "AuraLocalBackup");
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(
                WebView view,
                ValueCallback<Uri[]> callback,
                FileChooserParams params
            ) {
                if (fileChooser != null) fileChooser.onReceiveValue(null);
                fileChooser = callback;
                try {
                    Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    // Backup JSON and licensed exercise MP4/WebM/GIF must
                    // open in the same WebView SAF picker. Never grant broad
                    // filesystem access: user explicitly picks one document.
                    boolean motion = false;
                    String[] accepted = params.getAcceptTypes();
                    if (accepted != null) {
                        for (String type : accepted) {
                            if (type == null) continue;
                            String lower = type.toLowerCase(java.util.Locale.ROOT);
                            if (lower.contains("video/") || lower.contains("image/gif") ||
                                lower.contains(".mp4") || lower.contains(".webm") ||
                                lower.contains(".gif")) {
                                motion = true;
                                break;
                            }
                        }
                    }
                    if (motion) {
                        intent.setType("*/*");
                        intent.putExtra(Intent.EXTRA_MIME_TYPES,
                            new String[]{"video/mp4", "video/webm", "image/gif"});
                        if (params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE) {
                            intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                        }
                    } else {
                        intent.setType("application/json");
                    }
                    startActivityForResult(intent, CHOOSE_BACKUP);
                } catch (Exception error) {
                    fileChooser = null;
                    callback.onReceiveValue(null);
                    showToast("تعذر فتح اختيار الملف المحلي.");
                }
                return true;
            }
        });

        final WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
            .build();

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(
                WebView view, WebResourceRequest request
            ) {
                Uri url = request.getUrl();
                if (!isBundledResource(url)) return blocked();
                WebResourceResponse response = loader.shouldInterceptRequest(url);
                return response != null ? response : blocked();
            }

            @Override
            public boolean shouldOverrideUrlLoading(
                WebView view, WebResourceRequest request
            ) {
                if (isAppDocument(request.getUrl())) return false;
                showToast("هذا الرابط غير متاح في النسخة المحلية.");
                return true;
            }
        });

        if (state != null && webView.restoreState(state) != null) return;
        webView.loadUrl(START_URL);
    }

    /**
     * No file paths from JavaScript; the Android system asks the user where to
     * save. Data are validated and staged in app-private cache before SAF.
     */
    private final class LocalBackupBridge {
        @JavascriptInterface
        public void saveBackup(String jsonText) {
            try {
                if (jsonText == null || jsonText.length() > 10 * 1024 * 1024) {
                    throw new IllegalArgumentException("Invalid backup size");
                }
                JSONObject parsed = new JSONObject(jsonText);
                if (!"aura-fit-local-backup".equals(parsed.optString("format")) ||
                    parsed.optInt("version", -1) != 1) {
                    throw new IllegalArgumentException("Invalid backup format");
                }
                File temp = File.createTempFile("aura_backup_", ".json", getCacheDir());
                try (FileOutputStream file = new FileOutputStream(temp)) {
                    file.write(jsonText.getBytes(StandardCharsets.UTF_8));
                }
                runOnUiThread(() -> {
                    if (pendingExport != null) pendingExport.delete();
                    pendingExport = temp;
                    Intent save = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                    save.addCategory(Intent.CATEGORY_OPENABLE);
                    save.setType("application/json");
                    save.putExtra(Intent.EXTRA_TITLE,
                        "aura-fit-backup-" + new java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).format(new java.util.Date()) + ".json");
                    try {
                        startActivityForResult(save, SAVE_BACKUP);
                    } catch (Exception error) {
                        clearPendingExport();
                        showToast("تعذر فتح نافذة حفظ النسخة الاحتياطية.");
                    }
                });
            } catch (Exception error) {
                runOnUiThread(() -> showToast("تعذر تجهيز النسخة الاحتياطية."));
            }
        }
    }

    private void showToast(String message) {
        runOnUiThread(() ->
            Toast.makeText(OfflineActivity.this, message, Toast.LENGTH_SHORT).show()
        );
    }

    private void clearPendingExport() {
        if (pendingExport != null) {
            pendingExport.delete();
            pendingExport = null;
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent intent) {
        super.onActivityResult(requestCode, resultCode, intent);
        if (requestCode == CHOOSE_BACKUP) {
            if (fileChooser != null) {
                Uri[] selected = null;
                if (resultCode == RESULT_OK && intent != null) {
                    android.content.ClipData clips = intent.getClipData();
                    if (clips != null && clips.getItemCount() > 0 &&
                        clips.getItemCount() <= 60) {
                        selected = new Uri[clips.getItemCount()];
                        for (int index = 0; index < clips.getItemCount(); index++) {
                            selected[index] = clips.getItemAt(index).getUri();
                        }
                    } else if (intent.getData() != null) {
                        selected = new Uri[]{intent.getData()};
                    }
                }
                fileChooser.onReceiveValue(selected);
                fileChooser = null;
            }
        } else if (requestCode == SAVE_BACKUP) {
            boolean saved = false;
            try {
                if (resultCode == RESULT_OK && intent != null &&
                    intent.getData() != null && pendingExport != null) {
                    try (FileInputStream input = new FileInputStream(pendingExport);
                         OutputStream output = getContentResolver().openOutputStream(intent.getData())) {
                        if (output == null) throw new IllegalStateException("No file output");
                        byte[] chunk = new byte[8192];
                        int count;
                        while ((count = input.read(chunk)) >= 0) output.write(chunk, 0, count);
                    }
                    saved = true;
                }
            } catch (Exception error) {
                showToast("فشل حفظ النسخة، حاول اختيار مكان آخر.");
            } finally {
                clearPendingExport();
            }
            if (saved) showToast("تم حفظ ملف Aura Fit على الجهاز.");
        }
    }

    private static boolean isBundledResource(Uri uri) {
        return "https".equals(uri.getScheme())
            && LOCAL_HOST.equals(uri.getHost())
            && uri.getPath() != null
            && uri.getPath().startsWith("/assets/web/")
            && uri.getUserInfo() == null
            && uri.getPort() == -1
            && uri.getQuery() == null;
    }

    private static boolean isAppDocument(Uri uri) {
        return isBundledResource(uri) &&
            "/assets/web/index.html".equals(uri.getPath());
    }

    private static WebResourceResponse blocked() {
        return new WebResourceResponse("text/plain", "UTF-8",
            new ByteArrayInputStream(new byte[0]));
    }

    @Override
    protected void onSaveInstanceState(Bundle state) {
        if (pendingExport != null) state.putString(BACKUP_STATE, pendingExport.getAbsolutePath());
        webView.saveState(state);
        super.onSaveInstanceState(state);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (fileChooser != null) {
            fileChooser.onReceiveValue(null);
            fileChooser = null;
        }
        if (webView != null) {
            webView.stopLoading();
            webView.removeJavascriptInterface("AuraLocalBackup");
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
