import {assertWriteSession} from './write-session.mjs';
import {audit} from './database.mjs';
const fail=(status,code,message)=>{throw Object.assign(Error(message),{status,code})};
const key=id=>'merchant_receiving_bank:'+id;
const text=(value,max=120)=>typeof value==='string'&&value.trim().length>0&&value.trim().length<=max&&!/[\x00-\x1f\x7f]/.test(value)?value.trim():null;
const view=row=>({configured:!!row,bankName:row?.bankName||'',accountName:row?.accountName||'',maskedAccountNumber:row?'•••• '+row.accountNumber.slice(-4):'',revision:row?.revision||0,updatedAt:row?.updatedAt||null});
export async function merchantReceivingBankApi(db,user,req,path,url,readBody){
 if(path!=='/api/merchant/receiving-bank')return undefined;
 if(!user)fail(401,'AUTHENTICATION_REQUIRED','Please sign in');
 if(user.role!=='merchant')fail(403,'MERCHANT_BANK_FORBIDDEN','Only the account owner can manage receiving bank details');
 if(url.searchParams.has('ownerId')||url.searchParams.has('userId'))fail(400,'MERCHANT_BANK_OWNER_NOT_ALLOWED','The current account is selected by the session');
 const read=async()=>{const row=await db.prepare('SELECT value FROM system_settings WHERE key=?').get(key(user.id));return row?JSON.parse(row.value):null};
 if(req.method==='GET')return view(await read());
 if(!['PATCH','POST'].includes(req.method))fail(405,'MERCHANT_BANK_METHOD_NOT_ALLOWED','Unsupported receiving bank operation');
 const data=await readBody(req);
 if(!data||typeof data!=='object'||Array.isArray(data)||Object.keys(data).some(field=>!['bankName','accountName','accountNumber','revision'].includes(field)))fail(400,'MERCHANT_BANK_INVALID','Invalid receiving bank fields');
 const bankName=text(data.bankName),accountName=text(data.accountName);
 if(!bankName||!accountName||typeof data.accountNumber!=='string'||data.accountNumber.length>30||!Number.isSafeInteger(data.revision)||data.revision<0)fail(400,'MERCHANT_BANK_INVALID','Enter a bank, account holder and valid account number');
 return db.transaction(async()=>{
  await assertWriteSession(db,user);
  const previous=await read();
  if(data.revision!==(previous?.revision||0))fail(409,'MERCHANT_BANK_REVISION_CONFLICT','Receiving bank details changed; reload before saving');
  const accountNumber=data.accountNumber.trim()?data.accountNumber.replace(/[ -]/g,''):previous?.accountNumber||'';
  if(!/^\d{6,20}$/.test(accountNumber))fail(400,'MERCHANT_BANK_INVALID','Enter an account number containing 6–20 digits');
  const next={bankName,accountName,accountNumber,revision:(previous?.revision||0)+1,updatedAt:new Date().toISOString(),updatedBy:user.id};
  await db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key(user.id),JSON.stringify(next));
  await audit(db,user,'merchant.receiving_bank.updated',user.id);
  return view(next);
 });
}
