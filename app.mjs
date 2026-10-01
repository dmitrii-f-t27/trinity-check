import {t,locale,localizedHref} from './i18n.mjs';
// Trinity Check presentation layer. Parser verdicts come from the upstream t27 WASM.
import {parseURL} from './header-fetch.mjs';
import {statusText,states,node,verdict,filename,when,download} from './report-view.mjs';
import {saveRun,getRun} from './history.mjs';
const $ = id => document.getElementById(id);
const exampleURL='https://huggingface.co/prism-ml/Ternary-Bonsai-2-27B-gguf/resolve/b072e1d3b35a0a630cece372c2127528e0994386/Ternary-Bonsai-2-27B-PTQ1_0.gguf';
const parserSHA='2a3d397991ab3fd6aa29ea2b9ad153ece90aa6fe6acf4410392fb90d6ecf1452';
const serial = value => JSON.parse(JSON.stringify(value,(_,v)=>typeof v==='bigint'?v.toString():v));
let worker, report, rejectRun, job;
let mode='single', active=false;
// The motion layer (motion.mjs) mirrors the check on its scan stage.
const signal=(name,detail)=>dispatchEvent(new CustomEvent(`tc:${name}`,{detail}));
function status(text,kind=''){ $('state').textContent=text;$('status-line').className=`status-line ${kind}`; }
function setBusy(value){active=value;$('language').disabled=value;$('go').disabled=value;$('cancel').hidden=!value;$('example').disabled=value;$('mode-single').disabled=value;$('mode-batch').disabled=value;$('url').disabled=value||mode==='batch';$('urls').disabled=value||mode==='single';$('download-batch').disabled=value||!job;}
function setMode(value,clear=true){
 if(active)return;mode=value;
 $('mode-single').setAttribute('aria-pressed',String(value==='single'));$('mode-batch').setAttribute('aria-pressed',String(value==='batch'));
 $('single-field').hidden=value==='batch';$('batch-field').hidden=value==='single';$('url').required=value==='single';$('urls').required=value==='batch';
 $('go').textContent=value==='batch'?t('Проверить пакет'):t('Проверить заголовок');$('example').textContent=value==='batch'?t('Подставить два примера'):t('Подставить пример Bonsai');$('checker-title').textContent=value==='batch'?t('Выберите модели'):t('Выберите модель');
 if(clear){job=null;report=null;$('batch-results').hidden=true;$('results').hidden=true;$('saved-note').hidden=true;status(t('Готово к проверке. Результатов пока нет.'));}setBusy(false);
}
function cancel(){if(!active)return;job.cancel_requested=true;rejectRun?.();}
function friendlyError(message){
 if(/public HTTPS|GGUF \/resolve\//.test(message))return t('Используйте публичную HTTPS-ссылку на huggingface.co с /resolve/ и расширением .gguf.');
 if(/Invalid URL/.test(message))return t('Введите полную ссылку, начинающуюся с https://huggingface.co/.');
 if(/Failed to fetch|NetworkError|Load failed/.test(message))return t('Не удалось прочитать файл. Проверьте доступность модели и интернет-соединение. Для браузера сервер должен разрешать чтение диапазонов через CORS.');
 if(/abort|timeout/i.test(message))return t('Сервер не ответил вовремя. Повторите проверку.');
 return t`Проверка не завершена. ${message}`;
}
function render(result){
 const meta=$('file-meta');meta.replaceChildren();
 const link=node('a',decodeURIComponent(new URL(result.url).pathname.split('/').at(-1)));link.href=result.url;link.target='_blank';link.rel='noopener';meta.append(link);
 meta.append(node('p',t`Прочитано ${Number(result.bytes).toLocaleString(locale)} байт из ${BigInt(result.fileSize).toLocaleString(locale)}. Коммит: ${result.revision.slice(0,12)}.`));
 if(result.split)meta.append(node('p',t('Выбрана одна часть разделённой модели. Общая совместимость комплекта не определена.')));
 const table=node('table','','result-table');
 const caption=node('caption',t('Отчёт по заголовку'),'sr-only');table.append(caption);
 const head=node('thead',''),header=node('tr','');
 const labels=[t('Среда выполнения'),t('Результат'),t('Заголовок'),t('Метаданные'),t('Троичные записи')];
 for(const label of labels){const th=node('th',label);th.scope='col';header.append(th);}head.append(header);table.append(head);
 const body=node('tbody','');
 for(const row of result.rows){
  const {name,walk,model}=row,tr=node('tr',''),runtime=node('th',name);runtime.scope='row';tr.append(runtime);
  const v=verdict(row,result.split),decision=node('td','');decision.dataset.label=labels[1];decision.append(node('span',v.text,`verdict ${v.kind}`));tr.append(decision);
  const values=[statusText(walk.status),result.split?t('Нужны остальные части'):model?.result===2?t('Вращение игнорируется'):statusText(model?.status??walk.reader),t`${walk.ternary_ok.toString()} подходящих из ${walk.ternary.toString()} встреченных`];
  values.forEach((value,i)=>{const td=node('td',value);td.dataset.label=labels[i+2];tr.append(td);});body.append(tr);
 }
 table.append(body);$('out').replaceChildren(table);
 $('results').hidden=false;
}
const scope='GGUF header and metadata only; not a guarantee of successful inference';
const maxBatch=10;
function counts(){return {total:job.items.length,checked:job.items.filter(x=>x.status==='checked').length,errors:job.items.filter(x=>x.status==='error').length,cancelled:job.items.filter(x=>x.status==='cancelled').length};}
function renderBatch(){
 const c=counts();$('batch-summary').textContent=t`Всего: ${c.total} · Проверено: ${c.checked} · Ошибок: ${c.errors} · Отменено: ${c.cancelled}`;
 $('batch-progress').max=c.total;$('batch-progress').value=c.checked+c.errors+c.cancelled;
 const list=$('batch-list');list.replaceChildren();
 for(const item of job.items){
  const card=node('article','', 'batch-item');const top=node('div','', 'batch-item-top');
  top.append(node('h3',`${item.index}. ${filename(item.input_url)}`,'batch-name'),node('span',states[item.status],`batch-state ${item.status}`));card.append(top);
  const identity=item.report?.url||item.input_url;card.append(node('p',identity,'batch-input'));
  if(item.error)card.append(node('p',item.error,'batch-error'));
  if(item.report){
   const grid=node('div','', 'batch-runtime-grid');
   for(const row of item.report.rows){const cell=node('div','', 'batch-runtime');const v=verdict(row,item.report.split);const badge=node('span',v.text,`verdict ${v.kind}`);badge.title=t`Заголовок: ${statusText(row.walk.status)}. Метаданные: ${statusText(row.model?.status??row.walk.reader)}`;cell.append(node('b',row.name),badge);grid.append(cell);}card.append(grid);
   const detail=node('button',t('Подробный отчёт'),'text-button');detail.type='button';detail.setAttribute('aria-label',t`Подробный отчёт: файл ${item.index}`);detail.onclick=()=>{report=item.report;render(report);$('results').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});};card.append(detail);
  }
  list.append(card);
 }
}
async function inspectFile(input,onProgress){
 const url=parseURL(input.trim()).url.href;
 return new Promise((resolve,reject)=>{
  const w=new Worker(new URL('./check-worker.mjs',import.meta.url),{type:'module'});worker=w;let settled=false;
  function finish(error,result){if(settled)return;settled=true;w.terminate();if(worker===w)worker=null;rejectRun=null;if(error)reject(error);else resolve(result);}
  rejectRun=()=>finish(new DOMException(t('Проверка остановлена.'),'AbortError'));
  w.onmessage=({data})=>{if(settled)return;if(data.type==='progress'){onProgress(data.bytes);return;}if(data.type==='error'){finish(new Error(data.message));return;}if(data.type==='result')finish(null,serial({checked_at:new Date().toISOString(),parser_sha256:parserSHA,scope,...data.result}));};
  w.onerror=e=>finish(new Error(e.message||t('Проверяющее ядро не запустилось.')));
  try{w.postMessage({url});}catch(e){finish(e);}
 });
}
async function run(inputs,batch){
 if(active)throw new Error(t('Дождитесь завершения текущей проверки или остановите её.'));
 report=null;job=null;$('results').hidden=true;$('batch-results').hidden=true;$('download-batch').disabled=true;$('saved-note').hidden=true;
 if(location.hash)history.replaceState(null,'',location.pathname+location.search);
 if(!Array.isArray(inputs)||!inputs.length||inputs.length>(batch?maxBatch:1)||inputs.some(x=>typeof x!=='string'||!x.trim()||x.length>40000))throw new Error(t`Введите от 1 до ${batch?maxBatch:1} ссылок — по одной на строку.`);
 setMode(batch?'batch':'single',false);
 if(batch)$('urls').value=inputs.join('\n');else $('url').value=inputs[0];
 report=null;$('results').hidden=true;$('out').replaceChildren();
 job={schema_version:1,mode:batch?'batch':'single',started_at:new Date().toISOString(),finished_at:null,status:'running',parser_sha256:parserSHA,scope,cancel_requested:false,items:inputs.map((url,i)=>({index:i+1,input_url:url.trim(),status:'pending',report:null,error:null}))};
 $('batch-results').hidden=!batch;setBusy(true);if(batch)renderBatch();
 try{
  for(const item of job.items){
   if(job.cancel_requested)break;
   item.status='checking';if(batch)renderBatch();const prefix=batch?t`Файл ${item.index} из ${job.items.length}. `:'';status(t`${prefix}Определяем версию файла и загружаем проверяющее ядро…`,'busy');
   signal('start',{url:item.input_url,index:item.index,total:job.items.length});
   try{item.report=await inspectFile(item.input_url,bytes=>{status(t`${prefix}Читаем заголовок: ${bytes.toLocaleString(locale)} байт…`,'busy');signal('progress',{bytes});});item.status='checked';signal('done',{report:item.report});if(!batch){report=item.report;render(report);}}
   catch(e){if(job.cancel_requested){item.status='cancelled';signal('error',{message:t('Проверка остановлена.')});}else{item.status='error';item.error=friendlyError(e.message||String(e));signal('error',{message:item.error});}}
   if(batch)renderBatch();
  }
 }finally{
  for(const item of job.items)if(item.status==='pending'||item.status==='checking')item.status='cancelled';
  job.finished_at=new Date().toISOString();job.status=job.cancel_requested?'cancelled':'completed';job.summary=counts();setBusy(false);if(batch)renderBatch();
  const c=job.summary;
  if(job.cancel_requested)status(t('Проверка остановлена. Полученные результаты сохранены в отчёте.'));
  else if(!batch&&c.errors)status(job.items[0].error,'error');
  else if(batch)status(t`Пакет завершён. Проверено: ${c.checked} из ${c.total}; ошибок: ${c.errors}. Общий отчёт готов к скачиванию.`,c.errors?'':'done');
  else status(t('Проверка завершена. Ниже — решения по заголовку и метаданным.'),'done');
  if(c.checked)remember(job);
 }
 return job;
}
function savedNote(kind,...content){const note=$('saved-note');note.className=`saved-note ${kind}`;note.replaceChildren(...content);note.hidden=false;}
function remember(done){
 saveRun(done).then(()=>{if(job!==done)return;const link=node('a',t('Открыть кабинет'));link.href=localizedHref('cabinet.html');savedNote('',t("Отчёт сохранён в кабинете этого браузера. "),link);})
 .catch(e=>{if(job===done)savedNote('error',t`Отчёт не сохранён в истории: ${e.message}. Скачайте JSON, чтобы не потерять результат.`);});
}
// Cabinet links: #run=<id> opens a saved report, #rerun=<id> fills the form with its links.
async function openFromHash(){
 const m=/^#(run|rerun)=(r[a-f0-9]{16})$/.exec(location.hash);if(!m||active)return;
 let record;try{record=await getRun(m[2]);}catch(e){status(t`История недоступна: ${e.message}.`,'error');return;}
 if(!record){status(t('Этот отчёт не найден в истории браузера. Возможно, он удалён.'),'error');return;}
 if(active)return;
 const saved=record.job,batch=saved.mode==='batch',urls=saved.items.map(x=>x.input_url);
 setMode(batch?'batch':'single');
 if(batch)$('urls').value=urls.join('\n');else $('url').value=urls[0];
 if(m[1]==='rerun'){status(t`Ссылки из проверки от ${when(saved.started_at)} подставлены. Нажмите «${$('go').textContent}».`);$('go').focus();return;}
 job=saved;
 if(batch){$('batch-results').hidden=false;renderBatch();$('download-batch').disabled=false;}
 else{report=saved.items[0].report;render(report);}
 status(t`Открыт сохранённый отчёт от ${when(saved.started_at)}.`,'done');
 $(batch?'batch-results':'results').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
}
$('check-form').addEventListener('submit',e=>{e.preventDefault();const inputs=mode==='batch'?$('urls').value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean):[$('url').value];run(inputs,mode==='batch').catch(e=>status(e.message,'error'));});
$('mode-single').onclick=()=>setMode('single');$('mode-batch').onclick=()=>setMode('batch');
$('cancel').addEventListener('click',cancel);
$('example').addEventListener('click',()=>{if(mode==='batch'){$('urls').value=[exampleURL,exampleURL.replace('-PTQ1_0.gguf','-PQ2_0.gguf')].join('\n');$('urls').focus();status(t('Два примера подставлены. Нажмите «Проверить пакет».'));}else{$('url').value=exampleURL;$('url').focus();status(t('Пример подставлен. Нажмите «Проверить заголовок».'));}});
$('download').addEventListener('click',()=>download(report,'trinity-check-report.json'));
$('download-batch').addEventListener('click',()=>{if(!active)download(job,'trinity-check-batch-report.json');});
window.addEventListener('pagehide',cancel);
// Preserve the current form and completed result when changing UI language.
const draftKey='trinity-check-language-draft';
window.addEventListener('languagechange-request',()=>{
 try{sessionStorage.setItem(draftKey,JSON.stringify({mode,url:$('url').value,urls:$('urls').value,job,report}));}catch{}
});
function restoreDraft(){
 let draft;try{draft=JSON.parse(sessionStorage.getItem(draftKey));sessionStorage.removeItem(draftKey);}catch{}
 if(!draft||location.hash)return;
 setMode(draft.mode==='batch'?'batch':'single');$('url').value=draft.url||'';$('urls').value=draft.urls||'';
 if(draft.job){job=draft.job;if(mode==='batch'){$('batch-results').hidden=false;renderBatch();$('download-batch').disabled=false;}}
 if(draft.report){report=draft.report;render(report);}
 if(draft.job)status(t`Открыт сохранённый отчёт от ${when(draft.job.started_at)}.`,'done');
}
window.addEventListener('hashchange',openFromHash);restoreDraft();openFromHash();
const context=document.modelContext;
if(context?.registerTool){
 const lifecycle=new AbortController();window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
 const concise=item=>({input_url:item.input_url,status:item.status,error:item.error,result:item.report?{url:item.report.url,revision:item.report.revision,split:item.report.split,bytes:item.report.bytes,rows:item.report.rows.map(x=>({runtime:x.name,header_status:x.walk.status,model_result:x.model?.result??null,model_status:x.model?.status??null}))}:null});
 const tools=[{name:'check_gguf_header',title:'Check GGUF header',description:'Check one public Hugging Face GGUF header locally. Does not guarantee inference.',inputSchema:{type:'object',properties:{url:{type:'string'}},required:['url'],additionalProperties:false},execute:async input=>{if(!input||typeof input.url!=='string'||Object.keys(input).some(k=>k!=='url'))throw new Error('Expected only a url string.');const r=await run([input.url],false);return concise(r.items[0]);}},{name:'check_gguf_headers',title:'Check a batch of GGUF headers',description:'Check 1 to 10 public Hugging Face GGUF URLs sequentially and show a combined report. A failed file does not stop the batch. Does not guarantee inference.',inputSchema:{type:'object',properties:{urls:{type:'array',items:{type:'string'},minItems:1,maxItems:10}},required:['urls'],additionalProperties:false},execute:async input=>{if(!input||!Array.isArray(input.urls)||Object.keys(input).some(k=>k!=='urls'))throw new Error('Expected only a urls array.');const r=await run(input.urls,true);return {status:r.status,summary:r.summary,parser_sha256:r.parser_sha256,items:r.items.map(concise)};}}];
 for(const tool of tools)try{Promise.resolve(context.registerTool({...tool,annotations:{readOnlyHint:false,untrustedContentHint:true}},{signal:lifecycle.signal})).catch(()=>{});}catch{}
}
