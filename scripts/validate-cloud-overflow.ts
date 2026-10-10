// Supabase sync overflow safety: older, offline, unsaved records cannot be
// trimmed from a 500/365 working set on an HTTP 204 that changed no rows.
process.env.VITE_SUPABASE_URL="https://aura-test.supabase.co";
process.env.VITE_SUPABASE_PUBLISHABLE_KEY="fake-public-test-key";
const store=new Map<string,string>();
(globalThis as any).window={dispatchEvent:()=>true};
(globalThis as any).localStorage={
  getItem:(k:string)=>store.get(k)??null,
  setItem:(k:string,v:string)=>{store.set(k,v);},
  removeItem:(k:string)=>{store.delete(k);},
};
const data=await import("../src/lib/user-profile");
const ledger=await import("../src/lib/cloud-sync-ledger");
const {runFullCloudSync}=await import("../src/lib/cloud-sync");
const ok=(x:unknown,m:string)=>{if(!x)throw Error("History overflow: "+m);};
const uid="athlete-39";
store.set("kp.cloud.session",JSON.stringify({
  access_token:"mock",refresh_token:"mock",expires_at:Math.floor(Date.now()/1000)+3600,
  user:{id:uid},
}));
const workout=(id:string,date:string)=>({
  id,date,exercises:[],durationSec:600,activeSec:400,calories:50,
  intensity:50,performance:50,
});
const readiness=(dateKey:string)=>({
  dateKey,recordedAt:dateKey+"T08:00:00.000Z",sleepQuality:4,
  fatigue:2,muscleSoreness:1,energy:4,
});
const older=workout("older-local","2020-01-01T06:00:00.000Z");
const olderReady=readiness("2020-01-01");
data.replaceLocalHistory([older],false);
data.replaceLocalReadinessHistory([olderReady],false);
ledger.markCloudChangePending(uid,{kind:"workout",id:older.id});
ledger.markCloudChangePending(uid,{kind:"readiness",dateKey:olderReady.dateKey});
const remoteWork=new Map<string,any>();
const remoteReady=new Map<string,any>();
const date=(base:string,i:number)=>new Date(Date.parse(base)+86400000*i).toISOString();
for(let i=0;i<data.MAX_LOCAL_WORKOUTS;i++){
  const id="cloud-"+i,at=date("2024-01-01T06:00:00.000Z",i);
  remoteWork.set(id,{user_id:uid,workout_id:id,workout_date:at,data:workout(id,at)});
}
for(let i=0;i<data.MAX_LOCAL_READINESS;i++){
  const key=date("2025-01-01T08:00:00.000Z",i).slice(0,10);
  remoteReady.set(key,{user_id:uid,date_key:key,recorded_at:key+"T08:00:00.000Z",data:readiness(key)});
}
let accept=false,targeted=0;
const response=(v:unknown,code=200)=>code===204?new Response(null,{status:204}):
  new Response(JSON.stringify(v),{status:code});
(globalThis as any).fetch=async (uri:string,options?:RequestInit)=>{
  const u=new URL(uri),table=u.pathname.split("/").at(-1);
  const method=options?.method??"GET";
  if(method==="GET"){
    if(table==="aura_profiles")return response([]);
    const map=table==="aura_workouts"?remoteWork:remoteReady;
    const field=table==="aura_workouts"?"workout_id":"date_key";
    const id=u.searchParams.get(field);
    if(id?.startsWith("eq.")){
      targeted++;
      return response([...map.values()].filter((r:any)=>r[field]===id.slice(3)));
    }
    const sorted=[...map.values()].sort((a:any,b:any)=>
      table==="aura_workouts"?b.workout_date.localeCompare(a.workout_date):
        b.date_key.localeCompare(a.date_key));
    const start=Number(u.searchParams.get("offset")??0);
    return response(sorted.slice(start,start+Number(u.searchParams.get("limit")??100)));
  }
  if(method==="POST"&&accept){
    const rows=JSON.parse(String(options?.body));
    const list=Array.isArray(rows)?rows:[rows];
    for(const row of list){
      if(table==="aura_workouts")remoteWork.set(row.workout_id,row);
      if(table==="aura_readiness")remoteReady.set(row.date_key,row);
    }
  }
  return response(null,204);
};
let refused=false;
try{await runFullCloudSync();}catch{refused=true;}
ok(refused,"HTTP 204 cleared older local data without proof");
ok(data.loadHistory()[0]?.id===older.id,"local workout was destroyed");
ok(data.loadReadinessHistory()[0]?.dateKey===olderReady.dateKey,"local readiness was destroyed");
ok(ledger.pendingCloudChanges(uid)===2,"unverified pending entries were cleared");
accept=true;
await runFullCloudSync();
ok(remoteWork.has(older.id)&&remoteReady.has(olderReady.dateKey),
  "offline data were not uploaded before capped merge");
ok(targeted>=4,"evicted entries were not individually verified");
ok(ledger.pendingCloudChanges(uid)===0,"exact-row verification did not clear pending");
ok(data.loadHistory().length===500&&data.loadReadinessHistory().length===365,
  "recent working set not capped correctly");
console.log("Cloud overflow PASS: old unsynced local history retained until exact remote proof.");
