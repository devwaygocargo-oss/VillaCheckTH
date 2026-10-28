import {t as translateSystem} from "./locale"
import {useLocale} from './locale'
export default function LanguageSwitcher(){const{locale,setLocale,t}=useLocale();return <div className="language-switcher" role="group" aria-label={translateSystem('ภาษา')}><button type="button" lang="th" aria-pressed={locale==='th'} onClick={()=>setLocale('th')}>TH</button><button type="button" lang="en" aria-pressed={locale==='en'} onClick={()=>setLocale('en')}>EN</button></div>}
