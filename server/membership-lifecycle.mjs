import {verifyQaSyntheticGrant} from './qa-initial-grant-policy.mjs'
// Explicit approved records only. No HTTP grant/renewal route, worker, seed or DDL.
// Existing system_settings PK + adapter transaction/advisory lock serialize writers.
import {createHash,randomUUID} from 'node:crypto'
import {addMonths,audit} from './database.mjs'
export const DAY=86400000
export const activationStartTrigger='DOCUMENTS_COMPLETE_AND_ADMIN_ACTIVATION'
export const membershipPolicyKey='membership_policy:v1'
const fail=message=>{throw Object.assign(Error(message),{status:409})}
export const instant=value=>{if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString()!==value)fail('Explicit valid UTC timestamp required');return Date.parse(value)}
const validGrantEvidence=g=>typeof g?.reason==='string'&&g.reason.trim().length>0&&g.reason.length<=2000&&Array.isArray(g.evidenceRefs)&&g.evidenceRefs.length>0&&g.evidenceRefs.length<=20&&g.evidenceRefs.every(x=>typeof x==='string'&&x.trim().length>0&&x.length<=300)
const read=async(db,key,fallback=null)=>{const row=await db.prepare('SELECT value FROM system_settings WHERE key=?').get(key);return row?JSON.parse(row.value):fallback}
const save=async(db,key,value)=>db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,JSON.stringify(value))
export function validGracePolicy(p){return p?.status==='APPROVED'&&Boolean(p.approvalReference&&p.revision)&&['ROLLING_12_MONTHS','CALENDAR_YEAR_BANGKOK'].includes(p.window)&&p.days===7&&p.uses===1}
const bangkokYear=ms=>new Date(ms+7*3600000).getUTCFullYear()
export function graceEligible(policy,uses,expiry,reference=expiry){
 if(!validGracePolicy(policy))return false
 instant(expiry);const end=instant(reference),cutoff=Date.parse(addMonths(reference,-12))
 // Policy never resets history. Count every prior approved use, even another revision.
 return !uses.some(u=>{const at=instant(u.usedAt);return policy.window==='ROLLING_12_MONTHS'?at>cutoff:bangkokYear(at)===bangkokYear(end)})
}
export function membershipState({expires,lifecycle,ledger,policy,now=Date.now()}){
 if(['SUSPENDED','CANCELLED'].includes(lifecycle))return lifecycle==='SUSPENDED'?'SUSPENDED':'EXPIRED'
 let end;try{end=instant(expires)}catch{return 'EXPIRED'}
 if(now<end)return 'ACTIVE'
 if(!validGracePolicy(policy)||ledger?.version!==1||!Array.isArray(ledger.graceUses))return 'EXPIRED'
 const use=ledger.graceUses.find(u=>u.expiresAt===expires)
 if(!use||use.policyRevision!==policy.revision||instant(use.usedAt)<end||instant(use.usedAt)>=end+7*DAY)return 'EXPIRED'
 const prior=ledger.graceUses.filter(u=>u!==use)
 if(!graceEligible(policy,prior,expires,use.usedAt))return 'EXPIRED'
 return now<end+7*DAY?'GRACE_PERIOD':'EXPIRED'
}
async function admin(db,actor){const user=await db.prepare('SELECT id,role FROM users WHERE id=?').get(actor?.id||'');if(user?.role!=='admin')throw Object.assign(Error('Admin authorization required'),{status:403});return user}
const ledgerFor=(db,owner)=>read(db,'membership_ledger:'+owner,{version:1,ownerId:owner,graceUses:[]})
const lockMembership=async(db,owner)=>{if(db.dialect==='postgres')await db.prepare('SELECT owner_id FROM subscriptions WHERE owner_id=? FOR UPDATE').get(owner||'')}

