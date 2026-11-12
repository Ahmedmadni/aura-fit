package com.aurafit.offline;

import android.app.Activity;
import android.os.Bundle;
import android.net.Uri;
import android.view.ViewGroup;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.CookieManager;
import android.widget.Toast;

import androidx.webkit.WebViewAssetLoader;

/**
 * Air-gapped training shell: JavaScript/CSS/exercise catalog served from APK.
 * No INTERNET permission, no external URLs, no JS bridge and no file:// access.
 * WebView localStorage is device-local and is NOT shared with Chrome/TWA.
 */
public final class OfflineActivity extends Activity {
    private static final String LOCAL_HOST = "appassets.androidplatform.net";
    private static final String START_URL =
        "https://" + LOCAL_HOST + "/assets/web/index.html";
    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        webView = new WebView(this);
        webView.setLayoutParams(new ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        ));
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setBlockNetworkLoads(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        webView.setOverScrollMode(WebView.OVER_SCROLL_NEVER);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, false);
        webView.setWebChromeClient(new WebChromeClient());

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
                Toast.makeText(OfflineActivity.this,
                    "هذا الرابط غير متاح في النسخة المحلية.", Toast.LENGTH_SHORT).show();
                return true;
            }
        });

        if (savedInstanceState != null && webView.restoreState(savedInstanceState) != null) {
            return;
        }
        webView.loadUrl(START_URL);
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
            new java.io.ByteArrayInputStream(new byte[0]));
    }

    @Override
    protected void onSaveInstanceState(Bundle state) {
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
        if (webView != null) {
            webView.stopLoading();
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
