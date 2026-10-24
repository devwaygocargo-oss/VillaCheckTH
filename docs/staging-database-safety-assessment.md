# Database Safety Assessment สำหรับ Vercel Staging

**ยังยืนยันฐานบน staging ไม่ได้** Vercel API ตอบ 403 ไม่มีชื่อ provider/DB/project/schema/TLS/role หรือ migration status ของ host ที่ตรวจยืนยันได้ ไม่ต่อฐานภายนอกและไม่เดาว่าเหมือน local `.env`

## Source ที่ตรวจ

- Next API ใช้ Nest `DomainService` และ `PrismaDatabaseService`; ต้องมี `DATABASE_URL` หรือ alias เดิม ไม่มี SQLite fallback ใน Nest/Prisma path
- Runtime PostgreSQL และ migration direct URL แยกตาม config `scripts/deploy-db.mjs` มี fallback aliases และแปลง Neon pooler เป็น direct ตาม logic เดิม ต้องตรวจ target จริงก่อนรัน
- `npm run build` = Prisma generate + backend compile + Next build ไม่มี migration/seed
- Runtime อาจ bootstrap catalog ว่าง/Admin เมื่อ config กำหนด; standalone legacy adapter มี initialization ต่างจาก Nest จึงไม่ถือว่า GET health พิสูจน์ schema หรือไม่มี bootstrap side effects ทุก topology
- Public demo seed และ demo accounts ต้อง opt-in; production-mode guard เดิมปฏิเสธ local demo users แต่ไม่ได้พิสูจน์ว่า host ไม่มี try-* หรือข้อมูลเดิมอื่น
- ไม่เพิ่ม migration/schema ในรอบนี้ และไม่รัน migration ภายนอก

## หลักฐาน local ที่รันจริง

PostgreSQL ชั่วคราวบน localhost และ schema ทดสอบแยก ตรวจ migration baseline/repeat deploy/QR preservation, Next/Nest/Prisma adapter, encrypted backup ระหว่าง writes และ restore binary/application rows ไป target ว่าง รวมอยู่ใน 262 tests ที่ผ่านทั้งหมด SQLite ผ่าน 254/ข้าม 8 รายการ PostgreSQL-only

Restore บล็อก target ไม่ว่างและ remote restore โดยค่าเริ่มต้น Application backup เก็บ durable tables รวมเอกสาร/settings/QR/history แต่ไม่ใช่ SQL schema/PITR; sessions/OTP/rate limits เป็น transient ต้อง login ใหม่ การซ้อม local ไม่แทน host RPO/RTO/backup นอก host

## Operator ต้องยืนยันก่อนเขียน staging

1. เปิด dashboard ผู้ให้บริการ DB ยืนยัน project/environment เป็น staging แยกจาก production hosting บริษัท เก็บหลักฐานแบบไม่แสดง connection string หรือข้อมูลลูกค้า
2. ตรวจทุก DB URL alias, runtime/direct/backup target, schema/search_path, TLS และ role/connection pool รวม Preview env ว่าไม่ชี้ production
3. ตรวจ schema compatibility/`_prisma_migrations` ด้วยสิทธิ์ read-only ของผู้ดูแล ไม่ mark baseline จากการมีชื่อตารางครบอย่างเดียว
4. สำรองฐานเดิมก่อน migration; ถ้า DB ใหม่ว่างให้ migrate ก่อน snapshotเริ่มต้น ซ้อม restore ลงฐานใหม่ว่าง ไม่ drop/truncate/reset
5. หากต้องปรับ schema ให้ Operator รัน deploy-db หลังยืนยัน target และได้รับอนุญาตต่างหาก งานนี้ไม่อนุญาต migration ภายนอก
6. เก็บ DB เดิมและ invoice/grant/history ทั้งหมดไว้ Inventory test/demo rows แยก ไม่คัดลอก production data มา UAT และไม่ลบ 52 public rows ที่พบโดยเดาว่าเป็น demo
7. บันทึก backup artifact/digest/ผู้ทำ/เวลา/restore result/rollback target โดยแยก encryption key และกำหนด RPO/RTO จริง
