'use strict';
(function(root){
  function compose(payload){
    const css='<style>'+payload.css.replace(/<\/style/gi,'<\\/style')+'</style>';
    const scripts=payload.scripts.map((source,i)=>'<script>'+source.replace(/<\/script/gi,'<\\/script')+'\n//# sourceURL=oic-component-'+i+'.js\n</script>').join('');
    return payload.html.replace('</head>',()=>css+'</head>').replace('</body>',()=>'<script src="pdf-lib.min.js"></script>'+scripts+'<script src="chatgpt-bridge.js?v=8"></script></body>');
  }
  root.OfficeLoader={compose};
  if(!root.document)return;
  const doc=root.document,form=doc.getElementById('unlock'),button=doc.getElementById('open'),error=doc.getElementById('error'),key=doc.getElementById('key'),office=doc.getElementById('office');
  if('serviceWorker' in root.navigator)root.navigator.serviceWorker.register('sw.js?v=8').catch(()=>{});
  const setStatus=message=>{error.textContent=message;};
  async function label(){try{const p=await root.OfficeAuth.getProfile();doc.getElementById('key-label').textContent=p?'Contraseña de este navegador':'Clave privada de acceso';}catch(e){setStatus(e.message);}}
  root.OfficeAuth.onLocked=message=>{root.OfficeDownloads?.clear();office.srcdoc='';doc.body.classList.remove('open');button.disabled=false;key.value='';setStatus(message);label();};
  async function packet(){const r=await root.fetch('payload.bin?v=8',{cache:'no-cache'});if(!r.ok)throw Error('No se pudo cargar la Oficina. Comprueba la conexión inicial.');return new Uint8Array(await r.arrayBuffer());}
  form.addEventListener('submit',async e=>{
    e.preventDefault();button.disabled=true;setStatus('Comprobando y preparando la Oficina…');
    try{
      const {payload}=await root.OfficeAuth.unlock(key.value,await packet());key.value='';
      await new Promise((resolve,reject)=>{
        const timer=root.setTimeout(()=>reject(Error('La Oficina no terminó de cargar. Comprueba la conexión y vuelve a abrir.')),20000);
        office.onload=()=>{root.clearTimeout(timer);const w=office.contentWindow;
          const missing=['OfficeFiles','OfficeMotor','OfficeDeliverables','officeEngine'].filter(name=>!w[name]);
          if(missing.length)reject(Error('No se cargaron componentes de la Oficina: '+missing.join(', ')+'. Actualiza la página.'));else resolve();};
        office.srcdoc=compose(payload);
      });
      doc.body.classList.add('open');setStatus('');
    }catch(ex){setStatus(ex.message||'No se pudo abrir la Oficina.');button.disabled=false;}
  });
  doc.getElementById('restore-copy').addEventListener('click',async()=>{
    const f=doc.getElementById('vault-file').files[0];
    if(!f){setStatus('Selecciona una copia cifrada .oic.');return;}
    if(!key.value){setStatus('Escribe la contraseña con la que se protegió la copia.');return;}
    if(f.size>200000000){setStatus('La copia excede 200 MB.');return;}
    button.disabled=true;const restore=doc.getElementById('restore-copy');restore.disabled=true;
    try{const copy=JSON.parse(await f.text());const result=await root.OfficeAuth.restoreEncryptedBackup(copy,key.value);await label();setStatus('Copia restaurada: '+result.records+' registros. Pulsa «Abrir mi oficina» con la contraseña de la copia.');}
    catch(e){setStatus(e.message||'No se pudo leer la copia cifrada.');}
    finally{button.disabled=false;restore.disabled=false;}
  });
  label();
})(typeof window==='undefined'?globalThis:window);

