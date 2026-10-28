import {t as translateSystem} from "./locale"
import {t} from "./locale"
import {onPublicVillaRefresh} from "./publicVillaRefresh";
import {carouselBanners} from "../server/banner-display.mjs";
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
    let active = true, sequence = 0
    const load = () => {
      const request = ++sequence;
      void api<{ advertisements: HomeBannerItem[] }>(
        "/public/advertisements?placement=home",
      )
        .then((d) => {
          if (active && request === sequence) setAdvertisements(d.advertisements)
        })
        .catch(() => { if(active && request === sequence)setAdvertisements([]) })
    }
    const unsubscribe=onPublicVillaRefresh(load)
    const changed=(event:StorageEvent)=>{if(event.key==="villacheck-advertisements-updated")load()};
    window.addEventListener("villacheck-advertisements-updated",load);window.addEventListener("storage",changed);
    load()
    const timer = setInterval(load, 30000)
    return () => {
      active = false
      unsubscribe()
      clearInterval(timer)
      window.removeEventListener("villacheck-advertisements-updated",load);window.removeEventListener("storage",changed);
    }
  }, [])
  const slides: HomeBannerItem[] = carouselBanners(home,presentation,advertisements,now)
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [explicitPlay, setExplicitPlay] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [reduced, setReduced] = useState(false)
  const region = useRef<HTMLDivElement>(null)
  const activeDot = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)")
    const changed = () => setReduced(query.matches)
    changed(); query.addEventListener("change", changed)
    const outside = (event: PointerEvent) => {
      if (!region.current?.contains(event.target as Node)) setRevealed(false)
    }
    document.addEventListener("pointerdown", outside)
    return () => { query.removeEventListener("change", changed); document.removeEventListener("pointerdown", outside) }
  }, [])
  const touch = useRef<{x:number;y:number} | null>(null)
  const current = index % Math.max(slides.length, 1)
  const move = (step: number) =>
    setIndex((i) => (i + step + slides.length) % Math.max(slides.length, 1))
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(timer)
  }, [])
  useEffect(() => {
    if (
      paused || ((hovered || focused) && !explicitPlay) || reduced ||
      slides.length < 2 ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return
    const timer = setInterval(
      () => setIndex((i) => (i + 1) % slides.length),
      home.slideIntervalMs || 5200,
    )
    return () => clearInterval(timer)
  }, [paused, hovered, focused, explicitPlay, reduced, slides.length, home.slideIntervalMs])
  useEffect(() => {
    const dot = activeDot.current, strip = dot?.parentElement
    if (dot && strip) strip.scrollLeft = dot.offsetLeft - strip.clientWidth / 2 + dot.clientWidth / 2
  }, [current])
  if (!slides.length) return null
  return (
    <div
      className="vc-banner"
      role="region"
      aria-roledescription="carousel"
      aria-label={translateSystem("แบนเนอร์ VillaCheck")}
      ref={region}
      tabIndex={slides.length > 1 ? 0 : undefined}
      data-navigation={revealed ? "visible" : "hidden"}
      onMouseEnter={() => { setHovered(true); setExplicitPlay(false) }}
      onMouseLeave={() => { setHovered(false); if (!focused) setRevealed(false) }}
      onClick={(e) => {
        if (!(e.target as Element).closest("a,input,select,textarea")) setRevealed(true)
        if (!(e.target as Element).closest(".vc-banner-pause")) setExplicitPlay(false)
      }}
      onFocusCapture={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setExplicitPlay(false); setFocused(true); setRevealed(true) }}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) { setFocused(false); setRevealed(false) }
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") { setRevealed(false); if ((e.target as Element).closest(".vc-banner-prev,.vc-banner-next")) { region.current?.focus(); setRevealed(false) } return }
        if (e.target !== e.currentTarget) return
        if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
          e.preventDefault(); setExplicitPlay(false); setRevealed(true)
          if (e.key === "Home") setIndex(0)
          else if (e.key === "End") setIndex(slides.length - 1)
          else move(e.key === "ArrowLeft" ? -1 : 1)
        }
      }}
      onTouchStart={(e) => {
        setExplicitPlay(false)
        touch.current = {x:e.touches[0].clientX,y:e.touches[0].clientY}
      }}
      onTouchCancel={() => { touch.current = null }}
      onTouchEnd={(e) => {
        if (touch.current !== null) {
          const dx = e.changedTouches[0].clientX - touch.current.x
          const dy = e.changedTouches[0].clientY - touch.current.y
          if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) { move(dx < 0 ? 1 : -1); setRevealed(true) }
          touch.current = null
        }
      }}
    >
      {slides.map((slide, i) => (
        <article
          key={slide.id}
          data-banner-id={slide.id}
          className={`vc-banner-slide ${i === current ? "active" : ""}`}
          aria-hidden={i !== current}
          role="group"
          aria-roledescription="slide"
          aria-label={`${i + 1} / ${slides.length}`}
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
                {"demo" in slide && slide.demo ? translateSystem("โฆษณา · แพ็กเกจ 4,990 บาท/เดือน") : translateSystem("พื้นที่โฆษณา · ไม่ใช่สถานะการตรวจสอบ")}
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
                {slide.label || translateSystem("ดูรายละเอียด")} →
              </a>
            )}
          </div>
        </article>
      ))}
      {slides.length > 1 && (
        <>
          <button
            type="button"
            tabIndex={revealed ? 0 : -1}
            aria-hidden={!revealed}
            className="vc-banner-prev"
            aria-label={translateSystem("แบนเนอร์ก่อนหน้า")}
            onClick={() => move(-1)}
          >
            ‹
          </button>
          <button
            type="button"
            tabIndex={revealed ? 0 : -1}
            aria-hidden={!revealed}
            className="vc-banner-next"
            aria-label={translateSystem("แบนเนอร์ถัดไป")}
            onClick={() => move(1)}
          >
            ›
          </button>
          <div className="vc-banner-controls">
            <div className="vc-banner-dots" role="group" aria-label={translateSystem("เลือกแบนเนอร์")}>
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                ref={i === current ? activeDot : undefined}
                aria-label={translateSystem("แบนเนอร์ {v0}", {v0: i + 1})}
                aria-current={i === current ? "true" : undefined}
                className={i === current ? "active" : ""}
                onClick={() => setIndex(i)}
              />
            ))}
            </div>
            <button
              type="button"
              disabled={reduced}
              aria-pressed={paused || reduced}
              className="vc-banner-pause"
              aria-label={reduced ? translateSystem("ปิดสไลด์อัตโนมัติตามการตั้งค่าลดการเคลื่อนไหว") : paused ? translateSystem("เล่นสไลด์") : translateSystem("หยุดสไลด์")}
              onClick={() => { setPaused(!paused); setExplicitPlay(paused) }}
            >
              {paused || reduced ? "▶" : "Ⅱ"}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
