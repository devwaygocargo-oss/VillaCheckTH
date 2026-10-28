import {t as translateSystem} from "./locale"
import {t} from "./locale"
import {useCms} from "./cms";
type Villa={id:string;name:string;packageId:string;canUpload:boolean};
export default function FacebookMediaBrief({villas,villaId="",loading,error}:{villas:Villa[];villaId?:string;loading:boolean;error:string}){
 const {site}=useCms();
 const eligible=villas.filter(v=>(!villaId||v.id===villaId)&&v.canUpload&&["pro","premium"].includes(v.packageId));
 if(loading||error||!eligible.length)return null;
 return <section className="merchant-panel facebook-media-brief"><h2>{translateSystem("ส่งสื่อโปรโมททาง Facebook")}</h2>{eligible.map(v=><div key={v.id}><strong>{v.name} {" "}{translateSystem("· แพ็กเกจ")}{" "}{v.packageId==="premium"?"4,990":"2,990"} {" "}{translateSystem("บาท")}</strong><p>{translateSystem("กรุณาส่ง")}{v.packageId==="premium"?translateSystem("รูปภาพและวิดีโอ"):translateSystem("รูปภาพ")}{translateSystem("ผ่านข้อความ Facebook ของ VillaCheck เดือนละ 1 ครั้ง พร้อมชื่อที่พักและเดือนที่ต้องการโปรโมท เพื่อจัดทำแบนเนอร์และโปรโมทบน Social Media ตามสิทธิ์แพ็กเกจ")}</p></div>)}{site.facebook?<a className="primary-button" href={site.facebook} target="_blank" rel="noopener noreferrer">{translateSystem("ส่งสื่อทาง Facebook ↗")}</a>:<p>{translateSystem("กรุณาติดต่อทีม VillaCheck เพื่อส่งสื่อทาง Facebook")}</p>}</section>;
}
