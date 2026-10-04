import {locale} from './i18n.mjs';
import {copy} from './commerce-copy.mjs';
export const contactEmail='dmitrii.f@t27.ai';
// Stripe Payment Link for the pilot audit, created by the owner in the Stripe
// Dashboard (https://buy.stripe.com/...). Empty keeps the payment block hidden.
// Set its confirmation page to <site>/thanks.html. pilotPrice is display text
// only; the amount charged is whatever the Payment Link itself defines.
export const paymentLink='';
export const pilotPrice='250 USD';
// Launch month: the pilot is free until this date (inclusive, UTC). After it the
// free block hides itself and the Stripe/quote text applies again.
export const freeUntil='2026-11-04';
// Voluntary USDT support, one entry per network. Given by the owner on 2026-10-04.
// The network matters: funds sent on another network are lost.
export const usdtWallets=[
 {network:'TRON (TRC20)',address:'TU6yGqgy1KaKFS1xfo5fUM79nYXwjQnzjs'},
 {network:'Ethereum (ERC20)',address:'0xE3E2e63a32F638b267252FBfBc876677D95C3d20'},
 {network:'Solana',address:'7C7ZBZ1AkeFKwiq1BsimeKzsVuSsLt454NSxQfLWxds7'},
 {network:'TON',address:'UQDeWCDK6sKxYfp9J0WvQwyoHLmiYSSoK7mygSjXdgT76mTt'}
];
export const textFor=key=>copy[key]?.[locale]??copy[key]?.en??key;
export function prepareEmail({kind,model,runtime,message}){
 const subject=kind==='feedback'?'Trinity Check feedback':'Model Release Audit request';
 const body=[subject,'',`Model / release: ${model||'Not supplied'}`,`Target runtime: ${runtime||'Not supplied'}`,'',message, '',`Interface language: ${locale}`].join('\n');
 return {body,href:`mailto:${contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`};
}
if(typeof document!=='undefined'){
 for(const el of document.querySelectorAll('[data-copy]'))el.textContent=textFor(el.dataset.copy);
 for(const a of document.querySelectorAll('a[href]')){const url=new URL(a.getAttribute('href'),location.href);if(url.origin===location.origin&&(/\.html$/.test(url.pathname)||url.pathname==='/')){url.searchParams.set('lang',locale);a.href=url.href;}}
 if(document.querySelector('main.commerce'))document.title=document.querySelector('h1').textContent+' — Trinity';
 const freeActive=new Date().toISOString().slice(0,10)<=freeUntil;
 for(const block of document.querySelectorAll('[data-free]'))block.hidden=!freeActive;
 if(freeActive){for(const q of document.querySelectorAll('[data-copy="quote"]'))q.textContent=textFor('quoteFree');for(const [k,f] of [['steps','stepsFree'],['step2','step2Free'],['step3','step3Free']])for(const e of document.querySelectorAll(`[data-copy="${k}"]`))e.textContent=textFor(f);}
 const wallets=usdtWallets.filter(w=>/^[A-Za-z0-9_-]{26,64}$/.test(w.address)&&w.network);
 for(const block of document.querySelectorAll('[data-tip]')){block.hidden=!wallets.length;if(!wallets.length)continue;const list=block.querySelector('[data-tip-list]'),st=block.querySelector('[data-tip-status]');list.textContent='';for(const w of wallets){const li=document.createElement('li');const net=document.createElement('b');net.textContent=w.network;const code=document.createElement('code');code.className='tip-address';code.textContent=w.address;const btn=document.createElement('button');btn.type='button';btn.className='tip-copy';btn.textContent=textFor('tipCopy');btn.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(w.address);st.textContent=`${w.network}: ${textFor('tipCopied')}`;}catch{const r=document.createRange();r.selectNodeContents(code);const sel=getSelection();sel.removeAllRanges();sel.addRange(r);}});li.append(net,code,btn);list.append(li);}}
 if(!freeActive&&/^https:\/\/buy\.stripe\.com\//.test(paymentLink)){
  for(const block of document.querySelectorAll('[data-pay]')){block.hidden=false;for(const a of block.querySelectorAll('[data-pay-link]'))a.href=paymentLink;const price=block.querySelector('[data-price]');if(price){price.textContent=pilotPrice;price.hidden=!pilotPrice;}}
  if(pilotPrice)for(const q of document.querySelectorAll('[data-copy="quote"]'))q.hidden=true;
 }
 const draftText=document.querySelector('#draft-text');if(draftText)draftText.setAttribute('aria-label',textFor('draftLabel'));
 const form=document.querySelector('#contact-form');
 if(form){
  const kind=document.querySelector('#kind'),model=document.querySelector('#model');
  kind.value=new URL(location.href).searchParams.get('type')==='feedback'?'feedback':'audit';
  const update=()=>{model.required=kind.value==='audit';document.querySelector('#draft').hidden=true;};kind.addEventListener('change',update);update();
  form.addEventListener('submit',event=>{event.preventDefault();if(!form.reportValidity())return;const draft=prepareEmail({kind:kind.value,model:model.value.trim(),runtime:document.querySelector('#runtime').value.trim(),message:document.querySelector('#message').value.trim()});document.querySelector('#draft-text').value=draft.body;document.querySelector('#draft').hidden=false;document.querySelector('#contact-status').textContent=textFor('prepared');location.href=draft.href;});
  document.querySelector('#copy-message').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(document.querySelector('#draft-text').value);document.querySelector('#contact-status').textContent=textFor('copied');}catch{document.querySelector('#draft-text').select();document.querySelector('#contact-status').textContent=textFor('copyFail');}});
 }
}
