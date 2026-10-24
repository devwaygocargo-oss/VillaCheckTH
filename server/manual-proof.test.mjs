import test from "node:test"
import assert from "node:assert/strict"
import {openTestDatabase} from "./test-database.mjs"
import {reserveManualProof} from "./manual-proof.mjs"
test("manual proof prevents reuse with changed reference, formatting or another invoice, but permits idempotent resubmission",async t=>{
 const db=await openTestDatabase();t.after(()=>db.close())
 const reserve=(id,reference,file)=>db.transaction(()=>reserveManualProof(db,id,reference,Buffer.from(file)))
 assert.equal(await reserve("one"," Txn - 123 ","receipt-one"),"TXN123")
 await reserve("one","txn123","receipt-one")
 await assert.rejects(reserve("two","DIFFERENT","receipt-one"),{status:409})
 await assert.rejects(reserve("two","txn123","receipt-two"),{status:409})
 assert.equal((await db.prepare("SELECT value FROM system_settings WHERE key LIKE 'manual_reference:%'").all()).length,1,"failed reservation rolls back all keys")
 await reserve("two","txn456","receipt-two")
})
