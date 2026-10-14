'use strict';
(function(root){
  const entries=[];
  let panel;
  function remove(entry){root.clearTimeout(entry.timer);root.URL.revokeObjectURL(entry.url);entry.row.remove();const i=entries.indexOf(entry);if(i>=0)entries.splice(i,1);if(!entries.length){panel?.remove();panel=null;}}
  function clear(){for(const entry of [...entries])remove(entry);}
  function save(data,type,name){
    if(!panel){panel=root.document.createElement('section');panel.setAttribute('aria-label','Archivos preparados');panel.style.cssText='position:fixed;right:16px;bottom:16px;z-index:10000;max-width:min(440px,calc(100vw - 32px));max-height:45vh;overflow:auto;padding:16px;background:#fff;color:#092f3d;border:2px solid #c78645;border-radius:12px;box-shadow:0 8px 24px #0003;font:14px/1.4 Arial,sans-serif';const title=root.document.createElement('p');title.textContent='Archivo preparado. Si la descarga no comenzó, pulsa su enlace.';title.setAttribute('role','status');title.style.cssText='color:#092f3d;margin:0 0 8px';panel.append(title);root.document.body.append(panel);}
    const url=root.URL.createObjectURL(data instanceof root.Blob?data:new root.Blob([data],{type})),row=root.document.createElement('div'),link=root.document.createElement('a'),close=root.document.createElement('button'),entry={url,row,timer:null};
    row.style.cssText='display:flex;align-items:center;gap:10px;margin-top:8px';link.href=url;link.download=name;link.textContent='Descargar '+name;link.style.cssText='color:#075c80;display:block;padding:10px;overflow-wrap:anywhere;flex:1';close.type='button';close.textContent='×';close.setAttribute('aria-label','Quitar '+name);close.style.cssText='width:40px;min-width:40px;padding:8px;margin:0;background:#eef3f4;color:#092f3d';close.onclick=()=>remove(entry);row.append(link,close);panel.append(row);entries.push(entry);entry.timer=root.setTimeout(()=>remove(entry),600000);while(entries.length>5)remove(entries[0]);link.click();return {name,type};
  }
  root.OfficeDownloads={save,clear};
})(window);
