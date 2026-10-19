export async function receivingBank(db) {
  const row = await db.prepare("SELECT value FROM system_settings WHERE key='receiving_bank'").get()
  return row ? JSON.parse(row.value) : null
}
export function bankInstructions(bank) {
  return `ธนาคาร: ${bank.bankName}\nชื่อบัญชี: ${bank.accountName}\nเลขบัญชี: ${bank.accountNumber}\nประเภทบัญชี: ${{savings:"ออมทรัพย์",current:"กระแสรายวัน",other:"อื่น ๆ"}[bank.accountType]||"ไม่ระบุ"}\nพร้อมเพย์: ${bank.promptpayId}${bank.instructions ? `\n${bank.instructions}` : ""}`
}
