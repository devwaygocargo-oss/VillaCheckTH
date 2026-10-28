import {t as translateSystem} from "./locale"
import {useEffect,useState} from 'react'
import type {MerchantVilla} from './merchantStore'
import OwnershipDocuments from './OwnershipDocuments'
import {villaStatusBadge} from './villaStatus'
import {useLocale,formatDate} from './locale'
import './dashboard-documents.css'
export default function DocumentManagement({villas}:{villas:MerchantVilla[]}){
 const {t}=useLocale(),[selected,setSelected]=useState(villas[0]?.id||'')
 useEffect(()=>{if(!villas.some(v=>v.id===selected))setSelected(villas[0]?.id||'')},[villas,selected])
 const villa=villas.find(v=>v.id===selected),document=villa?.document
 const url=document?.data&&/^\/api\/documents\/[a-f0-9-]+$/.test(document.data)?document.data:''
 // Legacy primary files have no reliable upload timestamp. Never infer it from Villa creation.
 const uploadedAt=(document as (typeof document)&{uploadedAt?:string})?.uploadedAt
 return <section className="document-management" aria-labelledby="document-management-title">
  <nav className="document-breadcrumb" aria-label={translateSystem('จัดการเอกสาร')}>{translateSystem('บัญชีผู้ประกอบการ')} <span aria-hidden="true">/</span> {translateSystem('จัดการเอกสาร')}</nav>
  <div className="portal-head"><div><h1 id="document-management-title">{translateSystem('จัดการเอกสาร')}</h1><p>{translateSystem('เอกสารที่อัปโหลดและผลการตรวจสอบของที่พักในบัญชีคุณ')}</p></div></div>
  <p className="document-privacy-note">{translateSystem('เอกสารส่วนบุคคลเปิดได้เฉพาะเจ้าของบัญชีและผู้ดูแลที่มีสิทธิ์')}</p>
  {!villas.length?<div className="merchant-panel document-empty"><p>{translateSystem('ยังไม่มีที่พักหรือเอกสารในบัญชีนี้')}</p></div>:<>
   <label className="document-villa-picker">{translateSystem('เลือกที่พัก')}<select value={selected} onChange={e=>setSelected(e.target.value)}>{villas.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select></label>
   {villa&&<><article className="merchant-panel document-file-card">
    <div className="document-file-heading"><div><span className="kicker">{translateSystem('เอกสารหลักของที่พัก')}</span><h2>{document?.name||translateSystem('ไม่พบไฟล์เอกสารที่เปิดได้')}</h2></div><span className={`document-status document-status-${villa.status}`}>{villaStatusBadge(villa).label}</span></div>
    <dl className="document-file-meta"><div><dt>{translateSystem('ประเภท')}</dt><dd>{document?.type||translateSystem('ไม่ทราบชนิดไฟล์')}</dd></div><div><dt>{translateSystem('วันที่อัปโหลด')}</dt><dd>{uploadedAt?formatDate(uploadedAt):translateSystem('ไม่พบวันที่อัปโหลดในข้อมูลเดิม')}</dd></div></dl>
    {villa.reason&&<p className="document-review-note"><strong>{translateSystem('หมายเหตุจากผู้ตรวจ')}: </strong>{villa.reason}</p>}
    {url?<div className="button-row"><a className="outline-button" href={url+'?preview=1'} target="_blank" rel="noopener noreferrer">{t(document?.type==='application/pdf'?'ดู PDF':'เปิดเอกสาร')}</a><a className="outline-button" href={url} download={document?.name}>{translateSystem('ดาวน์โหลด')}</a></div>:<p role="status">{translateSystem('ไม่พบไฟล์เอกสารที่เปิดได้')}</p>}
   </article><OwnershipDocuments key={villa.id} villaId={villa.id}/></>}
  </>}
 </section>
}
