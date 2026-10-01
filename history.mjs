import {t,locale} from './i18n.mjs';
// Browser-local report history. IndexedDB on this device only: no server, no account.
// Every record is validated before it is stored, so imported files render like fresh reports.
import {parseURL} from './header-fetch.mjs';
const DB_NAME='trinity-check', STORE='runs', FORMAT='trinity-check-history';
export const MAX_IMPORT_BYTES=20*1024*1024, MAX_IMPORT_RUNS=5000;
const channel='BroadcastChannel' in globalThis?new BroadcastChannel('trinity-check-history'):null;
let opening=null, persistAsked=false;

function open(){
 opening??=new Promise((resolve,reject)=>{
  if(!globalThis.indexedDB)throw new Error(t('браузер не поддерживает IndexedDB'));
  const r=indexedDB.open(DB_NAME,1);
  r.onupgradeneeded=()=>r.result.createObjectStore(STORE,{keyPath:'id'});
  r.onsuccess=()=>{const db=r.result;db.onversionchange=()=>{db.close();opening=null;};resolve(db);};
  r.onerror=()=>reject(r.error||new Error(t('хранилище не открылось')));
  r.onblocked=()=>reject(new Error(t('закройте другие вкладки Trinity Check и повторите')));
 }).catch(e=>{opening=null;throw e;});
 return opening;
}
function request(mode,op){
 return open().then(db=>new Promise((resolve,reject)=>{
  const t=db.transaction(STORE,mode), r=op(t.objectStore(STORE));
  t.oncomplete=()=>resolve(r?.result);
  t.onerror=t.onabort=()=>reject(t.error||r?.error||new Error(t('ошибка хранилища')));
 }));
}
async function write(op){await request('readwrite',op);channel?.postMessage('changed');}

// cyrb53: a stable id, so saving or importing the same run twice keeps one record.
function hash(text){let h1=0xdeadbeef,h2=0x41c6ce57;for(let i=0;i<text.length;i++){const c=text.charCodeAt(i);h1=Math.imul(h1^c,2654435761);h2=Math.imul(h2^c,1597334677);}h1=Math.imul(h1^(h1>>>16),2246822507)^Math.imul(h2^(h2>>>13),3266489909);h2=Math.imul(h2^(h2>>>16),2246822507)^Math.imul(h1^(h1>>>13),3266489909);return (h2>>>0).toString(16).padStart(8,'0')+(h1>>>0).toString(16).padStart(8,'0');}
// A single run is keyed by its report, so a downloaded single-file JSON re-imports onto the same record.
export const runId=job=>{const r=job.mode==='single'?job.items[0].report:null;return 'r'+hash(JSON.stringify(r?['single',r.checked_at,r.url]:[job.started_at,job.mode,job.items.map(x=>x.input_url)]));};

