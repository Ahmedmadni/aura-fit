// Deterministic, pinned, opt-in offline PWA allowlist. Only exact/high GIF
// assets can enter the media cache. Never copy review/none candidate assets.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const read=(file)=>fs.readFileSync(path.join(root,file),"utf8");
const media=JSON.parse(read("src/data/exercise-media-map.json"));
const manifest=JSON.parse(read("src/data/workout-guide-manifest.json"));
const db=read("src/lib/exercise-db.ts");
const sourceCommit=media._meta?.sourceCommit;
const fallbackCommit=db.match(/const SOURCE_COMMIT = "([0-9a-f]{40})"/)?.[1];
const check=(ok,msg)=>{if(!ok)throw new Error("Offline media manifest: "+msg)};
check(/^[0-9a-f]{40}$/.test(sourceCommit)&&/^[0-9a-f]{40}$/.test(fallbackCommit),
  "unpinned media repository commit");
const gifs=[],posters=[],slugs=[];
for(const exercise of manifest){
  check(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(exercise.slug),
    "invalid fallback exercise slug");
  check(exercise.frames?.length===3&&exercise.frames.every((frame,index)=>
    frame.path==="assets/"+exercise.slug+"/frame-"+(index+1)+".svg"),
    "fallback frame inventory differs from the whitelist: "+exercise.slug);
  slugs.push(exercise.slug);
  const entry=media[exercise.slug];
  check(entry,"missing canonical mapping");
  if(entry.matchConfidence==="exact"||entry.matchConfidence==="high"){
    check(/^videos\/[0-9]{4}-[a-zA-Z0-9]+\.gif$/.test(entry.gif)&&
      /^images\/[0-9]{4}-[a-zA-Z0-9]+\.jpg$/.test(entry.poster),
      "approved GIF or poster path invalid: "+exercise.slug);
    gifs.push(entry.gif);
    posters.push(entry.poster);
  }else{
    check(!entry.gif&&!entry.poster,
      "unapproved media must not enter offline cache: "+exercise.slug);
  }
}
check(slugs.length===302&&gifs.length===191&&posters.length===191,
  "unexpected canonical media counts");
check(new Set(gifs).size===gifs.length&&new Set(posters).size===posters.length&&
  new Set(slugs).size===slugs.length,"duplicate media or slug");
const payload={sourceCommit,fallbackCommit,gifs:gifs.sort(),posters:posters.sort(),slugs:slugs.sort()};
const output="/* Auto-generated; run bun run media:offline:generate; do not hand-edit. */\n"+
  "self.AURA_OFFLINE_MEDIA = Object.freeze("+JSON.stringify(payload,null,2)+");\n";
const filename=path.join(root,"public/media-offline-allowlist.js");
if(process.argv.includes("--check")){
  check(fs.existsSync(filename)&&read("public/media-offline-allowlist.js")===output,
    "checked-in allowlist is stale; run bun run media:offline:generate");
  console.log("Offline media manifest PASS: 191 pinned GIFs + posters, 302 sets of three fallback frames; no unapproved candidates.");
}else{
  fs.writeFileSync(filename,output,"utf8");
  console.log("Generated public/media-offline-allowlist.js: 191 approved GIFs and 302 fallback exercise IDs.");
}
