import {t as translateSystem} from "./locale"
import {t,localeTag} from "./locale"
import {BusinessWriteFieldset} from './BusinessReadiness';
import CmsMediaPicker,{type CmsMedia} from "./CmsMediaPicker";
import { useEffect, useImperativeHandle, useState,type Ref } from "react"
import { api } from "./api"
import SocialMaterials from "./SocialMaterials"
import type { MerchantVilla } from "./merchantStore"
import type { HomeBannerItem } from "./cms"
export type Ad = HomeBannerItem & {
  eligible?:boolean
  villaId: string
  villaName?: string
  placement: string
  approved: boolean
  order: number
}
export type AdvertisingEditorHandle={select:(id:string)=>boolean;reload:()=>Promise<void>}
const adTextLabels={title:"หัวข้อ",description:"คำอธิบาย",href:"ลิงก์ปลายทาง",label:"ข้อความปุ่ม"}
type Job = {
  id: string
  villaId: string
  villaName?: string
  month: string
  type: string
  status: string
  channel: string
  publishedAt: string
  postUrl: string
  links?: Record<string, string>
  notes: string
}
const blankAd: Ad = {
  id: "",
  villaId: "",
  placement: "footer",
  approved: false,
  order: 0,
  image: "",
  mobileImage: "",
  title: "",
  description: "",
  href: "",
  label: "ดูที่พัก",
  visible: false,
  sponsored: true,
  startsAt: "",
  endsAt: "",
}
const blankJob: Job = {
  id: "",
  villaId: "",
  month: new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 7),
  type: "image",
  status: "pending",
  channel: "",
  publishedAt: "",
  postUrl: "",
  notes: "",
}
export default function Advertising({
  merchant = false, adsOnly=false, homeOnly=false, onDirtyChange,mediaLibrary,onMediaUploaded,editorRef,onLoaded,onLoadError,hideList=false,
}: {
  editorRef?:Ref<AdvertisingEditorHandle>
  onLoaded?:(ads:Ad[])=>void
  onLoadError?:(message:string)=>void
  hideList?:boolean
  mediaLibrary?:CmsMedia[]
  onMediaUploaded?:(media:CmsMedia)=>void
  adsOnly?:boolean
  homeOnly?:boolean
  onDirtyChange?:(dirty:boolean)=>void
  merchant?: boolean
}) {
  const [villas, setVillas] = useState<MerchantVilla[]>([]),
    [ads, setAds] = useState<Ad[]>([]),
    [jobs, setJobs] = useState<Job[]>([]),
    [ad, setAd] = useState<Ad>(blankAd),
    [job, setJob] = useState<Job>(blankJob),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false)
  const [localMedia,setLocalMedia]=useState<CmsMedia[]>([]);
  const mediaUploaded=(item:CmsMedia)=>{if(onMediaUploaded)onMediaUploaded(item);else setLocalMedia(rows=>[item,...rows])};
  const [query,setQuery]=useState(""),[placement,setPlacement]=useState("all"),[baseline,setBaseline]=useState(JSON.stringify(blankAd));
  const adDirty=JSON.stringify(ad)!==baseline;
  useEffect(()=>{onDirtyChange?.(adDirty)},[adDirty,onDirtyChange]);
  const chooseAd=(next:Ad)=>{if(adDirty&&!window.confirm(translateSystem("มีแบนเนอร์ที่ยังไม่บันทึก ต้องการเปลี่ยนรายการหรือไม่?")))return false;setAd(next);setBaseline(JSON.stringify(next));setMessage("");return true};
  useImperativeHandle(editorRef,()=>({select(id){if(busy)return false;if(id===ad.id)return true;const found=id?ads.find(row=>row.id===id):blankAd;return found?chooseAd({...blankAd,...found}):false},reload:()=>load()}),[ads,adDirty,busy,ad.id]);
  useEffect(()=>{if(homeOnly&&!adDirty&&(!ad.id||ad.placement!=="home")){const first=ads.filter(a=>a.placement==="home").sort((a,b)=>a.order-b.order)[0];if(first)chooseAd({...blankAd,...first});}},[homeOnly,ads]);
  const load = async () => {
    setError("")
    if (!merchant) {
      const [state,data,library]=await Promise.all([api<{villas:MerchantVilla[]}>("/state"),api<{advertisements:Ad[]}>("/admin/advertisements"),mediaLibrary?null:api<{media:CmsMedia[]}>("/admin/cms/media")])
      if(library)setLocalMedia(library.media.map(m=>({...m,url:m.url||"/api/public/cms-media/"+m.id})))
      setVillas(state.villas)
      const rows=data.advertisements.filter(row=>row.placement!=="detail")
      setAds(rows);onLoaded?.(rows)
    }
    if(!adsOnly)setJobs(
      (
        await api<{ jobs: Job[] }>(
          merchant ? "/merchant/social-jobs" : "/admin/social-jobs",
        )
      ).jobs,
    )
  }
  useEffect(() => {
    void load().catch((e) => {setError(e.message);onLoadError?.(e.message)})
  }, [merchant,adsOnly])
  const save = async (path: string, value: unknown) => {
    setBusy(true)
    setError("")
    try {
      const result=await api<{advertisement?:Ad}>(path, value)
      if(result.advertisement){const next={...blankAd,...result.advertisement};setAd(next);setBaseline(JSON.stringify(next));window.dispatchEvent(new Event("villacheck-advertisements-updated"));try{localStorage.setItem("villacheck-advertisements-updated",String(Date.now()));}catch{/* Storage may be unavailable in private browsing. */}}
      await load()
      setMessage(translateSystem("บันทึกแล้ว"))
    } catch (e) {
      setError(e instanceof Error ? e.message : translateSystem("บันทึกไม่สำเร็จ"))
    } finally {
      setBusy(false)
    }
  }
  return (
    <>{!adsOnly&&<SocialMaterials admin={!merchant}/>}<section className="merchant-panel advertising-panel">
      <h2>{adsOnly?translateSystem("จัดการโฆษณาทุกตำแหน่ง"):translateSystem("โฆษณาและคอนเทนต์ Social")}</h2>
      {adsOnly&&<p>{translateSystem("แบนเนอร์บันทึกแยกจากร่าง CMS เปิดแสดงเมื่ออนุมัติโฆษณา อยู่ในช่วงเวลา และที่พักมีสิทธิ์แพ็กเกจครบ")}</p>}
      <p>
        {translateSystem("2,990: ภาพเดี่ยว 1 โพสต์ / เดือน บนทุก Social ของ VillaCheck · 4,990: ภาพเดี่ยว 1 โพสต์ + วิดีโอ 1 ชิ้น / เดือน รวมงบโฆษณาและเผยแพร่บนทุก Social ของ VillaCheck สิทธิ์นับรวมทุกช่องทาง ไม่เพิ่มชิ้นงานตามจำนวนช่องทาง")}</p>
      <p>{translateSystem("เจ้าของบ้านส่งสื่อผ่าน Facebook เดือนละ 1 ครั้ง · 2,990 ส่งเฉพาะรูปภาพ · 4,990 ส่งรูปภาพและวิดีโอ เพื่อใช้ทำแบนเนอร์และโปรโมทตามสิทธิ์")}</p>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {!merchant && (
        <>
          <h3>{translateSystem("ตารางแบนเนอร์โฆษณา")}</h3>
          <p>
            {translateSystem("หน้าแรกหมุนเวียนทุกรายการที่มีสิทธิ์ตามลำดับ หน้ารายละเอียดสุ่มหนึ่งรายการเมื่อเข้าหน้าและคงไว้ระหว่างอ่าน")}</p>
          {!hideList&&<div className="merchant-toolbar"><input aria-label={translateSystem("ค้นหาโฆษณา")} placeholder={translateSystem("ค้นหาหัวข้อหรือชื่อที่พัก")} value={query} onChange={e=>setQuery(e.target.value)}/><select aria-label={translateSystem("กรองตำแหน่งโฆษณา")} value={homeOnly?"home":placement} disabled={homeOnly} onChange={e=>setPlacement(e.target.value)}><option value="all">{translateSystem("ทุกตำแหน่ง")}</option><option value="home">{translateSystem("Carousel หน้าแรก")}</option><option value="footer">{translateSystem("ก่อน Footer")}</option></select></div>}
          <div className={`ad-management-layout${hideList?" ad-management-single":""}`}>
          {!hideList&&<aside className="ad-campaign-list" aria-label={translateSystem("รายการแบนเนอร์")}>
            <div className="ad-list-heading"><strong>{translateSystem("รายการโฆษณา")}</strong><span>{ads.filter(a=>(homeOnly?a.placement==="home":placement==="all"||a.placement===placement)&&`${a.title} ${a.villaName||""}`.toLowerCase().includes(query.toLowerCase())).length} {" "}{translateSystem("รายการ")}</span></div>
            <button type="button" className="ad-create-button" onClick={()=>chooseAd({...blankAd})}>{translateSystem("+ เพิ่มโฆษณาใหม่")}</button>
            {ads.filter(a=>(homeOnly?a.placement==="home":placement==="all"||a.placement===placement)&&`${a.title} ${a.villaName||""}`.toLowerCase().includes(query.toLowerCase())).map(a=><button type="button" className={`ad-campaign-card${ad.id===a.id?" is-selected":""}`} aria-pressed={ad.id===a.id} aria-label={`${a.title} · ${a.placement}`} key={a.id} onClick={()=>chooseAd({...blankAd,...a})}>{a.image&&<img src={a.image} alt="" loading="lazy"/>}<span className="ad-campaign-copy"><strong>{a.title}</strong><small>{a.villaName||translateSystem("ไม่ระบุที่พัก")}</small><span className="ad-campaign-meta"><span>{{home:"Carousel หน้าแรก",detail:"หน้ารายละเอียด",footer:"ก่อน Footer"}[a.placement]||a.placement}</span><span>{!a.visible?translateSystem("ปิดแสดงผล"):!a.approved?translateSystem("รออนุมัติ"):translateSystem("อนุมัติแล้ว")}</span></span></span></button>)}
            {!ads.some(a=>(homeOnly?a.placement==="home":placement==="all"||a.placement===placement)&&`${a.title} ${a.villaName||""}`.toLowerCase().includes(query.toLowerCase()))&&<p>{translateSystem("ไม่พบโฆษณาตามเงื่อนไข")}</p>}
          </aside>}
          <BusinessWriteFieldset><form
            className="portal-form ad-editor-form"
            onSubmit={(e) => {
              e.preventDefault()
              void save("/admin/advertisements", ad)
            }}
          >
            <div className="ad-editor-heading"><span>{translateSystem("แก้ไขแบนเนอร์")}</span><h3>{ad.id?ad.title:translateSystem("โฆษณาใหม่")}</h3><p>{translateSystem("เลือกที่พัก กำหนดเนื้อหาและช่วงเวลา แล้วบันทึกแบนเนอร์")}</p></div>
            <fieldset className="ad-form-section"><legend>{translateSystem("1. ที่พักและตำแหน่ง")}</legend><div className="ad-form-grid">
            <label>
              {translateSystem("ที่พัก")}<select
                required
                aria-label={translateSystem("ที่พัก")}
                value={ad.villaId}
                onChange={(e) => setAd({ ...ad, villaId: e.target.value })}
              >
                <option value="">{translateSystem("เลือกที่พัก")}</option>
                {villas.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {translateSystem("ตำแหน่ง")}<select
                aria-label={translateSystem("ตำแหน่ง")}
                value={ad.placement}
                onChange={(e) => setAd({ ...ad, placement: e.target.value })}
              >

                <option value="home">{translateSystem("หน้าแรก (4,990)")}</option>
                <option value="footer">{translateSystem("โฆษณาเล็กก่อน Footer · 1 ชิ้น (2,990 ขึ้นไป)")}</option>
              </select>
            </label>
            </div></fieldset><fieldset className="ad-form-section"><legend>{translateSystem("2. รูปภาพโฆษณา")}</legend><div className="ad-form-grid">
            <CmsMediaPicker library={mediaLibrary??localMedia} onUploaded={mediaUploaded} label={translateSystem('ภาพคอมพิวเตอร์')} value={ad.image} onChange={image=>setAd(current=>({...current,image}))}/>
            <CmsMediaPicker library={mediaLibrary??localMedia} onUploaded={mediaUploaded} label={translateSystem('ภาพมือถือ')} value={ad.mobileImage} onChange={mobileImage=>setAd(current=>({...current,mobileImage}))}/>
            </div></fieldset><fieldset className="ad-form-section"><legend>{translateSystem("3. ข้อความและลิงก์")}</legend><div className="ad-form-grid">
            {([
              "title",
              "description",
              "href",
              "label",
            ] as const).map((k) => (
              <label key={k}>
                {
                  translateSystem(adTextLabels[k])
                }
                {k==="title"||k==="description"?<textarea aria-label={translateSystem(adTextLabels[k])} rows={3} value={ad[k]} onChange={e=>setAd({...ad,[k]:e.target.value})}/>:<input
                  aria-label={translateSystem(adTextLabels[k])}
                  value={ad[k]}
                  onChange={(e) => setAd({ ...ad, [k]: e.target.value })}
                />}
              </label>
            ))}
            </div></fieldset><fieldset className="ad-form-section"><legend>{translateSystem("4. กำหนดเวลาและการแสดงผล")}</legend><div className="ad-form-grid">
            {(["startsAt", "endsAt"] as const).map((k) => (
              <label key={k}>
                {k === "startsAt" ? translateSystem("เริ่มแสดง (เวลาไทย)") : translateSystem("สิ้นสุด (เวลาไทย)")}
                <input
                  required
                  type="datetime-local"
                  value={
                    ad[k]
                      ? new Date(Date.parse(ad[k]) + 7 * 3600000)
                          .toISOString()
                          .slice(0, 16)
                      : ""
                  }
                  onChange={(e) =>
                    setAd({
                      ...ad,
                      [k]: e.target.value
                        ? new Date(e.target.value + ":00+07:00").toISOString()
                        : "",
                    })
                  }
                />
              </label>
            ))}
            <label>
              {translateSystem("ลำดับ")}<input
                type="number"
                min="0"
                value={ad.order}
                onChange={(e) =>
                  setAd({ ...ad, order: Number(e.target.value) })
                }
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={ad.visible}
                onChange={(e) => setAd({ ...ad, visible: e.target.checked })}
              />
              {translateSystem("เปิดใช้งาน")}</label>
            <label>
              <input
                type="checkbox"
                checked={ad.approved}
                onChange={(e) => setAd({ ...ad, approved: e.target.checked })}
              />
              {translateSystem("Admin อนุมัติโฆษณา")}</label>
            </div></fieldset><div className="ad-save-bar"><span>{translateSystem("การแก้ไขจะมีผลหลังบันทึก")}</span><button className="primary-button" disabled={busy}>
              {translateSystem("บันทึกแบนเนอร์")}</button>
            </div>
          </form></BusinessWriteFieldset>
          </div>
        </>
      )}
      {!adsOnly&&<>
      <h3>{translateSystem("สิทธิ์คอนเทนต์รายเดือน")}</h3>
      {!jobs.length && <p>{translateSystem("ยังไม่มีงานคอนเทนต์")}</p>}
      {jobs.map((j) => (
        <article key={j.id}>
          <strong>
            {j.villaName} · {j.month} ·{" "}
            {j.type === "image" ? translateSystem("ภาพเดี่ยว") : translateSystem("วิดีโอ")} · {j.status}
          </strong>
          <p>
            {j.channel || translateSystem("ทุก Social ของ VillaCheck")}{" "}
            {j.publishedAt &&
              new Date(j.publishedAt).toLocaleString(localeTag(), {
                timeZone: "Asia/Bangkok",
              })}
          </p>
          {j.postUrl && (
            <a href={j.postUrl} target="_blank" rel="noopener noreferrer">
              {translateSystem("ดูโพสต์ที่เผยแพร่ ↗")}</a>
          )}
          {Object.entries(j.links || {}).filter(([,url])=>url).map(([channel,url])=><p key={channel}><a href={url} target="_blank" rel="noopener noreferrer">{channel} ↗</a></p>)}
          {!merchant && <button onClick={() => setJob(j)}>{translateSystem("แก้ไขงาน")}</button>}
        </article>
      ))}
      {!merchant && (
        <BusinessWriteFieldset><form
          className="portal-form"
          onSubmit={(e) => {
            e.preventDefault()
            void save("/admin/social-jobs", job)
          }}
        >
          <button type="button" onClick={() => setJob({ ...blankJob })}>
            {translateSystem("เพิ่มงานใหม่")}</button>
          <label>
            {translateSystem("ที่พัก")}<select
              required
              value={job.villaId}
              onChange={(e) => setJob({ ...job, villaId: e.target.value })}
            >
              <option value="">{translateSystem("เลือกที่พัก")}</option>
              {villas.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {translateSystem("เดือนที่ใช้สิทธิ์")}<input
              type="month"
              required
              value={job.month}
              onChange={(e) => setJob({ ...job, month: e.target.value })}
            />
          </label>
          <label>
            {translateSystem("ประเภท")}<select
              value={job.type}
              onChange={(e) => setJob({ ...job, type: e.target.value })}
            >
              <option value="image">{translateSystem("ภาพเดี่ยว")}</option>
              <option value="video">{translateSystem("วิดีโอ")}</option>
            </select>
          </label>
          <label>
            {translateSystem("สถานะ")}<select
              value={job.status}
              onChange={(e) => setJob({ ...job, status: e.target.value })}
            >
              <option value="pending">{translateSystem("รอดำเนินการ")}</option>
              <option value="production">{translateSystem("กำลังผลิต")}</option>
              <option value="review">{translateSystem("รอตรวจ")}</option>
              <option value="published">{translateSystem("เผยแพร่")}</option>
            </select>
          </label>
          <label>
            {translateSystem("ช่องทาง")}<input
              value={job.channel}
              onChange={(e) => setJob({ ...job, channel: e.target.value })}
            />
          </label>
          <label>
            {translateSystem("วันเผยแพร่ (เวลาไทย)")}<input
              type="datetime-local"
              value={
                job.publishedAt
                  ? new Date(Date.parse(job.publishedAt) + 7 * 3600000)
                      .toISOString()
                      .slice(0, 16)
                  : ""
              }
              onChange={(e) =>
                setJob({
                  ...job,
                  publishedAt: e.target.value
                    ? new Date(e.target.value + ":00+07:00").toISOString()
                    : "",
                })
              }
            />
          </label>
          <label>
            {translateSystem("ลิงก์โพสต์")}<input
              type="url"
              value={job.postUrl}
              onChange={(e) => setJob({ ...job, postUrl: e.target.value })}
            />
          </label>
          {["Facebook","Instagram","TikTok"].map(channel=><label key={channel}>{translateSystem("ลิงก์")}{" "}{channel}<input type="url" required={job.status === "published"} value={job.links?.[channel] || ""} onChange={e=>setJob({...job,links:{...job.links,[channel]:e.target.value}})}/></label>)}
          <label>
            {translateSystem("บันทึกงาน / งบโฆษณาที่ตกลง")}<textarea
              value={job.notes}
              onChange={(e) => setJob({ ...job, notes: e.target.value })}
            />
          </label>
          <button className="primary-button" disabled={busy}>
            {translateSystem("บันทึกงาน")}</button>
        </form></BusinessWriteFieldset>
      )}
      </>}
    </section></>
  )
}
