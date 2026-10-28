// Localize only system-generated comparison results; never alter stored records,
// identifiers, submitted values, customer text or Admin-authored replies.
const english={
 'ไม่พบที่พักที่ระบุในระบบ':'The specified property was not found.',
 'ข้อมูลตรงกับทะเบียน ณ เวลาตรวจสอบ ไม่ใช่การรับประกันการจอง':'The details match the registry at the time of checking. This does not guarantee a booking.',
 'บัญชีหรือช่องทางติดต่อไม่ตรง กรุณาตรวจสอบกับที่พักก่อนโอน':'The account or contact details do not match. Check with the property before transferring money.',
};
export function localizeCheckResponse(value,language){
 if(!/^en(?:-|,|;|$)/i.test(String(language||'').trim()))return value;
 const record=row=>{
  if(!row||typeof row!=='object'||Array.isArray(row)||typeof row.result!=='string')return row;
  const original=row.result;
  const result=Object.prototype.hasOwnProperty.call(english,original)?english[original]:/^QR ไม่พร้อมใช้งาน: [A-Z_]+$/.test(original)?'QR is unavailable: '+original.slice('QR ไม่พร้อมใช้งาน: '.length):original;
  return result!==original?{...row,result}:row;
 };
 if(Array.isArray(value))return value.map(record);
 if(value&&Array.isArray(value.checks))return{...value,checks:value.checks.map(record)};
 return record(value);
}
