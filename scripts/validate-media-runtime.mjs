import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const mediaPlayerPath = path.join(root, "src", "components", "athlete-video.tsx");
const fail = (message) => {
  console.error("Media runtime validation failed: " + message);
  process.exit(1);
};

if (!fs.existsSync(mediaPlayerPath)) fail("missing athlete-video.tsx");

const source = fs.readFileSync(mediaPlayerPath, "utf8");

for (const required of [
  "const usingFallback = !preferredGif || preferredFailed;",
  "if (!running || !usingFallback || !frames?.length) return;",
  "const nextFrame = frames[(frameIndex + 1) % frames.length];",
]) {
  if (!source.includes(required)) {
    fail("missing fallback-only runtime optimization: " + required);
  }
}

for (const banned of [
  "frames.forEach((src)",
  "const preferredAsset = running ? preferredGif : poster;",
]) {
  if (source.includes(banned)) {
    fail("eager media preload pattern returned: " + banned);
  }
}

const intervalBlock = source.match(/useEffect\(\(\) => \{[\s\S]*?window\.setInterval[\s\S]*?\}, \[[^\]]+\]\);/);
if (!intervalBlock || !intervalBlock[0].includes("usingFallback")) {
  fail("fallback frame interval must be disabled while a verified GIF is active");
}

console.log(
  "Media runtime PASS: verified GIF playback avoids hidden fallback timers and fallback mode preloads only the next frame.",
);
