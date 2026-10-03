import {locale} from './i18n.mjs';
import {copy} from './commerce-copy.mjs';
export const contactEmail='dmitrii.f@t27.ai';
// Stripe Payment Link for the pilot audit, created by the owner in the Stripe
// Dashboard (https://buy.stripe.com/...). Empty keeps the payment block hidden.
// Set its confirmation page to <site>/thanks.html. pilotPrice is display text
// only; the amount charged is whatever the Payment Link itself defines.
export const paymentLink='https://buy.stripe.com/test_00wcN55ZrcsK2jJbmagrS00';
export const pilotPrice='250 USD';
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
 if(/^https:\/\/buy\.stripe\.com\//.test(paymentLink)){
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
