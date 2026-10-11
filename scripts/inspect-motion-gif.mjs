// Dependency-free GIF structural inspector. GIF frame rectangles may be delta
// frames; inspecting timing/metadata is not a substitute for visual playback.
// To audit a pinned candidate: bun run media:motion:inspect -- path/to/file.gif 3217
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

function invalid(message) { throw new Error("Invalid GIF: " + message); }
export function inspectMotionGif(input) {
  const bytes = Buffer.from(input);
  if (bytes.length < 14 || !["GIF87a", "GIF89a"].includes(bytes.toString("ascii",0,6))) {
    invalid("GIF header not found");
  }
  const width = bytes.readUInt16LE(6), height = bytes.readUInt16LE(8);
  if (!width || !height) invalid("invalid canvas size");
  const globalColorBytes = bytes[10] & 0x80 ? 3 * (2 ** ((bytes[10] & 7) + 1)) : 0;
  let offset = 13 + globalColorBytes, gce = null, frameNo = 0;
  const frames = [];
  function need(count) {
    if (offset + count > bytes.length) invalid("truncated image/extension data");
  }
  function subblocks() {
    while (true) {
      need(1);
      const size = bytes[offset++];
      if (!size) return;
      need(size);
      offset += size;
    }
  }
  let trailer = false;
  while (offset < bytes.length) {
    need(1);
    const marker = bytes[offset++];
    if (marker === 0x3b) { trailer = true; break; }
    if (marker === 0x21) {
      need(1);
      const label = bytes[offset++];
      if (label === 0xf9) {
        need(1);
        const size = bytes[offset++];
        if (size !== 4) invalid("malformed graphics-control extension");
        need(5);
        gce = {
          delayMs: bytes.readUInt16LE(offset + 1) * 10,
          transparent: Boolean(bytes[offset] & 1),
          disposal: (bytes[offset] >> 2) & 7,
        };
        offset += 4;
        if (bytes[offset++] !== 0) invalid("graphics-control terminator missing");
      } else {
        subblocks();
      }
      continue;
    }
    if (marker !== 0x2c) invalid("unknown GIF block");
    need(9);
    const left=bytes.readUInt16LE(offset), top=bytes.readUInt16LE(offset+2);
    const w=bytes.readUInt16LE(offset+4), h=bytes.readUInt16LE(offset+6);
    const flags=bytes[offset+8];
    offset+=9;
    if (!w || !h || left+w>width || top+h>height) invalid("frame exceeds canvas");
    const localBytes=flags & 0x80 ? 3*(2**((flags&7)+1)) : 0;
    need(localBytes+1);
    offset+=localBytes+1;
    subblocks();
    frames.push({ index:frameNo++, left, top, width:w, height:h,
      delayMs:gce?.delayMs ?? 0, transparent:gce?.transparent ?? false,
      disposal:gce?.disposal ?? 0 });
    gce=null;
  }
  if (!trailer || !frames.length) invalid("missing trailer or frames");
  return {
    width,height,frameCount:frames.length,
    durationMs:frames.reduce((n,f)=>n+f.delayMs,0),
    frames,
    gitBlobSha:createHash("sha1").update(
      Buffer.concat([Buffer.from("blob "+bytes.length+"\0"),bytes])
    ).digest("hex"),
  };
}
if (process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const filename=process.argv[2],sourceId=process.argv[3];
  if (!filename) {
    console.error("Usage: bun run media:motion:inspect -- <local.gif> [pinned-source-id]");
    process.exitCode=2;
  } else {
    try {
      const inspected=inspectMotionGif(readFileSync(filename));
      if (sourceId) {
        const record=JSON.parse(readFileSync(
          new URL("../src/data/media-candidate-audit.json",import.meta.url),"utf8"
        )).reviews.find(row=>row.sourceExerciseId===sourceId);
        if (!record || record.gifBlobSha!==inspected.gitBlobSha) {
          throw new Error("Source GIF SHA mismatch: not the pinned reviewed version.");
        }
        const audit=record.motionAudit;
        if (audit && (audit.frames!==inspected.frameCount ||
          audit.durationMs!==inspected.durationMs ||
          audit.resolution[0]!==inspected.width ||
          audit.resolution[1]!==inspected.height)) {
          throw new Error("Source GIF does not match reviewed frame metadata.");
        }
      }
      console.log(JSON.stringify(inspected,null,2));
    } catch(error) {
      console.error(error instanceof Error?error.message:"GIF inspection failed.");
      process.exitCode=1;
    }
  }
}
