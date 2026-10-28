import {useSyncExternalStore} from 'react'
import {englishSystemText,thaiSystemText} from './systemTranslations'
export type Locale='th'|'en'
export type TranslationValues=Record<string,string|number>
export const localeStorageKey='villacheck:locale'
let selected:Locale='th',initialized=false
const listeners=new Set<()=>void>()
function initialize(){if(initialized||typeof window==='undefined')return;initialized=true;try{const stored=window.localStorage.getItem(localeStorageKey);if(stored==='en'||stored==='th')selected=stored}catch{/* Keep Thai when storage is unavailable. */}document.documentElement.lang=selected}
export function getLocale():Locale{return selected}
export function setLocale(locale:Locale){if(locale!=='en'&&locale!=='th')return;initialize();selected=locale;if(typeof document!=='undefined')document.documentElement.lang=locale;try{window.localStorage.setItem(localeStorageKey,locale)}catch{/* Locale remains available for this session. */}listeners.forEach(listener=>listener())}
function subscribe(listener:()=>void){initialize();listeners.add(listener);const storage=(event:StorageEvent)=>{if(event.key===localeStorageKey&&(event.newValue==='th'||event.newValue==='en')){selected=event.newValue;document.documentElement.lang=selected;listeners.forEach(item=>item())}};window.addEventListener('storage',storage);return()=>{listeners.delete(listener);window.removeEventListener('storage',storage)}}
export function localeTag(locale:Locale=getLocale()){return locale==='en'?'en-GB':'th-TH'}
export function tr(locale:Locale,key:string,values:TranslationValues={}){const text=locale==='th'?(thaiSystemText[key]??(Object.prototype.hasOwnProperty.call(englishSystemText,key)&&!/[\u0e00-\u0e7f]/.test(key)?englishSystemText[key]:key)):(englishSystemText[key]??key);return text.replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g,(whole,name)=>Object.prototype.hasOwnProperty.call(values,name)?String(values[name]):whole)}
export function t(key:string,values:TranslationValues={}){return tr(getLocale(),key,values)}
export function useLocale(){const locale=useSyncExternalStore(subscribe,getLocale,()=> 'th' as const);return{locale,setLocale,t:(key:string,values:TranslationValues={})=>tr(locale,key,values)}}
export function formatDate(value:string|number|Date|null|undefined,options:Intl.DateTimeFormatOptions={}){if(value===null||value===undefined||value==='')return t('ไม่ระบุ');const date=value instanceof Date?value:new Date(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)?value+'T00:00:00+07:00':value);if(!Number.isFinite(date.getTime()))return t('ไม่ระบุ');return new Intl.DateTimeFormat(localeTag(),{timeZone:'Asia/Bangkok',...(!options.dateStyle&&!options.timeStyle?{day:'numeric',month:'short',year:'numeric'}:{}),...options}).format(date)}
export function formatNumber(value:number,options:Intl.NumberFormatOptions={}){return new Intl.NumberFormat(localeTag(),options).format(value)}
export function formatCurrency(value:number,currency='THB',options:Intl.NumberFormatOptions={}){return formatNumber(value,{style:'currency',currency,...options})}
