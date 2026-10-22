import {useEffect,useState} from 'react'
import {api} from './api'
import {PortalShell,type Page} from './prototype'
import PropertyMedia from './PropertyMedia'
import type {Details} from './PropertyDetails'
type Villa={id:string;name:string;package_id:string;qr:string|null;status:string;details:Details|null}
const empty:Details={isDemo:false,description:'',location:'',guestCapacity:0,bedrooms:0,bathrooms:0,amenities:[],rules:[],checkIn:'',checkOut:'',notice:''}
export default function AdminVillaPage({id,go}:{id:string;go:(page:Page,item?:string)=>void}){
 const [villa,setVilla]=useState<Villa|null>(null),[draft,setDraft]=useState<Details>(empty),[saved,setSaved]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('')
 useEffect(()=>{let active=true;void api<{villas:Villa[]}>('/admin/villa-pages?villaId='+encodeURIComponent(id)).then(data=>{if(!active)return;const v=data.villas[0];if(!v)throw Error('ไม่พบที่พัก');setVilla(v);setDraft(v.details||empty);setSaved(JSON.stringify(v.details||empty))}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[id])
 const dirty=JSON.stringify(draft)!==saved
 const back=()=>{if(!dirty||window.confirm('มีข้อมูลที่ยังไม่บันทึก ต้องการกลับหรือไม่?'))go(villa?.status==='pending'?'admin-pending-villas':'admin-approved-villas')}
 return <PortalShell role="Admin" page="admin-villa-page" go={go}><div className="portal-head"><div><h1>จัดการหน้ารายละเอียดที่พัก</h1><p>{villa?.name||'กำลังโหลดข้อมูล…'} · ใช้ได้ทุกแพ็กเกจ · ไม่มีโฆษณาในหน้าที่พัก</p></div><button type="button" onClick={back}>กลับรายการที่พัก</button></div>{error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}{villa&&<><p>แพ็กเกจ: {villa.package_id}</p><form className="merchant-panel portal-form" onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');setMessage('');try{const result=await api<{details:Details}>('/admin/villa-pages',{id,details:draft});setDraft(result.details);setSaved(JSON.stringify(result.details));setMessage('บันทึกหน้ารายละเอียดแล้ว')}catch(e){setError(e instanceof Error?e.message:'บันทึกไม่สำเร็จ')}finally{setBusy(false)}}}>
 {([['description','เกี่ยวกับที่พัก'],['location','ทำเลที่พัก'],['checkIn','เวลาเช็กอิน'],['checkOut','เวลาเช็กเอาต์'],['notice','หมายเหตุ']] as const).map(([key,label])=><label key={key}>{label}<textarea aria-label={label} value={draft[key]} onChange={e=>setDraft({...draft,[key]:e.target.value})}/></label>)}
 {([['guestCapacity','จำนวนผู้เข้าพัก'],['bedrooms','ห้องนอน'],['bathrooms','ห้องน้ำ']] as const).map(([key,label])=><label key={key}>{label}<input aria-label={label} type="number" min="0" max="10000" required value={draft[key]} onChange={e=>setDraft({...draft,[key]:Number(e.target.value)})}/></label>)}
 {([['amenities','สิ่งอำนวยความสะดวก'],['rules','ข้อกำหนดการเข้าพัก']] as const).map(([key,label])=><label key={key}>{label} (หนึ่งรายการต่อบรรทัด)<textarea aria-label={label} value={draft[key].join('\n')} onChange={e=>setDraft({...draft,[key]:e.target.value.split('\n')})}/></label>)}
 <div className="button-row"><button className="primary-button" disabled={busy||!dirty}>บันทึกหน้ารายละเอียด</button>{villa.qr&&<a className="outline-button" href={'/#page=verify&item='+encodeURIComponent(villa.qr)} target="_blank" rel="noreferrer">ดูหน้าที่พัก ↗</a>}</div><p>บันทึกแล้วมีผลกับหน้าที่พักทันที และเก็บประวัติการเปลี่ยนแปลงไว้</p></form><PropertyMedia villaId={id} mode="admin"/></>}</PortalShell>
}
