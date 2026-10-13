import {
  Children,
  Fragment,
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"
import { api } from "./api"
import { cmsDefaults } from "../server/cms-defaults.mjs"
import { configureSupport, openSupport } from "./support"
import ContactLead from "./ContactLead"
import type { Page } from "./prototype"

export type CmsBlock = {
  id: string
  type: "text" | "image" | "cta"
  visible: boolean
  title: string
  body: string
  image: string
  alt: string
  label: string
  href: string
}
export type CmsPage = {
  slug: string
  kicker: string
  title: string
  description: string
  body: string
  blocks: CmsBlock[]
}
export type CmsArticle = {
  id: string
  title: string
  description: string
  body: string
  image: string
  visible: boolean
}
export type CmsFaq = {
  id: string
  question: string
  answer: string
  visible: boolean
}
export type CmsHomeSection = {
  id: string
  visible: boolean
  title: string
  description: string
}
export type CmsContent = {
  schemaVersion: number
  business: {emailOtpSubject:string;emailOtpBody:string;smsOtpBody:string;emailOtpTemplateId:string;facebookLoginEnabled:boolean;monthlyInitialMonths:number;monthlyRenewalMonths:number;paymentEmailSubject:string;paymentEmailIntro:string}
  site: {
    name: string
    description: string
    email: string
    phone: string
    facebook: string
    instagram: string
    line: string
    hours: string
    paymentInstructions: string
    logo: string
    accent: string
  }
  home: {
    eyebrow: string
    title: string
    description: string
    images: string[]
    blocks: CmsBlock[]
    sections: CmsHomeSection[]
  }
  pages: CmsPage[]
  articles: CmsArticle[]
  faqs: CmsFaq[]
  navigation: { id: string; label: string; href: string; visible: boolean }[]
}
export type CmsVersion = {
  revision: number
  content: CmsContent
  updatedAt: string | null
  updatedBy: string | null
}
export type CmsState = {
  draft: CmsVersion
  published: CmsVersion
  history: Omit<CmsVersion,"content">[]
}
export const defaultContent = cmsDefaults as CmsContent
const Context = createContext<CmsContent>(defaultContent)
export const useCms = () => useContext(Context)
export function CmsScope({
  content,
  children,
}: {
  content: CmsContent
  children: React.ReactNode
}) {
  return (
    <Context.Provider value={content}>
      <div
        style={{ "--cms-accent": content.site.accent } as React.CSSProperties}
      >
        {children}
      </div>
    </Context.Provider>
  )
}
export function CmsHomeLayout({ children }: { children: React.ReactNode }) {
  const { home } = useCms(),
    nodes = Children.toArray(children)
  const ids = defaultContent.home.sections.map((s) => s.id)
  return (
    <>
      {home.sections
        .filter((s) => s.visible)
        .map((s) => (
          <Fragment key={s.id}>{nodes[ids.indexOf(s.id)]}</Fragment>
        ))}
    </>
  )
}
export function CmsProvider({ children }: { children: React.ReactNode }) {
  const [content, setContent] = useState(defaultContent)
  const revision = useRef(-1)
  useEffect(() => {
    let active = true
    const load = () => {
      void api<{ revision: number; content: CmsContent }>("/public/cms")
        .then((r) => {
          if (active && r.revision !== revision.current) {
            revision.current = r.revision
            configureSupport(r.content.site)
            setContent(r.content)
          }
        })
        .catch(() => {})
    }
    load()
    const timer = window.setInterval(load, 60000)
    window.addEventListener("cms-published", load)
    return () => {
      active = false
      clearInterval(timer)
      window.removeEventListener("cms-published", load)
    }
  }, [])
  useEffect(() => {
    const update = () => {
      const params = new URLSearchParams(window.location.hash.slice(1)),
        page = params.get("page"),
        item = params.get("item")
      const info =
        page === "article-detail"
          ? content.articles.find((a) => a.id === item || a.title === item)
          : content.pages.find(
              (p) => p.slug === (page === "cms-page" ? item : page),
            )
      document.title = info
        ? `${info.title} | ${content.site.name}`
        : content.site.name
      let meta = document.querySelector<HTMLMetaElement>(
        'meta[name="description"]',
      )
      if (!meta) {
        meta = document.createElement("meta")
        meta.name = "description"
        document.head.append(meta)
      }
      meta.content = info?.description || content.site.description
    }
    update()
    window.addEventListener("hashchange", update)
    window.addEventListener("popstate", update)
    window.addEventListener("app-navigation", update)
    return () => {
      window.removeEventListener("hashchange", update)
      window.removeEventListener("popstate", update)
      window.removeEventListener("app-navigation", update)
    }
  }, [content])
  return <Context.Provider value={content}>{children}</Context.Provider>
}
export function CmsBlocks({ blocks }: { blocks: CmsBlock[] }) {
  return (
    <div className="cms-blocks">
      {blocks
        .filter((b) => b.visible)
        .map((b) => (
          <section key={b.id} className="cms-content-block">
            {b.title && <h2>{b.title}</h2>}
            {b.image && (
              <img src={b.image} alt={b.alt || b.title} loading="lazy" />
            )}
            {b.body && <p className="cms-prose">{b.body}</p>}
            {b.type === "cta" && b.href && (
              <a
                className="primary-button"
                href={b.href}
                {...(b.href.startsWith("https:")
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
              >
                {b.label || "ดูเพิ่มเติม"}
              </a>
            )}
          </section>
        ))}
    </div>
  )
}
export function CmsPublicPage({
  page,
  item = "",
  go,
  content: override,
  preview = false,
}: {
  page: string
  item?: string
  go: (p: Page, item?: string) => void
  content?: CmsContent
  preview?: boolean
}) {
  const live = useCms(),
    content = override || live
  const article = content.articles.find(
    (a) => (a.id === item || a.title === item) && a.visible,
  )
  const info = content.pages.find(
    (p) => p.slug === (page === "cms-page" ? item : page),
  )
  if (page === "home")
    return (
      <div className="cms-preview-home">
        <div className="page-hero">
          <span className="kicker">{content.home.eyebrow}</span>
          <h1 className="cms-prose">{content.home.title}</h1>
          <p>{content.home.description}</p>
        </div>
        <div className="cms-preview-images">
          {content.home.images.map((url, i) => (
            <img key={`${url}-${i}`} src={url} alt={`ภาพหน้าแรก ${i + 1}`} />
          ))}
        </div>
        <CmsBlocks blocks={content.home.blocks} />
      </div>
    )
  if (page === "articles")
    return (
      <main className="page-bg public-info-page">
        <div className="page-hero container">
          <h1>บทความและข่าวสาร</h1>
        </div>
        <div className="container info-article-list">
          {content.articles
            .filter((a) => a.visible)
            .map((a) => (
              <article key={a.id}>
                {a.image && (
                  <img
                    className="cms-article-image"
                    src={a.image}
                    alt={a.title}
                  />
                )}
                <h2>{a.title}</h2>
                <p>{a.description}</p>
                <button
                  className="text-button"
                  onClick={() => go("article-detail", a.id)}
                >
                  อ่านบทความ →
                </button>
              </article>
            ))}
          {!content.articles.some((a) => a.visible) && <p>ยังไม่มีบทความเผยแพร่</p>}
        </div>
      </main>
    )
  if (page === "article-detail")
    return (
      <main className="page-bg public-info-page">
        <div className="page-hero container">
          <h1>{article?.title || "ไม่พบบทความ"}</h1>
          <p>{article?.description}</p>
        </div>
        <article className="container info-body">
          {article?.image && (
            <img
              className="cms-article-image"
              src={article.image}
              alt={article.title}
            />
          )}
          <p className="cms-prose">{article?.body}</p>
          <button className="outline-button" onClick={() => go("articles")}>
            กลับไปบทความทั้งหมด
          </button>
        </article>
      </main>
    )
  return (
    <main className="page-bg public-info-page">
      <div className="page-hero container">
        <span className="kicker">{info?.kicker}</span>
        <h1>{info?.title || "ไม่พบหน้าเว็บ"}</h1>
        <p>{info?.description}</p>
      </div>
      <div className="container info-body">
        <p className="cms-prose">{info?.body}</p>
        <CmsBlocks blocks={info?.blocks || []} />
        {page === "help" &&
          content.faqs
            .filter((f) => f.visible)
            .map((f) => (
              <details className="cms-faq" key={f.id}>
                <summary>{f.question}</summary>
                <p className="cms-prose">{f.answer}</p>
              </details>
            ))}
        {page === "contact" && (
          <>
            <p>
              {content.site.email} {content.site.phone} · {content.site.hours}
            </p>
            {!preview && <ContactLead />}
              {!preview && <button className="outline-button" onClick={()=>openSupport("email")}>ส่งอีเมล</button>}
          </>
        )}
        <button className="outline-button" onClick={() => go(page === "help" ? "contact" : page === "owner-guide" ? "pricing" : "home")}>
          {page === "help" ? "ติดต่อทีมงาน" : page === "owner-guide" ? "ดูแพ็กเกจ" : "กลับหน้าหลัก"}
        </button>
      </div>
    </main>
  )
}