export const lifecyclePolicyChecksum=policy=>createHash('sha256').update(JSON.stringify(policy)).digest('hex')
export async function recordApprovedMembershipPolicy(db,{actor,policy,approvedRevision,approvedChecksum}){return db.transaction(async()=>{
 const user=await admin(db,actor)
 if(!validGracePolicy(policy)||policy.revision!==approvedRevision||lifecyclePolicyChecksum(policy)!==approvedChecksum)fail('Approved grace definition/revision/checksum required')
 const old=await read(db,membershipPolicyKey)
 if(old){if(JSON.stringify(old)!==JSON.stringify(policy))fail('Existing policy requires separate change review');return {created:false}}
 await save(db,membershipPolicyKey,policy);await audit(db,user,'membership.policy',policy.revision);return {created:true}
})}
export async function claimGrace(db,{actor,ownerId,now=new Date().toISOString()}){return db.transaction(async()=>{
 const user=await admin(db,actor);await lockMembership(db,ownerId);const policy=await read(db,membershipPolicyKey),sub=await db.prepare('SELECT * FROM subscriptions WHERE owner_id=?').get(ownerId),ledger=await ledgerFor(db,ownerId),at=instant(now)
 if(!validGracePolicy(policy))fail('Grace window definition requires approved policy')
 if(!sub||['SUSPENDED','CANCELLED'].includes(sub.lifecycle))fail('Membership is not eligible')
 const end=instant(sub.expires);if(at<end||at>=end+7*DAY)fail('Outside grace period')
 const existing=ledger.graceUses.find(u=>u.expiresAt===sub.expires)
 if(existing){if(membershipState({expires:sub.expires,lifecycle:sub.lifecycle,ledger,policy,now:at})!=='GRACE_PERIOD')fail('Grace history is not valid');return {claimed:false,state:'GRACE_PERIOD'}}
 if(!graceEligible(policy,ledger.graceUses,sub.expires,now))fail('Grace use limit reached')
 ledger.graceUses.push({id:randomUUID(),expiresAt:sub.expires,usedAt:now,endsAt:new Date(end+7*DAY).toISOString(),policyRevision:policy.revision,actorId:user.id})
 await save(db,'membership_ledger:'+ownerId,ledger);await audit(db,user,'membership.grace',ownerId)
 return {claimed:true,state:'GRACE_PERIOD'}
})}
// Approval of a grant request does not start service. The HTTP Admin review
// consumes it in the same transaction that approves documents/status/QR/snapshot.
export async function recordApprovedGrant(db,{actor,grant,terms,qaContext,now=new Date().toISOString()}){return db.transaction(async()=>{
 const user=await admin(db,actor);await lockMembership(db,grant?.ownerId);instant(now)
 const synthetic=grant?.source==='QA_SYNTHETIC_NO_CHARGE'||terms?.scope==='ISOLATED_QA_ONLY'
 if(synthetic){if(grant?.source!=='QA_SYNTHETIC_NO_CHARGE')fail('QA synthetic grant source required');await verifyQaSyntheticGrant(db,{terms,qaContext})}
 if(terms?.status!=='APPROVED'||!terms.approvalReference||!terms.revision||terms.billingCycle!=='MONTHLY'||terms.initialGrantPolicy!=='EXPLICIT_ADMIN_GRANT'||terms.renewal!=='NO_AUTOMATIC_RENEWAL'||terms.startTrigger!==activationStartTrigger)fail('Approved initial grant policy and Admin activation start required')
 if(!validGrantEvidence(grant))fail('Grant reason and evidence references are required')
 if(!grant?.id||grant.state!=='APPROVED_PENDING_ACTIVATION'||!grant.approvalReference||grant.termsRevision!==terms.revision||!(synthetic||grant.source==='OWNER_APPROVED_NO_CHARGE')||grant.validFrom!=null||grant.validUntil!=null)fail('Initial grant must await Admin activation without preset dates')
 const villa=await db.prepare('SELECT * FROM villas WHERE id=?').get(grant.villaId),sub=await db.prepare('SELECT * FROM subscriptions WHERE owner_id=?').get(grant.ownerId)
 if(!villa||villa.owner_id!==grant.ownerId||villa.status!=='pending'||villa.qr||villa.expires||villa.package_id!==grant.packageId||sub?.package_id!==grant.packageId||sub.expires||['SUSPENDED','CANCELLED'].includes(sub.lifecycle)||!['basic','starter','pro','premium'].includes(grant.packageId))fail('Grant owner/package or initial lifecycle mismatch')
 const key='membership_grant:'+villa.id,old=await read(db,key),record={...grant,terms,actorId:user.id,startTrigger:activationStartTrigger}
 if(old){if(JSON.stringify(old)!==JSON.stringify(record))fail('Existing grant cannot be overwritten');return {created:false}}
 await save(db,key,record);await audit(db,user,'membership.grant.prepared',villa.id);return {created:true,activationPending:true}
})}
export async function initialGrantForReview(db,villa,policyReference,now=Date.now(),actor,qaContext){
 // Must run in the caller's approval transaction; later review errors roll back
 // all expiry/ledger changes. Only current trusted documents are considered.
 if(!actor)fail('Actual Admin approval required')
 await admin(db,actor);await lockMembership(db,villa.owner_id);if(db.dialect==='postgres')await db.prepare('SELECT id FROM villas WHERE id=? FOR UPDATE').get(villa.id)
 const g=await read(db,'membership_grant:'+villa.id),sub=await db.prepare('SELECT * FROM subscriptions WHERE owner_id=?').get(villa.owner_id)
 const synthetic=g?.source==='QA_SYNTHETIC_NO_CHARGE'||g?.terms?.scope==='ISOLATED_QA_ONLY'
 if(synthetic){if(g?.source!=='QA_SYNTHETIC_NO_CHARGE')fail('QA synthetic grant source required');await verifyQaSyntheticGrant(db,{terms:g.terms,qaContext})}
 if(!validGrantEvidence(g))fail('Grant reason and evidence references are required')
 if(!policyReference||!g||g.startTrigger!==activationStartTrigger||g.terms?.startTrigger!==activationStartTrigger||g.terms.approvalReference!==policyReference||g.terms.status!=='APPROVED'||g.terms.billingCycle!=='MONTHLY'||g.state!=='APPROVED_PENDING_ACTIVATION'||g.validFrom!=null||g.validUntil!=null||!(synthetic||g.source==='OWNER_APPROVED_NO_CHARGE')||g.ownerId!==villa.owner_id||g.villaId!==villa.id||g.packageId!==villa.package_id||g.termsRevision!==g.terms.revision||!g.approvalReference||villa.status!=='pending'||villa.qr||villa.expires||sub?.package_id!==g.packageId||sub.expires||['SUSPENDED','CANCELLED'].includes(sub?.lifecycle))fail('Valid approved initial membership entitlement required')
 const doc=await db.prepare('SELECT owner_id,mime,bytes FROM documents WHERE id=?').get(villa.document_id)
 if(!doc||doc.owner_id!==villa.owner_id||!['application/pdf','image/jpeg','image/png'].includes(doc.mime)||!doc.bytes?.length)fail('Required Villa documents must be complete before activation')
 const validFrom=new Date(now).toISOString(),validUntil=addMonths(validFrom,1),active={...g,state:'APPROVED',validFrom,validUntil,activatedAt:validFrom,activatedBy:actor.id,documentId:villa.document_id,documentSha256:createHash('sha256').update(Buffer.from(doc.bytes)).digest('hex')}
 await db.prepare('UPDATE subscriptions SET expires=?,lifecycle=? WHERE owner_id=?').run(validUntil,'ACTIVE',villa.owner_id)
 await db.prepare('UPDATE villas SET expires=? WHERE id=?').run(validUntil,villa.id)
 await save(db,'membership_grant:'+villa.id,active);await audit(db,actor,'membership.activated',villa.id)
 return active
}
export async function renewApprovedMembership(db,{actor,ownerId,approval,now=new Date().toISOString()}){return db.transaction(async()=>{
 const user=await admin(db,actor);await lockMembership(db,ownerId);const at=instant(now)
 if(approval?.status!=='APPROVED'||!approval.id||!approval.reference||approval.months!==1||approval.noCharge!==true||approval.renewalPolicy!=='EXPLICIT_SINGLE_MONTH')fail('Approved one-month renewal required')
 const receiptKey='membership_renewal:'+approval.id,previous=await read(db,receiptKey)
 const fingerprint=createHash('sha256').update(JSON.stringify({ownerId,approval})).digest('hex')
 if(previous){if(previous.fingerprint!==fingerprint)fail('Renewal identity conflict');return {...previous,idempotent:true}}
 const sub=await db.prepare('SELECT * FROM subscriptions WHERE owner_id=?').get(ownerId)
 if(!sub||sub.expires!==approval.expectedExpiresAt||['SUSPENDED','CANCELLED'].includes(sub.lifecycle))fail('Membership changed or unavailable')
 const ledger=await ledgerFor(db,ownerId),policy=await read(db,membershipPolicyKey),state=membershipState({expires:sub.expires,lifecycle:sub.lifecycle,ledger,policy,now:at}),base=state==='ACTIVE'||state==='GRACE_PERIOD'?sub.expires:now,end=addMonths(base,1)
 await db.prepare("UPDATE subscriptions SET expires=?,lifecycle='ACTIVE' WHERE owner_id=?").run(end,ownerId)
 const villas=await db.prepare('SELECT * FROM villas WHERE owner_id=?').all(ownerId)
 for(const villa of villas){const grant=await read(db,'membership_grant:'+villa.id);if(!grant||grant.ownerId!==ownerId||grant.packageId!==sub.package_id||grant.state!=='APPROVED')continue;await db.prepare('UPDATE villas SET expires=? WHERE id=?').run(end,villa.id);await save(db,'membership_grant:'+villa.id,{...grant,validFrom:state==='EXPIRED'?base:grant.validFrom,validUntil:end,renewalFrom:base,renewalApproval:approval.reference})}
 const receipt={ownerId,fingerprint,expiresAt:end,base,stateBefore:state};await save(db,receiptKey,receipt);await audit(db,user,'membership.renewal',ownerId);return receipt
})}
export async function membershipNotices(db,ownerId){const rows=await db.prepare("SELECT value FROM system_settings WHERE key LIKE 'membership_notice:%'").all();return rows.map(r=>JSON.parse(r.value)).filter(n=>n.ownerId===ownerId).map(({id,kind,createdAt,expiresAt})=>({id,kind,createdAt,expiresAt}))}
export async function prepareMembershipNotifications(db,{actor,now=new Date().toISOString()}){
 await admin(db,actor);const at=instant(now),subs=await db.prepare('SELECT * FROM subscriptions WHERE expires IS NOT NULL').all();let created=0
 for(const sub of subs){if(['SUSPENDED','CANCELLED'].includes(sub.lifecycle))continue;let end;try{end=instant(sub.expires)}catch{continue}
  if(at>=end&&at<end+7*DAY){const policy=await read(db,membershipPolicyKey),ledger=await ledgerFor(db,sub.owner_id);if(validGracePolicy(policy)&&graceEligible(policy,ledger.graceUses,sub.expires,now))await claimGrace(db,{actor,ownerId:sub.owner_id,now})}
  await db.transaction(async()=>{const policy=await read(db,membershipPolicyKey),ledger=await ledgerFor(db,sub.owner_id),state=membershipState({expires:sub.expires,lifecycle:sub.lifecycle,ledger,policy,now:at}),kind=at>=end-7*DAY&&at<end?'EXPIRY_REMINDER':state==='GRACE_PERIOD'?'GRACE_PERIOD':at>=end?'EXPIRED':null;if(!kind||['SUSPENDED','CANCELLED'].includes(sub.lifecycle))return
   const id=createHash('sha256').update(JSON.stringify([sub.owner_id,sub.expires,kind])).digest('hex'),key='membership_notice:'+id
   if(await read(db,key))return
   await save(db,key,{id,ownerId:sub.owner_id,expiresAt:sub.expires,kind,createdAt:now,status:'QUEUED',attempts:0,nextAttempt:at});await audit(db,actor,'membership.notification.queued',id);created++
  })
 }
 return {created}
}
export function membershipMessage(notice){
 const titles={EXPIRY_REMINDER:'แจ้งเตือนสมาชิกใกล้หมดอายุ',GRACE_PERIOD:'แจ้งช่วงผ่อนผันสมาชิก 7 วัน',EXPIRED:'แจ้งสิทธิ์สมาชิกหมดอายุ'}
 return {subject:titles[notice.kind]||'แจ้งสถานะสมาชิก',text:`${titles[notice.kind]||'สถานะสมาชิก'} · วันหมดอายุ ${new Date(notice.expiresAt).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'})} กรุณาตรวจสถานะใน Member Room ไม่มีการต่ออายุหรือเรียกเก็บเงินอัตโนมัติ`}
}
// Capture-only rehearsal dispatcher. No SMTP implementation or scheduled entrypoint.
export async function dispatchMembershipCapture(db,{actor,approvalReference,transport,now=new Date().toISOString()}){
 await admin(db,actor);if(!approvalReference||typeof transport?.capture!=='function')fail('Explicit capture transport approval required');const at=instant(now),rows=await db.prepare("SELECT key,value FROM system_settings WHERE key LIKE 'membership_notice:%'").all();let delivered=0
 for(const row of rows){const lease=randomUUID(),notice=await db.transaction(async()=>{const n=await read(db,row.key);if(!['QUEUED','FAILED','SENDING'].includes(n.status)||n.attempts>=3||n.nextAttempt>at)return null;
 const sub=await db.prepare('SELECT * FROM subscriptions WHERE owner_id=?').get(n.ownerId),state=sub?membershipState({expires:sub.expires,lifecycle:sub.lifecycle,ledger:await ledgerFor(db,n.ownerId),policy:await read(db,membershipPolicyKey),now:at}):'EXPIRED';
 if(!sub||sub.expires!==n.expiresAt||['SUSPENDED','CANCELLED'].includes(sub.lifecycle)||(n.kind==='EXPIRY_REMINDER'&&at>=instant(n.expiresAt))||(n.kind==='GRACE_PERIOD'&&state!=='GRACE_PERIOD')||(n.kind==='EXPIRED'&&state!=='EXPIRED')){n.status='CANCELLED';await save(db,row.key,n);return null}
 n.status='SENDING';n.attempts++;n.nextAttempt=at+120000;n.lease=lease;await save(db,row.key,n);return n});if(!notice)continue
  try{await transport.capture({idempotencyKey:notice.id,kind:notice.kind,ownerId:notice.ownerId,expiresAt:notice.expiresAt,...membershipMessage(notice)});await db.transaction(async()=>{const n=await read(db,row.key);if(n.lease!==lease)return;n.status='CAPTURED';await save(db,row.key,n);await audit(db,actor,'membership.notification.captured',n.id)});delivered++}
  catch{await db.transaction(async()=>{const n=await read(db,row.key);if(n.lease!==lease)return;n.status='FAILED';n.lastError='Capture failed';await save(db,row.key,n);await audit(db,actor,'membership.notification.failed',n.id)})}
 }
 return {delivered}
}
