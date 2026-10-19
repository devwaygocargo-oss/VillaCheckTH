// Never persist provider response text: it can contain credentials or recipient data.
export function smtpDiagnostic(error) {
 const code=String(error?.code||'').toUpperCase(),responseCode=Number(error?.responseCode)
 let category='PROVIDER_ERROR',message='ส่งอีเมลไม่สำเร็จ ตรวจการตั้งค่าบริการ SMTP และสิทธิ์การส่ง'
 if(code==='EAUTH'||responseCode===535){category='AUTHENTICATION';message='SMTP ยืนยันตัวตนไม่สำเร็จ ตรวจชื่อผู้ใช้ credential สำหรับ SMTP และสิทธิ์ส่งอีเมล'}
 else if(['ENOTFOUND','EAI_AGAIN','EDNS'].includes(code)){category='DNS';message='ค้นหา SMTP host ไม่สำเร็จ ตรวจชื่อ host และ DNS'}
 else if(['ETIMEDOUT','ESOCKET','ECONNECTION','ECONNREFUSED','ECONNRESET'].includes(code)){category='CONNECTION';message='เชื่อมต่อ SMTP ไม่สำเร็จ ตรวจ host, port, TLS และเครือข่าย'}
 else if(['ETLS','CERT_HAS_EXPIRED','DEPTH_ZERO_SELF_SIGNED_CERT','ERR_TLS_CERT_ALTNAME_INVALID'].includes(code)){category='TLS';message='ตรวจสอบใบรับรองหรือการตั้งค่า TLS ของ SMTP'}
 else if([421,450,451,452].includes(responseCode)){category='TEMPORARY_PROVIDER_LIMIT';message='ผู้ให้บริการ SMTP จำกัดหรือขัดข้องชั่วคราว ตรวจโควตาและสถานะบริการก่อนส่งซ้ำ'}
 return {category,message,...Number.isInteger(responseCode)&&responseCode>=400&&responseCode<=599?{responseCode}:{}}
}

export function smtpTransportOptions(env){
 const port=Number(env.SMTP_PORT||587),secure=env.SMTP_SECURE?env.SMTP_SECURE==='true':port===465
 if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid SMTP port')
 return {host:env.SMTP_HOST,port,secure,requireTLS:!secure,auth:env.SMTP_USER?{user:env.SMTP_USER,pass:env.SMTP_PASSWORD}:undefined,connectionTimeout:10000,socketTimeout:20000,greetingTimeout:10000}
}
