import {t as translateSystem} from "./locale"
import {useLocale} from './locale'
import './dashboard-documents.css'
export default function PackageComingSoon(){
 const {t}=useLocale()
 return <section className="package-coming-soon" aria-labelledby="package-coming-soon-title">
  <span className="package-coming-soon-mark" aria-hidden="true">◇</span>
  <p className="kicker">VILLACHECK</p>
  <h1 id="package-coming-soon-title">Coming Soon</h1>
  <h2>{translateSystem('กำลังเตรียมระบบแพ็กเกจ')}</h2>
  <p>{translateSystem('ระบบแพ็กเกจกำลังอยู่ระหว่างเตรียมความพร้อม สิทธิ์การใช้งานเดิมของคุณยังคงเป็นไปตามเงื่อนไขเดิม')}</p>
 </section>
}
