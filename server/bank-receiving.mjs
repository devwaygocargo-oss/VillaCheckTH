import {notifyOwner} from "./approval-history.mjs"
import { randomUUID } from "node:crypto"
import generatePayload from "promptpay-qr"
import QRCode from "qrcode"
import { audit } from "./database.mjs"
import { demoMode } from "./demo-payment.mjs"
import { receivingBank, bankInstructions } from "./payment-account.mjs"

const fail = (status,message) => { throw Object.assign(Error(message),{status}) }
const text = (value,max=200) => {
  if(typeof value!=="string" || value.length>max || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value)) fail(400,"ข้อมูลบัญชีไม่ถูกต้อง")
  return value.trim()
}
const key = id => `bank_notification:${id}`
async function notifications(db) {
  const rows=await db.prepare("SELECT value FROM system_settings WHERE key LIKE 'bank_notification:%'").all()
  return rows.map(row=>JSON.parse(row.value)).sort((a,b)=>b.created.localeCompare(a.created)||a.id.localeCompare(b.id))
}
async function put(db,id,value) {
  await db.prepare("INSERT INTO system_settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(id,JSON.stringify(value))
}
function validate(data) {
  const bankName=text(data.bankName),accountName=text(data.accountName),accountNumber=text(data.accountNumber,30).replace(/[ -]/g,"")
  const promptpayType=data.promptpayType,promptpayId=text(data.promptpayId,30).replace(/[ -]/g,""),instructions=text(data.instructions||"",2000)
  if(!bankName || !accountName || !/^\d{6,20}$/.test(accountNumber))fail(400,"กรุณาระบุธนาคาร ชื่อบัญชี และเลขบัญชี 6–20 หลัก")
  if(!["phone","taxId"].includes(promptpayType))fail(400,"เลือกประเภทพร้อมเพย์")
  if(promptpayType==="phone"&&!/^0[689]\d{8}$/.test(promptpayId))fail(400,"หมายเลขพร้อมเพย์ต้องเป็นเบอร์มือถือไทย 10 หลัก")
  if(promptpayType==="taxId"){
    if(!/^\d{13}$/.test(promptpayId))fail(400,"เลขประจำตัวผู้เสียภาษีต้องมี 13 หลัก")
    const sum=[...promptpayId.slice(0,12)].reduce((total,n,i)=>total+Number(n)*(13-i),0)
    if((11-sum%11)%10!==Number(promptpayId[12]))fail(400,"เลขประจำตัวผู้เสียภาษีไม่ถูกต้อง")
  }
  if(data.confirmedBinding!==true)fail(400,"กรุณายืนยันว่าพร้อมเพย์ผูกกับบัญชีรับเงินที่ระบุแล้ว")
  const accountType=data.accountType||"savings"
  if(!["savings","current","other"].includes(accountType))fail(400,"ประเภทบัญชีไม่ถูกต้อง")
  return {bankName,accountName,accountNumber,accountType,promptpayType,promptpayId,instructions}
}
async function payableMerchants(db) {
  const rows=await db.prepare("SELECT u.id,u.name,u.business_name,u.email,i.id AS invoice_id,i.amount,i.package_id AS selected_package_id,p.name AS package_name FROM users u JOIN invoices i ON i.subscription_owner=u.id JOIN villas v ON v.id=i.villa_id JOIN package_catalog p ON p.id=COALESCE(i.package_id,v.package_id) WHERE u.role='merchant' AND i.status='pending' AND i.amount>0 ORDER BY u.name,u.id").all()
  return rows.map(({invoice_id,selected_package_id,package_name,...row})=>({...row,invoiceId:invoice_id,packageId:selected_package_id,packageName:package_name}))
}
async function invoiceBank(db,invoiceId,current) {
  const snapshot=await db.prepare("SELECT value FROM system_settings WHERE key=?").get(`invoice_receiving_bank:${invoiceId}`)
  if(snapshot)return JSON.parse(snapshot.value)
  const qr=await db.prepare("SELECT value FROM system_settings WHERE key=?").get(`invoice_bank_qr:${invoiceId}`)
  if(qr&&JSON.parse(qr.value)===current.qrImage)return current
  fail(409,"ใบแจ้งชำระเดิมไม่มีข้อมูลพร้อมเพย์ที่ยืนยันได้ กรุณาตรวจบัญชีในใบแจ้งชำระก่อนส่ง")
}
async function view(db,config,transport) {
  const merchants=await payableMerchants(db)
  const rows=await notifications(db)
  return {bank:await receivingBank(db),merchants:merchants.filter(m=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m.email)&&!m.email.endsWith("@phone.villacheck.invalid")),notifications:rows.slice(0,100).map(({id,merchantId,recipient,merchantName,subject,status,created,sentAt,error,attempts,bank,invoiceId,amount,packageName})=>({id,merchantId,recipient,merchantName,subject,status,created,sentAt,error,attempts,invoiceId,amount,packageName,bankRevision:bank.revision})),demoMode:await demoMode(db,config),smtpConfigured:Boolean(transport)}
}
export async function adminReceivingBank(db,user,req,path,readBody,config,transport,validateOnly=false) {
  if(!path.startsWith("/api/admin/receiving-bank"))return undefined
  if(user.role!=="admin")fail(403,"เฉพาะ Admin")
  if(path==="/api/admin/receiving-bank"&&req.method==="GET")return view(db,config,transport)
  if(path==="/api/admin/receiving-bank"&&req.method==="POST"){
    if(!validateOnly){
      const policy=await db.prepare("SELECT value FROM system_settings WHERE key='approval:reviewer_email'").get()
      if(policy && String(JSON.parse(policy.value)).trim() && String(JSON.parse(policy.value)).trim().toLowerCase()!==user.email?.toLowerCase())fail(403,"เฉพาะ Admin ผู้มีสิทธิ์อนุมัติที่กำหนด")
    }
    const data=await readBody(req),fields=validate(data)
    await db.transaction(async()=>{
      const current=await receivingBank(db)
      if(data.revision!==(current?.revision||0))fail(409,"ข้อมูลถูกแก้ไขแล้ว กรุณาโหลดล่าสุดก่อนบันทึก")
      if(validateOnly)return
      const payload=generatePayload(fields.promptpayId,{})
      let qrDocumentId=current?.qrDocumentId,qrImage=current?.qrImage,generatedAt=current?.generatedAt
      if(!current||current.payload!==payload){
        qrDocumentId=randomUUID();generatedAt=new Date().toISOString()
        const png=await QRCode.toBuffer(payload,{type:"png",width:512,margin:4,errorCorrectionLevel:"M"})
        await db.prepare("INSERT INTO documents(id,owner_id,name,mime,bytes) VALUES (?,?,?,?,?)").run(qrDocumentId,user.id,`receiving-bank-qr:${qrDocumentId}.png`,"image/png",png)
        qrImage=`/api/receiving-bank/qr/${qrDocumentId}`
      }
      const bank={...fields,revision:(current?.revision||0)+1,payload,qrDocumentId,qrImage,generatedAt,updatedAt:new Date().toISOString(),updatedBy:user.name}
      await put(db,"receiving_bank",bank)
      await audit(db,user,"receiving_bank.save",String(bank.revision))
      await notifyOwner(db,{type:"BANK_UPDATED",targetId:String(bank.revision),actorId:user.id,result:"APPROVED"})
    })
    return view(db,config,transport)
  }
  if(path==="/api/admin/receiving-bank/email"&&req.method==="POST"){
    const data=await readBody(req),demo=await demoMode(db,config)
    if(!demo&&!transport)fail(409,"ยังไม่ได้ตั้งค่า SMTP จึงยังส่งอีเมลจริงไม่ได้")
    if(!/^[a-f0-9-]{36}$/.test(data.requestId||""))fail(400,"รหัสคำขอไม่ถูกต้อง")
    if(!Array.isArray(data.merchantIds)||!data.merchantIds.length||data.merchantIds.length>50||data.merchantIds.some(id=>typeof id!=="string")||new Set(data.merchantIds).size!==data.merchantIds.length)fail(400,"เลือก Merchant 1–50 รายโดยไม่ซ้ำ")
    const subject=text(data.subject,200),message=text(data.message||"",4000)
    if(!subject||/[\r\n]/.test(subject))fail(400,"หัวข้ออีเมลไม่ถูกต้อง")
    const fingerprint=JSON.stringify({revision:data.revision,merchantIds:[...data.merchantIds].sort(),invoiceIds:data.invoiceIds,subject,message})
    let ids
    await db.transaction(async()=>{
      const requestKey=`bank_email_request:${data.requestId}`,existing=await db.prepare("SELECT value FROM system_settings WHERE key=?").get(requestKey)
      if(existing){const previous=JSON.parse(existing.value);if(previous.fingerprint!==fingerprint)fail(409,"คำขอส่งซ้ำมีข้อมูลต่างจากเดิม");ids=previous.ids;return}
      const bank=await receivingBank(db)
      if(!bank)fail(409,"กรุณาบันทึกบัญชีรับเงินและ QR ก่อนส่งอีเมล")
      if(data.revision!==bank.revision)fail(409,"บัญชีรับเงินเปลี่ยนแล้ว กรุณาโหลดล่าสุดก่อนส่ง")
      const eligible=await payableMerchants(db),recipients=[]
      for(const id of data.merchantIds){
        const merchant=eligible.find(m=>m.id===id)
        if(!merchant||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(merchant.email)||merchant.email.endsWith("@phone.villacheck.invalid"))fail(400,"เลือกได้เฉพาะ Merchant ที่ซื้อแพ็กเกจ มีใบแจ้งชำระรอชำระ และมีอีเมลรับข้อความได้")
        if(data.invoiceIds&&(!Array.isArray(data.invoiceIds)||!data.invoiceIds.includes(merchant.invoiceId)))fail(409,"รายการชำระเปลี่ยนแล้ว กรุณาโหลดข้อมูลล่าสุด")
        recipients.push(merchant)
      }
      ids=[]
      for(const merchant of recipients){
        const receiver=await invoiceBank(db,merchant.invoiceId,bank)
        const payload=generatePayload(receiver.promptpayId,{amount:merchant.amount/100})
        const qrDocumentId=randomUUID(),png=await QRCode.toBuffer(payload,{type:"png",width:512,margin:4,errorCorrectionLevel:"M"})
        await db.prepare("INSERT INTO documents(id,owner_id,name,mime,bytes) VALUES (?,?,?,?,?)").run(qrDocumentId,user.id,`receiving-bank-qr:${qrDocumentId}.png`,"image/png",png)
        const paymentBank={...receiver,payload,qrDocumentId,qrImage:`/api/receiving-bank/qr/${qrDocumentId}`}
        const id=randomUUID(),created=new Date().toISOString()
        const mail={id,merchantId:merchant.id,merchantName:merchant.name,recipient:merchant.email,invoiceId:merchant.invoiceId,amount:merchant.amount,packageName:merchant.packageName,subject,message,bank:paymentBank,body:`เรียน ${merchant.name}\n\n${message}\n\nแพ็กเกจ: ${merchant.packageName}\nเลขที่ใบแจ้งชำระ: ${merchant.invoiceId}\nยอดชำระ: ฿${(merchant.amount/100).toLocaleString("th-TH",{minimumFractionDigits:2})}\n\n${bankInstructions(receiver)}\n\nQR พร้อมเพย์แนบเป็นไฟล์ PNG ระบุยอดตามใบแจ้งชำระนี้ ตรวจชื่อผู้รับก่อนโอนและแนบสลิปให้ Admin ตรวจ หากชำระแล้วไม่ต้องชำระซ้ำ\n${config.appUrl}/#page=owner-package`,created,status:demo||/\.example$/.test(merchant.email)?"demo":"queued",attempts:0,nextAttempt:0,sentAt:null,error:"",lease:null}
        await put(db,key(id),mail);ids.push(id)
      }
      await put(db,requestKey,{fingerprint,ids})
      await audit(db,user,"receiving_bank.email",data.requestId)
    })
    return {queuedIds:ids,...await view(db,config,transport)}
  }
  const retry=path.match(/^\/api\/admin\/receiving-bank\/notifications\/([a-f0-9-]{36})\/retry$/)
  if(retry&&req.method==="POST"){
    if(!transport)fail(409,"ยังไม่ได้ตั้งค่า SMTP")
    await db.transaction(async()=>{const row=await db.prepare("SELECT value FROM system_settings WHERE key=?").get(key(retry[1]));if(!row)fail(404,"ไม่พบอีเมล");const mail=JSON.parse(row.value);if(mail.status!=="failed")fail(409,"ส่งซ้ำได้เฉพาะอีเมลที่ล้มเหลว");await put(db,key(mail.id),{...mail,status:"queued",attempts:0,nextAttempt:0,error:"",lease:null});await audit(db,user,"receiving_bank.email.retry",mail.id)})
    return view(db,config,transport)
  }
  fail(404,"ไม่พบ API บัญชีรับเงิน")
}
export async function drainBankNotifications(db,config,transport) {
  if(!transport||await demoMode(db,config))return
  for(let i=0;i<(config.serverless?3:10);i++){
    if(!(await notifications(db)).some(m=>["queued","failed","sending"].includes(m.status)&&m.nextAttempt<=Date.now()&&m.attempts<8))break
    const mail=await db.transaction(async()=>{
      const next=(await notifications(db)).reverse().find(m=>["queued","failed","sending"].includes(m.status)&&m.nextAttempt<=Date.now()&&m.attempts<8)
      if(!next)return null
      const claimed={...next,status:"sending",attempts:next.attempts+1,nextAttempt:Date.now()+120000,lease:randomUUID()};await put(db,key(next.id),claimed);return claimed
    })
    if(!mail)break
    let status="sent",error=""
    try{
      if(mail.invoiceId&&!(await db.prepare("SELECT id FROM invoices WHERE id=? AND status='pending' AND amount=? AND subscription_owner=?").get(mail.invoiceId,mail.amount,mail.merchantId))){status="cancelled"}
      else if(/\.example$/.test(mail.recipient)){status="demo"}else{
        const image=await db.prepare("SELECT bytes FROM documents WHERE id=? AND name LIKE 'receiving-bank-qr:%'").get(mail.bank.qrDocumentId)
        if(!image)throw Error("Missing bank QR")
        await transport.sendMail({from:config.smtpFrom,to:mail.recipient,subject:mail.subject,text:mail.body,messageId:`<bank-${mail.id}@villacheck.local>`,attachments:[{filename:"villacheck-bank-qr.png",content:Buffer.from(image.bytes),contentType:"image/png"}]})
      }
    }catch(e){status="failed";error=e.code==="EAUTH"?"SMTP authentication failed":"ส่งอีเมลไม่สำเร็จ กรุณาตรวจการตั้งค่า SMTP"}
    await db.transaction(async()=>{const row=await db.prepare("SELECT value FROM system_settings WHERE key=?").get(key(mail.id));const latest=row&&JSON.parse(row.value);if(latest?.lease!==mail.lease)return;await put(db,key(mail.id),{...latest,status,error,sentAt:["sent","demo"].includes(status)?new Date().toISOString():null,nextAttempt:Date.now()+Math.min(3600000,30000*2**mail.attempts),lease:null})})
  }
}
