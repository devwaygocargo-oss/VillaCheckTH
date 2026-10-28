import {randomUUID} from 'node:crypto'
const events=new Set(['authentication.failed','authentication.succeeded','document.accessed','otp.rejected','account.changed','admin.action'])
const identifier=value=>typeof value==='string'&&/^[a-f0-9-]{36}$/.test(value)?value:null
// An allowlist, not generic object redaction. Never serialize request data,
// exception messages, addresses, cookies, passwords, tokens or document bytes.
export function securityEvent(event,fields={},sink=console.info){
 if(!events.has(event))throw Error('Unsupported security event')
 const entry={eventId:randomUUID(),at:new Date().toISOString(),event,actorId:identifier(fields.actorId),targetId:identifier(fields.targetId)}
 sink(JSON.stringify(entry))
 return entry
}
