import {messages} from './messages.mjs';

export const languages = {'ru':'Русский','en':'English','es':'Español','pt-BR':'Português (Brasil)','zh-CN':'简体中文','ja':'日本語'};
const storageKey='trinity-check-language';
export function resolveLocale(value){
 const code=String(value||'').toLowerCase();
 if(code==='pt'||code.startsWith('pt-'))return 'pt-BR';
 if(code==='zh'||code.startsWith('zh-'))return 'zh-CN';
 const base=code.split('-')[0];return Object.hasOwn(languages,base)?base:null;
}
export function chooseLocale(explicit,saved,preferred=[]){
 return resolveLocale(explicit)||resolveLocale(saved)||preferred.map(resolveLocale).find(Boolean)||'en';
}
function detect(){
 if(typeof document==='undefined')return 'ru';
 let saved;try{saved=localStorage.getItem(storageKey);}catch{}
 return chooseLocale(new URL(location.href).searchParams.get('lang'),saved,navigator.languages||[navigator.language]);
}
export const locale=detect();
export function translate(key,values=[],language=locale){
 const text=language==='ru'?key:messages[key]?.[language]??messages[key]?.en??key;
 return text.replace(/\{(\d+)\}/g,(match,n)=>n<values.length?String(values[n]):match);
}
export function t(key,...values){
 if(Array.isArray(key))key=key.reduce((s,part,i)=>s+(i?`{${i-1}}`:'')+part,'');
 return translate(key,values);
}

// Only translate first-party static text. User file names, URLs and imported
// reports are rendered by the presentation modules, never scanned or rewritten.
function localizeStatic(){
 document.documentElement.lang=locale;
 const walker=document.createTreeWalker(document.documentElement,NodeFilter.SHOW_TEXT);
 const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
 for(const n of nodes){
  if(n.parentElement?.closest('script,style,code'))continue;
  const key=n.textContent.trim();if(messages[key])n.textContent=n.textContent.replace(key,t(key));
 }
 for(const el of document.querySelectorAll('[aria-label],[placeholder],meta[name="description"]')){
  for(const attr of ['aria-label','placeholder','content']){
   const key=el.getAttribute(attr);if(key&&messages[key])el.setAttribute(attr,t(key));
  }
 }
 const label=document.createElement('label');label.className='language-control';
 const labelText={ru:'Язык',en:'Language',es:'Idioma','pt-BR':'Idioma','zh-CN':'语言',ja:'言語'};
 label.append(document.createTextNode(labelText[locale]));
 const select=document.createElement('select');select.id='language';select.name='language';
 for(const [value,text] of Object.entries(languages)){
  const option=document.createElement('option');option.value=value;option.lang=value;option.textContent=text;option.selected=value===locale;select.append(option);
 }
 label.append(select);document.querySelector('header').append(label);
 select.addEventListener('change',()=>{
  const next=select.value;
  try{localStorage.setItem(storageKey,next);}catch{}
  // The app can preserve a draft and current results before this navigation.
  window.dispatchEvent(new Event('languagechange-request'));
  const url=new URL(location.href);url.searchParams.set('lang',next);location.assign(url.href);
 });
 // Keep the explicit choice across page navigation even if storage is blocked.
 for(const link of document.querySelectorAll('a[href="./"],a[href="cabinet.html"]'))link.href=localizedHref(link.getAttribute('href'));
}
export function localizedHref(path){
 const url=new URL(path,location.href);url.searchParams.set('lang',locale);return url.href;
}
if(typeof document!=='undefined')localizeStatic();
