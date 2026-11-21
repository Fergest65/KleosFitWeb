(() => {
 const controls=document.querySelector('[data-txt-cloud]');
 const select=controls.querySelector('select'),status=controls.querySelector('[role="status"]');
 const refresh=controls.querySelector('[data-cloud-refresh]'),save=controls.querySelector('[data-cloud-save]');
 const editorMode=Boolean(save),limit=10*1024*1024,ownerKey='kleos-txt-offline-owner';
 let busy=false,selected='',available=new Map(),offline=new Map(),database,authBound=false;
 function report(text){status.textContent=text;}
 function cache(mode,operation){
  database??=new Promise((resolve,reject)=>{
   const request=indexedDB.open('kleos-txt-offline',1);
   request.onupgradeneeded=()=>request.result.createObjectStore('sheets');
   request.onsuccess=()=>resolve(request.result);
   request.onerror=()=>reject(request.error);
  });
  return database.then(db=>new Promise((resolve,reject)=>{
   const tx=db.transaction('sheets',mode),request=operation(tx.objectStore('sheets'));
   tx.oncomplete=()=>resolve(request.result);
   tx.onabort=()=>reject(tx.error||request.error);
   tx.onerror=()=>reject(tx.error||request.error);
  }));
 }
 async function storage(){
  if(editorMode&&window.supabase)db??=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
  const connection=editorMode?db:client;
  if(!connection||!navigator.onLine)throw Error('Connessione assente.');
  if(!authBound){
   authBound=true;
   connection.auth.onAuthStateChange(event=>{
    if(event==='SIGNED_OUT'){
     localStorage.removeItem(ownerKey);offline.clear();available.clear();draw();
    }
   });
  }
  const {data,error}=await connection.auth.getSession();
  if(error)throw error;
  if(!data.session){
   localStorage.removeItem(ownerKey);offline.clear();available.clear();draw();
   throw Error('Accedi come amministratore su Kleos.');
  }
  const owner=data.session.user.id;
  localStorage.setItem(ownerKey,owner);
  return {bucket:connection.storage.from('schede-txt'),owner};
 }
 async function readCache(owner){
  if(!owner)return new Map();
  const entries=await cache('readonly',store=>store.get(owner));
  return new Map(entries||[]);
 }
 function draw(){
  select.replaceChildren(new Option('Scegli scheda TXT',''));
  const names=[...available.keys()].sort((a,b)=>a.localeCompare(b,'it'));
  for(const name of names)select.add(new Option(name+(offline.has(name)?' · offline':''),name));
  select.value=available.has(selected)?selected:'';
 }
 async function download(bucket,name){
  const {data,error}=await bucket.download(name);
  if(error)throw error;
  return data;
 }
 async function sync(){
  try{offline=await readCache(localStorage.getItem(ownerKey));}catch{offline=new Map();}
  available=new Map(offline);draw();
  if(!navigator.onLine){
   report(offline.size?'Offline · '+offline.size+' schede disponibili.':'Offline · nessuna scheda sincronizzata su questo dispositivo.');
   return;
  }
  let connection;
  try{
   connection=await storage();
   try{offline=await readCache(connection.owner);}catch{offline=new Map();}
   const {bucket,owner}=connection,online=new Map();
   for(let offset=0;;offset+=100){
    const {data,error}=await bucket.list('',{limit:100,offset,sortBy:{column:'name',order:'asc'}});
    if(error)throw error;
    for(const f of data)if(f.id&&/.txt$/i.test(f.name))online.set(f.name,f);
    if(data.length<100)break;
   }
   if(localStorage.getItem(ownerKey)!==owner)return;
   available=online;draw();
   const next=new Map(),pending=[...online];
   let failed=0;
   const worker=async()=>{
    while(pending.length){
     const [name,file]=pending.shift(),version=file.updated_at||file.metadata?.eTag||null,previous=offline.get(name);
     if(version&&previous?.version===version){next.set(name,previous);continue;}
     try{next.set(name,{version,blob:await download(bucket,name)});}
     catch{failed++;if(previous)next.set(name,previous);}
    }
   };
   await Promise.all(Array.from({length:3},worker));
   if(localStorage.getItem(ownerKey)!==owner)return;
   await cache('readwrite',store=>store.put([...next],owner));
   offline=next;draw();
   report(failed?next.size+' schede disponibili offline. Aggiorna per riprovare la sincronizzazione.':next.size+' schede disponibili offline.');
  }catch(error){
   available=new Map(offline);draw();
   report((error.message||String(error))+(offline.size?' · '+offline.size+' schede offline disponibili.':''));
  }
 }
 async function action(work){
  if(busy)return;
  busy=true;refresh.disabled=true;if(save)save.disabled=true;
  try{await work();}catch(error){report(error.message||String(error));}
  finally{busy=false;refresh.disabled=false;if(save)save.disabled=!navigator.onLine;}
 }
 refresh.onclick=()=>action(sync);
 let openRequest=0;
 select.onchange=async()=>{
  const name=select.value,request=++openRequest;
  if(!name){selected='';return;}
  if(editorMode&&!replaceAllowed()){select.value=selected;return;}
  const stamp=editorMode?readRequest:monitorTxtRequest,initial=editorMode?editor.value:null;
  try{
   report('Apertura scheda…');
   let blob=offline.get(name)?.blob;
   if(!blob){
    const {bucket}=await storage();
    blob=await download(bucket,name);
   }
   if(request!==openRequest||(editorMode?(stamp!==readRequest||initial!==editor.value):stamp!==monitorTxtRequest))return;
   const file=new File([blob],name,{type:'text/plain'});
   if(editorMode)await openTxt({files:[file],value:''},true);
   else await loadMonitorTxt({files:[file],value:''});
   if(request===openRequest){selected=name;select.value=name;report(offline.has(name)?'Disponibile offline.':'Scheda aperta.');}
  }catch(error){if(request===openRequest){select.value=selected;report(error.message||String(error));}}
 };
 if(save)save.onclick=()=>action(async()=>{
  if(!editor.value.trim())throw Error('Inserisci il contenuto della scheda prima di salvare.');
  const name=safeTxtFilename(filename.value).normalize('NFKD').replace(/\p{M}/gu,'').replace(/[^a-zA-Z0-9_. -]/g,'-');
  const content=sheetTxtContent(),blob=new Blob(['\uFEFF'+content],{type:'text/plain'});
  if(blob.size>limit)throw Error('La scheda supera 10 MB.');
  const {bucket,owner}=await storage();
  let result=await bucket.upload(name,blob,{upsert:false,contentType:'text/plain'});
  if(result.error&&(/duplicate|already exists/i.test(result.error.message)||String(result.error.statusCode)==='409')){
   if(!confirm('Sostituire la scheda online «'+name+'»?')){report('Salvataggio annullato.');return;}
   result=await bucket.upload(name,blob,{upsert:true,contentType:'text/plain'});
  }
  if(result.error)throw result.error;
  if(sheetTxtContent()===content){dirty=false;filename.value=name;}
  selected=name;
  try{
   const cached=await readCache(owner);
   cached.set(name,{version:null,blob});
   await cache('readwrite',store=>store.put([...cached],owner));
  }catch{}
  await sync();
  report('Salvata su Supabase: '+name+(offline.has(name)?' · disponibile offline.':'.'));
 });
 window.addEventListener('online',()=>action(sync));
 window.addEventListener('offline',()=>{if(save)save.disabled=true;report('Offline · '+offline.size+' schede disponibili.');});
 if(save)save.disabled=!navigator.onLine;
 if('serviceWorker' in navigator&&location.protocol!=='file:')navigator.serviceWorker.register('./sw.js').catch(()=>{});
 refresh.click();
})();
