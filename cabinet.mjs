import {t,locale,localizedHref} from './i18n.mjs';
// Trinity Check cabinet: browse, reopen, re-run, export and import the browser-local history.
import {listRuns,deleteRun,putRuns,clearRuns,exportHistory,parseImport,onHistoryChange,MAX_IMPORT_BYTES} from './history.mjs';
import {states,node,verdict,filename,when,download} from './report-view.mjs';
const $ = id => document.getElementById(id);
const PAGE=50;
let runs=[],query='',shown=PAGE,ready=false;
function status(text,kind='',...extra){$('state').replaceChildren(text,...extra);$('status-line').className=`status-line ${kind}`;}
const runCount=n=>t`Запусков: ${n}`;
const stamp=iso=>iso.slice(0,16).replace(/[-:]/g,'').replace('T','-');
function controls(){const has=ready&&runs.length>0;$('export').disabled=!has;$('clear').disabled=!has;$('search').disabled=!has;$('import').disabled=!ready;}
function stats(){
 const now=new Date(),fmt=n=>n.toLocaleString(locale);let files=0,errors=0,month=0;
 for(const {job} of runs){files+=job.summary.checked;errors+=job.summary.errors;const d=new Date(job.started_at);if(d.getFullYear()===now.getFullYear()&&d.getMonth()===now.getMonth())month+=job.summary.checked;}
 $('stat-runs').textContent=ready?fmt(runs.length):'—';$('stat-files').textContent=ready?fmt(files):'—';$('stat-errors').textContent=ready?fmt(errors):'—';$('stat-month').textContent=ready?fmt(month):'—';
}
const matches=job=>!query||job.items.some(item=>`${filename(item.input_url)} ${item.input_url} ${item.report?.url||''}`.toLowerCase().includes(query));
function card({id,job}){
 const batch=job.mode==='batch',s=job.summary,article=node('article','','run');
 const head=node('div','','run-head'),title=batch?t`Пакет · ссылок: ${s.total}`:filename(job.items[0].input_url);
 const time=node('time',when(job.started_at),'run-time');time.dateTime=job.started_at;
 head.append(node('h3',title,'run-title'),time);article.append(head);
 const parts=[t`Проверено: ${s.checked} из ${s.total}`];if(s.errors)parts.push(t`ошибок: ${s.errors}`);if(s.cancelled)parts.push(t`отменено: ${s.cancelled}`);if(job.status==='cancelled')parts.push(t('проверка была остановлена'));
 article.append(node('p',parts.join(' · '),'run-summary'));
 const list=node('ul','','run-files');
 for(const item of job.items){
  const li=node('li','','run-file'),badges=node('span','','run-badges');
  li.append(node('span',batch?`${item.index}. ${filename(item.input_url)}`:item.report?t`Коммит ${item.report.revision.slice(0,12)}`:filename(item.input_url),'run-file-name'));
  if(item.report)for(const row of item.report.rows){const v=verdict(row,item.report.split);const badge=node('span',`${row.name}: ${v.short}`,`verdict ${v.kind}`);badge.title=v.text;badges.append(badge);}
  else badges.append(node('span',states[item.status],`batch-state ${item.status}`));
  li.append(badges);if(item.error)li.append(node('p',item.error,'batch-error'));list.append(li);
 }
 article.append(list);
 const actions=node('div','','run-actions');
 const open=node('a',t('Открыть отчёт'),'button-link');open.href=localizedHref(`./#run=${id}`);
 const again=node('a',t('Проверить снова'),'button-link quiet');again.href=localizedHref(`./#rerun=${id}`);
 const json=node('button',t('Скачать JSON'),'text-button');json.type='button';json.onclick=()=>download(job,`trinity-check-${stamp(job.started_at)}.json`);
 const del=node('button',t('Удалить'),'text-button danger-text');del.type='button';del.setAttribute('aria-label',t`Удалить отчёт от ${when(job.started_at)}`);del.onclick=()=>remove(id);
 actions.append(open,again,json,del);article.append(actions);
 return article;
}
function render(){
 stats();controls();
 const visible=runs.filter(r=>matches(r.job)),list=$('runs');
 $('empty').hidden=!ready||runs.length>0;
 list.replaceChildren(...visible.slice(0,shown).map(card));
 if(runs.length&&!visible.length)list.append(node('p',t('По этому запросу ничего не найдено.'),'empty-search'));
 $('more').hidden=visible.length<=shown;$('more').textContent=t`Показать ещё ${Math.min(PAGE,Math.max(0,visible.length-shown))}`;
}
async function load(message){
 try{runs=await listRuns();ready=true;}
 catch(e){runs=[];ready=false;render();status(t`История недоступна в этом браузере: ${e.message}. Проверки работают, но отчёты нужно скачивать вручную.`,'error');return;}
 render();
 if(message)status(...message);else status(runs.length?t`В истории ${runCount(runs.length)}.`:t('История пуста.'),runs.length?'done':'');
}
async function remove(id){
 const record=runs.find(r=>r.id===id);if(!record)return;
 try{await deleteRun(id);}catch(e){status(t`Не удалось удалить: ${e.message}.`,'error');return;}
 const undo=node('button',t('Вернуть'),'text-button');undo.type='button';
 undo.onclick=async()=>{undo.disabled=true;try{await putRuns([record]);await load([t('Отчёт восстановлен.'),'done']);}catch(e){status(t`Не удалось восстановить: ${e.message}.`,'error');}};
 await load([t`Отчёт от ${when(record.job.started_at)} удалён. `,'',undo]);undo.focus();
}
$('export').onclick=()=>{download(exportHistory(runs),`trinity-check-history-${new Date().toISOString().slice(0,10)}.json`);status(t`История выгружена: ${runCount(runs.length)}.`,'done');};
$('import').onclick=()=>$('import-file').click();
$('import-file').onchange=async()=>{
 const file=$('import-file').files[0];$('import-file').value='';if(!file)return;
 if(file.size>MAX_IMPORT_BYTES){status(t('Файл больше 20 МБ. Загрузите историю частями.'),'error');return;}
 status(t('Проверяем файл…'),'busy');
 try{const {added,total}=await putRuns(parseImport(await file.text()));await load([added?t`Добавлено в историю: ${runCount(added)} из ${total}.`:t`Все отчёты из файла (${total}) уже есть в истории.`,'done']);}
 catch(e){status(t`Файл не загружен. ${e.message}`,'error');}
};
$('clear').onclick=async()=>{
 if(!confirm(t`Удалить все сохранённые отчёты (${runs.length})? Это нельзя отменить. Перед очисткой можно скачать историю.`))return;
 try{await clearRuns();await load([t('История очищена.'),'done']);}catch(e){status(t`Не удалось очистить историю: ${e.message}.`,'error');}
};
$('search').oninput=e=>{query=e.target.value.trim().toLowerCase();shown=PAGE;render();};
$('more').onclick=()=>{shown+=PAGE;render();};
onHistoryChange(()=>load());
window.addEventListener('pageshow',e=>{if(e.persisted)load();});
load();
