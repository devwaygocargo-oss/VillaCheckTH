import {t as translateSystem} from "./locale"
import {t} from "./locale"
import {useEffect,useState,useRef} from "react"
import {api,currentAccount} from "./api"
export type CmsMedia={id:string;name:string;url:string;mime:string;source?:string}
export default function CmsMediaPicker({label,value,onChange,library,onUploaded}:{label:string;value:string;onChange:(url:string)=>void;library?:CmsMedia[];onUploaded?:(media:CmsMedia)=>void}){
 const change=useRef(onChange),active=useRef(true);change.current=onChange;useEffect(()=>{active.current=true;return()=>{active.current=false}},[]);
 const [media,setMedia]=useState<CmsMedia[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const options=library??media;
 const load=async()=>{const data=await api<{media:CmsMedia[]}>('/admin/cms/media');setMedia(data.media.map(m=>({...m,url:m.url||'/api/public/cms-media/'+m.id})))}
 useEffect(()=>{if(!library)void load().catch(e=>setError(e.message))},[Boolean(library)])
 const upload=async(file?:File)=>{if(!file)return;setBusy(true);setError('');try{if(!['image/jpeg','image/png'].includes(file.type)||file.size>2*1024*1024)throw Error('ใช้ JPG/PNG ไม่เกิน 2 MB');const data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(Error('อ่านรูปไม่สำเร็จ'));reader.readAsDataURL(file)});await currentAccount();const result=await api<CmsMedia>('/admin/cms/media',{file:{name:file.name,type:file.type,data}});if(active.current){if(library)onUploaded?.(result);else await load();change.current(result.url)}}catch(e){setError(e instanceof Error?e.message:'อัปโหลดไม่สำเร็จ')}finally{setBusy(false)}}
 return <div className="cms-image-field"><label>{label} URL<input value={value} onChange={e=>onChange(e.target.value)}/></label><label>{translateSystem("เลือกจากคลังรูป")}<select aria-label={label+translateSystem(" เลือกจากคลังรูป")} value={options.some(m=>m.url===value)?value:''} onChange={e=>{if(e.target.value)onChange(e.target.value)}}><option value="">{translateSystem("เลือกภาพ…")}</option>{options.map(m=><option key={m.id} value={m.url}>{m.name.replace('cms-image:','')}</option>)}</select></label><label>{translateSystem("อัปโหลด")}{" "}{label}<input type="file" accept="image/jpeg,image/png" disabled={busy} onChange={e=>{void upload(e.target.files?.[0]);e.target.value=''}}/></label>{busy&&<p role="status">{translateSystem("กำลังอัปโหลด…")}</p>}{error&&<p role="alert">{error}</p>}{value&&<img loading="lazy" decoding="async" src={value} alt={' '+label}/>}<button type="button" disabled={busy} onClick={()=>onChange('')}>{translateSystem("ล้าง")}{" "}{label}</button></div>
}
