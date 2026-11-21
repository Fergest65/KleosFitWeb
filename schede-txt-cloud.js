(() => {
 const limit=10*1024*1024;
 const controls=document.querySelector('[data-txt-cloud]');
 const select=controls.querySelector('select'),status=controls.querySelector('[role="status"]');
 const refresh=controls.querySelector('[data-cloud-refresh]'),save=controls.querySelector('[data-cloud-save]');
 const editorMode=Boolean(save);
 let busy=false,selectedKey='';
 function report(text){status.textContent=text;}
 async function storage(){
  if(editorMode){
   if(!window.supabase)throw Error('Supabase non disponibile.');
   db??=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
  }
  const supabaseClient=editorMode?db:client;
  const {data,error}=await supabaseClient.auth.getSession();
  if(error)throw error;
  if(!data.session)throw Error('Accedi come amministratore su Kleos per usare le schede online.');
  return supabaseClient.storage.from('schede-txt');
 }
 async function list(preferred=''){
  const bucket=await storage(),files=[];
  for(let offset=0;;offset+=100){
   const {data,error}=await bucket.list('',{limit:100,offset,sortBy:{column:'name',order:'asc'}});
   if(error)throw error;
   files.push(...data.filter(item=>item.id&&/\.txt$/i.test(item.name)));
   if(data.length<100)break;
  }
  select.replaceChildren(new Option('Scegli scheda online',''));
  for(const file of files)select.add(new Option(file.name,file.name));
  select.value=files.some(file=>file.name===preferred)?preferred:'';
  selectedKey=select.value;
  report(files.length?'':'Nessuna scheda online disponibile.');
 }
 async function action(work){
  if(busy)return;
  busy=true;select.disabled=refresh.disabled=true;if(save)save.disabled=true;
  try{await work();}
  catch(error){report(error.message||String(error));}
  finally{busy=false;select.disabled=refresh.disabled=false;if(save)save.disabled=false;}
 }
 refresh.onclick=()=>action(async()=>{report('Caricamento elenco…');await list(selectedKey);});
 select.onchange=()=>{
  const name=select.value;
  if(!name){selectedKey='';return;}
  action(async()=>{
   const previous=selectedKey;
   try{
    if(editorMode&&!replaceAllowed()){select.value=previous;return;}
    const stamp=editorMode?readRequest:monitorTxtRequest;
    const initialText=editorMode?editor.value:null;
    report('Apertura scheda…');
    const bucket=await storage(),{data,error}=await bucket.download(name);
    if(error)throw error;
    if(editorMode?(readRequest!==stamp||editor.value!==initialText):monitorTxtRequest!==stamp){
     select.value=previous;report('È stata aperta o modificata un’altra scheda.');return;
    }
    const input={files:[new File([data],name,{type:'text/plain'})],value:''};
    if(editorMode)await openTxt(input,true);else await loadMonitorTxt(input);
    selectedKey=name;report('');
   }catch(error){select.value=previous;throw error;}
  });
 };
 if(save)save.onclick=()=>action(async()=>{
  if(!editor.value.trim())throw Error('Inserisci il contenuto della scheda prima di salvare.');
  const name=safeTxtFilename(filename.value).normalize('NFKD').replace(/\p{M}/gu,'').replace(/[^a-zA-Z0-9_. -]/g,'-');
  const content=sheetTxtContent();
  const blob=new Blob(['\uFEFF'+content],{type:'text/plain'});
  if(blob.size>limit)throw Error('La scheda supera 10 MB.');
  const bucket=await storage();
  let result=await bucket.upload(name,blob,{upsert:false,contentType:'text/plain'});
  if(result.error&&(/duplicate|already exists/i.test(result.error.message)||String(result.error.statusCode)==='409')){
   if(!confirm('Sostituire la scheda online «'+name+'»?')){report('Salvataggio annullato.');return;}
   result=await bucket.upload(name,blob,{upsert:true,contentType:'text/plain'});
  }
  if(result.error)throw result.error;
  if(sheetTxtContent()===content){dirty=false;filename.value=name;}
  try{await list(name);report('Salvata online: '+name);}
  catch{report('Salvata online: '+name+'. Premi Aggiorna per ricaricare l’elenco.');}
 });
 if(editorMode)refresh.click();
 else document.getElementById('monitorTxtToggle').addEventListener('click',()=>{
  if(!document.getElementById('monitorTxtPane').hidden&&!select.options[1])refresh.click();
 });
})();