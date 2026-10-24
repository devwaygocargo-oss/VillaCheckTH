import test from "node:test"
import assert from "node:assert/strict"
import {remainingPaidValue,assertNoUnsettledPackageChange} from "./proration.mjs"
const base={paidAmount:99000,startsAt:"2026-10-01T00:00:00Z",endsAt:"2026-11-01T00:00:00Z",at:"2026-10-16T12:00:00Z"}
test("mid-cycle uses actual paid amount and real duration with no rounding",()=>{
 assert.deepEqual(remainingPaidValue(base).unusedValue,{numerator:"49500",denominator:"1"})
 assert.deepEqual(remainingPaidValue({...base,paidAmount:1,at:"2026-10-02T00:00:00Z"}).unusedValue,{numerator:"30",denominator:"31"})
})
test("100% promotion, expired, start boundary and repeat calculation are deterministic",()=>{
 assert.deepEqual(remainingPaidValue({...base,paidAmount:0}).unusedValue,{numerator:"0",denominator:"1"})
 assert.deepEqual(remainingPaidValue({...base,at:base.endsAt}).unusedValue,{numerator:"0",denominator:"1"})
 assert.deepEqual(remainingPaidValue({...base,at:base.startsAt}).unusedValue,{numerator:"99000",denominator:"1"})
 assert.deepEqual(remainingPaidValue(base),remainingPaidValue(base))
 for(const input of [{paidAmount:-1},{paidAmount:1.5},{endsAt:base.startsAt},{at:"invalid"},{at:null},{startsAt:"2026-10-01"}])assert.throws(()=>remainingPaidValue({...base,...input}))
})
test("unsettled upgrades and downgrades cannot destroy remaining value",()=>{
 const villa={payments:1,package_id:"pro",expires:"2099-01-01"}
 for(const target of ["premium","basic"])assert.throws(()=>assertNoUnsettledPackageChange(villa,target),{status:409})
 assert.throws(()=>assertNoUnsettledPackageChange({...villa,expires:null},"pro"),{status:409})
 assert.doesNotThrow(()=>assertNoUnsettledPackageChange(villa,"pro"))
 assert.doesNotThrow(()=>assertNoUnsettledPackageChange({...villa,payments:0},"premium"))
 assert.doesNotThrow(()=>assertNoUnsettledPackageChange({...villa,expires:"2000-01-01"},"basic"))
})
