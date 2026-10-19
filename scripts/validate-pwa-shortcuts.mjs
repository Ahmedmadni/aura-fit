// Validate installed PWA shortcut destinations against actual TanStack file routes.
import fs from "node:fs";
import path from "node:path";
const root=path.resolve("src/routes");
const manifest=JSON.parse(fs.readFileSync("public/manifest.webmanifest","utf8"));
const shortcuts=manifest.shortcuts;
if(!Array.isArray(shortcuts)||shortcuts.length<1)throw Error("PWA must expose at least one shortcut");
const seen=new Set();
for(const item of shortcuts){
 if(typeof item.name!=="string"||!item.name.trim())throw Error("Shortcut missing name");
 if(typeof item.url!=="string"||!/^\/[a-z0-9/-]*$/i.test(item.url))throw Error("Shortcut must be a static same-origin route: "+item.url);
 if(seen.has(item.url))throw Error("Duplicate PWA shortcut: "+item.url);
 seen.add(item.url);
 const route=item.url==="/"? "index.tsx":item.url.slice(1)+".tsx";
 if(!fs.existsSync(path.join(root,route)))throw Error("PWA shortcut route is missing: "+item.url);
 for(const icon of item.icons??[]){
  if(typeof icon.src!=="string"||!/^\/[a-z0-9/_-]+\.png$/i.test(icon.src)||!fs.existsSync(path.join("public",icon.src.slice(1))))throw Error("Invalid PWA shortcut icon: "+icon.src);
 }
}
for(const route of ["/programs","/workout","/progress"]){
 if(!seen.has(route))throw Error("Expected installed navigation shortcut: "+route);
}
console.log("PWA shortcut routes PASS: all shortcuts point to existing static routes and icons.");
