# Preview Environment Template — staging-preview

เป็นข้อเสนอรออนุมัติ ไม่ใช่ค่าที่ตั้งแล้ว ไม่ระบุ connection string/secret values

Production scope ของ project design-villacheck คง Neon main/neondb ตามที่ตรวจยืนยันภายหลัง Preview เป้าหมาย fixed branch staging-preview/neondb ใน neon-citrine-xylophone โดยต้องทราบ IDs จริงก่อนใช้

| ชื่อที่ code อ่าน | Preview target/value ที่เสนอ | หมายเหตุ |
|---|---|---|
| DATABASE_URL | pooled URL ของ staging-preview/neondb จาก provider secret store | precedence สูงสุด; ไม่พิมพ์ค่า |
| VillaCheck_DATABASE_URL | branch เดียวกัน หรือไม่มี effective fallback ชี้ main | managed variable อาจแก้ตรงไม่ได้ ต้องตรวจ integration scope หลังอนุมัติ |
| DIRECT_URL | direct URL ของ staging-preview/neondb | operator migrations เท่านั้น ไม่ pooler |
| DATABASE_URL_UNPOOLED | ถ้ามีต้องเป็น direct ของ Preview branch หรือไม่อยู่ Preview scope | ไม่ปล่อย main fallback |
| VillaCheck_DATABASE_URL_UNPOOLED | เช่นเดียวกัน | ไม่ลบเอง |
| VillaCheck_POSTGRES_URL_NON_POOLING | เช่นเดียวกัน | ชื่อ exact จาก deploy-db source |
| BACKUP_DATABASE_URL | ไม่จำเป็นบน web Preview; ถ้ามีต้อง Preview-only | ห้าม main/prod target; scheduled job แยก |
| BACKUP_SCHEMA | schema ที่ยืนยันตรง runtime ถ้าทำ operator job | default public ไม่ยืนยันทุก target |
| PAYMENT_ACCESS_MODE | DISABLED | ต้องใช้ explicit ทุก scope |
| OMISE_TEST_ENABLED | false | ไม่มี Test/live charges |
| APP_ENV | staging | email guard |
| APP_URL | approved Preview QA origin ที่ได้จริง | ไม่เดา URL/ไม่ copy main origin ไป Preview อื่น |
| COOKIE_SECURE | true | คง production runtime ไม่ตั้ง development |
| DEMO_MODE | false | DB demo_mode อาจ override; schema-only ควรไม่มี data แต่ต้องตรวจ |
| SEED_DEMO_ACCOUNTS | false | ไม่มี auto demo accounts |
| SEED_PUBLIC_DEMO_DATA | false | ไม่ seed ตอน build |
| OTP_SECRET | secret QA แยกที่ผู้ดูแลจัด อย่างน้อย 32 ตัว | ไม่ copy production secret |
| STAGING_EMAIL_ALLOWLIST | exact QA inbox ที่ได้รับอนุญาตเท่านั้น | ว่างส่ง Email ไม่ได้ ไม่คุม SMS |
| SMTP_HOST/PORT/SECURE/USER/PASSWORD/FROM | QA sender/transport ตาม provider | พิจารณา 587/STARTTLS หรือ 465/TLS ตามจริง ไม่แสดง credentials |
| THAIBULKSMS_* | มีเฉพาะช่องทางที่อนุมัติและตรวจ CMS template แล้ว | ไม่มี SMS kill-switch ชื่อใหม่ใน source; ไม่ให้ keys ของลูกค้า/ไม่ทดสอบ SMS จริง |
| ADMIN_EMAIL/ADMIN_PASSWORD | เฉพาะ bootstrap Admin QA ใหม่ที่อนุมัติ | schema-only ไม่มีบัญชีเดิม; ไม่ reuse บัญชี production |
| PUBLIC_URL | Preview QA URL จริงถ้าตรวจ monitoring | operator tool ไม่ใช่ APP_URL fallback |
| OMISE_TEST_PUBLIC_KEY/SECRET_KEY/METHODS | ไม่จำเป็นสำหรับ Phase1 | ไม่เพิ่ม Live key |

ข้อมูลที่ต้องเก็บเป็นผลตรวจโดยไม่เผยค่า: Production branch ID ต่างจาก Preview branch ID, database/schema/role ถูกต้อง, runtime/direct/backup อยู่ branch ตามหน้าที่, DB production จริงแยก, no main fallback และไม่มี integration injection เปลี่ยน target ภายหลัง

APP_URL ไม่ได้ derive จาก VERCEL_URL ใน source ถ้ายังไม่มี stable Preview URL ให้ Operator วางแผน first Preview + การตั้ง APP_URL/redeploy ที่ได้รับอนุมัติ ก่อน login/OTP/write QA ห้ามอ้างว่า URL เดาได้จากชื่อ Git branch หรือ bypass host/origin checks

## ขอบเขตและ deployment เก่า

ถ้าใช้ Preview scope รวม ทุก feature/PR ที่สร้างใหม่อาจใช้ fixed staging-preview ร่วมกัน จึงยังไม่แยกข้อมูลระหว่าง PR แต่ละชุด ให้กำหนดรอบ QA/branch-specific overrides และยอมรับผลกระทบก่อนอนุมัติ C การปรับ env ไม่ทำให้ deployment เก่าที่เก็บ env snapshot เดิมเปลี่ยน target เอง ต้อง inventory Preview เก่าที่อาจยังชี้ main แล้วเสนอจำกัดการเข้าถึง/จัดการตามการอนุมัติแยก ห้ามลบหรือ redeploy ของเก่าโดยเดา


## Lifetime ไม่ใช่ app Environment Variable

ก่อน deploy ต้องตรวจ expires_at/Automatically delete branch after และ integration cleanup ของ staging-preview จริง Console อาจเปิด 1-day expiration ตอนสร้าง schema-only การตั้ง PAYMENT_ACCESS_MODE หรือ DEMO_MODE ไม่ควบคุม Neon branch lifetime และไม่มี app flag สำหรับปิด Neon auto-delete ใน source นี้ ดู [runbook ที่เพิ่มจุดตรวจแล้ว](neon-preview-approval-and-release.md)
