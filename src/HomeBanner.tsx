import { useEffect, useRef, useState } from "react"
import { api } from "./api"
import type { HomeBannerItem } from "./cms"
import { useCms,usePresentation } from "./cms"
export default function HomeBanner() {
  const { home } = useCms()
  const presentation=usePresentation()
  const [now, setNow] = useState(Date.now())
  const [advertisements, setAdvertisements] = useState<HomeBannerItem[]>([])
  useEffect(() => {
    let active = true
    const load = () =>
      void api<{ advertisements: HomeBannerItem[] }>(
        "/public/advertisements?placement=home",
      )
        .then((d) => {
          if (active) setAdvertisements(d.advertisements)
        })
        .catch(() => {})
    const changed=(event:StorageEvent)=>{if(event.key==="villacheck-advertisements-updated")load()};
    window.addEventListener("villacheck-advertisements-updated",load);window.addEventListener("storage",changed);
    load()
    const timer = setInterval(load, 30000)
    return () => {
      active = false
      clearInterval(timer)
      window.removeEventListener("villacheck-advertisements-updated",load);window.removeEventListener("storage",changed);
    }
  }, [])
  const editorial = home.banners?.length
    ? home.banners.filter(
        (b) =>
          b.visible &&
          (!b.startsAt || Date.parse(b.startsAt) <= now) &&
          (!b.endsAt || Date.parse(b.endsAt) > now),
      )
    : home.images.map((image, i) => ({
        id: String(i),
        image,
        mobileImage: "",
        title: home.title,
        description: home.description,
        href: home.buttonHref ?? "#page=directory",
        label: home.buttonLabel ?? "ค้นหาที่พัก",
        sponsored: false,
      }))
  const activeAdvertisements = advertisements.filter(
    b => (!b.startsAt || Date.parse(b.startsAt) <= now) && (!b.endsAt || Date.parse(b.endsAt) > now),
  )
  const slides: (HomeBannerItem | (typeof editorial)[number])[] = presentation.bannerSource === "mixed" ? [...activeAdvertisements,...editorial] : presentation.bannerSource === "editorial-first" ? (editorial.length?editorial:activeAdvertisements) : (activeAdvertisements.length?activeAdvertisements:editorial)
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const touch = useRef<number | null>(null)
  const current = index % Math.max(slides.length, 1)
  const move = (step: number) =>
    setIndex((i) => (i + step + slides.length) % Math.max(slides.length, 1))
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(timer)
  }, [])
  useEffect(() => {
    if (
      paused ||
      slides.length < 2 ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return
    const timer = setInterval(
      () => setIndex((i) => (i + 1) % slides.length),
      home.slideIntervalMs || 5200,
    )
    return () => clearInterval(timer)
  }, [paused, slides.length, home.slideIntervalMs])
  if (!slides.length) return null
  return (
    <div
      className="vc-banner"
      role="region"
      aria-roledescription="carousel"
      aria-label="แบนเนอร์ VillaCheck"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setPaused(false)
      }}
      onTouchStart={(e) => {
        touch.current = e.touches[0].clientX
      }}
      onTouchEnd={(e) => {
        if (touch.current !== null) {
          const delta = e.changedTouches[0].clientX - touch.current
          if (Math.abs(delta) > 45) move(delta < 0 ? 1 : -1)
          touch.current = null
        }
      }}
    >
      {slides.map((slide, i) => (
        <article
          key={slide.id}
          className={`vc-banner-slide ${i === current ? "active" : ""}`}
          aria-hidden={i !== current}
        >
          <picture>
            {slide.mobileImage && (
              <source media="(max-width: 640px)" srcSet={slide.mobileImage} />
            )}
            <img
              src={slide.image}
              alt={slide.title}
              loading={i === 0 ? "eager" : "lazy"}
            />
          </picture>
          <div className="vc-banner-shade" />
          <div className="container vc-banner-copy">
            {slide.sponsored && (
              <span className="vc-ad-label">
                {"demo" in slide && slide.demo ? "โฆษณาตัวอย่าง · แพ็กเกจ 4,990 บาท/เดือน" : "พื้นที่โฆษณา · ไม่ใช่สถานะการตรวจสอบ"}
              </span>
            )}
            <span className="kicker">{slide.sponsored ? "FEATURED VILLA / PREMIUM MEMBER" : home.eyebrow}</span>
            <h2>{slide.title}</h2>
            <p>{slide.description}</p>
            {slide.href && (
              <a
                className="sun-button"
                tabIndex={i === current ? 0 : -1}
                href={slide.href}
                {...(slide.href.startsWith("https:")
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
              >
                {slide.label || "ดูรายละเอียด"} →
              </a>
            )}
          </div>
        </article>
      ))}
      {slides.length > 1 && (
        <>
          <button
            className="vc-banner-prev"
            aria-label="แบนเนอร์ก่อนหน้า"
            onClick={() => move(-1)}
          >
            ‹
          </button>
          <button
            className="vc-banner-next"
            aria-label="แบนเนอร์ถัดไป"
            onClick={() => move(1)}
          >
            ›
          </button>
          <div className="vc-banner-controls">
            {slides.map((s, i) => (
              <button
                key={s.id}
                aria-label={`แบนเนอร์ ${i + 1}`}
                aria-current={i === current ? "true" : undefined}
                className={i === current ? "active" : ""}
                onClick={() => setIndex(i)}
              />
            ))}
            <button
              className="vc-banner-pause"
              aria-label={paused ? "เล่นสไลด์" : "หยุดสไลด์"}
              onClick={() => setPaused((v) => !v)}
            >
              {paused ? "▶" : "Ⅱ"}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
