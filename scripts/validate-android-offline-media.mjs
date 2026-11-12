/**
 * Verify 100% of the APK's exercise media is present and byte-for-byte
 * identical to the generated, SHA-256 digested pinned-source pack.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
const root = resolve("android-offline/app/src/main/assets/web/media");
const data = JSON.parse(readFileSync(join(root,"manifest.json"),"utf8"));
const manifest = JSON.parse(readFileSync("src/data/workout-guide-manifest.json","utf8"));
const mappings = JSON.parse(readFileSync("src/data/exercise-media-map.json","utf8"));
assert.equal(data.format, "aura-fit-android-media-pack");
assert.equal(data.version, 1);
assert.equal(data.catalogExercises, 302);
assert.equal(data.approvedAnimatedGifs, 191);
assert.equal(data.posters, 191);
assert.equal(data.fallbackExerciseFrames, 906);
assert.equal(data.sourceCommits.animated, mappings._meta.sourceCommit);
assert.equal(data.sourceCommits.frames, "aac599224bb9780305239607ef98540b7e0ce389");
assert.equal(data.assets.length, 1288);
const indexes = new Map(data.assets.map((a) => [a.relative, a]));
assert.equal(indexes.size, 1288, "Duplicate media entries");
let bytes = 0;
function inspect(file, magic) {
  assert(indexes.has(file), "Media item not manifested: " + file);
  const info = indexes.get(file), path = join(root, file);
  assert(existsSync(path), "Media file missing from bundled APK: " + file);
  const data = readFileSync(path);
  assert(data.length > 20 && data.length === info.bytes, "Invalid size: " + file);
  assert.equal(createHash("sha256").update(data).digest("hex"), info.sha256,
    "Media integrity failure: " + file);
  if (magic === "gif") {
    assert(["GIF87a","GIF89a"].includes(data.subarray(0,6).toString("ascii")),
      "Invalid GIF: " + file);
    assert(data.readUInt16LE(6) > 0 && data.readUInt16LE(8) > 0,
      "GIF missing dimensions: " + file);
  } else if (magic === "jpg") {
    assert.equal(data[0], 0xff); assert.equal(data[1], 0xd8);
    assert.equal(data[2], 0xff);
  } else {
    const svg = data.toString("utf8");
    assert(svg.includes("<svg") && svg.includes("</svg>"),
      "Invalid SVG: " + file);
  }
  bytes += data.length;
}
for (const item of manifest) {
  const slug = item.slug;
  const mapped = mappings[slug];
  if (mapped.matchConfidence === "exact" || mapped.matchConfidence === "high") {
    inspect("gifs/" + slug + ".gif", "gif");
    inspect("posters/" + slug + ".jpg", "jpg");
  }
  for (const frame of item.frames) {
    inspect("frames/" + slug + "-" + frame.index + ".svg", "svg");
  }
}
assert.equal(bytes, data.totalBytes);
const built = readdirSync(resolve("android-offline/app/src/main/assets/web/assets"))
  .filter((name) => name.endsWith(".js"));
assert(built.length, "Cannot inspect bundled runtime");
const compiled = built.map((name) => readFileSync(
  resolve("android-offline/app/src/main/assets/web/assets",name),"utf8")).join(" ");
for (const fragment of ["/assets/web/media/","gifs/","posters/","frames/"]) {
  assert(compiled.includes(fragment), "Bundled runtime still refers to remote media instead of "+fragment);
}
console.log("Offline exercise media PASS: " + manifest.length + " detail pages, " +
  data.approvedAnimatedGifs + " animated GIFs, " +
  data.posters + " posters and " + data.fallbackExerciseFrames +
  " verified frames. SHA256 totals: " + (bytes/1024/1024).toFixed(1) + " MiB.");
