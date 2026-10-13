import { useEffect,useState } from "react";
import { api,currentAccount } from "./api";
type Diagnostic={ok?:boolean;accepted?:boolean;at?:string;category?:string;reason?:string};
type Readiness={checkedAt:string;demoMode:boolean;paymentMode:string;paymentConfigured:boolean;smtpConfigured:boolean;oauth:Record<string,boolean>;facebookStatus:string;otp:{channels:{email:boolean;sms:boolean};emailMode:string;smsMode:string;emailDelivery:Diagnostic|null;smsDelivery:Diagnostic|null;emailVerification:Diagnostic|null;smsVerification:Diagnostic|null};mail:{counts:{status:string;count:number}[];lastFailure:{reason:string;at:string}|null};missingGuestCapacities:number;legacyInvoicesWithoutBankSnapshot:number;cms:{publishedRevision:number}};
const outcome=(d:Diagnostic|null,verification=false)=>!d?"ยังไม่มีผลบันทึก":(verification?d.accepted:d.ok)?"สำเร็จ":`ไม่สำเร็จ (${d.category||d.reason||"ตรวจการตั้งค่าบริการ"})`;
export default function AdminReadiness(){
 const [data,setData]=useState<Readiness|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 const refresh=async()=>{setBusy(true);setError("");try{const user=await currentAccount();if(user.role!=="admin")throw Error("เฉพาะ Admin");setData(await api<Readiness>("/admin/readiness"));}catch(e){setError(e instanceof Error?e.message:"ตรวจสถานะไม่สำเร็จ");}finally{setBusy(false);}};
 useEffect(()=>{void refresh();},[]);
 return <section className="merchant-panel"><div className="button-row"><h2>ความพร้อมเปิดใช้งานและสถานะบริการ</h2><button disabled={busy} onClick={()=>void refresh()}>{busy?"กำลังตรวจ…":"ตรวจสถานะล่าสุด"}</button></div>{error&&<p role="alert">{error}</p>}{data&&<>
 <p>ตรวจล่าสุด {new Date(data.checkedAt).toLocaleString("th-TH")} · CMS เผยแพร่ v{data.cms.publishedRevision}</p>
 <p><strong>โหมดระบบ:</strong> {data.demoMode?"Demo — ยังไม่ใช่การตรวจรับการชำระเงินจริง":"ใช้งานจริง"} · ตรวจสลิปโดยคน ({data.paymentMode})</p>
 <p>ข้อมูลรับชำระ: {data.paymentConfigured?"ตั้งค่าแล้ว":"ยังไม่ได้ตั้งค่า"} · SMTP สำหรับอีเมลชำระเงิน: {data.smtpConfigured?"ตั้งค่าแล้ว (ตรวจส่งจริงแยกต่างหาก)":"ยังไม่ได้ตั้งค่า"}</p>
 <h3>การเข้าสู่ระบบ</h3><p>Facebook: {data.facebookStatus==="waiting-approval"?"รอ Meta อนุมัติ — ปิดใช้งานไว้":data.oauth.facebook?"เปิดใช้งาน — ต้องตรวจรับกับ Meta จริง":"ยังตั้งค่าไม่ครบ"}</p><p>Google: {data.oauth.google?"ตั้งค่าแล้ว":"ยังไม่ตั้งค่า"} · LINE: {data.oauth.line?"ตั้งค่าแล้ว":"ยังไม่ตั้งค่า"}</p>
 {(["sms","email"] as const).map(channel=><div className="cms-block-editor" key={channel}><h3>{channel.toUpperCase()} OTP</h3><p>การตั้งค่า: {data.otp.channels[channel]?"ครบ":"ยังไม่ครบ"} · รูปแบบส่ง: {channel==="sms"?data.otp.smsMode:data.otp.emailMode}</p><p>ส่งรหัสล่าสุด: {outcome(channel==="sms"?data.otp.smsDelivery:data.otp.emailDelivery)}</p><p>ยืนยันรหัสล่าสุด: {outcome(channel==="sms"?data.otp.smsVerification:data.otp.emailVerification,true)}</p></div>)}
 <h3>คิวอีเมลแจ้งชำระ</h3>{data.mail.counts.length?data.mail.counts.map(row=><p key={row.status}>{row.status}: {row.count}</p>):<p>ยังไม่มีรายการ</p>}{data.mail.lastFailure&&<p role="status">ข้อผิดพลาดล่าสุด: {data.mail.lastFailure.reason}</p>}
 <p>Villa ที่ยังไม่ได้ระบุจำนวนผู้พัก: {data.missingGuestCapacities} รายการ ให้ Merchant เติมข้อมูลจริงและส่งตรวจตาม Flow</p>
 <p>ใบแจ้งชำระเก่าที่ยังไม่มีข้อมูลบัญชี ณ ตอนสร้าง: {data.legacyInvoicesWithoutBankSnapshot} รายการ ตรวจข้อมูลกับทีมงานก่อนรับชำระจริง ระบบไม่คาดเดาหรือเขียนทับข้อมูลย้อนหลัง</p>
 <p>การตรวจอุปกรณ์จริง, UAT โดยทีมธุรกิจ และระยะเวลาเก็บ Backup ของผู้ให้บริการ ต้องบันทึกผลตรวจรับแยกต่างหาก การมีการตั้งค่าไม่ถือว่าผ่านการใช้งานจริงแล้ว</p>
 <details className="cms-faq"><summary>คู่มือ Admin และขั้นตอนตรวจรับ</summary><ol>
 <li><strong>CMS:</strong> แก้เนื้อหา → บันทึกร่าง → Preview → เผยแพร่ → เปิดหน้าสาธารณะตรวจผล หากผิดให้คืนเวอร์ชันเป็นร่างแล้วเผยแพร่อีกครั้ง Admin ทุกคนแก้และเผยแพร่ได้</li>
 <li><strong>Villa:</strong> ตรวจเอกสารและข้อมูลจริง ระบุเหตุผลเมื่อขอแก้ไขหรือปฏิเสธ อนุมัติจึงเปิดสิทธิ์ตามแพ็กเกจ ข้อมูลที่ Merchant แก้ต้องตรวจใหม่</li>
 <li><strong>สลิป:</strong> ตรวจยอด บัญชี และรายการรับเงินจริงก่อนกรอกเลขธุรกรรมยืนยัน หากไม่ผ่านให้ส่งกลับพร้อมเหตุผล ไม่ใช้การอนุมัติอัตโนมัติ</li>
 <li><strong>แพ็กเกจ:</strong> ตรวจราคา จำนวน Villa และสิทธิ์ก่อนบันทึก กติกาอายุสิทธิ์ที่เผยแพร่จาก CMS ใช้กับใบแจ้งชำระใหม่เท่านั้น ใบเดิมคงเงื่อนไขเดิม</li>
 <li><strong>อีเมล:</strong> ตรวจคิวส่งและข้อผิดพลาด SMTP การส่ง OTP ผ่านไม่ได้ยืนยันว่าอีเมลแจ้งชำระผ่านด้วย หากล้มเหลวให้ตรวจบริการและใช้ปุ่มส่งซ้ำในรายการอีเมล</li>
 <li><strong>ตรวจรับ:</strong> ให้ทีมธุรกิจทดลองสมัคร เพิ่ม Villa ส่งเอกสาร ตรวจสลิป ต่ออายุ QR แจ้งปัญหา และแก้ CMS พร้อมบันทึก Pass/Fail บนอุปกรณ์จริงก่อนยืนยันเปิดใช้งานจริง</li>
 <li><strong>สำรองข้อมูล:</strong> ผู้ดูแลระบบใช้คำสั่ง db:backup เก็บไฟล์เข้ารหัสและกุญแจแยกกัน กู้คืนด้วย db:restore ไปยังฐานข้อมูลใหม่ที่ว่างและผ่าน migration แล้ว ระบบไม่กู้คืน session/OTP เก่า ตรวจข้อมูลและการชำระก่อนเปิดบริการส่งอีเมล</li>
 <li><strong>หลังเปิดระบบ:</strong> ตรวจหน้านี้เมื่อมีปัญหา ใช้ check:health เพื่อตรวจบริการ และรับเรื่องผ่านแบบฟอร์มแจ้งปัญหา/ข้อมูลติดต่อที่ตั้งใน CMS</li>
 </ol></details>
 </>}</section>;
}
