import { inspectMotionGif } from "./inspect-motion-gif.mjs";
const good=Buffer.from(
  "R0lGODlhAgACAIEAAP///wAAAAAAAAAAACH/C05FVFNDQVBFMi4wAwEAAAAh+QQAFAAAACwAAAAAAgACAAAIBgABCAQQEAAh+QQBHgABACwAAAAAAgACAIH/AAAAAAAAAAAAAAAIBgABCAQQEAA7",
  "base64"
);
const fail=(message)=>{throw new Error("GIF parser regression: "+message)};
const check=(condition,message)=>{if(!condition)fail(message)};
const gif=inspectMotionGif(good);
check(gif.frameCount===2&&gif.width===2&&gif.height===2,"lost canvas/frame count");
check(gif.durationMs===500 && gif.frames[0].delayMs===200&&gif.frames[1].delayMs===300,
  "bad graphics-control timing");
check(/^[0-9a-f]{40}$/.test(gif.gitBlobSha),"Git blob checksum invalid");
check(gif.frames[0].index===0&&gif.frames[1].index===1,"frame ordering changed");
for(const invalid of [
  Buffer.from("not a gif"),good.subarray(0,20),good.subarray(0,good.length-1),
  Buffer.concat([good.subarray(0,good.length-1),Buffer.from([0x42])])
]){
  let rejected=false;
  try{inspectMotionGif(invalid)}catch{rejected=true;}
  check(rejected,"malformed or truncated source GIF accepted");
}
const changed=Buffer.from(good);
changed[0]=0x41;let rejected=false;
try{inspectMotionGif(changed)}catch{rejected=true;}
check(rejected,"invalid magic header accepted");
console.log("Motion GIF parser PASS: frame/timing extraction, SHA, and malformed input fail-closed.");
