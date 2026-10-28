import {assertDemoSeedAllowed} from './production-demo-gate.mjs'
import {createHash,randomUUID} from "node:crypto"
import {createUser,addMonths} from "./database.mjs"
import {seedCatalog,trustDto} from "./catalog.mjs"
import {seedFreeDemo} from "./demo-free-seed.mjs"
const uuid=(name)=>{const h=createHash('sha256').update(`villacheck-demo:${name}`).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`}
export function dummyPdf(details={}){
 const pdfText=value=>String(value).replace(/[^\x20-\x7e]/g,'?').replace(/[()\\]/g,'\\$&');
 const lines=Object.entries(details).map(([label,value])=>`0 -22 Td (${pdfText(label+': '+value)}) Tj`).join(' ');
 const content='BT /F1 14 Tf 40 150 Td (VillaCheck dummy document - NOT legal evidence) Tj'+(lines?' '+lines:'')+' ET';
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>',`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${lines?'720 300':'500 220'}] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>`,`<< /Length ${content.length} >>\nstream\n${content}\nendstream`,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
 let data='%PDF-1.4\n';const offsets=[0];for(const [i,object]of objects.entries()){offsets.push(Buffer.byteLength(data));data+=`${i+1} 0 obj\n${object}\nendobj\n`;}
 const xref=Buffer.byteLength(data);data+=`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(x=>String(x).padStart(10,'0')+' 00000 n ').join('\n')}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
 return Buffer.from(data);
}
export async function seedDemo(db,{password,adminEmail,adminPassword}={}){
 assertDemoSeedAllowed(process.env,db.connectionIdentity)
 if(!password || password.length<12)throw Error('DEMO_PASSWORD must have at least 12 characters')
 return db.transaction(async()=>{
  await seedCatalog(db)
  await db.prepare("INSERT INTO system_settings(key,value) VALUES ('demo_mode','true') ON CONFLICT(key) DO NOTHING").run()
  const add=async(email,name,role,pw=password)=>{
   const existing=await db.prepare('SELECT * FROM users WHERE email=?').get(email)
   if(existing&&existing.role!==role)throw Error('Dummy account role does not match its scenario')
   return existing||await createUser(db,email,pw,name,role)
  }
  const merchant=await add('demo-merchant@villacheck.example','Merchant ','merchant')
  const regional=await add('demo-regional@villacheck.example','Merchant จุดหมาย','merchant')
  const customer=await add('demo-user@villacheck.example','User ','user')
  if(adminEmail && adminPassword)await add(adminEmail,'Admin สำหรับทดสอบ','admin',adminPassword)
  const now=new Date().toISOString(),expires=addMonths(new Date(),3)
  await db.prepare("INSERT INTO subscriptions(owner_id,package_id,expires,payments,created,lifecycle) VALUES (?,'premium',?,1,?,'ACTIVE') ON CONFLICT(owner_id) DO NOTHING").run(merchant.id,expires,now)
  await db.prepare("INSERT INTO subscriptions(owner_id,package_id,expires,payments,created,lifecycle) VALUES (?,'premium',?,1,?,'ACTIVE') ON CONFLICT(owner_id) DO NOTHING").run(regional.id,expires,now)
  const samples=[['Sea Sky Demo Villa','ชลบุรี','approved'],['Chiang Mai Demo Villa','เชียงใหม่','approved'],['Phuket Demo Villa','ภูเก็ต','approved'],['Hua Hin Demo Villa','ประจวบคีรีขันธ์','pending'],['Krabi Demo Villa','กระบี่','changes'],['Expired Demo Villa','สุราษฎร์ธานี','approved'],['Krabi Cliff Demo Villa','กระบี่','approved'],['Khao Yai Forest Demo Villa','นครราชสีมา','approved'],['Rayong Ocean Demo Villa','ระยอง','approved'],['Phang Nga Lagoon Demo Villa','พังงา','approved'],['Cha Am Garden Demo Villa','เพชรบุรี','approved'],['Hua Hin Palm Demo Villa','ประจวบคีรีขันธ์','approved'],['Bangkok Garden Demo Villa','กรุงเทพมหานคร','approved',9],['Samui Island Demo Villa','สุราษฎร์ธานี','approved',4]]
  const ownerExpiry=new Map((await db.prepare('SELECT owner_id,expires FROM subscriptions WHERE owner_id IN (?,?)').all(merchant.id,regional.id)).map(row=>[row.owner_id,row.expires]))
  for(const [index,[name,province,status,imageIndex]]of samples.entries()){
   const owner=index>=6?regional:merchant
   const id=uuid(name),doc=uuid(`${name}-document`),expired=name.startsWith('Expired')
   await db.prepare("INSERT INTO documents(id,owner_id,name,mime,bytes) VALUES (?,?,?,?,?) ON CONFLICT(id) DO NOTHING").run(doc,owner.id,'dummy-ownership.pdf','application/pdf',dummyPdf())
   await db.prepare("INSERT INTO villas(id,owner_id,name,province,merchant,email,package_id,document_id,status,qr,expires,created,phone,bank_name,account_name,account_number,verification_level,payments) VALUES (?,?,?,?,?,?,'premium',?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING")
    .run(id,owner.id,name,province,'ธุรกิจสาธิต — ไม่ใช่ที่พักจริง',owner.email,doc,status,status==='approved'?`VC-DEMO-${id}`:null,expired?'2000-01-01T00:00:00.000Z':status==='approved'?(ownerExpiry.get(owner.id)||expires):null,now,'0800000000','ธนาคาร — ห้ามโอนเงินจริง','บัญชีสาธิต','0000000000',status==='approved'?'VERIFIED':'REGISTERED',status==='approved'?1:0)
   await db.prepare('UPDATE villas SET guest_capacity=? WHERE id=? AND guest_capacity IS NULL AND NOT EXISTS (SELECT 1 FROM system_settings WHERE key=?)').run(index % 2 ? 8 : 12,id,'villa_review:'+id)
   await db.prepare("UPDATE villas SET photo_url=? WHERE id=? AND (photo_url='' OR photo_url=?) AND NOT EXISTS (SELECT 1 FROM system_settings WHERE key=?)").run(`/demo/villas/villa-${imageIndex??(index>=6?index-2:index%3+1)}.jpg`,id,`/demo/villas/villa-${index%3+1}.jpg`,'villa_review:'+id)
  }
  // Labelled advertising fixtures use the same paid Premium entitlement checks as real ads.
  for(const [order,name,paidName,headlineText,descriptionText] of [
   [0,'Sea Sky Demo Villa','Chiang Mai Pool Villa Online Dummy'],
   [1,'Khao Yai Forest Demo Villa','Khao Yai Pool Villa Online Dummy 3'],
   [2,'Phuket Demo Villa','Krabi Pool Villa Online Dummy 4'],
   [3,'Chiang Mai Demo Villa','Chiang Mai Pool Villa Online Dummy','เปลี่ยนเช้าวุ่น ๆ เป็นเช้าที่ได้พัก','พักสายตากับบรรยากาศสีเขียว แล้วใช้วันพักผ่อนให้ช้าลงอีกนิด'],
   [4,'Krabi Cliff Demo Villa','Krabi Pool Villa Online Dummy 4','ทริปครั้งนี้ ขอมีแค่คนรู้ใจ','ค้นหาไอเดียวันพักผ่อน ท่ามกลางวิวธรรมชาติและบรรยากาศส่วนตัว'],
   [5,'Rayong Ocean Demo Villa','Khao Yai Pool Villa Online Dummy 3','ปิดแจ้งเตือน แล้วเปิดโหมดพักผ่อน','ชวนแก๊งคนโปรดมาเปลี่ยนบรรยากาศ กับทริปพักผ่อนที่เลือกได้เอง'],
   [6,'Phang Nga Lagoon Demo Villa','Phang Nga Pool Villa Online Dummy 5','เก็บภาพวันดี ๆ ในมุมพักผ่อนที่ชอบ','เก็บภาพสวยและช่วงเวลาที่อยากจำ ในวันพักผ่อนที่ไม่ต้องเร่งรีบ'],
   [7,'Bangkok Garden Demo Villa','Chiang Mai Pool Villa Online Dummy','วันหยุดมีไม่บ่อย ใช้ให้เต็มที่กับคนโปรด','เติมไอเดียให้ทริปครั้งใหม่ แล้วเลือกมุมพักผ่อนที่ใช่สำหรับคุณ'],
  ]){
   const villa=await db.prepare("SELECT * FROM villas WHERE name=? AND package_id='premium' AND payments>0 AND status='approved' AND expires>? ORDER BY created,id LIMIT 1").get(paidName,now) || await db.prepare('SELECT * FROM villas WHERE id=?').get(uuid(name));
   if(!villa || villa.package_id!=='premium' || villa.payments<1 || villa.status!=='approved')continue;
   const id=uuid((order<3?villa.name:name)+'-home-ad');
   const headline=headlineText||'พักผ่อนกับพูลวิลล่าส่วนตัว ที่'+villa.province;
   const copy=descriptionText||villa.province+' · สระว่ายน้ำส่วนตัว พร้อมพื้นที่พักผ่อนสำหรับทริปกับคนที่คุณรัก';
   const ad={id,villaId:villa.id,villaName:villa.name,placement:'home',image:villa.photo_url,mobileImage:villa.photo_url,title:headline,description:copy+' — '+villa.name+' · ข้อมูลโฆษณา ไม่เปิดรับจองจริง',href:'#page=verify&item='+encodeURIComponent(villa.qr),label:'ดูที่พัก',startsAt:now,endsAt:villa.expires,visible:true,approved:true,order,updatedAt:now,approvedBy:null,approvedAt:now,demo:true};
   await db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?) ON CONFLICT(key) DO NOTHING').run('advertisement:'+id,JSON.stringify(ad));
  }
  // Dedicated, explicitly simulated Pro purchase; never alter an existing customer's plan.
  const footerName='Hua Hin Footer Ad Demo Villa';
  const footerOwner=await add('demo-footer@villacheck.example','Merchant โฆษณา Footer ','merchant');
  const footerId=uuid(footerName),footerDoc=uuid(footerName+'-document');
  await db.prepare("INSERT INTO subscriptions(owner_id,package_id,expires,payments,created,lifecycle) VALUES (?,'pro',?,1,?,'ACTIVE') ON CONFLICT(owner_id) DO NOTHING").run(footerOwner.id,expires,now);
  await db.prepare("INSERT INTO documents(id,owner_id,name,mime,bytes) VALUES (?,?,?,?,?) ON CONFLICT(id) DO NOTHING").run(footerDoc,footerOwner.id,'dummy-ownership.pdf','application/pdf',dummyPdf({'Villa ID':footerId,'Villa name':footerName,'Merchant email':footerOwner.email,'Purpose':'DUMMY Pro footer advertising - no real property rights'}));
  await db.prepare("INSERT INTO villas(id,owner_id,name,name_en,province,merchant,email,package_id,document_id,status,qr,expires,created,phone,bank_name,account_name,account_number,verification_level,payments,photo_url,guest_capacity) VALUES (?,?,?,?,'ประจวบคีรีขันธ์',?,?,'pro',?,'approved',?,?,?,?,?,?,?,'VERIFIED',1,'/demo/villas/villa-2.jpg',8) ON CONFLICT(id) DO NOTHING").run(footerId,footerOwner.id,footerName,footerName,'ธุรกิจสาธิต — ไม่ใช่ที่พักจริง',footerOwner.email,footerDoc,'VC-DEMO-'+footerId,expires,now,'0800000000','ธนาคาร — ห้ามโอนเงินจริง','บัญชีสาธิต','0000000000');
  const footerVilla=await db.prepare("SELECT * FROM villas WHERE id=? AND package_id='pro' AND payments>0 AND status='approved' AND expires>?").get(footerId,now);
  if(footerVilla){
   const id=uuid(footerVilla.id+'-footer-ad');
   const ad={id,villaId:footerVilla.id,villaName:footerVilla.name,placement:'footer',image:footerVilla.photo_url,mobileImage:footerVilla.photo_url,title:'วันพักผ่อนของคุณ เริ่มที่'+footerVilla.province,description:footerVilla.name+' · โฆษณา ไม่เปิดรับจองจริง',href:'#page=verify&item='+encodeURIComponent(footerVilla.qr),label:'ดูที่พัก',startsAt:now,endsAt:footerVilla.expires,visible:true,approved:true,order:0,updatedAt:now,approvedBy:null,approvedAt:now,demo:true};
   await db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?) ON CONFLICT(key) DO NOTHING').run('advertisement:'+id,JSON.stringify(ad));
  }
  const extraFooterSamples=[
   ['Khao Yai Footer Ad Demo Villa','นครราชสีมา',5,'พักกลางสีเขียว เติมพลังให้วันหยุด','ชวนคนโปรดมาเปลี่ยนบรรยากาศ กับไอเดียทริปพักผ่อนที่เขาใหญ่'],
   ['Rayong Footer Ad Demo Villa','ระยอง',6,'ปิดโหมดงาน เปิดวันพักที่ระยอง','เก็บกระเป๋าแล้วออกไปหามุมพักผ่อน สำหรับทริปครั้งใหม่ของคุณ'],
   ['Phang Nga Footer Ad Demo Villa','พังงา',7,'ให้วันพักผ่อน มีภาพจำใหม่ที่พังงา','เติมไอเดียเที่ยวธรรมชาติ แล้วเลือกที่พักที่เข้ากับวันหยุดของคุณ'],
  ];
  for(const [index,[name,province,image,title,copy]] of extraFooterSamples.entries()){
   const owner=await add(`demo-footer-${index+1}@villacheck.example`,'Merchant โฆษณาย่อย '+(index+1),'merchant');
   await db.prepare("INSERT INTO subscriptions(owner_id,package_id,expires,payments,created,lifecycle) VALUES (?,'pro',?,1,?,'ACTIVE') ON CONFLICT(owner_id) DO NOTHING").run(owner.id,expires,now);
   const id=uuid(name),doc=uuid(name+'-document');
   await db.prepare('INSERT INTO documents(id,owner_id,name,mime,bytes) VALUES (?,?,?,?,?) ON CONFLICT(id) DO NOTHING').run(doc,owner.id,'dummy-ownership.pdf','application/pdf',dummyPdf({'Villa ID':id,'Villa name':name,'Merchant email':owner.email,'Purpose':'DUMMY Pro footer advertising - no real property rights'}));
   await db.prepare("INSERT INTO villas(id,owner_id,name,name_en,province,merchant,email,package_id,document_id,status,qr,expires,created,phone,bank_name,account_name,account_number,verification_level,payments,photo_url,guest_capacity) VALUES (?,?,?,?,?,?,?,'pro',?,'approved',?,?,?,?,?,?,?,'VERIFIED',1,?,8) ON CONFLICT(id) DO NOTHING").run(id,owner.id,name,name,province,'ธุรกิจสาธิต — ไม่ใช่ที่พักจริง',owner.email,doc,'VC-DEMO-'+id,expires,now,'0800000000','ธนาคาร — ห้ามโอนเงินจริง','บัญชีสาธิต','0000000000',`/demo/villas/villa-${image}.jpg`);
   const villa=await db.prepare("SELECT * FROM villas WHERE id=? AND package_id='pro' AND payments>0 AND status='approved' AND expires>?").get(id,now);
   if(villa){const adId=uuid(id+'-footer-ad'),ad={id:adId,villaId:id,villaName:villa.name,placement:'footer',image:villa.photo_url,mobileImage:villa.photo_url,title,description:copy+' · โฆษณา ไม่เปิดรับจองจริง',href:'#page=verify&item='+encodeURIComponent(villa.qr),label:'ดูที่พัก',startsAt:now,endsAt:villa.expires,visible:true,approved:true,order:index+1,updatedAt:now,approvedBy:null,approvedAt:now,demo:true};await db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?) ON CONFLICT(key) DO NOTHING').run('advertisement:'+adId,JSON.stringify(ad));}
  }
  // Explicit simulated highest-level Admin results for two labelled demo records only.
  for(const name of ['Sea Sky Demo Villa','Khao Yai Forest Demo Villa'])await db.prepare("UPDATE villas SET verification_level='PREMIUM_VERIFIED' WHERE id=? AND status='approved' AND merchant='ธุรกิจสาธิต — ไม่ใช่ที่พักจริง' AND reviewed_by IS NULL").run(uuid(name))
  // An expired subscription must be separate: QR status follows the account subscription.
  const expired=await add('demo-expired@villacheck.example','Merchant หมดอายุ','merchant')
  await db.prepare("INSERT INTO subscriptions(owner_id,package_id,expires,payments,created,lifecycle) VALUES (?,'starter','2000-01-01T00:00:00.000Z',1,?,'ACTIVE') ON CONFLICT(owner_id) DO NOTHING").run(expired.id,now)
  await db.prepare('UPDATE villas SET owner_id=?,package_id=\'starter\' WHERE id=? AND owner_id=?').run(expired.id,uuid('Expired Demo Villa'),merchant.id)
  await db.prepare("UPDATE documents SET owner_id=? WHERE id=?").run(expired.id,uuid("Expired Demo Villa-document"))
  for(const [email,name,plan] of [['demo-payment@villacheck.example','Payment Workflow Demo Villa','starter'],['demo-trial@villacheck.example','Free Trial Demo Villa','basic']]){
   const owner=await add(email,name+' Merchant','merchant'),id=uuid(name),doc=uuid(name+'-document')
   await db.prepare("INSERT INTO subscriptions(owner_id,package_id,payments,created,lifecycle) VALUES (?,?,0,?,'PENDING_RENEWAL') ON CONFLICT(owner_id) DO NOTHING").run(owner.id,plan,now)
   await db.prepare("INSERT INTO documents(id,owner_id,name,mime,bytes) VALUES (?,?,?,?,?) ON CONFLICT(id) DO NOTHING").run(doc,owner.id,'dummy-ownership.pdf','application/pdf',dummyPdf())
   await db.prepare("INSERT INTO villas(id,owner_id,name,province,merchant,email,package_id,document_id,status,created,photo_url,phone,bank_name,account_name,account_number,verification_level,payments) VALUES (?,?,?,'ชลบุรี',?,?,?,?, 'pending',?, '/demo/villas/villa-1.jpg','0800000000','DEMO BANK','DEMO ACCOUNT','0000000000','REGISTERED',0) ON CONFLICT(id) DO NOTHING").run(id,owner.id,name,'DEMO business - no real bookings',email,plan,doc,now)
  }
  await synchronizeDemoProfilesAndDocuments(db,[...samples.map(([name])=>name),'Payment Workflow Demo Villa','Free Trial Demo Villa',footerName,...extraFooterSamples.map(([name])=>name)],merchant)
  const sampleId=uuid('Sea Sky Demo Villa')
  const sample=await db.prepare('SELECT * FROM villas WHERE id=?').get(sampleId)
  const reportDetails=[
   'DUMMY: User received account 9999999999, which differs from the registered demo account. Merchant and Admin must review; no real transfer.',
   'DUMMY: User requested a QR investigation. Admin is reviewing the same Villa; no real complaint.',
   'DUMMY: Contact inquiry resolved by Admin using the registered Villa details; no real complaint.'
  ]
  for(const [index,status] of ['NEW','UNDER_REVIEW','RESOLVED'].entries()){
   const id=uuid('report-'+index)
   await db.prepare('INSERT INTO support_reports(id,reference,user_id,villa_id,villa_name,type,detail,reporter,contact,status,public_note,created,updated) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').run(id,'RPT-DEMO-'+id,customer.id,sampleId,sample.name,'DEMO report',reportDetails[index],customer.name,customer.email,status,status==='RESOLVED'?'DUMMY: Admin checked the same registered Villa and replied to the User.':'',now,now)
   await db.prepare("UPDATE support_reports SET detail=?,reporter=? WHERE id=? AND detail='Dummy report for workflow testing; no real complaint.' AND reporter='Demo User'").run(reportDetails[index],customer.name,id)
  }
  const sampleTrust=await trustDto(db,sample)
  for(const index of [0,1]){
   const matched=index===0&&sampleTrust.qrStatus==='ACTIVE'
   const checkResult=matched?'DUMMY: Submitted contact and bank account matched the registered Villa at test time; not a booking guarantee.':index===0?'DUMMY: QR is not active; Admin must review this Villa before it can be trusted.':'DUMMY: Submitted account 9999999999 differs from the registered demo account; review before transfer.'
   const id=uuid('check-'+index)
   await db.prepare('INSERT INTO user_checks VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').run(id,'CHK-DEMO-'+id,customer.id,sampleId,sample.name,sample.qr||'',matched?'MATCHED':'REVIEW_REQUIRED',checkResult,index===0?sample.account_number:'9999999999',sample.phone,'demo-'+index,now)
   if(index===1)await db.prepare("UPDATE user_checks SET submitted_account='9999999999',result=? WHERE id=? AND request_key='demo-1' AND result='Dummy check snapshot - not a guarantee of bookings.'").run('DUMMY: Submitted account 9999999999 differs from the registered demo account; review before transfer.',id)
  }
  for(let day=0;day<7;day++)for(const [index,kind]of ['PROFILE_VIEW','QR_SCAN','CONTACT_VIEW'].entries()){
   const stamp=new Date(Date.now()-day*86400000).toISOString(),id=uuid('event-'+stamp.slice(0,10)+'-'+index)
   await db.prepare('INSERT INTO villa_events VALUES (?,?,?,?) ON CONFLICT(id) DO NOTHING').run(id,sampleId,kind,stamp)
  }
  const freeVillas=await seedFreeDemo(db,password,dummyPdf)
  return {merchant:'demo-merchant@villacheck.example',user:'demo-user@villacheck.example',villas:samples.length+6+freeVillas,freeVillas,workflowMerchants:["demo-payment@villacheck.example","demo-trial@villacheck.example"]}
 // Remote fixture bootstrap may exceed the normal 30s write limit.
 },{timeout:120000})
}

