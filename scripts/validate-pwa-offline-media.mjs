// Deterministic SW contract: exercises are explicitly allowlisted, all dynamic
// navigation is network-only, and media caches remain bounded per category.
// Node vm is used so this runs without a browser or Supabase credentials.
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";

const root=process.cwd(), worker=fs.readFileSync(path.join(root,"public/sw.js"),"utf8");
const allowlist=fs.readFileSync(path.join(root,"public/media-offline-allowlist.js"),"utf8");
const events={},store=new Map(),history=[];
let offline=false;
const assert=(x,why)=>{if(!x)throw Error("PWA offline media: "+why)};
const key=(req)=>typeof req==="string"?new URL(req,"https://aura.local").href:req.url;
class Cache {
  constructor(name){this.name=name;this.rows=new Map();}
  async match(req){return this.rows.get(key(req))?.clone();}
  async addAll(paths){for(const p of paths){this.rows.set(key(p),new Response("public:"+p));}}
  async put(req,res){this.rows.set(key(req),res.clone());}
  async keys(){return [...this.rows.keys()].map(url=>({url}));}
  async delete(req){return this.rows.delete(key(req));}
}
const caches={
  async open(name){if(!store.has(name))store.set(name,new Cache(name));return store.get(name);},
  async keys(){return [...store.keys()];},
  async delete(name){return store.delete(name);},
  async match(req){for(const cache of store.values()){const response=await cache.match(req);if(response)return response;}return undefined;},
};
const self={
  AURA_OFFLINE_MEDIA:null,
  location:{origin:"https://aura.local"},
  clients:{claim:async()=>{}},
  skipWaiting:async()=>{},
  addEventListener:(event,callback)=>{events[event]=callback;},
};
const ctx=vm.createContext({
  self,caches,URL,Response,Set,Promise,
  importScripts:(url)=>{assert(url==="/media-offline-allowlist.js","unknown imported worker script");
    vm.runInContext(allowlist,ctx,{filename:"media-offline-allowlist.js"});},
  fetch:async request=>{
    const url=key(request);history.push(url);
    if(offline)throw Error("synthetic offline");
    if(url.endsWith("/profile"))return new Response("PRIVATE ACCOUNT A");
    return new Response("HTTP 200 "+url,{status:200});
  },
});
vm.runInContext(worker,ctx,{filename:"sw.js"});
async function dispatch(name,request){
  const waits=[];let promise;
  const ev={request,waitUntil(p){waits.push(Promise.resolve(p));},
    respondWith(p){assert(promise===undefined,"response assigned twice");promise=Promise.resolve(p);}};
  events[name](ev);
  const response=promise?await promise:null;
  // Also drain work scheduled in microtasks after respondWith settles.
  await Promise.all(waits);
  return response;
}
await dispatch("install");
assert(store.get("aura-fit-v2").rows.has("https://aura.local/"),"public install shell missing");
store.set("aura-fit-v1",new Cache("aura-fit-v1"));
await dispatch("activate");
assert(!store.has("aura-fit-v1"),"old cache not cleaned on activation");
const make=(url,mode="no-cors")=>({
  method:"GET",url,mode,headers:new Headers(),cache:"default",
});
const base="https://aura.local";
const profile=make(base+"/profile","navigate");
const online=await dispatch("fetch",profile);
assert((await online.text())==="PRIVATE ACCOUNT A","network navigation missing");
assert(!(await caches.match(profile)),"private profile HTML leaked to public CacheStorage");
offline=true;
const offlinePage=await dispatch("fetch",profile);
assert((await offlinePage.text())==="public:/",
  "offline private route did not fall back to public install shell");
offline=false;
const publicMedia=self.AURA_OFFLINE_MEDIA;
assert(publicMedia.gifs.length===191&&publicMedia.posters.length===191&&publicMedia.slugs.length===302,
  "source-approved inventory altered");
const git="https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/"+
  publicMedia.sourceCommit+"/";
const frames="https://raw.githubusercontent.com/bryllim/workout-guide/"+
  publicMedia.fallbackCommit+"/packages/workout-guide/";
const gif=make(git+publicMedia.gifs[0]);
let count=history.length;
const firstGif=await dispatch("fetch",gif);
assert(firstGif && (await firstGif.text()).includes("HTTP 200"),"approved GIF not delivered");
assert(history.length===count+1,"first GIF did not request network");
offline=true;
const cachedGif=await dispatch("fetch",gif);
assert(cachedGif && (await cachedGif.text()).includes("HTTP 200"),
  "approved GIF does not survive offline view");
assert(history.length===count+1,"cache-first media unexpectedly requested network");
offline=false;
const firstPoster=await dispatch("fetch",make(git+publicMedia.posters[0]));
assert(firstPoster && firstPoster.ok,"approved poster not cached");
const exerciseFrame=frames+"assets/"+publicMedia.slugs[0]+"/frame-1.svg";
await dispatch("fetch",make(exerciseFrame));
assert((await store.get("aura-fit-exercise-frames-v1").keys()).length===1,
  "pinned reference frame not accepted");

const reject=[
  git+"videos/3217-epOSYUZ.gif", // rejected candidate
  git+publicMedia.gifs[0]+"?download=1", // query manipulation
  git.replace(publicMedia.sourceCommit,"f".repeat(40))+publicMedia.gifs[0],
  frames+"assets/nonexistent-exercise/frame-1.svg",
  frames+"assets/"+publicMedia.slugs[0]+"/frame-4.svg",
  "https://supabase.example.co/rest/v1/aura_profiles",
  "https://raw.githubusercontent.com/another-org/exercises-dataset/"+publicMedia.gifs[0],
];
for(const url of reject){
  const response=await dispatch("fetch",make(url));
  assert(response===null,"untrusted or private request was intercepted: "+url);
}
assert(!(await caches.match(make(git+"videos/3217-epOSYUZ.gif"))),
  "rejected Hindu Push-up source entered offline media cache");

for(let i=1;i<27;i++)await dispatch("fetch",make(git+publicMedia.gifs[i]));
const gifKeys=await store.get("aura-fit-approved-gifs-v1").keys();
assert(gifKeys.length===24,"GIF media cache exceeded 24-item budget");
assert(!gifKeys.some(x=>x.url===gif.url),"oldest GIF was not evicted");

let loaded=0;
for(const slug of publicMedia.slugs){
  for(let frame=1;frame<=3;frame++){
    if(loaded++>=126)break;
    await dispatch("fetch",make(frames+"assets/"+slug+"/frame-"+frame+".svg"));
  }
  if(loaded>=126)break;
}
assert((await store.get("aura-fit-exercise-frames-v1").keys()).length===120,
  "reference frame cache must evict beyond 120 items");

// User-scoped endpoints and unknown origins were never cached.
const allKeys=[...store.values()].flatMap(cache=>[...cache.rows.keys()]);
assert(!allKeys.some(url=>url.includes("/profile")||url.includes("supabase.example")),
  "personal/auth endpoint persisted in shared cache");
assert(allKeys.filter(url=>url.includes("raw.githubusercontent.com")).every(url=>
  url.includes(publicMedia.sourceCommit)||url.includes(publicMedia.fallbackCommit)),
  "unpinned exercise source leaked into offline storage");
console.log("PWA offline media PASS: public-only navigation shell, verified exercise allowlist, offline re-use, exact pinned origins, no candidate or Supabase caching, bounded LRU-independent FIFO.");
