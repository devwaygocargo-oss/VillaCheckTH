# ขั้นตอนอัปเดต Staging เดิมและ Rollback

อัปเดต 24 ตุลาคม 2026: VillaCheck ใช้ **GitHub → Vercel Git integration** ไม่ deploy ด้วย Vercel CLI ให้ใช้ [คู่มือ GitHub → Vercel ฉบับปัจจุบัน](github-vercel-staging-deployment.md) แทนขั้นตอน CLI ที่เคยอยู่ในเอกสารนี้

ยังไม่มีการ Push/Merge/Deploy/เปลี่ยน Branch Configuration/แก้ฐานข้อมูลในรอบนี้ Local code ผ่าน QA แต่ก่อน Push ต้องยืนยัน Connected Repository, Production Branch/Branch Tracking, Domains, env scopes, staging DB isolation และ payment DISABLED บน host จริง

## เส้นทางปัจจุบัน

1. ดิวตรวจ Dashboard ตามคู่มือ: project ที่ครอบครอง `design-villacheck.vercel.app`, Git repo และ branch/domain mapping เพราะ Vercel API ยัง 403
2. ยืนยัน staging DB แยกและ payment gate ปิดก่อนให้ Git push trigger build ใด ๆ รวม Preview ซึ่งอาจใช้ env ผิดได้
3. ใช้คำสั่ง Push ไป branch `fix/autonomous-business-security-20261024` ใน **remote ที่ Dashboard ยืนยันเท่านั้น** ไม่ Push main/force หรือ merge เอง
4. ตรวจ GitHub Vercel checks → Deployment Source SHA/Environment → deployment URL → alias staging จริง จากนั้น SMTP/OTP และ UAT 16 กรณี
5. Rollback โดย Operator ที่ได้รับอนุญาตผ่าน Dashboard ตาม environment ที่รองรับ และ revert ผ่าน GitHub review process; ไม่ย้อน DB หรือเปลี่ยน branch config อัตโนมัติ

`origin` และ `legacy` ชี้คนละ GitHub repository ไม่มีข้อมูลยืนยันว่า project staging ใช้ตัวใด GitHub default main ไม่ยืนยัน Vercel Production Branch และ Push feature branch ไม่รับรองว่าจะเปลี่ยน URL หลัก

Production `villacheckth.com` อยู่ hosting บริษัทที่ยังไม่ทราบรายละเอียด ไม่ใช่ Vercel staging และไม่อยู่ในขั้นตอน deploy นี้ คำสั่ง backup/migration ที่ต้องใช้ภายหลังให้ดู [Database safety](staging-database-safety-assessment.md) ต้องตรวจ target และได้รับอนุญาตแยกก่อนทำกับฐานภายนอก
