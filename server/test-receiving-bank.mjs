// Synthetic, non-production receiver for tests that exercise the manual legacy flow.
export async function testReceivingBank(db) {
 const bank={bankName:"DUMMY BANK",accountName:"DUMMY RECEIVER",accountNumber:"0000000000",accountType:"savings",promptpayType:"phone",promptpayId:"0812345678",instructions:"TEST ONLY - NO TRANSFER",qrImage:"",revision:1}
 await db.prepare("INSERT INTO system_settings(key,value) VALUES ('receiving_bank',?) ON CONFLICT(key) DO NOTHING").run(JSON.stringify(bank))
 return bank
}
