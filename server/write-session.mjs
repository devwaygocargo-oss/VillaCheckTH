// Recheck after acquiring the existing write transaction, so revocation wins over queued writes.
export async function assertWriteSession(db,actor){
 if(!actor.token_hash)return; // Trusted non-HTTP jobs/tests have no browser session.
 const row=await db.prepare("SELECT s.expires,u.role,u.email,p.value AS access FROM sessions s JOIN users u ON u.id=s.user_id LEFT JOIN system_settings p ON p.key='account_status:'||u.id WHERE s.token_hash=? AND s.user_id=?").get(actor.token_hash,actor.id);
 let suspended=false;try{suspended=Boolean(row?.access&&JSON.parse(row.access).status==='suspended')}catch{suspended=true}
 if(!row||!Number.isFinite(Number(row.expires))||Number(row.expires)<=Date.now()||row.role!==actor.role||(typeof actor.email==='string'&&row.email!==actor.email)||suspended)throw Object.assign(Error('บัญชีหรือเซสชันเปลี่ยนแปลง กรุณาเข้าสู่ระบบอีกครั้ง'),{status:401,code:'SESSION_REVOKED'});
}
