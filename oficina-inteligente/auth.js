'use strict';
(function (root) {
  const DB = 'oficina-inteligente-cuba-cifrada-v1';
  const ITERATIONS = 350000;
  const AUTH_AAD = new TextEncoder().encode('OIC-AUTH-1');
  const PAYLOAD_AAD = new TextEncoder().encode('OIC2026');
  const enc = new TextEncoder(), dec = new TextDecoder();
  let dbPromise, session = null;
  const sessionId = root.crypto.randomUUID();
  const channel = typeof root.BroadcastChannel === 'function' && root.document
    ? new root.BroadcastChannel('oficina-inteligente-credenciales-v1') : null;
  const bytes = value => value instanceof Uint8Array ? value : new Uint8Array(value);
  const to64 = value => { let s = ''; for (const b of bytes(value)) s += String.fromCharCode(b); return btoa(s); };
  const from64 = value => Uint8Array.from(atob(value), c => c.charCodeAt(0));
  const same = (a, b) => { a = bytes(a); b = bytes(b); return a.length === b.length && a.every((v, i) => v === b[i]); };
  const stale = () => Error('La contraseña cambió en otra pestaña. Vuelve a entrar en la Oficina.');
  function request(r) { return new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); }); }
  function completed(tx) { return new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onabort = () => reject(tx.error || Error('No se pudo guardar el cambio. La contraseña anterior se conserva.')); tx.onerror = () => {}; }); }
  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const r = root.indexedDB.open(DB, 2);
      r.onupgradeneeded = () => {
        const db = r.result;
        if (!db.objectStoreNames.contains('records')) db.createObjectStore('records', {keyPath:'id'});
        if (!db.objectStoreNames.contains('audit')) db.createObjectStore('audit', {keyPath:'seq', autoIncrement:true});
        if (!db.objectStoreNames.contains('auth')) db.createObjectStore('auth', {keyPath:'id'});
      };
      r.onsuccess = () => { const db = r.result; db.onversionchange = () => { db.close(); dbPromise = null; }; resolve(db); };
      r.onerror = () => { dbPromise = null; reject(Error('No se puede abrir el almacenamiento privado. Permite guardar datos en este navegador.')); };
      r.onblocked = () => { dbPromise = null; reject(Error('Cierra las otras pestañas de la Oficina y vuelve a abrirla para actualizar el almacenamiento.')); };
    });
    return dbPromise;
  }
  async function getProfile() {
    const db = await openDB(), tx = db.transaction('auth');
    return request(tx.objectStore('auth').get('credential'));
  }
  function parsePacket(value) {
    const b = bytes(value);
    if (b.length < 51 || dec.decode(b.slice(0, 7)) !== 'OIC2026') throw Error('Paquete de Oficina no válido.');
    return {bytes:b, salt:b.slice(7, 23), iv:b.slice(23, 35), cipher:b.slice(35)};
  }
  async function derive(password, salt, extractable = false) {
    const material = await root.crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
    return root.crypto.subtle.deriveKey({name:'PBKDF2', salt, iterations:ITERATIONS, hash:'SHA-256'}, material, {name:'AES-GCM', length:256}, extractable, ['encrypt','decrypt']);
  }
  async function decryptMaterial(password, profile, packet) {
    if (typeof password !== 'string' || !password) throw Error('Escribe la contraseña actual.');
    if (!profile) {
      const contentKey = await derive(password.trim(), packet.salt, true);
      try { await root.crypto.subtle.decrypt({name:'AES-GCM', iv:packet.iv, additionalData:PAYLOAD_AAD}, contentKey, packet.cipher); }
      catch { throw Error('Contraseña actual incorrecta.'); }
      return {dataKey:contentKey, contentKey};
    }
    if (profile.id !== 'credential' || profile.schema !== 'OIC-AUTH-1' || profile.iterations !== ITERATIONS) throw Error('Credencial local no reconocida. Restaura una copia cifrada válida.');
    let plain;
    try {
      const kek = await derive(password, from64(profile.salt));
      plain = new Uint8Array(await root.crypto.subtle.decrypt({name:'AES-GCM', iv:from64(profile.iv), additionalData:AUTH_AAD}, kek, from64(profile.cipher)));
      const value = JSON.parse(dec.decode(plain));
      if (value.schema !== 'OIC-AUTH-1' || value.revision !== profile.revision || value.payloadSalt !== to64(packet.salt)) throw Error('Credencial incompatible.');
      const dataRaw = from64(value.dataKey), contentRaw = from64(value.contentKey);
      if (dataRaw.length !== 32 || contentRaw.length !== 32) throw Error('Credencial inválida.');
      const dataKey = await root.crypto.subtle.importKey('raw', dataRaw, 'AES-GCM', false, ['encrypt','decrypt']);
      const contentKey = await root.crypto.subtle.importKey('raw', contentRaw, 'AES-GCM', true, ['encrypt','decrypt']);
      dataRaw.fill(0); contentRaw.fill(0);
      return {dataKey, contentKey};
    } catch { throw Error('Contraseña actual incorrecta o credencial local dañada.'); }
    finally { plain?.fill(0); }
  }
  async function unlock(password, value) {
    const packet = parsePacket(value), profile = await getProfile();
    const material = await decryptMaterial(password, profile, packet);
    const raw = await root.crypto.subtle.decrypt({name:'AES-GCM', iv:packet.iv, additionalData:PAYLOAD_AAD}, material.contentKey, packet.cipher);
    const payload = JSON.parse(dec.decode(raw));
    if (typeof payload.html !== 'string' || typeof payload.css !== 'string' || !Array.isArray(payload.scripts)) throw Error('Contenido de Oficina no válido.');
    session = {...material, packet, revision:profile?.revision || 'legacy'};
    root.__officeKey = material.dataKey;
    return {payload, revision:session.revision};
  }
  function getRevision() { if (!session) throw Error('Desbloquea la Oficina.'); return session.revision; }
  function assertRevision(profile, revision) { if ((profile?.revision || 'legacy') !== revision) throw stale(); }
  async function readSnapshot(db) {
    const tx = db.transaction(['records','audit','auth']), done = completed(tx);
    const [records, audit, credential] = await Promise.all([
      request(tx.objectStore('records').getAll()), request(tx.objectStore('audit').getAll()), request(tx.objectStore('auth').get('credential'))
    ]);
    await done;
    return {records, audit, credential};
  }
  function rowsEqual(a, b, key) {
    return a.length === b.length && a.every((r, i) => r[key] === b[i][key] && same(r.iv, b[i].iv) && same(r.data, b[i].data));
  }
  async function writeSnapshot(db, before, after) {
    let conflict;
    const tx = db.transaction(['records','audit','auth'], 'readwrite'), done = completed(tx);
    const rs = tx.objectStore('records'), as = tx.objectStore('audit'), au = tx.objectStore('auth');
    const [r, a, c] = await Promise.all([request(rs.getAll()), request(as.getAll()), request(au.get('credential'))]);
    if ((c?.revision || 'legacy') !== (before.credential?.revision || 'legacy') || !rowsEqual(r, before.records, 'id') || !rowsEqual(a, before.audit, 'seq')) {
      conflict = Error('Los datos cambiaron durante el cambio de contraseña. Se conserva la contraseña anterior. Cierra las otras pestañas y repite.');
      tx.abort();
    } else {
      try {
        for (const row of after.records) rs.put(row);
        for (const row of after.audit) as.put(row);
        if(after.credential)au.put(after.credential);
      } catch(error) { conflict=error; try { tx.abort(); } catch {} }
    }
    try { await done; } catch (e) { throw conflict || e; }
  }
  function validateChange(p) {
    if (typeof p.current !== 'string' || !p.current) throw Error('Escribe la contraseña actual.');
    if (typeof p.next !== 'string' || p.next.length < 12 || p.next.length > 128) throw Error('La nueva contraseña debe tener entre 12 y 128 caracteres.');
    if (p.next !== p.next.trim()) throw Error('La nueva contraseña no puede empezar ni terminar con espacios.');
    if (p.next !== p.confirm) throw Error('La confirmación no coincide con la nueva contraseña.');
    if (p.next === p.current || p.next === p.current.trim()) throw Error('La nueva contraseña debe ser distinta de la actual.');
  }
  async function changePassword(p, store) {
    validateChange(p);
    if (!session) throw Error('Desbloquea la Oficina para cambiar la contraseña.');
    const db = await store.ready, before = await readSnapshot(db);
    assertRevision(before.credential, store.revision);
    const material = await decryptMaterial(p.current, before.credential, session.packet);
    const generated = await root.crypto.subtle.generateKey({name:'AES-GCM', length:256}, true, ['encrypt','decrypt']);
    const dataRaw = new Uint8Array(await root.crypto.subtle.exportKey('raw', generated));
    const contentRaw = new Uint8Array(await root.crypto.subtle.exportKey('raw', material.contentKey));
    const dataKey = await root.crypto.subtle.importKey('raw', dataRaw, 'AES-GCM', false, ['encrypt','decrypt']);
    const rotate = async (row, keyName) => {
      let plain;
      try {
        plain = new Uint8Array(await root.crypto.subtle.decrypt({name:'AES-GCM', iv:bytes(row.iv)}, material.dataKey, row.data));
        const iv = root.crypto.getRandomValues(new Uint8Array(12));
        const data = await root.crypto.subtle.encrypt({name:'AES-GCM', iv}, dataKey, plain);
        return {[keyName]:row[keyName], iv, data};
      } catch { throw Error('Hay un registro que no se puede descifrar. No se cambió la contraseña ni los datos.'); }
      finally { plain?.fill(0); }
    };
    let after;
    try {
      const revision = root.crypto.randomUUID(), salt = root.crypto.getRandomValues(new Uint8Array(16)), iv = root.crypto.getRandomValues(new Uint8Array(12));
      const value = enc.encode(JSON.stringify({schema:'OIC-AUTH-1', revision, dataKey:to64(dataRaw), contentKey:to64(contentRaw), payloadSalt:to64(session.packet.salt)}));
      const kek = await derive(p.next, salt), cipher = await root.crypto.subtle.encrypt({name:'AES-GCM', iv, additionalData:AUTH_AAD}, kek, value);
      value.fill(0);
      after = {records:await Promise.all(before.records.map(r => rotate(r, 'id'))), audit:await Promise.all(before.audit.map(r => rotate(r, 'seq'))),
        credential:{id:'credential', schema:'OIC-AUTH-1', revision, iterations:ITERATIONS, salt:to64(salt), iv:to64(iv), cipher:to64(cipher), changed_at:new Date().toISOString()}};
      await writeSnapshot(db, before, after);
    } finally { dataRaw.fill(0); contentRaw.fill(0); }
    store.key = dataKey; store.revision = after.credential.revision;
    session = {...session, dataKey, revision:after.credential.revision}; root.__officeKey = dataKey;
    channel?.postMessage({type:'password-changed', source:sessionId, revision:session.revision});
    return {changed:true, message:'Contraseña cambiada. Los expedientes y el registro de operaciones se conservaron. Usa la nueva contraseña en este navegador.'};
  }
  async function encryptedBackup(store) {
    if (!session) throw Error('Desbloquea la Oficina.');
    const snapshot = await readSnapshot(await store.ready);
    assertRevision(snapshot.credential, store.revision);
    return {schema:'OIC-VAULT-1', exported_at:new Date().toISOString(), packet:to64(session.packet.bytes), credential:snapshot.credential || null,
      records:snapshot.records.map(r=>({id:r.id, iv:to64(r.iv), data:to64(r.data)})), audit:snapshot.audit.map(r=>({seq:r.seq, iv:to64(r.iv), data:to64(r.data)}))};
  }
  async function restoreEncryptedBackup(copy, password) {
    if (copy?.schema !== 'OIC-VAULT-1' || !Array.isArray(copy.records) || !Array.isArray(copy.audit) || copy.records.length > 50000 || copy.audit.length > 100000) throw Error('Copia cifrada no reconocida.');
    const packet = parsePacket(from64(copy.packet)), material = await decryptMaterial(password, copy.credential, packet);
    await root.crypto.subtle.decrypt({name:'AES-GCM', iv:packet.iv, additionalData:PAYLOAD_AAD}, material.contentKey, packet.cipher);
    const validateRows = async (rows, key) => {
      const ids = new Set();
      return Promise.all(rows.map(async r=>{if (!r[key] || ids.has(r[key])) throw Error('La copia contiene identificadores inválidos o repetidos.'); ids.add(r[key]);
        const iv=from64(r.iv), data=from64(r.data); if(iv.length!==12 || data.length<16)throw Error('Registro cifrado inválido.');
        const plain=await root.crypto.subtle.decrypt({name:'AES-GCM',iv},material.dataKey,data); const value=JSON.parse(dec.decode(plain));
        if(key==='id' && value.id!==r.id)throw Error('Identificador de registro inconsistente.');return {[key]:r[key],iv,data};}));
    };
    const records=await validateRows(copy.records,'id'), audit=await validateRows(copy.audit,'seq'), db=await openDB();
    const tx=db.transaction(['records','audit','auth'],'readwrite'),done=completed(tx);
    const rs=tx.objectStore('records'),as=tx.objectStore('audit'),au=tx.objectStore('auth');
    const [nr,na,credential]=await Promise.all([request(rs.count()),request(as.count()),request(au.get('credential'))]);
    let conflict;
    if(nr || na || credential){conflict=Error('Este navegador ya contiene una Oficina. Restaura la copia en un navegador o perfil vacío para conservar los datos existentes.');tx.abort();}
    else {records.forEach(r=>rs.put(r));audit.forEach(r=>as.put(r));if(copy.credential)au.put(copy.credential);}
    try{await done;}catch(e){throw conflict||e;}
    return {restored:true,records:records.length,audit:audit.length};
  }
  if(channel)channel.onmessage=e=>{if(e.data?.type==='password-changed' && e.data.source!==sessionId && session && e.data.revision!==session.revision){session=null;delete root.__officeKey;root.OfficeAuth.onLocked?.('La contraseña cambió en otra pestaña. Vuelve a entrar con la nueva contraseña.');}};
  root.OfficeAuth = {openDB,getProfile,unlock,getRevision,assertRevision,changePassword,encryptedBackup,restoreEncryptedBackup,parsePacket,readSnapshot,writeSnapshot,validateChange,derive,onLocked:null};
})(typeof window === 'undefined' ? globalThis : window);
