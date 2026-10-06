function database() {
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open('lot-rot-drafts',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('drafts');
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
}
export async function draft(action,key,value) {
  const db=await database();
  try { return await new Promise((resolve,reject)=>{
    const transaction=db.transaction('drafts',action==='get' ? 'readonly' : 'readwrite');
    const store=transaction.objectStore('drafts');
    const request=action==='get' ? store.get(key) : action==='delete' ? store.delete(key) : store.put(value,key);
    transaction.oncomplete=()=>resolve(request.result);
    transaction.onerror=()=>reject(transaction.error);
    transaction.onabort=()=>reject(transaction.error);
  }); } finally {db.close();}
}
