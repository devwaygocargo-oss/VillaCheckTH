import {t as translateSystem} from "./locale"
import {t} from "./locale"
import {useBusinessWritesEnabled,BusinessWriteFieldset} from './BusinessReadiness';
import {notifyCmsPublished} from "./cms-publish-sync";
import CmsIntroBannerEditor from "./CmsIntroBannerEditor";
import CmsChangeHistory from "./CmsChangeHistory";
import Advertising,{type Ad,type AdvertisingEditorHandle} from "./Advertising";
import CmsBannerInventory,{type BannerSelection} from "./CmsBannerInventory";
import CmsPresentationEditor from "./CmsPresentationEditor";
import CmsPreviewWindow from "./CmsPreviewWindow";
import HomeDiscoveryEditor from "./HomeDiscoveryEditor";
import { publicDestinations } from "../server/cms-home-config.mjs";
import BannerEditor,{cmsHomeBanners} from "./BannerEditor";
import { useCallback, useEffect, useRef, useState } from "react"
import { api, currentAccount } from "./api"
import { PortalShell, type Page } from "./prototype"
import {
  CmsScope,
  CmsPublicPage,
  type CmsBlock,
  type CmsContent,
  type CmsState,
} from "./cms"

const sectionLabels:Record<string,string>={hero:"Carousel / ค้นหา / เมนูลัด",promotion:"แพ็กเกจแนะนำ",how:"ขั้นตอนการใช้งาน",provinces:"ค้นหาตามจังหวัด",showcase:"ที่พักแนะนำ",qr:"แนะนำ QR",merchant:"สำหรับเจ้าของที่พัก",pricing:"แนะนำ Member Room",news:"ข่าวสารและอัปเดต",custom:"Section ที่เพิ่มเอง"};
const makeId = () => `item-${crypto.randomUUID()}`
const blankBlock = (): CmsBlock => ({
  id: makeId(),
  type: "text",
  title: "",
  body: "",
  image: "",
  alt: "",
  href: "",
  label: "",
  visible: true,
})
function Field({
  label,
  value,
  onChange,
  multiline = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  multiline?: boolean
}) {
  return (
    <label>
      {translateSystem(label)}
      {multiline ? (
        <textarea
          aria-label={translateSystem(label)}
          rows={5}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          aria-label={translateSystem(label)}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  )
}
function ImageField({
  value,
  onChange,
  media,
  label = "รูปภาพ",
}: {
  value: string
  onChange: (value: string) => void
  media: Media[]
  label?: string
}) {
  return (
    <div className="cms-image-field">
      <Field
        label={translateSystem("{v0} (URL HTTPS หรือเลือกจากคลัง)", {v0: label})}
        value={value}
        onChange={onChange}
      />
      <label>
        {translateSystem("เลือกจากคลังรูป")}<select
          aria-label={translateSystem("เลือกจากคลังรูป")}
          value={media.some((m) => m.url === value) ? value : ""}
          onChange={(e) => {
            if (e.target.value) onChange(e.target.value)
          }}
        >
          <option value="">{translateSystem("เลือกภาพ…")}</option>
          {media.map((m) => (
            <option key={m.id} value={m.url}>
              {m.name.replace("cms-image:", "")}
            </option>
          ))}
        </select>
      </label>
      {value && <img src={value} alt={translateSystem("ภาพที่เลือก")} />}
      <button type="button" onClick={() => onChange("")}>
        {translateSystem("ล้างรูป")}</button>
    </div>
  )
}
function BlockEditor({
  blocks,
  onChange,
  media,
}: {
  blocks: CmsBlock[]
  onChange: (rows: CmsBlock[]) => void
  media: Media[]
}) {
  const update = (i: number, patch: Partial<CmsBlock>) =>
    onChange(blocks.map((b, j) => (i === j ? { ...b, ...patch } : b)))
  const move = (i: number, step: number) => {
    const rows = [...blocks],
      j = i + step
    ;[rows[i], rows[j]] = [rows[j], rows[i]]
    onChange(rows)
  }
  return (
    <section className="cms-editor-section">
      <h2>{translateSystem("Section เพิ่มเติม")}</h2>
      <p>{translateSystem("เปลี่ยนลำดับ ซ่อน หรือเพิ่มข้อความ รูปภาพ และปุ่มลิงก์ได้")}</p>
      {blocks.map((b, i) => (
        <fieldset className="cms-block-editor" key={b.id}>
          <legend>Section {i + 1}</legend>
          <div className="button-row">
            <button
              type="button"
              disabled={i === 0}
              onClick={() => move(i, -1)}
            >
              {translateSystem("↑ ขึ้น")}</button>
            <button
              type="button"
              disabled={i === blocks.length - 1}
              onClick={() => move(i, 1)}
            >
              {translateSystem("↓ ลง")}</button>
            <button
              type="button"
              onClick={() => onChange(blocks.filter((x) => x.id !== b.id))}
            >
              {translateSystem("ลบ Section")}</button>
          </div>
          <label>
            {translateSystem("รูปแบบ")}<select
              value={b.type}
              onChange={(e) =>
                update(i, { type: e.target.value as CmsBlock["type"] })
              }
            >
              <option value="text">{translateSystem("ข้อความ")}</option>
              <option value="image">{translateSystem("รูปภาพและข้อความ")}</option>
              <option value="cta">{translateSystem("ปุ่มลิงก์และข้อความ")}</option>
            </select>
          </label>
          <label className="cms-checkbox">
            <input
              type="checkbox"
              checked={b.visible}
              onChange={(e) => update(i, { visible: e.target.checked })}
            />
            {translateSystem("แสดง Section")}</label>
          <Field
            label={translateSystem('หัวข้อ')}
            value={b.title}
            onChange={(title) => update(i, { title })}
          />
          <Field
            label={translateSystem('เนื้อหา')}
            multiline
            value={b.body}
            onChange={(body) => update(i, { body })}
          />
          {b.type === "image" && (
            <>
              <ImageField
                value={b.image}
                onChange={(image) => update(i, { image })}
                media={media}
              />
              <Field
                label={translateSystem('คำอธิบายภาพสำหรับผู้ใช้โปรแกรมอ่านหน้าจอ')}
                value={b.alt}
                onChange={(alt) => update(i, { alt })}
              />
            </>
          )}
          {b.type === "cta" && (
            <>
              <Field
                label={translateSystem('ข้อความบนปุ่ม')}
                value={b.label}
                onChange={(label) => update(i, { label })}
              />
              <Field
                label={translateSystem('ลิงก์ (HTTPS หรือ #page=pricing เป็นต้น)')}
                value={b.href}
                onChange={(href) => update(i, { href })}
              />
            </>
          )}
        </fieldset>
      ))}
      <button type="button" onClick={() => onChange([...blocks, blankBlock()])}>
        {translateSystem("+ เพิ่ม Section")}</button>
    </section>
  )
}
type Media = { id: string; name: string; mime: string; url: string; source?:string }
type Tab = "presentation" | "advertising" | "data" | "business" | "navigation" | "home" | "pages" | "articles" | "faqs" | "site" | "media" | "history"
const tabs: [Tab, string][] = [
  ["home", "หน้าแรก"],
  ["presentation", "เนื้อหาทั่วเว็บไซต์"],
  ["advertising", "แบนเนอร์ / โฆษณา"],
  ["data", "ข้อมูลที่พัก / แพ็กเกจ / บัญชี"],
  ["navigation", "เมนูเว็บไซต์"],
  ["pages", "หน้าเว็บ"],
  ["articles", "ข่าวสาร / บทความ"],
  ["faqs", "FAQ"],
  ["site", "ตั้งค่าเว็บไซต์"],
  ["business", "กติกา / ข้อความอีเมล"],
  ["media", "คลังรูปภาพ"],
  ["history", "ประวัติ / ย้อนเวอร์ชัน"],
]
export default function AdminCms({
  go,
  renderHome,renderPreview,
}: {
  go: (page: Page, item?: string) => void
  renderPreview?:(page:Page,reference:string)=>React.ReactNode
  renderHome: React.ReactNode
}) {
  const [state, setState] = useState<CmsState | null>(null),
    [content, setContent] = useState<CmsContent | null>(null),
    [media, setMedia] = useState<Media[]>([]),
    [tab, setTab] = useState<Tab>("home"),
    [selected, setSelected] = useState("about"),
    [articleId, setArticleId] = useState(""),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [preview, setPreview] = useState(false)
  const [previewPage,setPreviewPage]=useState<Page>("home"),[previewReference,setPreviewReference]=useState(""),[previewReferenceInput,setPreviewReferenceInput]=useState("");
  const [adsDirty,setAdsDirty]=useState(false),[visitedAds,setVisitedAds]=useState(false);
  const [bannerAds,setBannerAds]=useState<Ad[]>([]),[bannerSelection,setBannerSelection]=useState<BannerSelection|null>(null),[bannerAdsLoaded,setBannerAdsLoaded]=useState(false)
  const bannerAdEditor=useRef<AdvertisingEditorHandle>(null)
  const receiveBannerAds=useCallback((rows:Ad[])=>{setBannerAds(rows);setBannerAdsLoaded(true)},[])
  const selectBanner=(item:BannerSelection)=>{if(item.kind==="ad"&&!bannerAdEditor.current?.select(item.id))return;setBannerSelection(item)}
  useEffect(()=>{if(!bannerSelection)return;const frame=window.requestAnimationFrame(()=>document.getElementById(bannerSelection.kind==="ad"?"cms-property-ads":"cms-website-banners")?.scrollIntoView({behavior:"smooth",block:"start"}));return()=>window.cancelAnimationFrame(frame)},[bannerSelection])
  const [previewWindow,setPreviewWindow] = useState<Window|null>(null)
  const previewTarget = useRef<Window|null>(null)
  const closePreview = useCallback(()=>{
    const target=previewTarget.current;previewTarget.current=null
    setPreview(false);setPreviewWindow(null)
    if(target&&!target.closed)target.close()
  },[])
  useEffect(()=>()=>{previewTarget.current?.close()},[])
  const openPreview = () => {
    if(previewTarget.current&&!previewTarget.current.closed){previewTarget.current.focus();return}
    const target=window.open("about:blank","_blank")
    if(!target){setError(translateSystem("เบราว์เซอร์บล็อกแท็บ Preview กรุณาอนุญาตป๊อปอัปสำหรับเว็บไซต์นี้แล้วลองอีกครั้ง"));return}
    previewTarget.current=target;setPreviewWindow(target);setPreview(true);setError("")
  }
  const accept = (r: CmsState) => {
    setState(r)
    setContent(r.draft.content)
    setDirty(false)
  }
  const load = async () => {
    const user = await currentAccount()
    if (user.role !== "admin") throw Error("เฉพาะ Admin")
    accept(await api<CmsState>("/admin/cms"))
    await refreshMedia()
  }
  const refreshMedia=async()=>{const r=await api<{media:Media[]}>("/admin/cms/media");setMedia(r.media.map(m=>({...m,url:m.url||`/api/public/cms-media/${m.id}`})))}

  useEffect(() => {
    void load().catch((e) => setError(e.message))
  }, [])
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty || adsDirty) {
        event.preventDefault()
        event.returnValue = ""
      }
    }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty,adsDirty])
  const change = (next: CmsContent) => {
    setContent(next)
    setDirty(true)
    setMessage("")
  }
  const mutate = async (
    action: "save" | "publish" | "restore",
    version?: number,
  ) => {
    if (!state || !content) return
    setBusy(true)
    setError("")
    try {
      const r = await api<CmsState>(`/admin/cms/${action}`, {
        revision: state.draft.revision,
        ...(action === "save"
          ? { content }
          : action === "restore"
            ? { version }
            : {}),
      })
      accept(r)
      if(action==="publish")notifyCmsPublished()
      setMessage(
        action === "publish" ? translateSystem("เผยแพร่สำเร็จแล้ว เว็บไซต์แสดงข้อมูลเวอร์ชันล่าสุด") : action === "restore"
            ? translateSystem("คืนเวอร์ชันเป็นร่างแล้ว ตรวจ Preview และเผยแพร่เมื่อพร้อม")
            : translateSystem("บันทึกร่างแล้ว เว็บจริงยังไม่เปลี่ยน"),
      )

    } catch (e) {
      setError(e instanceof Error ? e.message : translateSystem("บันทึกไม่สำเร็จ"))
    } finally {
      setBusy(false)
    }
  }
  const upload = async (file: File) => {
    setBusy(true)
    setError("")
    try {
      if (
        !["image/jpeg", "image/png"].includes(file.type) ||
        file.size > 2 * 1024 * 1024
      )
        throw Error("ใช้ JPG/PNG ขนาดไม่เกิน 2 MB")
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(Error("อ่านรูปไม่สำเร็จ"))
        reader.readAsDataURL(file)
      })
      const r = await api<Media>("/admin/cms/media", {
        file: { name: file.name, type: file.type, data },
      })
      setMedia((rows) => [r, ...rows])
      setMessage(translateSystem("อัปโหลดแล้ว เลือกรูปนี้ในหน้าเว็บหรือบทความได้"))
    } catch (e) {
      setError(e instanceof Error ? e.message : "อัปโหลดไม่สำเร็จ")
    } finally {
      setBusy(false)
    }
  }
  const writesEnabled=useBusinessWritesEnabled();
  const [homePanel,setHomePanel]=useState("hero");

  const p = content?.pages.find((p) => p.slug === selected),
    a = content?.articles.find((a) => a.id === articleId)
  return (
    <PortalShell
      role="Admin"
      page="admin-cms"
      go={(target, item) => {
        if (
          !(dirty || adsDirty) ||
          window.confirm(translateSystem("มีการแก้ไขที่ยังไม่บันทึก ต้องการออกจาก CMS หรือไม่?"))
        )
          go(target, item)
      }}
    >
      <div className="portal-head">
        <div>
          <h1>{translateSystem("จัดการเว็บไซต์ CMS")}</h1>
          <p>{translateSystem("บันทึกร่าง → ตรวจ Preview → เผยแพร่")}</p>
        </div>
        <button
          disabled={busy}
          onClick={() => {
            if (!dirty || window.confirm(translateSystem("ละทิ้งการแก้ไขที่ยังไม่บันทึกและโหลดล่าสุด?")))
              void load().catch((e) => setError(e.message))
          }}
        >
          {translateSystem("โหลดข้อมูลล่าสุด")}</button>
      </div>
      {error && (
        <p role="alert" className="form-message error-state">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {!content || !state ? (
        <p>
          {error
            ? translateSystem("ไม่สามารถโหลด CMS กรุณาเข้าสู่ระบบด้วยบัญชี Admin")
            : translateSystem("กำลังโหลด CMS…")}
        </p>
      ) : (
        <>
          <div className="cms-toolbar">
            <span>
              {translateSystem("ร่าง v")}{state.draft.revision} {" "}{translateSystem("· เผยแพร่ v")}{state.published.revision}
              {dirty ? translateSystem(" · ยังไม่บันทึก") : ""}
            </span>
            <div className="button-row">
              <button
                disabled={busy || !dirty || !writesEnabled}
                onClick={() => void mutate("save")}
              >
                {translateSystem("บันทึกร่าง")}</button>
              <button className="outline-button cms-preview-button" disabled={busy} onClick={openPreview}>
                {translateSystem("Preview ก่อนเผยแพร่ ↗ (แท็บใหม่)")}</button>
              <button
                className="primary-button"
                disabled={
                  !writesEnabled || busy ||
                  dirty ||
                  !state.draft.revision ||
                  state.draft.revision === state.published.revision
                }
                onClick={() => {
                  if (window.confirm(translateSystem("เผยแพร่ร่างที่บันทึกไว้ขึ้นเว็บไซต์จริง?")))
                    void mutate("publish")
                }}
              >
                {translateSystem("เผยแพร่")}</button>
            </div>
          </div>
          <nav className="cms-tabs" aria-label={translateSystem("ส่วนจัดการ CMS")}>
            {tabs.map(([key, label]) => (
              <button
                key={key}
                aria-current={tab === key ? "page" : undefined}
                className={tab === key ? "active" : ""}
                onClick={() => {
                  setTab(key);if(key==="media"||key==="advertising")void refreshMedia().catch(e=>setError(e.message))
                  if(key==="advertising")setVisitedAds(true)
                }}
              >
                {translateSystem(label)}
              </button>
            ))}
          </nav>

          <div className={`cms-workspace${preview?" has-preview":""}`}>
          {tab==="advertising"&&<>{!bannerAdsLoaded&&<p role="status">{translateSystem("กำลังโหลดรายการแบนเนอร์ทั้งหมด…")}</p>}<CmsBannerInventory content={content} ads={bannerAds} selection={bannerSelection} onSelect={selectBanner} onReload={()=>{setError("");void bannerAdEditor.current?.reload().catch(e=>setError(e.message))}} onCreate={kind=>{if(kind==="ad"){selectBanner({kind:"ad",id:""});return}const id=`banner-${crypto.randomUUID()}`;change({...content,home:{...content.home,banners:[...cmsHomeBanners(content),{id,image:content.home.images[0]||"",mobileImage:"",title:"แบนเนอร์ใหม่",description:"",href:"#page=directory",label:"ดูรายละเอียด",visible:false,sponsored:false,startsAt:"",endsAt:""}]}});setBannerSelection({kind:"cms",id})}}/></>}

          {preview && previewWindow && (<CmsPreviewWindow target={previewWindow} onClose={closePreview}>
            <section id="cms-draft-preview" className="cms-browser-preview" aria-label={translateSystem("เนื้อหาก่อนเผยแพร่")}>
              <div className="cms-preview-heading"><div><h2>{translateSystem("Preview ก่อนเผยแพร่")}</h2><p>{translateSystem("แสดงข้อมูลร่างล่าสุด รวมการแก้ไขที่ยังไม่ได้บันทึก · เว็บไซต์จริงยังไม่เปลี่ยน · กลับไปแก้ไขในแท็บ CMS ได้")}</p>{adsDirty&&<p role="status">{translateSystem("มีโฆษณาที่ยังไม่บันทึก กรุณาบันทึกแบนเนอร์แต่ละรายการก่อนดู Preview โฆษณาล่าสุด")}</p>}</div><button type="button" className="outline-button" onClick={closePreview}>{translateSystem("ปิด Preview")}</button></div>
              {tab==="presentation"&&<><label>{translateSystem("หน้าสำหรับ Preview")}<select aria-label={translateSystem("หน้าสำหรับ Preview")} value={previewPage} onChange={e=>setPreviewPage(e.target.value as Page)}>{([["home","หน้าแรก"],["directory","ค้นหาที่พัก"],["scan","สแกน QR"],["login","เข้าสู่ระบบ User"],["owner-auth","เข้าสู่ระบบ Merchant"],["user-registration","สมัคร User"],["owner-registration","สมัคร Merchant"],["verify","หน้าที่พัก / QR"],["villa-report","แจ้งปัญหา"],["contact","ติดต่อเรา"]] as [Page,string][]).map(([value,label])=><option key={value} value={value}>{translateSystem(label)}</option>)}</select></label>{previewPage==="verify"&&<div><label>{translateSystem("QR ที่พักสำหรับ Preview")}<input value={previewReferenceInput} onChange={e=>setPreviewReferenceInput(e.target.value)} placeholder="VC-…"/></label><button type="button" onClick={()=>setPreviewReference(previewReferenceInput)}>{translateSystem("แสดงที่พัก")}</button></div>}</>}
              {tab==="presentation"&&previewPage!=="home"&&renderPreview?<CmsScope content={content}><div onSubmitCapture={e=>{e.preventDefault();e.stopPropagation()}} onClickCapture={e=>{if((e.target as HTMLElement).closest("button")){e.preventDefault();e.stopPropagation()}}}>{renderPreview(previewPage,previewReference)}</div></CmsScope> : ["home","navigation","site","presentation","advertising"].includes(tab) ? (
                <CmsScope content={content}>{renderHome}</CmsScope>
              ) : (
                <CmsPublicPage
                  page={
                    tab === "articles"
                      ? a
                        ? "article-detail"
                        : "articles"
                      : tab === "faqs"
                        ? "help"
                        : selected
                  }
                  item={a?.id || ""}
                  content={content}
                  preview
                  go={(target, item) => {
                    if (target === "article-detail") {
                      setTab("articles")
                      setArticleId(item || "")
                    } else if (target === "articles") {
                      setArticleId("")
                    } else {
                      setTab("home")
                    }
                  }}
                />
              )}
            </section></CmsPreviewWindow>
          )}
          {visitedAds&&<div id="cms-property-ads" className="cms-ad-workspace" hidden={tab!=="advertising"||bannerSelection?.kind!=="ad"}><BusinessWriteFieldset><Advertising adsOnly hideList editorRef={bannerAdEditor} onLoaded={receiveBannerAds} onLoadError={message=>{setError(message);setBannerAdsLoaded(true)}} onDirtyChange={setAdsDirty} mediaLibrary={media} onMediaUploaded={item=>setMedia(rows=>[item,...rows])}/></BusinessWriteFieldset></div>}
          <fieldset
            disabled={busy||!writesEnabled}
            style={tab==="advertising"&&bannerSelection?.kind!=="cms"?{display:"none"}:undefined}
            className={`merchant-panel portal-form cms-editor cms-editor-${tab}`}
          >
            {tab === "presentation" && <CmsPresentationEditor content={content} onChange={change} media={media} onUploaded={item=>setMedia(rows=>[item,...rows])}/>}
            {tab === "advertising"&&bannerSelection?.kind==="cms" && <BannerEditor hideInventory selectionId={bannerSelection?.kind==="cms"?bannerSelection.id:undefined} onSelectionChange={id=>setBannerSelection({kind:"cms",id})} content={content} onChange={change} media={media} onUploaded={item=>setMedia(rows=>[item,...rows])}/>}
            {tab === "data" && <section><h2>{translateSystem("ข้อมูลที่แสดงบนหน้าเว็บ")}</h2><p>{translateSystem("ข้อมูลจริงของที่พัก แพ็กเกจ และบัญชี จัดการผ่านเมนูที่เกี่ยวข้อง โดยใช้ฐานข้อมูลเดียวกับหน้าเว็บ")}</p><div className="button-row">{([["admin-villas","ข้อมูลที่พัก / รูป / สถานะ"],["admin-packages","ราคาและสิทธิ์แพ็กเกจ"],["admin-users","บัญชี User"],["admin-owners","บัญชี Merchant"],["admin-reviews","รีวิวลูกค้า"],["admin-pending-villas","ตรวจ Villa / ยืนยันเจ้าของบ้าน"],["admin-approved-villas","ส่งสื่อทาง Social Media"],["admin-receiving-bank","บัญชีรับเงิน"]] as [Page,string][]).map(([target,label])=><button type="button" key={target} onClick={()=>{if(!(dirty||adsDirty)||window.confirm(translateSystem("มีการแก้ไขที่ยังไม่บันทึก ต้องการออกจาก CMS หรือไม่?")))go(target)}}>{translateSystem(label)}</button>)}</div></section>}
            {tab === "home" && (
              <>
                <nav className="cms-home-panels" aria-label={translateSystem("ส่วนแก้ไขหน้าแรก")}>
                  {[["hero","แบนเนอร์แรก"],["discovery","ช่องค้นหา / เมนูลัด"],["sections","ลำดับ Section"],["slides","ภาพสไลด์"],["blocks","Section เพิ่มเติม"]].map(([key,label])=><button key={key} type="button" aria-pressed={homePanel===key} className={homePanel===key?"active":""} onClick={()=>setHomePanel(key)}>{translateSystem(label)}</button>)}
                </nav>
                {homePanel==="discovery"&&<HomeDiscoveryEditor content={content} onChange={change} media={media}/>}
                {homePanel==="hero"&&<CmsIntroBannerEditor content={content} onChange={change} media={media} onUploaded={item=>setMedia(rows=>[item,...rows])}/>}
                {homePanel==="sections"&&<>
                <h2>{translateSystem("ลำดับ Section หน้าแรก")}</h2><p>{translateSystem("ส่วนข่าวสารใช้รายการที่เปิดแสดงจากแท็บข่าวสาร / บทความ เรียงตามลำดับใน CMS")}</p>
                {content.home.sections.filter(s=>!["promotion","pricing"].includes(s.id)).map((s, i, visibleSections) => (
                  <div className="cms-block-editor" key={s.id}>
                    <strong>{translateSystem(sectionLabels[s.id] || s.id)}</strong>
                    <label className="cms-checkbox">
                      <input
                        type="checkbox"
                        checked={s.visible}
                        onChange={(e) =>
                          change({
                            ...content,
                            home: {
                              ...content.home,
                              sections: content.home.sections.map((x) =>
                                x.id === s.id
                                  ? { ...x, visible: e.target.checked }
                                  : x,
                              ),
                            },
                          })
                        }
                      />
                      {translateSystem("แสดง Section")}</label>
                    <div className="button-row">
                      <button
                        disabled={i === 0}
                        onClick={() => {
                          const sections = [...visibleSections]
                          ;[sections[i - 1], sections[i]] = [
                            sections[i],
                            sections[i - 1],
                          ]
                          change({
                            ...content,
                            home: { ...content.home, sections:[...sections,...content.home.sections.filter(x=>["promotion","pricing"].includes(x.id))] },
                          })
                        }}
                      >
                        {translateSystem("↑ ขึ้น")}</button>
                      <button
                        disabled={i === visibleSections.length - 1}
                        onClick={() => {
                          const sections = [...visibleSections]
                          ;[sections[i + 1], sections[i]] = [
                            sections[i],
                            sections[i + 1],
                          ]
                          change({
                            ...content,
                            home: { ...content.home, sections:[...sections,...content.home.sections.filter(x=>["promotion","pricing"].includes(x.id))] },
                          })
                        }}
                      >
                        {translateSystem("↓ ลง")}</button>
                    </div>
                    {["how", "provinces", "showcase", "news", "qr", "merchant", "pricing"].includes(
                      s.id,
                    ) && (
                      <details className="cms-card-details">
                        <summary>{translateSystem("แก้ไขข้อความ / ภาพ Section")}</summary>
                        {["qr","merchant"].includes(s.id)&&<ImageField label={translateSystem('ภาพประกอบ Section (เว้นว่างใช้ภาพเริ่มต้น)')} value={s.image||""} media={media} onChange={image=>change({...content,home:{...content.home,sections:content.home.sections.map(row=>row.id===s.id?{...row,image}:row)}})}/>}
                        <Field
                          label={translateSystem('หัวข้อ Section')}
                          multiline
                          value={s.title}
                          onChange={(title) =>
                            change({
                              ...content,
                              home: {
                                ...content.home,
                                sections: content.home.sections.map((x) =>
                                  x.id === s.id ? { ...x, title } : x,
                                ),
                              },
                            })
                          }
                        />
                        {s.id !== "pricing" && (
                          <Field
                            label={translateSystem('คำอธิบาย Section')}
                            multiline
                            value={s.description}
                            onChange={(description) =>
                              change({
                                ...content,
                                home: {
                                  ...content.home,
                                  sections: content.home.sections.map((x) =>
                                    x.id === s.id ? { ...x, description } : x,
                                  ),
                                },
                              })
                            }
                          />
                        )}
                      </details>
                    )}
                  </div>
                ))}
                </>}
                {homePanel==="slides"&&<>
                <button type="button" onClick={()=>{setTab("advertising");setVisitedAds(true)}}>{translateSystem("จัดการแบนเนอร์และโฆษณาทุกสไลด์")}</button><h2>{translateSystem("ภาพสไลด์สำรอง (ใช้เมื่อยังไม่มีรายการแบนเนอร์)")}</h2>
                {content.home.images.map((url, i) => (
                  <div className="cms-block-editor" key={i}>
                    <ImageField
                      label={translateSystem("ภาพ {v0}", {v0: i + 1})}
                      value={url}
                      onChange={(value) =>
                        change({
                          ...content,
                          home: {
                            ...content.home,
                            images: content.home.images.map((x, j) =>
                              i === j ? value : x,
                            ),
                          },
                        })
                      }
                      media={media}
                    />
                    <div className="button-row">
                      <button
                        disabled={i === 0}
                        onClick={() => {
                          const images = [...content.home.images]
                          ;[images[i - 1], images[i]] = [
                            images[i],
                            images[i - 1],
                          ]
                          change({
                            ...content,
                            home: { ...content.home, images },
                          })
                        }}
                      >
                        {translateSystem("↑ ขึ้น")}</button>
                      <button
                        disabled={content.home.images.length === 1}
                        onClick={() =>
                          change({
                            ...content,
                            home: {
                              ...content.home,
                              images: content.home.images.filter(
                                (_, j) => i !== j,
                              ),
                            },
                          })
                        }
                      >
                        {translateSystem("ลบภาพ")}</button>
                    </div>
                  </div>
                ))}
                <button
                  onClick={() =>
                    change({
                      ...content,
                      home: {
                        ...content.home,
                        images: [...content.home.images, ""],
                      },
                    })
                  }
                >
                  {translateSystem("+ เพิ่มภาพสไลด์")}</button>
                </>}
                {homePanel==="blocks"&&<BlockEditor
                  blocks={content.home.blocks}
                  media={media}
                  onChange={(blocks) =>
                    change({ ...content, home: { ...content.home, blocks } })
                  }
                />}
              </>
            )}
            {tab === "navigation" && (
              <>
                <h2>{translateSystem("เมนูเว็บไซต์")}</h2><p>{translateSystem("เมนูติดต่อเราจะแสดงเสมอ เมนูหน้าหลัก วิธีการทำงาน และแพ็กเกจไม่ได้ใช้ในแถบเมนูหลักแล้ว")}</p>
                {content.navigation.map((n, i) => (
                  <div className="cms-block-editor" key={n.id}>
                    <Field
                      label={translateSystem('ชื่อเมนู')}
                      value={n.label}
                      onChange={(label) =>
                        change({
                          ...content,
                          navigation: content.navigation.map((x) =>
                            x.id === n.id ? { ...x, label } : x,
                          ),
                        })
                      }
                    />
                    <Field
                      label={translateSystem('ลิงก์ (HTTPS หรือหน้าสาธารณะในระบบ)')}
                      value={n.href}
                      onChange={(href) =>
                        change({
                          ...content,
                          navigation: content.navigation.map((x) =>
                            x.id === n.id ? { ...x, href } : x,
                          ),
                        })
                      }
                    />
                    <label>{translateSystem("เลือกหน้าปลายทาง")}<select aria-label={translateSystem("เลือกหน้าปลายทาง")} value="" onChange={e=>{if(e.target.value)change({...content,navigation:content.navigation.map(x=>x.id===n.id?{...x,href:e.target.value}:x)});}}>
                      <option value="">{translateSystem("เลือกหน้าเพื่อใส่ลิงก์อัตโนมัติ…")}</option>
                      {publicDestinations.map(x=><option key={x.href} value={x.href}>{translateSystem(x.label)}</option>)}
                      {content.pages.map(p=><option key={p.slug} value={`#page=cms-page&item=${p.slug}`}>{p.title}</option>)}
                    </select></label>
                    <label className="cms-checkbox">
                      <input
                        type="checkbox"
                        disabled={n.href==="#page=contact"}
                        checked={n.visible}
                        onChange={(e) =>
                          change({
                            ...content,
                            navigation: content.navigation.map((x) =>
                              x.id === n.id
                                ? { ...x, visible: e.target.checked }
                                : x,
                            ),
                          })
                        }
                      />
                      {translateSystem("แสดงเมนู")}</label>
                    <div className="button-row">
                      <button
                        disabled={i === 0}
                        onClick={() => {
                          const rows = [...content.navigation]
                          ;[rows[i - 1], rows[i]] = [rows[i], rows[i - 1]]
                          change({ ...content, navigation: rows })
                        }}
                      >
                        {translateSystem("↑ ขึ้น")}</button>
                      <button
                        disabled={n.href==="#page=contact"}
                        onClick={() =>
                          change({
                            ...content,
                            navigation: content.navigation.filter(
                              (x) => x.id !== n.id,
                            ),
                          })
                        }
                      >
                        {translateSystem("ลบเมนู")}</button>
                    </div>
                  </div>
                ))}
                <button
                  disabled={content.navigation.length >= 12}
                  onClick={() =>
                    change({
                      ...content,
                      navigation: [
                        ...content.navigation,
                        {
                          id: makeId(),
                          label: "เมนูใหม่",
                          href: "#page=about",
                          visible: true,
                        },
                      ],
                    })
                  }
                >
                  {translateSystem("+ เพิ่มเมนู")}</button>
                <p>
                  {translateSystem("เพิ่มได้สูงสุด 12 เมนู หน้าที่สร้างใหม่ใช้ลิงก์ #page=cms-page&amp;item=รหัสหน้า ตามลิงก์ในแท็บหน้าเว็บ")}</p>
              </>
            )}
            {tab === "pages" && (
              <>
                <label>
                  {translateSystem("เลือกหน้าเว็บ")}<select
                    value={selected}
                    onChange={(e) => setSelected(e.target.value)}
                  >
                    {content.pages.map((p) => (
                      <option key={p.slug} value={p.slug}>
                        {p.title} ({p.slug})
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  onClick={() => {
                    const slug = `page-${crypto.randomUUID()}`
                    change({
                      ...content,
                      pages: [
                        ...content.pages,
                        {
                          slug,
                          kicker: "",
                          title: "หน้าใหม่",
                          description: "",
                          body: "",
                          blocks: [],
                        },
                      ],
                    })
                    setSelected(slug)
                  }}
                >
                  {translateSystem("+ เพิ่มหน้าเว็บ")}</button>
                {p && (
                  <>
                    <p>
                      {translateSystem("ลิงก์หน้าเว็บ: #")}{new URLSearchParams({
                        page: "cms-page",
                        item: p.slug,
                      }).toString()}
                    </p>
                    {([
                      ["kicker", "ข้อความเหนือหัวข้อ"],
                      ["title", "ชื่อหน้า"],
                      ["description", "คำอธิบาย"],
                      ["body", "เนื้อหา"],
                    ] as const).map(([key, label]) => (
                      <Field
                        key={key}
                        label={translateSystem(label)}
                        multiline={key === "body"}
                        value={p[key]}
                        onChange={(value) =>
                          change({
                            ...content,
                            pages: content.pages.map((x) =>
                              x.slug === p.slug ? { ...x, [key]: value } : x,
                            ),
                          })
                        }
                      />
                    ))}
                    <BlockEditor
                      blocks={p.blocks}
                      media={media}
                      onChange={(blocks) =>
                        change({
                          ...content,
                          pages: content.pages.map((x) =>
                            x.slug === p.slug ? { ...x, blocks } : x,
                          ),
                        })
                      }
                    />
                    {p.slug.startsWith("page-") && (
                      <button
                        onClick={() => {
                          change({
                            ...content,
                            pages: content.pages.filter(
                              (x) => x.slug !== p.slug,
                            ),
                          })
                          setSelected("about")
                        }}
                      >
                        {translateSystem("ลบหน้าที่เพิ่มเอง")}</button>
                    )}
                  </>
                )}
              </>
            )}
            {tab === "articles" && (
              <>
                <label>
                  {translateSystem("เลือกบทความ")}<select
                    value={articleId}
                    onChange={(e) => setArticleId(e.target.value)}
                  >
                    <option value="">{translateSystem("เลือกบทความ…")}</option>
                    {content.articles.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.title}
                        {x.visible ? "" : translateSystem(" (ซ่อน)")}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  onClick={() => {
                    const id = makeId()
                    change({
                      ...content,
                      articles: [
                        ...content.articles,
                        {
                          id,
                          title: "บทความใหม่",
                          description: "",
                          body: "",
                          image: "",
                          visible: false,
                        },
                      ],
                    })
                    setArticleId(id)
                  }}
                >
                  {translateSystem("+ เพิ่มบทความ")}</button>
                {a && (
                  <>
                    {([
                      ["title", "ชื่อบทความ"],
                      ["description", "คำอธิบาย"],
                      ["body", "เนื้อหา"],
                    ] as const).map(([key, label]) => (
                      <Field
                        key={key}
                        label={translateSystem(label)}
                        value={a[key]}
                        multiline={key === "body"}
                        onChange={(value) =>
                          change({
                            ...content,
                            articles: content.articles.map((x) =>
                              x.id === a.id ? { ...x, [key]: value } : x,
                            ),
                          })
                        }
                      />
                    ))}
                    <BlockEditor blocks={a.blocks||[]} media={media} onChange={blocks=>change({...content,articles:content.articles.map(x=>x.id===a.id?{...x,blocks}:x)})}/>
                    <ImageField
                      value={a.image}
                      media={media}
                      onChange={(image) =>
                        change({
                          ...content,
                          articles: content.articles.map((x) =>
                            x.id === a.id ? { ...x, image } : x,
                          ),
                        })
                      }
                    />
                    <label className="cms-checkbox">
                      <input
                        type="checkbox"
                        checked={a.visible}
                        onChange={(e) =>
                          change({
                            ...content,
                            articles: content.articles.map((x) =>
                              x.id === a.id
                                ? { ...x, visible: e.target.checked }
                                : x,
                            ),
                          })
                        }
                      />
                      {translateSystem("แสดงบทความหลังเผยแพร่")}</label>
                    <div className="button-row">
                      <button
                        disabled={content.articles[0].id === a.id}
                        onClick={() => {
                          const rows = [...content.articles],
                            i = rows.findIndex((x) => x.id === a.id)
                          ;[rows[i - 1], rows[i]] = [rows[i], rows[i - 1]]
                          change({ ...content, articles: rows })
                        }}
                      >
                        {translateSystem("↑ เลื่อนขึ้น")}</button>
                      <button
                        onClick={() => {
                          change({
                            ...content,
                            articles: content.articles.filter(
                              (x) => x.id !== a.id,
                            ),
                          })
                          setArticleId("")
                        }}
                      >
                        {translateSystem("ลบบทความ")}</button>
                    </div>
                  </>
                )}
              </>
            )}
            {tab === "faqs" && (
              <>
                {content.faqs.map((f, i) => (
                  <div className="cms-block-editor" key={f.id}>
                    <Field
                      label={translateSystem("คำถาม {v0}", {v0: i + 1})}
                      value={f.question}
                      onChange={(question) =>
                        change({
                          ...content,
                          faqs: content.faqs.map((x) =>
                            x.id === f.id ? { ...x, question } : x,
                          ),
                        })
                      }
                    />
                    <Field
                      label={translateSystem('คำตอบ')}
                      multiline
                      value={f.answer}
                      onChange={(answer) =>
                        change({
                          ...content,
                          faqs: content.faqs.map((x) =>
                            x.id === f.id ? { ...x, answer } : x,
                          ),
                        })
                      }
                    />
                    <label className="cms-checkbox">
                      <input
                        type="checkbox"
                        checked={f.visible}
                        onChange={(e) =>
                          change({
                            ...content,
                            faqs: content.faqs.map((x) =>
                              x.id === f.id
                                ? { ...x, visible: e.target.checked }
                                : x,
                            ),
                          })
                        }
                      />
                      {translateSystem("แสดง FAQ")}</label>
                    <div className="button-row">
                      <button
                        disabled={i === 0}
                        onClick={() => {
                          const rows = [...content.faqs]
                          ;[rows[i - 1], rows[i]] = [rows[i], rows[i - 1]]
                          change({ ...content, faqs: rows })
                        }}
                      >
                        {translateSystem("↑ เลื่อนขึ้น")}</button>
                      <button
                        onClick={() =>
                          change({
                            ...content,
                            faqs: content.faqs.filter((x) => x.id !== f.id),
                          })
                        }
                      >
                        {translateSystem("ลบ FAQ")}</button>
                    </div>
                  </div>
                ))}
                <button
                  onClick={() =>
                    change({
                      ...content,
                      faqs: [
                        ...content.faqs,
                        {
                          id: makeId(),
                          question: "คำถามใหม่",
                          answer: "",
                          visible: true,
                        },
                      ],
                    })
                  }
                >
                  {translateSystem("+ เพิ่ม FAQ")}</button>
              </>
            )}
            {tab === "business" && <><h2>{translateSystem("กติกาอายุสิทธิ์เดิมและข้อความแจ้งชำระ")}</h2><p>{translateSystem("แพ็กเกจ 990 / 1,990 / 2,990 / 4,990 คิดต่อที่พัก ครั้งละ 1 เดือน รวมภาษี ค่าด้านล่างใช้เฉพาะแพ็กเกจเดิมนอก 4 ระดับนี้ ใบแจ้งชำระเดิมคงยอดและระยะเวลาเดิม")}</p><label>{translateSystem("ชำระครั้งแรกได้สิทธิ์กี่เดือน")}<input aria-label={translateSystem("ชำระครั้งแรกได้สิทธิ์กี่เดือน")} type="number" min="1" max="36" value={content.business.monthlyInitialMonths} onChange={e=>change({...content,business:{...content.business,monthlyInitialMonths:Number(e.target.value)}})}/></label><label>{translateSystem("ต่ออายุครั้งถัดไปได้สิทธิ์กี่เดือน")}<input aria-label={translateSystem("ต่ออายุครั้งถัดไปได้สิทธิ์กี่เดือน")} type="number" min="1" max="36" value={content.business.monthlyRenewalMonths} onChange={e=>change({...content,business:{...content.business,monthlyRenewalMonths:Number(e.target.value)}})}/></label><h2>{translateSystem("OTP และการเข้าสู่ระบบ")}</h2><Field label={translateSystem('หัวข้ออีเมล OTP (SMTP)')} value={content.business.emailOtpSubject} onChange={emailOtpSubject=>change({...content,business:{...content.business,emailOtpSubject}})}/><Field label={translateSystem('ข้อความอีเมล OTP (SMTP)')} multiline value={content.business.emailOtpBody} onChange={emailOtpBody=>change({...content,business:{...content.business,emailOtpBody}})}/><Field label={translateSystem('ข้อความ SMS OTP (SMS API)')} multiline value={content.business.smsOtpBody} onChange={smsOtpBody=>change({...content,business:{...content.business,smsOtpBody}})}/><Field label={translateSystem('Email OTP Template ID ของผู้ให้บริการ (เว้นว่างใช้ค่าที่ตั้งไว้เดิม)')} value={content.business.emailOtpTemplateId} onChange={emailOtpTemplateId=>change({...content,business:{...content.business,emailOtpTemplateId}})}/><p>{translateSystem("ข้อความ OTP ต้องมี")}{" "}{'{{code}}'} {" "}{translateSystem("และ")}{" "}{'{{minutes}}'} {" "}{translateSystem("อายุรหัสยังเป็น 5 นาที เมื่อใช้ Ready to Use SMS OTP หรือ Email OTP API ผู้ให้บริการเป็นผู้สร้างรหัสและใช้ข้อความที่อนุมัติในระบบของผู้ให้บริการ ฟิลด์ข้อความด้านบนใช้กับ SMTP และ SMS API เท่านั้น")}</p><label className="cms-checkbox"><input type="checkbox" checked={content.business.facebookLoginEnabled} onChange={e=>change({...content,business:{...content.business,facebookLoginEnabled:e.target.checked}})}/>{translateSystem("เปิด Facebook Login หลัง Meta อนุมัติและทดสอบแล้ว")}</label><h2>{translateSystem("อีเมลแจ้งชำระแพ็กเกจ")}</h2><Field label={translateSystem('หัวข้ออีเมลแจ้งชำระ')} value={content.business.paymentEmailSubject} onChange={paymentEmailSubject=>change({...content,business:{...content.business,paymentEmailSubject}})}/><Field label={translateSystem('ข้อความนำอีเมลแจ้งชำระ')} multiline value={content.business.paymentEmailIntro} onChange={paymentEmailIntro=>change({...content,business:{...content.business,paymentEmailIntro}})}/><p>{translateSystem("ใช้คำแทน")}{" "}{'{{merchant}}'}, {'{{package}}'}, {'{{villa}}'} {" "}{translateSystem("ได้ ระบบเติมยอดชำระ อายุสิทธิ์ เลขใบแจ้งชำระ และลิงก์ชำระให้อัตโนมัติ การแก้ข้อความไม่แก้ข้อมูลธุรกรรม และไม่ส่งอีเมลเองตอนเผยแพร่")}</p><section className="cms-block-editor"><h3>{translateSystem("ข้อความอีเมล (ข้อมูลจำลอง)")}</h3><strong>{content.business.paymentEmailSubject.replace(/\{\{(merchant|package|villa)\}\}/g,(_,k)=>({merchant:"เจ้าของที่พัก",package:"แพ็กเกจ",villa:"Villa "}[k as "merchant"|"package"|"villa"]))}</strong><p className="cms-prose">{content.business.paymentEmailIntro.replace(/\{\{(merchant|package|villa)\}\}/g,(_,k)=>({merchant:"เจ้าของที่พัก",package:"แพ็กเกจ",villa:"Villa "}[k as "merchant"|"package"|"villa"]))}</p><p>{translateSystem("ระบบจะแนบรายละเอียดใบแจ้งชำระจริงให้อัตโนมัติเมื่อมีการสร้างใบแจ้งชำระ")}</p></section></>}
            {tab === "site" && (
              <>
                <ImageField
                  label={translateSystem('โลโก้')}
                  value={content.site.logo}
                  onChange={(logo) =>
                    change({ ...content, site: { ...content.site, logo } })
                  }
                  media={media}
                />
                <label>
                  {translateSystem("สีหลักของปุ่ม")}<input
                    type="color"
                    value={content.site.accent}
                    onChange={(e) =>
                      change({
                        ...content,
                        site: { ...content.site, accent: e.target.value },
                      })
                    }
                  />
                </label>
                {([
                  ["name", "ชื่อเว็บไซต์"],
                  ["description", "คำอธิบายเว็บไซต์ / SEO"],
                  ["email", "อีเมลติดต่อ"],
                  ["phone", "เบอร์โทร"],
                  ["hours", "เวลาทำการ"],
                  ["facebook", "Facebook URL"],
                  ["instagram", "Instagram URL"],
                  ["line", "LINE URL"],
                ] as const).map(([key, label]) => (
                  <Field
                    key={key}
                    label={translateSystem(label)}
                    value={content.site[key]}
                    onChange={(value) =>
                      change({
                        ...content,
                        site: { ...content.site, [key]: value },
                      })
                    }
                  />
                ))}
                <h3>{translateSystem("บัญชีและ QR รับเงิน")}</h3>
                <p>{translateSystem("จัดการบัญชี สร้าง QR พร้อมเพย์คงที่ และส่งอีเมลให้ Merchant ได้ที่หน้าบัญชีรับเงิน ข้อมูลที่บันทึกในหน้านั้นใช้กับใบแจ้งชำระใหม่ โดยใบเดิมคงข้อมูลเดิม")}</p>
                <button className="outline-button" onClick={()=>go("admin-receiving-bank")}>{translateSystem("จัดการบัญชีรับเงิน")}</button>
                <p>
                  {translateSystem("ช่องว่างของช่องทางติดต่อใช้ค่าที่ตั้งไว้เดิม ระบบตรวจสลิปยังใช้คนตรวจตาม Flow")}</p>
              </>
            )}
            {tab === "media" && (
              <>
                <h2>{translateSystem("คลังรูปภาพ")}</h2>
                <label>
                  {translateSystem("อัปโหลด JPG/PNG ไม่เกิน 2 MB")}<input
                    type="file"
                    accept="image/jpeg,image/png"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) void upload(file)
                      e.target.value = ""
                    }}
                  />
                </label>
                <p>
                  {translateSystem("รูปที่ยังไม่อยู่ในเนื้อหาที่เผยแพร่เปิดดูได้เฉพาะ Admin รูปเก็บไว้เพื่อรองรับการย้อนเวอร์ชัน")}</p>
                <div className="cms-media-grid">
                  {media.map((m) => (
                    <article key={m.id}>
                      <img loading="lazy" decoding="async" src={m.url} alt={m.name.replace("cms-image:", "")} />
                      <p>{m.name.replace("cms-image:", "")}</p>
                      <input aria-label={translateSystem("URL รูปภาพ")} readOnly value={m.url} />
                      {m.source==="banner"?<p>{translateSystem("รูปจากแบนเนอร์ · เลือกใช้ซ้ำได้จากคลังรูป")}</p>:<button
                        disabled={busy || dirty || !writesEnabled}
                        onClick={() => {
                          if (
                            !window.confirm(translateSystem("ลบรูปนี้? รูปที่อยู่ในร่างหรือประวัติจะลบไม่ได้"))
                          )
                            return
                          setBusy(true)
                          void api("/admin/cms/media/delete", { id: m.id })
                            .then(() => {
                              setMedia((rows) =>
                                rows.filter((x) => x.id !== m.id),
                              )
                              setMessage(translateSystem("ลบรูปแล้ว"))
                            })
                            .catch((e) => setError(e.message))
                            .finally(() => setBusy(false))
                        }}
                      >
                        {translateSystem("ลบรูปที่ไม่ได้ใช้")}</button>}
                    </article>
                  ))}
                </div>
              </>
            )}
            {tab === "history" && <CmsChangeHistory revision={state.draft.revision} onRestored={result=>{if(result)accept(result);setVisitedAds(false);setAdsDirty(false);setBannerSelection(null);setBannerAds([]);setBannerAdsLoaded(false)}}/>}
          </fieldset>

          {adsDirty&&<p role="status">{translateSystem("มีแบนเนอร์โฆษณาที่ยังไม่บันทึก")}</p>}
          </div>
        </>
      )}
    </PortalShell>
  )
}
