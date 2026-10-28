// Staging cannot send mail to a customer outside an operator-defined test list.
export function stagingMailTransport(transport,env){
 if(!transport||env.APP_ENV!=="staging")return transport
 const allowed=new Set((env.STAGING_EMAIL_ALLOWLIST||"").split(",").map(s=>s.trim().toLowerCase()).filter(Boolean))
 return {options:transport.options,verify:()=>transport.verify(),sendMail:message=>{
  if(typeof message.to!=="string"||!allowed.has(message.to.trim().toLowerCase())||message.cc||message.bcc)throw Object.assign(Error("Staging recipient is not allowed"),{code:"EENVELOPE"})
  return transport.sendMail(message)
 }}
}