// Repair only our deterministic fixtures and their untouched legacy defaults.
// Merchant edits, replacement documents, review decisions and historical snapshots remain intact.
async function synchronizeDemoProfilesAndDocuments(db,names,originalMerchant){
 const emails=['demo-merchant@villacheck.example','demo-regional@villacheck.example','demo-expired@villacheck.example','demo-payment@villacheck.example','demo-trial@villacheck.example','demo-footer@villacheck.example','demo-footer-1@villacheck.example','demo-footer-2@villacheck.example','demo-footer-3@villacheck.example']
 const placeholders=values=>values.map(()=>'?').join(',')
 const ownerRows=await db.prepare(`SELECT * FROM users WHERE role='merchant' AND email IN (${placeholders(emails)})`).all(...emails)
 const owners=new Map(ownerRows.map(owner=>[owner.id,owner]))
 const ids=names.map(uuid)
 const villas=await db.prepare(`SELECT * FROM villas WHERE id IN (${placeholders(ids)}) ORDER BY created,id`).all(...ids)
 const expectedDocs=new Set(names.map(name=>uuid(name+'-document')))
 const docIds=[...new Set(villas.map(v=>v.document_id).filter(id=>expectedDocs.has(id)))]
 const docs=docIds.length?await db.prepare(`SELECT * FROM documents WHERE id IN (${placeholders(docIds)})`).all(...docIds):[]
 const documents=new Map(docs.map(doc=>[doc.id,doc]))
 const reviewKeys=ids.map(id=>'villa_review:'+id)
 const reviews=new Set((await db.prepare(`SELECT key FROM system_settings WHERE key IN (${placeholders(reviewKeys)})`).all(...reviewKeys)).map(row=>row.key))
 for(const owner of ownerRows){
  const villa=villas.find(v=>v.owner_id===owner.id)
  if(villa)for(const [field,value]of [['business_name',villa.merchant],['phone',villa.phone],['address','DUMMY address - not a real business location']]){
   if(!owner[field])await db.prepare(`UPDATE users SET ${field}=? WHERE id=? AND ${field}=''`).run(value||'',owner.id)
  }
 }
 const generic=dummyPdf()
 for(const name of names){
  const villa=villas.find(v=>v.id===uuid(name)),owner=villa&&owners.get(villa.owner_id)
  if(!owner)continue
  if(name==='Expired Demo Villa'&&owner.email==='demo-expired@villacheck.example'&&villa.email===originalMerchant.email)
   await db.prepare('UPDATE villas SET email=? WHERE id=? AND email=?').run(owner.email,villa.id,originalMerchant.email)
  if(!reviews.has('villa_review:'+villa.id)&&!villa.reviewed_by&&['pending','changes'].includes(villa.status)){
   if(villa.verification_level==='VERIFIED')await db.prepare("UPDATE villas SET verification_level='REGISTERED' WHERE id=? AND verification_level='VERIFIED'").run(villa.id)
   if(villa.status==='changes'&&!villa.reason)
    await db.prepare("UPDATE villas SET reason=? WHERE id=? AND reason='' ").run('DUMMY: ownership document needs additional detail; Merchant must upload a replacement for Admin review.',villa.id)
  }
  if(villa.document_id!==uuid(name+'-document'))continue
  const doc=documents.get(villa.document_id)
  if(doc?.owner_id===owner.id&&doc.name==='dummy-ownership.pdf'&&Buffer.from(doc.bytes).equals(generic)){
   await db.prepare('UPDATE documents SET bytes=? WHERE id=?').run(dummyPdf({'Villa ID':villa.id,'Villa name':villa.name,'Merchant email':owner.email,'Purpose':'DUMMY ownership proof - no real property rights'}),doc.id)
  }
 }
}
