import type { CmsContent, HomeDiscovery, HomeShortcut, ShortcutIconName } from "./cms";
import { discoveryDefaults, publicDestinations, shortcutIcons } from "../server/cms-home-config.mjs";
import ShortcutIcon from "./ShortcutIcon";
export default function HomeDiscoveryEditor({content,onChange,media}:{content:CmsContent;onChange:(content:CmsContent)=>void;media:{url:string;name:string}[]}){
  const d={...discoveryDefaults,...content.home.discovery} as HomeDiscovery;
  const update=(patch:Partial<HomeDiscovery>)=>onChange({...content,home:{...content.home,discovery:{...d,...patch}}});
  const itemUpdate=(id:string,patch:Partial<HomeShortcut>)=>update({shortcuts:d.shortcuts.map(item=>item.id===id?{...item,...patch}:item)});
  const move=(index:number,delta:number)=>{const rows=[...d.shortcuts];[rows[index],rows[index+delta]]=[rows[index+delta],rows[index]];update({shortcuts:rows});};
  const field=(key:"heading"|"placeholder"|"buttonLabel"|"provinceHint"|"freeHint",label:string)=><label>{label}<input value={d[key]} maxLength={300} onChange={e=>update({[key]:e.target.value})}/></label>;
  return <div className="cms-discovery-editor"><h2>ช่องค้นหาและเมนูลัดใต้ Carousel</h2><p>ปรับข้อความ เลือกไอคอนใหม่ หรือใช้ภาพจากคลังรูปภาพ ลากลำดับด้วยปุ่มขึ้น / ลง แล้วกด Preview เพื่อตรวจสอบก่อนบันทึกร่าง</p>
    {([['visible','แสดงส่วนค้นหาและเมนูลัด'],['searchVisible','แสดงช่องค้นหา'],['showProvinceHint','แสดงลิงก์เลือกจังหวัด'],['showFreeHint','แสดงข้อความดูข้อมูลฟรี']] as const).map(([key,label])=><label className="cms-checkbox" key={key}><input type="checkbox" checked={d[key]} onChange={e=>update({[key]:e.target.checked})}/>{label}</label>)}
    {field("heading","หัวข้อสำหรับโปรแกรมอ่านหน้าจอ")}{field("placeholder","ข้อความในช่องค้นหา")}{field("buttonLabel","ข้อความปุ่มค้นหา")}{field("provinceHint","ข้อความลิงก์เลือกจังหวัด")}{field("freeHint","ข้อความดูข้อมูลฟรี")}
    <div className="cms-discovery-colors">{([['background','สีพื้นหลัง'],['iconColor','สีไอคอน'],['accentColor','สีเส้นตกแต่ง']] as const).map(([key,label])=><label key={key}>{label}<input type="color" value={d[key]} onChange={e=>update({[key]:e.target.value})}/></label>)}</div>
    {d.shortcuts.map((item,index)=><section className="cms-block-editor" key={item.id} aria-label={`เมนูลัด ${index+1}`}><h3>{index+1}. {item.label}</h3><label className="cms-checkbox"><input type="checkbox" checked={item.visible} onChange={e=>itemUpdate(item.id,{visible:e.target.checked})}/>แสดงเมนูลัดนี้</label>
      <label>ชื่อเมนูลัด<input maxLength={80} value={item.label} onChange={e=>itemUpdate(item.id,{label:e.target.value})}/></label><label>คำอธิบายเมื่อชี้เมาส์<input maxLength={300} value={item.description} onChange={e=>itemUpdate(item.id,{description:e.target.value})}/></label>
      <p>เลือกไอคอน</p><div className="cms-shortcut-icons">{shortcutIcons.map(icon=><button type="button" key={icon.id} aria-pressed={item.icon===icon.id&&!item.image} onClick={()=>itemUpdate(item.id,{icon:icon.id as ShortcutIconName,image:""})}><ShortcutIcon name={icon.id as ShortcutIconName}/><span>{icon.label}</span></button>)}</div>
      <label>ใช้ภาพจากคลังแทนไอคอน<select value={media.some(m=>m.url===item.image)?item.image:""} onChange={e=>itemUpdate(item.id,{image:e.target.value})}><option value="">ใช้ไอคอนที่เลือก</option>{media.map(m=><option key={m.url} value={m.url}>{m.name}</option>)}</select></label>
      <label>URL ภาพไอคอน (HTTPS หรือภาพจากคลัง)<input value={item.image} onChange={e=>itemUpdate(item.id,{image:e.target.value})}/></label>
      <label>เลือกหน้าปลายทาง<select value="" onChange={e=>{if(e.target.value)itemUpdate(item.id,{href:e.target.value});}}><option value="">เลือกหน้าปลายทาง…</option>{publicDestinations.map(x=><option key={x.href} value={x.href}>{x.label}</option>)}{content.pages.map(p=><option key={p.slug} value={`#page=cms-page&item=${p.slug}`}>{p.title}</option>)}</select></label><label>ลิงก์ปลายทาง<input value={item.href} onChange={e=>itemUpdate(item.id,{href:e.target.value})}/></label>
      <div className="button-row"><button type="button" disabled={index===0} onClick={()=>move(index,-1)}>↑ ขึ้น</button><button type="button" disabled={index===d.shortcuts.length-1} onClick={()=>move(index,1)}>↓ ลง</button><button type="button" onClick={()=>update({shortcuts:d.shortcuts.filter(x=>x.id!==item.id)})}>ลบเมนูลัด</button></div>
    </section>)}
    <button type="button" disabled={d.shortcuts.length>=12} onClick={()=>update({shortcuts:[...d.shortcuts,{id:`shortcut-${crypto.randomUUID()}`,icon:"find",label:"เมนูลัดใหม่",href:"#page=directory",description:"",visible:true,image:""}]})}>+ เพิ่มเมนูลัด</button><p>สูงสุด 12 รายการ · มือถือแสดง 3 คอลัมน์ · คอมพิวเตอร์แสดง 6 คอลัมน์</p>
  </div>;
}
