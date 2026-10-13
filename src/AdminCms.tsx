import { useEffect, useState } from "react"
import { api, currentAccount } from "./api"
import { PortalShell, type Page } from "./prototype"
import {
  CmsScope,
  CmsPublicPage,
  type CmsBlock,
  type CmsContent,
  type CmsState,
} from "./cms"

const sectionLabels:Record<string,string>={hero:"ภาพและหัวข้อหน้าแรก",promotion:"แพ็กเกจแนะนำ",how:"ขั้นตอนการใช้งาน",provinces:"ค้นหาตามจังหวัด",showcase:"ที่พักแนะนำ",qr:"แนะนำ QR",merchant:"สำหรับเจ้าของที่พัก",pricing:"แนะนำแพ็กเกจ",custom:"Section ที่เพิ่มเอง"};
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
      {label}
      {multiline ? (
        <textarea
          aria-label={label}
          rows={5}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          aria-label={label}
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
        label={`${label} (URL HTTPS หรือเลือกจากคลัง)`}
        value={value}
        onChange={onChange}
      />
      <label>
        เลือกจากคลังรูป
        <select
          aria-label="เลือกจากคลังรูป"
          value={media.some((m) => m.url === value) ? value : ""}
          onChange={(e) => {
            if (e.target.value) onChange(e.target.value)
          }}
        >
          <option value="">เลือกภาพ…</option>
          {media.map((m) => (
            <option key={m.id} value={m.url}>
              {m.name.replace("cms-image:", "")}
            </option>
          ))}
        </select>
      </label>
      {value && <img src={value} alt="ตัวอย่างภาพที่เลือก" />}
      <button type="button" onClick={() => onChange("")}>
        ล้างรูป
      </button>
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
      <h2>Section เพิ่มเติม</h2>
      <p>เปลี่ยนลำดับ ซ่อน หรือเพิ่มข้อความ รูปภาพ และปุ่มลิงก์ได้</p>
      {blocks.map((b, i) => (
        <fieldset className="cms-block-editor" key={b.id}>
          <legend>Section {i + 1}</legend>
          <div className="button-row">
            <button
              type="button"
              disabled={i === 0}
              onClick={() => move(i, -1)}
            >
              ↑ ขึ้น
            </button>
            <button
              type="button"
              disabled={i === blocks.length - 1}
              onClick={() => move(i, 1)}
            >
              ↓ ลง
            </button>
            <button
              type="button"
              onClick={() => onChange(blocks.filter((x) => x.id !== b.id))}
            >
              ลบ Section
            </button>
          </div>
          <label>
            รูปแบบ
            <select
              value={b.type}
              onChange={(e) =>
                update(i, { type: e.target.value as CmsBlock["type"] })
              }
            >
              <option value="text">ข้อความ</option>
              <option value="image">รูปภาพและข้อความ</option>
              <option value="cta">ปุ่มลิงก์และข้อความ</option>
            </select>
          </label>
          <label className="cms-checkbox">
            <input
              type="checkbox"
              checked={b.visible}
              onChange={(e) => update(i, { visible: e.target.checked })}
            />
            แสดง Section
          </label>
          <Field
            label="หัวข้อ"
            value={b.title}
            onChange={(title) => update(i, { title })}
          />
          <Field
            label="เนื้อหา"
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
                label="คำอธิบายภาพสำหรับผู้ใช้โปรแกรมอ่านหน้าจอ"
                value={b.alt}
                onChange={(alt) => update(i, { alt })}
              />
            </>
          )}
          {b.type === "cta" && (
            <>
              <Field
                label="ข้อความบนปุ่ม"
                value={b.label}
                onChange={(label) => update(i, { label })}
              />
              <Field
                label="ลิงก์ (HTTPS หรือ #page=pricing เป็นต้น)"
                value={b.href}
                onChange={(href) => update(i, { href })}
              />
            </>
          )}
        </fieldset>
      ))}
      <button type="button" onClick={() => onChange([...blocks, blankBlock()])}>
        + เพิ่ม Section
      </button>
    </section>
  )
}
type Media = { id: string; name: string; mime: string; url: string }
type Tab = "business" | "navigation" | "home" | "pages" | "articles" | "faqs" | "site" | "media" | "history"
const tabs: [Tab, string][] = [
  ["home", "หน้าแรก"],
  ["navigation", "เมนูเว็บไซต์"],
  ["pages", "หน้าเว็บ"],
  ["articles", "บทความ"],
  ["faqs", "FAQ"],
  ["site", "ตั้งค่าเว็บไซต์"],
  ["business", "กติกา / ข้อความอีเมล"],
  ["media", "คลังรูปภาพ"],
  ["history", "ประวัติ / ย้อนเวอร์ชัน"],
]
export default function AdminCms({
  go,
  renderHome,
}: {
  go: (page: Page, item?: string) => void
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
  const accept = (r: CmsState) => {
    setState(r)
    setContent(r.draft.content)
    setDirty(false)
  }
  const load = async () => {
    const user = await currentAccount()
    if (user.role !== "admin") throw Error("เฉพาะ Admin")
    accept(await api<CmsState>("/admin/cms"))
    const r = await api<{ media: Omit<Media, "url">[] }>("/admin/cms/media")
    setMedia(
      r.media.map((m) => ({ ...m, url: `/api/public/cms-media/${m.id}` })),
    )
  }
  useEffect(() => {
    void load().catch((e) => setError(e.message))
  }, [])
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault()
        event.returnValue = ""
      }
    }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty])
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
      setMessage(
        action === "publish"
          ? "เผยแพร่แล้ว เว็บจริงใช้เนื้อหาเวอร์ชันนี้"
          : action === "restore"
            ? "คืนเวอร์ชันเป็นร่างแล้ว ตรวจ Preview และเผยแพร่เมื่อพร้อม"
            : "บันทึกร่างแล้ว เว็บจริงยังไม่เปลี่ยน",
      )
      if (action === "publish") window.dispatchEvent(new Event("cms-published"))
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ")
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
      setMessage("อัปโหลดแล้ว เลือกรูปนี้ในหน้าเว็บหรือบทความได้")
    } catch (e) {
      setError(e instanceof Error ? e.message : "อัปโหลดไม่สำเร็จ")
    } finally {
      setBusy(false)
    }
  }
  const p = content?.pages.find((p) => p.slug === selected),
    a = content?.articles.find((a) => a.id === articleId)
  return (
    <PortalShell
      role="Admin"
      page="admin-cms"
      go={(target, item) => {
        if (
          !dirty ||
          window.confirm("มีการแก้ไขที่ยังไม่บันทึก ต้องการออกจาก CMS หรือไม่?")
        )
          go(target, item)
      }}
    >
      <div className="portal-head">
        <div>
          <h1>จัดการเว็บไซต์ CMS</h1>
          <p>บันทึกร่าง → ตรวจ Preview → เผยแพร่</p>
        </div>
        <button
          disabled={busy}
          onClick={() => {
            if (!dirty || window.confirm("ละทิ้งการแก้ไขที่ยังไม่บันทึกและโหลดล่าสุด?"))
              void load().catch((e) => setError(e.message))
          }}
        >
          โหลดข้อมูลล่าสุด
        </button>
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
            ? "ไม่สามารถโหลด CMS กรุณาเข้าสู่ระบบด้วยบัญชี Admin"
            : "กำลังโหลด CMS…"}
        </p>
      ) : (
        <>
          <div className="cms-toolbar">
            <span>
              ร่าง v{state.draft.revision} · เผยแพร่ v{state.published.revision}
              {dirty ? " · ยังไม่บันทึก" : ""}
            </span>
            <div className="button-row">
              <button
                disabled={busy || !dirty}
                onClick={() => void mutate("save")}
              >
                บันทึกร่าง
              </button>
              <button disabled={busy} onClick={() => setPreview((v) => !v)}>
                {preview ? "ปิด Preview" : "Preview"}
              </button>
              <button
                className="primary-button"
                disabled={
                  busy ||
                  dirty ||
                  !state.draft.revision ||
                  state.draft.revision === state.published.revision
                }
                onClick={() => {
                  if (window.confirm("เผยแพร่ร่างที่บันทึกไว้ขึ้นเว็บไซต์จริง?"))
                    void mutate("publish")
                }}
              >
                เผยแพร่
              </button>
            </div>
          </div>
          <nav className="cms-tabs" aria-label="ส่วนจัดการ CMS">
            {tabs.map(([key, label]) => (
              <button
                key={key}
                aria-current={tab === key ? "page" : undefined}
                className={tab === key ? "active" : ""}
                onClick={() => {
                  setTab(key)
                  setPreview(false)
                }}
              >
                {label}
              </button>
            ))}
          </nav>
          {preview && (
            <section className="cms-preview" aria-label="ตัวอย่างเนื้อหาก่อนเผยแพร่">
              <p>Preview ก่อนเผยแพร่ · ใช้ตัวแสดงเดียวกับเว็บไซต์จริง</p>
              {tab === "home" ? (
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
            </section>
          )}
          <fieldset
            disabled={busy}
            className="merchant-panel portal-form cms-editor"
          >
            {tab === "home" && (
              <>
                <Field
                  label="ข้อความเหนือหัวข้อ"
                  value={content.home.eyebrow}
                  onChange={(eyebrow) =>
                    change({ ...content, home: { ...content.home, eyebrow } })
                  }
                />
                <Field
                  label="หัวข้อหน้าแรก (ขึ้นบรรทัดใหม่ได้)"
                  multiline
                  value={content.home.title}
                  onChange={(title) =>
                    change({ ...content, home: { ...content.home, title } })
                  }
                />
                <Field
                  label="คำอธิบายหน้าแรก"
                  multiline
                  value={content.home.description}
                  onChange={(description) =>
                    change({
                      ...content,
                      home: { ...content.home, description },
                    })
                  }
                />
                <h2>ลำดับ Section หน้าแรก</h2>
                {content.home.sections.map((s, i) => (
                  <div className="cms-block-editor" key={s.id}>
                    <strong>{sectionLabels[s.id] || s.id}</strong>
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
                      แสดง Section
                    </label>
                    <div className="button-row">
                      <button
                        disabled={i === 0}
                        onClick={() => {
                          const sections = [...content.home.sections]
                          ;[sections[i - 1], sections[i]] = [
                            sections[i],
                            sections[i - 1],
                          ]
                          change({
                            ...content,
                            home: { ...content.home, sections },
                          })
                        }}
                      >
                        ↑ ขึ้น
                      </button>
                      <button
                        disabled={i === content.home.sections.length - 1}
                        onClick={() => {
                          const sections = [...content.home.sections]
                          ;[sections[i + 1], sections[i]] = [
                            sections[i],
                            sections[i + 1],
                          ]
                          change({
                            ...content,
                            home: { ...content.home, sections },
                          })
                        }}
                      >
                        ↓ ลง
                      </button>
                    </div>
                    {["how", "showcase", "qr", "merchant", "pricing"].includes(
                      s.id,
                    ) && (
                      <>
                        <Field
                          label="หัวข้อ Section"
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
                            label="คำอธิบาย Section"
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
                      </>
                    )}
                  </div>
                ))}
                <h2>ภาพสไลด์หน้าแรก</h2>
                {content.home.images.map((url, i) => (
                  <div className="cms-block-editor" key={i}>
                    <ImageField
                      label={`ภาพ ${i + 1}`}
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
                        ↑ ขึ้น
                      </button>
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
                        ลบภาพ
                      </button>
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
                  + เพิ่มภาพสไลด์
                </button>
                <BlockEditor
                  blocks={content.home.blocks}
                  media={media}
                  onChange={(blocks) =>
                    change({ ...content, home: { ...content.home, blocks } })
                  }
                />
              </>
            )}
            {tab === "navigation" && (
              <>
                <h2>เมนูเว็บไซต์</h2>
                {content.navigation.map((n, i) => (
                  <div className="cms-block-editor" key={n.id}>
                    <Field
                      label="ชื่อเมนู"
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
                      label="ลิงก์ (HTTPS, #page=about หรือ #how)"
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
                    <label>เลือกหน้าปลายทาง<select aria-label="เลือกหน้าปลายทาง" value="" onChange={e=>{if(e.target.value)change({...content,navigation:content.navigation.map(x=>x.id===n.id?{...x,href:e.target.value}:x)});}}>
                      <option value="">เลือกหน้าเพื่อใส่ลิงก์อัตโนมัติ…</option>
                      {[['home','หน้าหลัก'],['directory','ค้นหาที่พัก'],['scan','สแกน QR'],['pricing','แพ็กเกจ'],['articles','บทความ'],['gallery','รูปที่พัก'],['villa-report','แจ้งปัญหา'],['login','เข้าสู่ระบบ']].map(([key,label])=><option key={key} value={`#page=${key}`}>{label}</option>)}
                      {content.pages.map(p=><option key={p.slug} value={`#page=cms-page&item=${p.slug}`}>{p.title}</option>)}
                    </select></label>
                    <label className="cms-checkbox">
                      <input
                        type="checkbox"
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
                      แสดงเมนู
                    </label>
                    <div className="button-row">
                      <button
                        disabled={i === 0}
                        onClick={() => {
                          const rows = [...content.navigation]
                          ;[rows[i - 1], rows[i]] = [rows[i], rows[i - 1]]
                          change({ ...content, navigation: rows })
                        }}
                      >
                        ↑ ขึ้น
                      </button>
                      <button
                        onClick={() =>
                          change({
                            ...content,
                            navigation: content.navigation.filter(
                              (x) => x.id !== n.id,
                            ),
                          })
                        }
                      >
                        ลบเมนู
                      </button>
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
                  + เพิ่มเมนู
                </button>
                <p>
                  เพิ่มได้สูงสุด 12 เมนู หน้าที่สร้างใหม่ใช้ลิงก์
                  #page=cms-page&amp;item=รหัสหน้า ตามลิงก์ในแท็บหน้าเว็บ
                </p>
              </>
            )}
            {tab === "pages" && (
              <>
                <label>
                  เลือกหน้าเว็บ
                  <select
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
                  + เพิ่มหน้าเว็บ
                </button>
                {p && (
                  <>
                    <p>
                      ลิงก์หน้าเว็บ: #
                      {new URLSearchParams({
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
                        label={label}
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
                        ลบหน้าที่เพิ่มเอง
                      </button>
                    )}
                  </>
                )}
              </>
            )}
            {tab === "articles" && (
              <>
                <label>
                  เลือกบทความ
                  <select
                    value={articleId}
                    onChange={(e) => setArticleId(e.target.value)}
                  >
                    <option value="">เลือกบทความ…</option>
                    {content.articles.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.title}
                        {x.visible ? "" : " (ซ่อน)"}
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
                  + เพิ่มบทความ
                </button>
                {a && (
                  <>
                    {([
                      ["title", "ชื่อบทความ"],
                      ["description", "คำอธิบาย"],
                      ["body", "เนื้อหา"],
                    ] as const).map(([key, label]) => (
                      <Field
                        key={key}
                        label={label}
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
                      แสดงบทความหลังเผยแพร่
                    </label>
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
                        ↑ เลื่อนขึ้น
                      </button>
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
                        ลบบทความ
                      </button>
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
                      label={`คำถาม ${i + 1}`}
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
                      label="คำตอบ"
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
                      แสดง FAQ
                    </label>
                    <div className="button-row">
                      <button
                        disabled={i === 0}
                        onClick={() => {
                          const rows = [...content.faqs]
                          ;[rows[i - 1], rows[i]] = [rows[i], rows[i - 1]]
                          change({ ...content, faqs: rows })
                        }}
                      >
                        ↑ เลื่อนขึ้น
                      </button>
                      <button
                        onClick={() =>
                          change({
                            ...content,
                            faqs: content.faqs.filter((x) => x.id !== f.id),
                          })
                        }
                      >
                        ลบ FAQ
                      </button>
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
                  + เพิ่ม FAQ
                </button>
              </>
            )}
            {tab === "business" && <><h2>กติกาอายุสิทธิ์สำหรับแพ็กเกจรายเดือน</h2><p>ใช้กับใบแจ้งชำระที่สร้างหลังเผยแพร่ ใบแจ้งชำระเดิมคงยอดและจำนวนเดือนเดิม รายไตรมาสยังให้ 3 เดือน และรายปี 12 เดือน</p><label>ชำระครั้งแรกได้สิทธิ์กี่เดือน<input aria-label="ชำระครั้งแรกได้สิทธิ์กี่เดือน" type="number" min="1" max="36" value={content.business.monthlyInitialMonths} onChange={e=>change({...content,business:{...content.business,monthlyInitialMonths:Number(e.target.value)}})}/></label><label>ต่ออายุครั้งถัดไปได้สิทธิ์กี่เดือน<input aria-label="ต่ออายุครั้งถัดไปได้สิทธิ์กี่เดือน" type="number" min="1" max="36" value={content.business.monthlyRenewalMonths} onChange={e=>change({...content,business:{...content.business,monthlyRenewalMonths:Number(e.target.value)}})}/></label><h2>อีเมลแจ้งชำระแพ็กเกจ</h2><Field label="หัวข้ออีเมลแจ้งชำระ" value={content.business.paymentEmailSubject} onChange={paymentEmailSubject=>change({...content,business:{...content.business,paymentEmailSubject}})}/><Field label="ข้อความนำอีเมลแจ้งชำระ" multiline value={content.business.paymentEmailIntro} onChange={paymentEmailIntro=>change({...content,business:{...content.business,paymentEmailIntro}})}/><p>ใช้คำแทน {'{{merchant}}'}, {'{{package}}'}, {'{{villa}}'} ได้ ระบบเติมยอดชำระ อายุสิทธิ์ เลขใบแจ้งชำระ และลิงก์ชำระให้อัตโนมัติ การแก้ข้อความไม่แก้ข้อมูลธุรกรรม และไม่ส่งอีเมลเองตอนเผยแพร่</p><section className="cms-block-editor"><h3>ตัวอย่างข้อความอีเมล (ข้อมูลจำลอง)</h3><strong>{content.business.paymentEmailSubject.replace(/\{\{(merchant|package|villa)\}\}/g,(_,k)=>({merchant:"เจ้าของที่พักตัวอย่าง",package:"แพ็กเกจตัวอย่าง",villa:"Villa ตัวอย่าง"}[k as "merchant"|"package"|"villa"]))}</strong><p className="cms-prose">{content.business.paymentEmailIntro.replace(/\{\{(merchant|package|villa)\}\}/g,(_,k)=>({merchant:"เจ้าของที่พักตัวอย่าง",package:"แพ็กเกจตัวอย่าง",villa:"Villa ตัวอย่าง"}[k as "merchant"|"package"|"villa"]))}</p><p>ระบบจะแนบรายละเอียดใบแจ้งชำระจริงให้อัตโนมัติเมื่อมีการสร้างใบแจ้งชำระ</p></section></>}
            {tab === "site" && (
              <>
                <ImageField
                  label="โลโก้"
                  value={content.site.logo}
                  onChange={(logo) =>
                    change({ ...content, site: { ...content.site, logo } })
                  }
                  media={media}
                />
                <label>
                  สีหลักของปุ่ม
                  <input
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
                  ["paymentInstructions", "ข้อมูลบัญชีและคำแนะนำรับชำระ"],
                ] as const).map(([key, label]) => (
                  <Field
                    key={key}
                    label={label}
                    multiline={key === "paymentInstructions"}
                    value={content.site[key]}
                    onChange={(value) =>
                      change({
                        ...content,
                        site: { ...content.site, [key]: value },
                      })
                    }
                  />
                ))}
                <p>
                  ช่องว่างของช่องทางติดต่อและข้อมูลรับชำระใช้ค่าที่ตั้งไว้เดิม
                  การเปลี่ยนบัญชีรับชำระมีผลหลังเผยแพร่ ตรวจชื่อบัญชีและเลขบัญชีก่อนเผยแพร่ทุกครั้ง
                  ระบบตรวจสลิปยังใช้คนตรวจตาม Flow
                </p>
              </>
            )}
            {tab === "media" && (
              <>
                <h2>คลังรูปภาพ</h2>
                <label>
                  อัปโหลด JPG/PNG ไม่เกิน 2 MB
                  <input
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
                  รูปที่ยังไม่อยู่ในเนื้อหาที่เผยแพร่เปิดดูได้เฉพาะ Admin
                  รูปเก็บไว้เพื่อรองรับการย้อนเวอร์ชัน
                </p>
                <div className="cms-media-grid">
                  {media.map((m) => (
                    <article key={m.id}>
                      <img src={m.url} alt={m.name.replace("cms-image:", "")} />
                      <p>{m.name.replace("cms-image:", "")}</p>
                      <input aria-label="URL รูปภาพ" readOnly value={m.url} />
                      <button
                        disabled={busy || dirty}
                        onClick={() => {
                          if (
                            !window.confirm("ลบรูปนี้? รูปที่อยู่ในร่างหรือประวัติจะลบไม่ได้")
                          )
                            return
                          setBusy(true)
                          void api("/admin/cms/media/delete", { id: m.id })
                            .then(() => {
                              setMedia((rows) =>
                                rows.filter((x) => x.id !== m.id),
                              )
                              setMessage("ลบรูปแล้ว")
                            })
                            .catch((e) => setError(e.message))
                            .finally(() => setBusy(false))
                        }}
                      >
                        ลบรูปที่ไม่ได้ใช้
                      </button>
                    </article>
                  ))}
                </div>
              </>
            )}
            {tab === "history" && (
              <>
                <h2>เวอร์ชันที่เคยเผยแพร่ (เก็บล่าสุด 30 เวอร์ชัน)</h2>
                {state.history.map((v) => (
                  <article className="cms-block-editor" key={v.revision}>
                    <h3>เวอร์ชัน {v.revision}</h3>
                    <p>
                      {v.updatedAt
                        ? new Date(v.updatedAt).toLocaleString("th-TH")
                        : "เนื้อหาเริ่มต้น"}{" "}
                      · {v.updatedBy || "ระบบ"}
                    </p>
                    <button
                      onClick={() => {
                        if (
                          window.confirm(
                            "คืนเวอร์ชันนี้เป็นร่าง? การแก้ไขที่ยังไม่บันทึกจะถูกแทนที่ เว็บจริงยังไม่เปลี่ยนจนกดเผยแพร่",
                          )
                        )
                          void mutate("restore", v.revision)
                      }}
                    >
                      คืนเป็นร่าง
                    </button>
                  </article>
                ))}
                {!state.history.length && <p>ยังไม่มีการเผยแพร่จาก CMS</p>}
              </>
            )}
          </fieldset>
        </>
      )}
    </PortalShell>
  )
}
