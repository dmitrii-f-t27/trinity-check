import {t,locale} from './i18n.mjs';
// Shared report vocabulary for the checker page and the cabinet. Presentation only; verdicts come from the t27 WASM.
export const statusNames = new Map([[0,'OK'],[-55,t('Заголовок прочитан не полностью')],[-63,t('Тип ключа Hadamard')],[-64,t('Нет ключа Hadamard')],[-65,t('Версия Hadamard')],[-66,t('Размер блока Hadamard')],[-67,t('Преобразование Hadamard')],[-68,t('Знаки Hadamard')],[-69,t('Архитектура Hadamard')],[-70,t('Имя тензора Hadamard')],[-71,t('Тензор Hadamard')],[-72,t('Смещения тензоров')],[-73,t('Сигнатура GGUF')],[-74,t('Версия GGUF')],[-75,t('Порядок байтов')],[-76,t('Ключ метаданных')],[-77,t('Выравнивание')],[-78,t('Имя тензора')],[-79,t('Форма тензора')],[-80,t('Тип тензора')],[-81,t('Выравнивание строк')],[-82,t('Границы файла')],[-83,t('Архитектура')],[-84,t('Лимит проверки')],[-85,t('Метаданные частей')],[-86,t('Количество записей')],[-87,t('Файл заканчивается внутри заголовка')],[-88,t('Метаданные связанного выходного слоя Hadamard')],[-89,t('Метаданные точности активаций тензоров')]]);
export const statusText = n => statusNames.get(n) || t`Код ${n}`;
export const states={pending:t('В очереди'),checking:t('Проверяется'),checked:t('Проверен'),error:t('Ошибка'),cancelled:t('Отменён')};
export const node = (tag,text,cls) => {const n=document.createElement(tag);n.textContent=text;if(cls)n.className=cls;return n;};
export function verdict(row,split){
 if(split)return {text:t('Только одна часть'),short:t('одна часть'),kind:''};
 if(!row.model||row.model.result<0)return {text:t('Не определено'),short:t('не определено'),kind:''};
 if(row.model.result===0)return {text:t('Метаданные приняты'),short:t('принят'),kind:'accept'};
 if(row.model.result===2)return {text:t('Приняты с оговоркой'),short:t('с оговоркой'),kind:''};
 return {text:t('Метаданные отклонены'),short:t('отклонён'),kind:'refuse'};
}
export function filename(url){try{return decodeURIComponent(new URL(url).pathname.split('/').at(-1))||url;}catch{return url;}}
export const when = iso => new Date(iso).toLocaleString(locale,{day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'});
export function download(value,name){if(!value)return;const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=node('a','');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
