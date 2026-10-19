// Phase 55: verify PNG icon bytes, declared sizes and maskable artwork before shipping.
import fs from "node:fs";
import path from "node:path";
const root = path.resolve("public");
const manifest = JSON.parse(fs.readFileSync(path.join(root,"manifest.webmanifest"),"utf8"));
const required = new Map([["small","any"],["large","any"],["large","maskable"]].map(([size,purpose])=>[`${size}:${purpose}`,false]));
for(const icon of manifest.icons ?? []) {
  if(typeof icon.src !== "string" || !/^\/[a-z0-9/_-]+\.png$/i.test(icon.src)) throw Error("Unsafe icon path: " + icon.src);
  const bytes=fs.readFileSync(path.join(root,icon.src.slice(1)));
  if(bytes.length<33 || !bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) || bytes.toString("ascii",12,16)!=="IHDR") throw Error("Invalid PNG: "+icon.src);
  const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
  if(width<1||height<1||width>2048||height>2048) throw Error("Unreasonable icon dimension "+icon.src);
  if(icon.sizes!==`${width}x${height}`) throw Error(`Icon ${icon.src}: declared ${icon.sizes} but actual ${width}x${height}`);
  const purposes=(icon.purpose ?? "any").split(/\s+/);
  for(const purpose of purposes) {
    const sizeClass = width >= 512 && height >= 512 ? "large" : width >= 192 && height >= 192 ? "small" : "undersized";
    const key=`${sizeClass}:${purpose}`;
    if(required.has(key)) required.set(key,true);
  }
  if(icon.type!=="image/png")throw Error("PNG icon MIME mismatch "+icon.src);
}
for(const [requirement,present] of required)if(!present)throw Error("Missing PWA icon "+requirement);
console.log("PWA icon integrity PASS: valid PNG signatures, matching actual dimensions, 192/512 and maskable variants.");
