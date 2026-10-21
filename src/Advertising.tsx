import CmsMediaPicker,{type CmsMedia} from "./CmsMediaPicker";
import { useEffect, useState } from "react"
import { api } from "./api"
import SocialMaterials from "./SocialMaterials"
import type { MerchantVilla } from "./merchantStore"
import type { HomeBannerItem } from "./cms"
type Ad = HomeBannerItem & {
  villaId: string
  villaName?: string
  placement: string
  approved: boolean
  order: number
}
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
  placement: "detail",
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
  merchant = false, adsOnly=false, onDirtyChange,mediaLibrary,onMediaUploaded,
}: {
  mediaLibrary?:CmsMedia[]
  onMediaUploaded?:(media:CmsMedia)=>void
  adsOnly?:boolean
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
  const chooseAd=(next:Ad)=>{if(adDirty&&!window.confirm("มีแบนเนอร์ที่ยังไม่บันทึก ต้องการเปลี่ยนรายการหรือไม่?"))return;setAd(next);setBaseline(JSON.stringify(next));setMessage("")};
  const load = async () => {
    if (!merchant) {
      if(!mediaLibrary){const library=await api<{media:CmsMedia[]}>("/admin/cms/media");setLocalMedia(library.media.map(m=>({...m,url:m.url||"/api/public/cms-media/"+m.id})));}
      setVillas((await api<{ villas: MerchantVilla[] }>("/state")).villas)
      setAds(
        (await api<{ advertisements: Ad[] }>("/admin/advertisements"))
          .advertisements,
      )
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
    void load().catch((e) => setError(e.message))
  }, [merchant,adsOnly])
  const save = async (path: string, value: unknown) => {
    setBusy(true)
    setError("")
    try {
      const result=await api<{advertisement?:Ad}>(path, value)
      if(result.advertisement){const next={...blankAd,...result.advertisement};setAd(next);setBaseline(JSON.stringify(next));window.dispatchEvent(new Event("villacheck-advertisements-updated"));try{localStorage.setItem("villacheck-advertisements-updated",String(Date.now()));}catch{}}
      await load()
      setMessage("บันทึกแล้ว")
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ")
    } finally {
      setBusy(false)
    }
  }
  return (
    <>{!adsOnly&&<SocialMaterials admin={!merchant}/>}<section className="merchant-panel advertising-panel">
      <h2>{adsOnly?"จัดการโฆษณาทุกตำแหน่ง":"โฆษณาและคอนเทนต์ Social"}</h2>
      {adsOnly&&<p>แบนเนอร์บันทึกแยกจากร่าง CMS เปิดแสดงเมื่ออนุมัติโฆษณา อยู่ในช่วงเวลา และที่พักมีสิทธิ์แพ็กเกจครบ</p>}
      <p>
        2,990: ภาพเดี่ยว 1 โพสต์ / เดือน บนทุก Social ของ VillaCheck · 4,990: ภาพเดี่ยว 1 โพสต์ + วิดีโอ 1
        ชิ้น / เดือน รวมงบโฆษณาและเผยแพร่บนทุก Social ของ VillaCheck สิทธิ์นับรวมทุกช่องทาง ไม่เพิ่มชิ้นงานตามจำนวนช่องทาง
      </p>
      <p>เจ้าของบ้านส่งสื่อผ่าน Facebook เดือนละ 1 ครั้ง · 2,990 ส่งเฉพาะรูปภาพ · 4,990 ส่งรูปภาพและวิดีโอ เพื่อใช้ทำแบนเนอร์และโปรโมทตามสิทธิ์</p>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {!merchant && (
        <>
          <h3>ตารางแบนเนอร์โฆษณา</h3>
          <p>
            หน้าแรกหมุนเวียนทุกรายการที่มีสิทธิ์ตามลำดับ
            หน้ารายละเอียดสุ่มหนึ่งรายการเมื่อเข้าหน้าและคงไว้ระหว่างอ่าน
          </p>
          <div className="merchant-toolbar"><input aria-label="ค้นหาโฆษณา" placeholder="ค้นหาหัวข้อหรือชื่อที่พัก" value={query} onChange={e=>setQuery(e.target.value)}/><select aria-label="กรองตำแหน่งโฆษณา" value={placement} onChange={e=>setPlacement(e.target.value)}><option value="all">ทุกตำแหน่ง</option><option value="home">Carousel หน้าแรก</option><option value="detail">หน้ารายละเอียดที่พัก</option><option value="footer">ก่อน Footer</option></select></div>
          <div className="ad-management-layout">
          <aside className="ad-campaign-list" aria-label="รายการแบนเนอร์">
            <div className="ad-list-heading"><strong>รายการโฆษณา</strong><span>{ads.filter(a=>(placement==="all"||a.placement===placement)&&`${a.title} ${a.villaName||""}`.toLowerCase().includes(query.toLowerCase())).length} รายการ</span></div>
            <button type="button" className="ad-create-button" onClick={()=>chooseAd({...blankAd})}>+ เพิ่มโฆษณาใหม่</button>
            {ads.filter(a=>(placement==="all"||a.placement===placement)&&`${a.title} ${a.villaName||""}`.toLowerCase().includes(query.toLowerCase())).map(a=><button type="button" className={`ad-campaign-card${ad.id===a.id?" is-selected":""}`} aria-pressed={ad.id===a.id} aria-label={`${a.title} · ${a.placement}`} key={a.id} onClick={()=>chooseAd({...blankAd,...a})}>{a.image&&<img src={a.image} alt="" loading="lazy"/>}<span className="ad-campaign-copy"><strong>{a.title}</strong><small>{a.villaName||"ไม่ระบุที่พัก"}</small><span className="ad-campaign-meta"><span>{{home:"Carousel หน้าแรก",detail:"หน้ารายละเอียด",footer:"ก่อน Footer"}[a.placement]||a.placement}</span><span>{!a.visible?"ปิดแสดงผล":!a.approved?"รออนุมัติ":"อนุมัติแล้ว"}</span></span></span></button>)}
            {!ads.some(a=>(placement==="all"||a.placement===placement)&&`${a.title} ${a.villaName||""}`.toLowerCase().includes(query.toLowerCase()))&&<p>ไม่พบโฆษณาตามเงื่อนไข</p>}
          </aside>
          <form
            className="portal-form ad-editor-form"
            onSubmit={(e) => {
              e.preventDefault()
              void save("/admin/advertisements", ad)
            }}
          >
            <div className="ad-editor-heading"><span>แก้ไขแบนเนอร์</span><h3>{ad.id?ad.title:"โฆษณาใหม่"}</h3><p>เลือกที่พัก กำหนดเนื้อหาและช่วงเวลา แล้วบันทึกแบนเนอร์</p></div>
            <fieldset className="ad-form-section"><legend>1. ที่พักและตำแหน่ง</legend><div className="ad-form-grid">
            <label>
              ที่พัก
              <select
                required
                aria-label="ที่พัก"
                value={ad.villaId}
                onChange={(e) => setAd({ ...ad, villaId: e.target.value })}
              >
                <option value="">เลือกที่พัก</option>
                {villas.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              ตำแหน่ง
              <select
                aria-label="ตำแหน่ง"
                value={ad.placement}
                onChange={(e) => setAd({ ...ad, placement: e.target.value })}
              >
                <option value="detail">หน้ารายละเอียดที่พัก (2,990 ขึ้นไป)</option>
                <option value="home">หน้าแรก (4,990)</option>
                <option value="footer">โฆษณาเล็กก่อน Footer · 1 ชิ้น (2,990 ขึ้นไป)</option>
              </select>
            </label>
            </div></fieldset><fieldset className="ad-form-section"><legend>2. รูปภาพโฆษณา</legend><div className="ad-form-grid">
            <CmsMediaPicker library={mediaLibrary??localMedia} onUploaded={mediaUploaded} label="ภาพคอมพิวเตอร์" value={ad.image} onChange={image=>setAd(current=>({...current,image}))}/>
            <CmsMediaPicker library={mediaLibrary??localMedia} onUploaded={mediaUploaded} label="ภาพมือถือ" value={ad.mobileImage} onChange={mobileImage=>setAd(current=>({...current,mobileImage}))}/>
            </div></fieldset><fieldset className="ad-form-section"><legend>3. ข้อความและลิงก์</legend><div className="ad-form-grid">
            {([
              "title",
              "description",
              "href",
              "label",
            ] as const).map((k) => (
              <label key={k}>
                {
                  {
                    title: "หัวข้อ",
                    description: "คำอธิบาย",
                    image: "ภาพคอมพิวเตอร์ URL",
                    mobileImage: "ภาพมือถือ URL",
                    href: "ลิงก์ปลายทาง",
                    label: "ข้อความปุ่ม",
                  }[k]
                }
                <input
                  value={ad[k]}
                  onChange={(e) => setAd({ ...ad, [k]: e.target.value })}
                />
              </label>
            ))}
            </div></fieldset><fieldset className="ad-form-section"><legend>4. กำหนดเวลาและการแสดงผล</legend><div className="ad-form-grid">
            {(["startsAt", "endsAt"] as const).map((k) => (
              <label key={k}>
                {k === "startsAt" ? "เริ่มแสดง (เวลาไทย)" : "สิ้นสุด (เวลาไทย)"}
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
              ลำดับ
              <input
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
              เปิดใช้งาน
            </label>
            <label>
              <input
                type="checkbox"
                checked={ad.approved}
                onChange={(e) => setAd({ ...ad, approved: e.target.checked })}
              />
              Admin อนุมัติโฆษณา
            </label>
            </div></fieldset><div className="ad-save-bar"><span>การแก้ไขจะมีผลหลังบันทึก</span><button className="primary-button" disabled={busy}>
              บันทึกแบนเนอร์
            </button>
            </div>
          </form>
          </div>
        </>
      )}
      {!adsOnly&&<>
      <h3>สิทธิ์คอนเทนต์รายเดือน</h3>
      {!jobs.length && <p>ยังไม่มีงานคอนเทนต์</p>}
      {jobs.map((j) => (
        <article key={j.id}>
          <strong>
            {j.villaName} · {j.month} ·{" "}
            {j.type === "image" ? "ภาพเดี่ยว" : "วิดีโอ"} · {j.status}
          </strong>
          <p>
            {j.channel || "ทุก Social ของ VillaCheck"}{" "}
            {j.publishedAt &&
              new Date(j.publishedAt).toLocaleString("th-TH", {
                timeZone: "Asia/Bangkok",
              })}
          </p>
          {j.postUrl && (
            <a href={j.postUrl} target="_blank" rel="noopener noreferrer">
              ดูโพสต์ที่เผยแพร่ ↗
            </a>
          )}
          {Object.entries(j.links || {}).filter(([,url])=>url).map(([channel,url])=><p key={channel}><a href={url} target="_blank" rel="noopener noreferrer">{channel} ↗</a></p>)}
          {!merchant && <button onClick={() => setJob(j)}>แก้ไขงาน</button>}
        </article>
      ))}
      {!merchant && (
        <form
          className="portal-form"
          onSubmit={(e) => {
            e.preventDefault()
            void save("/admin/social-jobs", job)
          }}
        >
          <button type="button" onClick={() => setJob({ ...blankJob })}>
            เพิ่มงานใหม่
          </button>
          <label>
            ที่พัก
            <select
              required
              value={job.villaId}
              onChange={(e) => setJob({ ...job, villaId: e.target.value })}
            >
              <option value="">เลือกที่พัก</option>
              {villas.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            เดือนที่ใช้สิทธิ์
            <input
              type="month"
              required
              value={job.month}
              onChange={(e) => setJob({ ...job, month: e.target.value })}
            />
          </label>
          <label>
            ประเภท
            <select
              value={job.type}
              onChange={(e) => setJob({ ...job, type: e.target.value })}
            >
              <option value="image">ภาพเดี่ยว</option>
              <option value="video">วิดีโอ</option>
            </select>
          </label>
          <label>
            สถานะ
            <select
              value={job.status}
              onChange={(e) => setJob({ ...job, status: e.target.value })}
            >
              <option value="pending">รอดำเนินการ</option>
              <option value="production">กำลังผลิต</option>
              <option value="review">รอตรวจ</option>
              <option value="published">เผยแพร่</option>
            </select>
          </label>
          <label>
            ช่องทาง
            <input
              value={job.channel}
              onChange={(e) => setJob({ ...job, channel: e.target.value })}
            />
          </label>
          <label>
            วันเผยแพร่ (เวลาไทย)
            <input
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
            ลิงก์โพสต์
            <input
              type="url"
              value={job.postUrl}
              onChange={(e) => setJob({ ...job, postUrl: e.target.value })}
            />
          </label>
          {["Facebook","Instagram","TikTok"].map(channel=><label key={channel}>ลิงก์ {channel}<input type="url" required={job.status === "published"} value={job.links?.[channel] || ""} onChange={e=>setJob({...job,links:{...job.links,[channel]:e.target.value}})}/></label>)}
          <label>
            บันทึกงาน / งบโฆษณาที่ตกลง
            <textarea
              value={job.notes}
              onChange={(e) => setJob({ ...job, notes: e.target.value })}
            />
          </label>
          <button className="primary-button" disabled={busy}>
            บันทึกงาน
          </button>
        </form>
      )}
      </>}
    </section></>
  )
}
export function DetailAdvertisement() {
  const [ad, setAd] = useState<HomeBannerItem | null>(null)
  useEffect(()=>{
    let active=true;
    const load=()=>void api<{advertisements:HomeBannerItem[]}>("/public/advertisements?placement=detail").then(({advertisements})=>{if(active)setAd(previous=>advertisements.find(item=>item.id===previous?.id)??advertisements[Math.floor(Math.random()*advertisements.length)]??null)}).catch(()=>{});
    const changed=(event:StorageEvent)=>{if(event.key==="villacheck-advertisements-updated")load()};
    load();window.addEventListener("villacheck-advertisements-updated",load);window.addEventListener("storage",changed);
    return()=>{active=false;window.removeEventListener("villacheck-advertisements-updated",load);window.removeEventListener("storage",changed)};
  },[])
  if (!ad) return null
  return (
    <aside className="merchant-panel">
      <small>พื้นที่โฆษณาที่พัก · แยกจากสถานะการตรวจสอบ</small>
      <a href={ad.href || "#page=directory"} {...(ad.href?.startsWith("https:")?{target:"_blank",rel:"noopener noreferrer"}:{})}>
        <picture>
          {ad.mobileImage && (
            <source media="(max-width:640px)" srcSet={ad.mobileImage} />
          )}
          <img
            src={ad.image}
            alt={ad.title}
            style={{
              width: "100%",
              maxHeight: 300,
              objectFit: "cover",
              borderRadius: 12,
            }}
          />
        </picture>
        <strong>{ad.title}</strong><p>{ad.description}</p><span>{ad.label||"ดูรายละเอียด"} ↗</span>
      </a>
    </aside>
  )
}
