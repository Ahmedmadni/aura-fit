/**
 * Reproducible, fail-closed media packaging for the isolated Android build.
 *
 * Approved exact/high mappings only: GIF + static poster (191 exercises).
 * Every one of the 302 exercise slugs has 3 source-matched SVG guide frames.
 * Download at pinned source commits, verify magic bytes and SHA256 and embed
 * under Android WebViewAssetLoader's /assets/web/media paths. No device network.
 *
 * User-supplied redistribution permissions must cover the selected assets.
 * This script never promotes review/none candidates to trusted exercise GIFs.
 */
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync, renameSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const base = resolve("android-offline/app/src/main/assets/web");
const mediaDir = join(base, "media");
assert(existsSync(join(base, "index.html")), "Run offline:web:build before downloading media");
const manifest = JSON.parse(readFileSync("src/data/workout-guide-manifest.json", "utf8"));
const mappings = JSON.parse(readFileSync("src/data/exercise-media-map.json", "utf8"));
assert(manifest.length === 302, "Exercise catalog count changed; audit before packaging");
const rawGifBase = "https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/" +
  mappings._meta.sourceCommit + "/";
const rawFrameBase = "https://raw.githubusercontent.com/bryllim/workout-guide/" +
  "aac599224bb9780305239607ef98540b7e0ce389/packages/workout-guide/";
const jobs = [];
const seenUrls = new Set();
const uniquePaths = new Set();
function addAsset(slug, kind, index, rawPath, baseUrl) {
  const ext = kind === "gif" ? ".gif" : kind === "poster" ? ".jpg" : ".svg";
  const relative = kind + "s/" + slug + (index ? "-" + index : "") + ext;
  assert(/^[a-z0-9-]+$/.test(slug) && /^[a-z0-9-]+$/.test(String(index || "0")), "Bad slug");
  assert(/^(?:videos\/[-\w]+\.gif|images\/[-\w]+\.jpg|assets\/[-\w]+\/frame-[123]\.svg)$/.test(rawPath),
    "Unexpected remote asset path: " + rawPath);
  assert(!uniquePaths.has(relative), "Duplicate media path: " + relative);
  uniquePaths.add(relative);
  const url = new URL(rawPath, baseUrl).href;
  assert(url.startsWith(baseUrl), "Remote media path escaped pinned host");
  const isFirst = !seenUrls.has(url);
  seenUrls.add(url);
  jobs.push({ slug, kind, index: index || undefined, relative,
    url, maxBytes: kind === "gif" ? 3_000_000 : kind === "poster" ? 2_000_000 : 500_000,
    reusedUrl: !isFirst,
  });
}
let approved = 0;
for (const entry of manifest) {
  const slug = entry.slug;
  const approvedMedia = mappings[slug];
  assert(approvedMedia, "Missing media mapping " + slug);
  if (approvedMedia.matchConfidence === "exact" || approvedMedia.matchConfidence === "high") {
    assert(approvedMedia.gif && approvedMedia.poster, slug + " incomplete approved mapping");
    addAsset(slug, "gif", null, approvedMedia.gif, rawGifBase);
    addAsset(slug, "poster", null, approvedMedia.poster, rawGifBase);
    approved++;
  }
  assert(entry.frames.length === 3, slug + " missing guide frames");
  for (const frame of entry.frames) {
    assert(frame.path === "assets/" + slug + "/frame-" + frame.index + ".svg",
      slug + " non-canonical frame path");
    addAsset(slug, "frame", frame.index, frame.path, rawFrameBase);
  }
}
assert(approved === 191 && jobs.length === 191 * 2 + 302 * 3,
  "Approved media counts changed; require explicit mapping audit");
const digest = (buffer) => createHash("sha256").update(buffer).digest("hex");
function valid(buffer, job) {
  if (buffer.length < 20 || buffer.length > job.maxBytes) return false;
  if (job.kind === "gif") return ["GIF87a", "GIF89a"].includes(buffer.subarray(0,6).toString("ascii"));
  if (job.kind === "poster") return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  // Every source frame must be SVG without active content/embedded remote media.
  const text = buffer.toString("utf8");
  return /<svg(?:\s|>)/i.test(text) && /<\/svg\s*>/i.test(text) &&
    !/<(?:script|foreignObject|iframe|embed|object)\b/i.test(text) &&
    !/\son[a-z]+\s*=/i.test(text) &&
    !/(?:https?:)?\/\//i.test(text.replace(/xmlns(?::\w+)?="[^"]*"/g, "")) &&
    !/\b(?:javascript|data):/i.test(text);
}
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
const results = Array(jobs.length);
const concurrency = Math.min(16, Number(process.env.AURA_MEDIA_WORKERS || 12));
let cursor = 0, successes = 0, reuses = 0, failures = [];
async function worker() {
  while (true) {
    const index = cursor++;
    if (index >= jobs.length) return;
    const job = jobs[index];
    const destination = join(mediaDir, job.relative);
    mkdirSync(dirname(destination), { recursive:true });
    if (existsSync(destination)) {
      const previous = readFileSync(destination);
      if (valid(previous, job)) {
        results[index] = { ...job, bytes:previous.length, sha256:digest(previous) };
        reuses++; successes++;
        continue;
      }
      rmSync(destination);
    }
    let last = "";
    for (let attempt=0; attempt<4; attempt++) {
      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), 25_000);
      try {
        const response = await fetch(job.url, {
          signal: abort.signal, redirect:"error",
          headers: { "user-agent":"AuraFit-offline-media-pack/1.0" },
        });
        if (!response.ok) throw new Error("HTTP " + response.status);
        const declared = Number(response.headers.get("content-length") || "0");
        if (declared > job.maxBytes) throw new Error("Asset too large");
        const body = Buffer.from(await response.arrayBuffer());
        if (!valid(body, job)) throw new Error("Unexpected media content for " + job.kind);
        const tmp = destination + ".partial-" + index;
        writeFileSync(tmp, body);
        renameSync(tmp, destination);
        results[index] = { ...job, bytes:body.length, sha256:digest(body) };
        successes++;
        break;
      } catch (error) {
        last = error instanceof Error ? error.message : String(error);
        if (attempt < 3) await sleep(200 * 2 ** attempt);
      } finally {
        clearTimeout(timer);
      }
    }
    if (!results[index]) failures.push(job.slug + ":" + job.kind + ":" + last);
    if ((successes + failures.length) % 100 === 0) {
      console.log("Media: " + (successes+failures.length) + "/" + jobs.length +
        ", failed=" + failures.length + ", reused=" + reuses);
    }
  }
}
await Promise.all(Array.from({length:concurrency}, () => worker()));
if (failures.length) {
  console.error("Media packaging FAILED for " + failures.length + " items:");
  failures.slice(0,35).forEach((item) => console.error(item));
  process.exit(1);
}
const report = {
  format: "aura-fit-android-media-pack",
  version: 1,
  catalogExercises: manifest.length,
  approvedAnimatedGifs: approved,
  fallbackExerciseFrames: 302 * 3,
  posters: approved,
  sourceCommits: {
    animated: mappings._meta.sourceCommit,
    frames: "aac599224bb9780305239607ef98540b7e0ce389",
  },
  totalBytes: results.reduce((sum, result) => sum + result.bytes, 0),
  assets: results,
};
writeFileSync(join(mediaDir,"manifest.json"), JSON.stringify(report));
console.log("Offline media pack PASS: " + jobs.length + " files, " +
  (report.totalBytes/1024/1024).toFixed(1) + " MiB, " +
  approved + " approved GIFs, " + (302*3) + " frames; reused " + reuses);
