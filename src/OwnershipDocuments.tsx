import {t as translateSystem} from "./locale"
import {BusinessWriteFieldset} from './BusinessReadiness'
import {useEffect,useState} from 'react'
import {api} from './api'
import {useLocale,formatDate,formatNumber} from './locale'
import './dashboard-documents.css'
type Doc={id:string;kind:string;name:string;status:string;remark:string;mime?:string;uploadedAt?:string;supersededAt?:string;removedAt?:string}
type Review={counts?:{documents:number};revision:number;documents:Doc[];history:{action:string;at:string;remark?:string}[];kinds:Record<string,string>}
const statusKeys:Record<string,string>={pending:'รอตรวจสอบ',accepted:'ผ่านการตรวจ',changes:'รอการแก้ไข',rejected:'ไม่ผ่านการตรวจ'}
export default function OwnershipDocuments({villaId,admin=false,onChanged}:{villaId:string;admin?:boolean;onChanged?:()=>void}){
 const {t}=useLocale()
 const [state,setState]=useState<Review|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[kind,setKind]=useState('ownership'),[replacement,setReplacement]=useState(''),[busy,setBusy]=useState(false),[remark,setRemark]=useState<Record<string,string>>({})
 const path=`/${admin?'admin':'merchant'}/ownership-documents`
 const load=async(isCurrent:()=>boolean=()=>true)=>{const data=await api<Review>(path+'?villaId='+encodeURIComponent(villaId));if(isCurrent()){setState(data);setError('');setLoading(false)}}
 useEffect(()=>{let current=true;setState(null);setError('');setLoading(true);setReplacement('');void load(()=>current).catch(e=>{if(current){setError(e instanceof Error?e.message:translateSystem('โหลดเอกสารไม่สำเร็จ'));setLoading(false)}});return()=>{current=false}},[villaId,admin])
 async function perform(data:unknown){if(busy)return;setBusy(true);setError('');try{await api(path,{...(data as object),villaId,revision:state?.revision});await load();onChanged?.()}catch(e){setError(e instanceof Error?e.message:translateSystem('บันทึกไม่สำเร็จ'))}finally{setBusy(false)}}
 const documents=state?.documents.filter(d=>!d.supersededAt&&!d.removedAt)||[]
 return <section className="merchant-panel ownership-documents" aria-labelledby={`ownership-documents-${villaId}`}>
  <h2 id={`ownership-documents-${villaId}`}>{translateSystem('เอกสารประกอบการตรวจสอบ')}</h2>
  <p>{translateSystem('เอกสารที่ใช้งาน')} {state?formatNumber(state.counts?.documents??0):'…'}/10 {translateSystem('ไฟล์')} · {translateSystem('ประวัติฉบับเก่ายังคงอยู่')}</p>
  <p>{translateSystem('เอกสารส่วนบุคคลเปิดได้เฉพาะเจ้าของบัญชีและผู้ดูแลที่มีสิทธิ์')} {translateSystem('การติดต่อทางโทรศัพท์ไม่ใช่การอนุมัติกรรมสิทธิ์')}</p>
  {busy&&<progress aria-label={translateSystem('กำลังบันทึกเอกสาร')}/>}
  {loading&&<p role="status">{translateSystem('กำลังโหลดเอกสาร…')}</p>}
  {error&&<div role="alert"><p>{error}</p><button type="button" className="outline-button" disabled={busy||loading} onClick={()=>{setLoading(true);void load().catch(e=>{setError(e instanceof Error?e.message:translateSystem('โหลดเอกสารไม่สำเร็จ'));setLoading(false)})}}>{translateSystem('ลองใหม่')}</button></div>}
  {state&&<>
   {!admin&&<BusinessWriteFieldset><div className="portal-form">
    <label>{translateSystem('ประเภทเอกสาร')}<select disabled={busy||!!replacement} value={kind} onChange={e=>setKind(e.target.value)}>{Object.entries(state.kinds).map(([id,label])=><option key={id} value={id}>{t(label)}</option>)}</select></label>
    <label>{translateSystem('การแนบเอกสาร')}<select disabled={busy} value={replacement} onChange={e=>{setReplacement(e.target.value);const document=state.documents.find(d=>d.id===e.target.value);if(document)setKind(document.kind)}}><option value="">{translateSystem('เพิ่มเอกสารใหม่')}</option>{documents.filter(d=>d.status!=='pending').map(d=><option key={d.id} value={d.id}>{translateSystem('เปลี่ยนเอกสาร')} · {d.name}</option>)}</select></label>
    <label>{translateSystem('แนบเอกสาร PDF, JPG หรือ PNG ไม่เกิน 2 MB')}<input type="file" disabled={busy} accept="application/pdf,image/jpeg,image/png" onChange={async e=>{
     const file=e.target.files?.[0];e.target.value='';if(!file)return
     if(!replacement&&(state.counts?.documents??0)>=10){setError(translateSystem('เอกสารประกอบการตรวจสอบรวมได้ไม่เกิน 10 ไฟล์ กรุณาเลือกเปลี่ยนเอกสารเดิม'));return}
     if(file.size>2*1024*1024||!['application/pdf','image/jpeg','image/png'].includes(file.type)){setError(translateSystem('รองรับ PDF, JPG, PNG ไม่เกิน 2 MB'));return}
     try{const data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(Error(translateSystem('อ่านไฟล์ไม่สำเร็จ')));reader.readAsDataURL(file)});await perform({action:'upload',kind,additional:!replacement,replacementDocumentId:replacement||undefined,file:{name:file.name,data}})}catch{setError(translateSystem('อ่านไฟล์ไม่สำเร็จ กรุณาเลือกไฟล์ใหม่'))}
    }}/></label>
   </div></BusinessWriteFieldset>}
   {!documents.length&&<p className="document-empty">{translateSystem('ยังไม่มีเอกสารประกอบ')}</p>}
   <div className="document-card-list">{documents.map(document=>{
    const url=`/api/${admin?'admin/':''}documents/${document.id}`
    return <article key={document.id}>
     <div className="document-file-heading"><div><span className="kicker">{t(state.kinds[document.kind]||document.kind)}</span><h3>{document.name}</h3></div><span className={`document-status document-status-${document.status}`}>{t(statusKeys[document.status]||document.status)}</span></div>
     <dl className="document-file-meta"><div><dt>{translateSystem('ประเภท')}</dt><dd>{document.mime||translateSystem('ไม่ทราบชนิดไฟล์')}</dd></div><div><dt>{translateSystem('วันที่อัปโหลด')}</dt><dd>{document.uploadedAt?formatDate(document.uploadedAt):translateSystem('ไม่พบวันที่อัปโหลดในข้อมูลเดิม')}</dd></div></dl>
     <div className="button-row"><a className="outline-button" href={url+'?preview=1'} target="_blank" rel="noopener noreferrer">{t(document.mime==='application/pdf'?'ดู PDF':'เปิดเอกสาร')}</a><a className="outline-button" href={url} download={document.name}>{translateSystem('ดาวน์โหลด')}</a></div>
     {document.remark&&<p className="document-review-note"><strong>{translateSystem('ข้อแก้ไข')}: </strong>{document.remark}</p>}
     {!admin&&<BusinessWriteFieldset><button type="button" className="text-button" disabled={busy} onClick={()=>{const reason=window.prompt(translateSystem('ระบุเหตุผลนำเอกสารออกจากรายการปัจจุบัน (ประวัติและไฟล์เดิมจะยังคงอยู่)'));if(reason===null)return;if(!reason.trim()){setError(translateSystem('กรุณาระบุเหตุผลนำเอกสารออก'));return}void perform({action:'remove',documentId:document.id,confirm:true,reason:reason.trim()})}}>{translateSystem('นำเอกสารออกจากรายการ')}</button></BusinessWriteFieldset>}
     {admin&&document.status==='pending'&&<BusinessWriteFieldset><label>{translateSystem('หมายเหตุ / ข้อแก้ไข')}<textarea disabled={busy} value={remark[document.id]||''} onChange={e=>setRemark({...remark,[document.id]:e.target.value})}/></label><div className="button-row">{['accepted','changes','rejected'].map(status=><button type="button" key={status} disabled={busy} onClick={()=>void perform({action:'review',documentId:document.id,status,remark:remark[document.id]||''})}>{t(statusKeys[status])}</button>)}</div></BusinessWriteFieldset>}
    </article>
   })}</div>
   <details className="document-history"><summary>{translateSystem('ประวัติตรวจเอกสาร')} ({formatNumber(state.history.length)})</summary>{state.history.map((entry,index)=><p key={index}>{formatDate(entry.at,{hour:'2-digit',minute:'2-digit'})} · {t(entry.action==='review'?'ตรวจเอกสาร':entry.action==='resubmit'?'ส่งเอกสารใหม่':entry.action==='remove'?'นำเอกสารออกจากรายการ':'แนบเอกสาร')} {entry.remark}</p>)}</details>
  </>}
 </section>
}
