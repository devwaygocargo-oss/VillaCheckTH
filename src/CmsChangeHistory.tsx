import { useEffect,useState } from "react"
import { api } from "./api"
import type { CmsState } from "./cms"
type Entry={id:string;kind:string;action:string;revision:number|null;targetId?:string;title?:string;updatedAt:string|null;updatedBy:string|null}
type HistoryPage={entries:Entry[];nextCursor:string|null}
const actions:Record<string,string>={upload:"เพิ่มรูปในคลัง",delete:"ลบรูปที่ไม่ได้ใช้งาน",save:"บันทึกการแก้ไข",publish:"เผยแพร่",restore:"ย้อนเวอร์ชัน",create:"สร้างโฆษณา",before_edit:"ก่อนเริ่มเก็บประวัติ",import_published:"เวอร์ชันเผยแพร่เดิม",import_draft:"ร่างเดิม"}
export default function CmsChangeHistory({revision,onRestored}:{revision:number;onRestored:(state?:CmsState)=>void}){
 const [entries,setEntries]=useState<Entry[]>([]),[cursor,setCursor]=useState<string|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("")
 const load=async(more=false)=>{setBusy(true);setError("");try{const page=await api<HistoryPage>("/admin/cms/history"+(more&&cursor?"?cursor="+encodeURIComponent(cursor):""));setEntries(previous=>more?[...previous,...page.entries]:page.entries);setCursor(page.nextCursor)}catch(e){setError(e instanceof Error?e.message:"โหลดประวัติไม่สำเร็จ")}finally{setBusy(false)}}
 useEffect(()=>{void load()},[])
 const restore=async(entry:Entry)=>{
  const ad=entry.kind==="advertisement"
  if(!window.confirm(ad?"คืนข้อมูลโฆษณาเวอร์ชันนี้? การแก้ไขที่ยังไม่บันทึกจะถูกแทนที่ โฆษณาที่คืนจะปิดแสดงผลและรออนุมัติ ให้ตรวจสอบก่อนเปิดใช้งานอีกครั้ง":"คืนเวอร์ชันนี้เป็นร่าง? การแก้ไขที่ยังไม่บันทึกจะถูกแทนที่ เว็บจริงยังไม่เปลี่ยนจนผ่านการเผยแพร่"))return
  setBusy(true);setError("");setMessage("")
  try{if(ad){await api("/admin/advertisements",{historyId:entry.id});onRestored();setMessage("คืนโฆษณาแล้ว ปิดแสดงผลและรออนุมัติ กรุณาตรวจสอบในแท็บแบนเนอร์ / โฆษณา")}
  else{const state=await api<CmsState>("/admin/cms/restore",{revision,...(entry.id.startsWith("legacy:")?{version:entry.revision}:{historyId:entry.id})});onRestored(state);setMessage("คืนเป็นร่างใหม่แล้ว เว็บจริงยังไม่เปลี่ยน")}
  await load()}catch(e){setError(e instanceof Error?e.message:"คืนเวอร์ชันไม่สำเร็จ")}finally{setBusy(false)}
 }
 return <section className="cms-change-history"><h2>ประวัติการเปลี่ยนแปลง / ย้อนเวอร์ชัน</h2><p>เก็บทุกครั้งที่บันทึกร่าง เผยแพร่ ย้อนเวอร์ชัน บันทึกโฆษณา หรือเพิ่มและลบรูปในคลัง โดยไม่ตัดประวัติเก่าทิ้ง แสดงครั้งละ 50 รายการ</p><p>การย้อน CMS จะสร้างร่างใหม่ ส่วนโฆษณาจะคืนข้อมูลพร้อมปิดแสดงผลเพื่อให้ตรวจสอบก่อนเปิดใช้งานอีกครั้ง การพิมพ์ที่ยังไม่กดบันทึกจะไม่ถูกเก็บเป็นเวอร์ชัน</p><button type="button" disabled={busy} onClick={()=>void load()}>โหลดประวัติล่าสุด</button>{error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}<div className="cms-banner-table-scroll"><table className="cms-banner-table"><thead><tr><th>วันเวลา (ไทย)</th><th>ผู้แก้ไข</th><th>รายการ / เวอร์ชัน</th><th>การเปลี่ยนแปลง</th><th>ย้อนเวอร์ชัน</th></tr></thead><tbody>{entries.map(entry=><tr key={entry.id}><td>{entry.updatedAt?new Date(entry.updatedAt).toLocaleString("th-TH",{timeZone:"Asia/Bangkok"}):"เนื้อหาเริ่มต้น"}</td><td>{entry.updatedBy||"ระบบ"}</td><td>{entry.kind==="cms"?`CMS v${entry.revision}`:`${entry.kind==="media"?"คลังรูป":"โฆษณา"} · ${entry.title}`}</td><td>{actions[entry.action]||entry.action}</td><td>{entry.kind==="media"?"บันทึกเหตุการณ์":<button type="button" disabled={busy} onClick={()=>void restore(entry)}>{entry.kind==="cms"?"คืนเป็นร่าง":"คืนโฆษณาแบบปิดแสดงผล"}</button>}</td></tr>)}</tbody></table></div>{!busy&&!entries.length&&<p>ยังไม่มีประวัติการเปลี่ยนแปลงที่บันทึกไว้</p>}{cursor&&<button type="button" disabled={busy} onClick={()=>void load(true)}>ดูประวัติเก่ากว่านี้</button>}{busy&&<p role="status">กำลังดำเนินการ…</p>}</section>
}