const finished=new Set(['checked','error','cancelled']);
const isTime=v=>typeof v==='string'&&v.length<=40&&!Number.isNaN(Date.parse(v));
const isCount=v=>/^\d{1,20}$/.test(String(v));
const bad=(where,what)=>{throw new Error(`${where}: ${what}.`);};
function checkReport(r,where){
 if(!r||typeof r!=='object')bad(where,t('нет отчёта'));
 let href;try{href=parseURL(r.url).url.href;}catch{bad(where,t('ссылка не ведёт на GGUF в huggingface.co'));}
 if(href!==r.url)bad(where,t('ссылка изменена'));
 if(!/^[a-f0-9]{40}$/.test(r.revision))bad(where,t('нет коммита модели'));
 if(!isTime(r.checked_at))bad(where,t('нет времени проверки'));
 if(!isCount(r.bytes)||!isCount(r.fileSize)||typeof r.split!=='boolean')bad(where,t('нет размеров файла'));
 if(!Array.isArray(r.rows)||r.rows.length<3||r.rows.length>4)bad(where,t('нужны решения сред выполнения'));
 for(const row of r.rows){
  const w=row?.walk;
  if(typeof row?.name!=='string'||typeof w?.status!=='number'||typeof w.reader!=='number'||!isCount(w.ternary)||!isCount(w.ternary_ok))bad(where,t('повреждена строка среды выполнения'));
  if(row.model!==null&&(typeof row.model?.result!=='number'||typeof row.model.status!=='number'))bad(where,t('повреждено решение по метаданным'));
 }
}
function checkJob(job,where){
 if(!job||typeof job!=='object'||job.schema_version!==1)bad(where,t('неизвестный формат отчёта'));
 if(job.mode!=='single'&&job.mode!=='batch')bad(where,t('неизвестный режим'));
 if(!isTime(job.started_at))bad(where,t('нет времени запуска'));
 const items=job.items;
 if(!Array.isArray(items)||!items.length||items.length>(job.mode==='batch'?10:1))bad(where,t('неверное число файлов'));
 items.forEach((item,i)=>{
  const at=t`${where}, файл ${i+1}`;
  if(item?.index!==i+1||typeof item.input_url!=='string'||!item.input_url||item.input_url.length>40000||!finished.has(item.status))bad(at,t('повреждена запись'));
  if(item.error!==null&&typeof item.error!=='string')bad(at,t('повреждено сообщение об ошибке'));
  if(item.status==='checked')checkReport(item.report,at);else if(item.report!==null)bad(at,t('отчёт у непроверенного файла'));
 });
 const summary={total:items.length,checked:items.filter(x=>x.status==='checked').length,errors:items.filter(x=>x.status==='error').length,cancelled:items.filter(x=>x.status==='cancelled').length};
 if(!summary.checked)bad(where,t('нет ни одного проверенного файла'));
 return {...job,summary};
}
// A single-file report downloaded before the cabinet existed becomes a one-file run.
const singleJob=r=>({schema_version:1,mode:'single',started_at:r.checked_at,finished_at:r.checked_at,status:'completed',parser_sha256:r.parser_sha256,scope:r.scope,cancel_requested:false,items:[{index:1,input_url:r.url,status:'checked',report:r,error:null}]});

export const recordFor=(job,saved_at=new Date().toISOString())=>({id:runId(job),saved_at,job});
const byNewest=(a,b)=>b.job.started_at.localeCompare(a.job.started_at);
export const listRuns=()=>request('readonly',s=>s.getAll()).then(rows=>rows.sort(byNewest));
export const getRun=id=>request('readonly',s=>s.get(id));
export const deleteRun=id=>write(s=>s.delete(id));
export const clearRuns=()=>write(s=>s.clear());
export async function putRuns(records){
 const known=new Set(await request('readonly',s=>s.getAllKeys()));
 await write(s=>{for(const r of records)s.put(r);});
 return {added:records.filter(r=>!known.has(r.id)).length,total:records.length};
}
export async function saveRun(job){
 const record=recordFor(checkJob(structuredClone(job),t('Отчёт')));
 await write(s=>s.put(record));
 if(!persistAsked){persistAsked=true;navigator.storage?.persist?.().catch(()=>{});}
 return record;
}
export const onHistoryChange=fn=>channel?.addEventListener('message',fn);
export const exportHistory=runs=>({format:FORMAT,version:1,exported_at:new Date().toISOString(),runs});
export function parseImport(text){
 let data;try{data=JSON.parse(text);}catch{throw new Error(t('Файл не является JSON.'));}
 let entries;
 if(data?.format===FORMAT&&data.version===1&&Array.isArray(data.runs))entries=data.runs.map(r=>({job:r?.job,saved_at:r?.saved_at}));
 else if(Array.isArray(data?.items))entries=[{job:data}];
 else if(Array.isArray(data?.rows)&&typeof data.url==='string'&&isTime(data.checked_at))entries=[{job:singleJob(data)}];
 else throw new Error(t('Это не отчёт и не история Trinity Check.'));
 if(!entries.length)throw new Error(t('В файле нет отчётов.'));
 if(entries.length>MAX_IMPORT_RUNS)throw new Error(t`За один раз можно загрузить не больше ${MAX_IMPORT_RUNS} отчётов.`);
 const records=entries.map(({job,saved_at},i)=>recordFor(checkJob(job,entries.length>1?t`Отчёт ${i+1}`:t('Отчёт')),isTime(saved_at)?saved_at:undefined));
 return [...new Map(records.map(r=>[r.id,r])).values()];
}
