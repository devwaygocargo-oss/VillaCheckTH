import { useEffect, useState } from "react"
import { api } from "./api"
type Media = {
  id: string
  name: string
  kind: string
  url: string
  uploadedAt: string | null
  takenAt: string | null
  reviewedAt: string | null
}
const date = (value: string | null) =>
  value
    ? new Date(
        value.length === 10 ? value + "T00:00:00+07:00" : value,
      ).toLocaleDateString("th-TH", {
        timeZone: "Asia/Bangkok",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "ไม่ระบุ"
export default function PropertyMedia({
  qr,
  villaId,
  mode = "public",
}: {
  qr?: string
  villaId?: string
  mode?: "public" | "merchant" | "admin"
}) {
  const [media, setMedia] = useState<Media[]>([]),
    [latest, setLatest] = useState<string | null>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [takenAt, setTakenAt] = useState(""),
    [busy, setBusy] = useState(false)
  const path =
    mode === "public"
      ? `/public/property-media?qr=${encodeURIComponent(qr || "")}`
      : `/${mode}/property-media?villaId=${villaId}`
  const load = async () => {
    const data = await api<{
      media: Media[]
      latestUpdatedAt: string | null
    }>(
      path,
    )
    setMedia(data.media)
    setLatest(data.latestUpdatedAt)
  }
  useEffect(() => {
    void load().catch((e) => setError(e.message))
  }, [path])
  const upload = async (file?: File) => {
    if (!file) return
    setError("")
    setBusy(true)
    setMessage("")
    try {
      if (file.size > 2 * 1024 * 1024) throw Error("ไฟล์ต้องไม่เกิน 2 MB")
      const data = await new Promise<string>((resolve, reject) => {
        const r = new FileReader()
        r.onload = () => resolve(String(r.result))
        r.onerror = reject
        r.readAsDataURL(file)
      })
      await api(`/${mode}/property-media`, {
        villaId,
        takenAt,
        file: { name: file.name, type: file.type, data },
      })
      await load()
      setMessage("อัปโหลดสื่อแล้ว วันที่อัปโหลดบันทึกอัตโนมัติ")
    } catch (e) {
      setError(e instanceof Error ? e.message : "อัปโหลดไม่สำเร็จ")
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="merchant-panel">
      <h2>รูปภาพและวิดีโอ</h2>
      <p>อัปเดตรูปภาพ/วิดีโอล่าสุดเมื่อ {date(latest)}</p>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {mode !== "public" && (
        <div className="portal-form">
          <label>
            วันที่ถ่ายภาพหรือวิดีโอ (ไม่ทราบเว้นว่าง)
            <input
              type="date"
              value={takenAt}
              onChange={(e) => setTakenAt(e.target.value)}
            />
          </label>
          <label>
            อัปโหลด JPG / PNG / MP4 ไม่เกิน 2 MB
            <input
              disabled={busy}
              type="file"
              accept="image/jpeg,image/png,video/mp4"
              onChange={(e) => {
                void upload(e.target.files?.[0])
                e.target.value = ""
              }}
            />
          </label>
          <p>
            รูปภาพใช้ได้ทุกแพ็กเกจ วิดีโอต้องใช้สิทธิ์ 1,990 ขึ้นไปที่ยังใช้งานอยู่
            วันที่อัปโหลดแยกจากวันที่ถ่ายจริง
          </p>
        </div>
      )}
      <div className="villa-grid">
        {media.map((m) => (
          <figure key={m.id} style={{ margin: 0 }}>
            {m.kind === "video" ? (
              <video
                controls
                playsInline
                preload="metadata"
                src={m.url}
                style={{ width: "100%", borderRadius: 12 }}
              />
            ) : (
              <a href={m.url} target="_blank" rel="noopener noreferrer">
                <img
                  src={m.url}
                  alt={m.name}
                  style={{
                    width: "100%",
                    aspectRatio: "4/3",
                    objectFit: "cover",
                    borderRadius: 12,
                  }}
                />
              </a>
            )}
            <figcaption>
              <strong>{m.name}</strong>
              <p>
                อัปโหลด: {date(m.uploadedAt)}
                <br />
                ถ่าย: {date(m.takenAt)}
                {m.reviewedAt && (
                  <>
                    <br />
                    ทีมตรวจสื่อ: {date(m.reviewedAt)}
                  </>
                )}
              </p>
            </figcaption>
            {mode === "admin" && (
              <button
                disabled={busy}
                onClick={async () => {
                  setBusy(true)
                  setError("")
                  try {
                    await api("/admin/property-media", {
                      villaId,
                      mediaId: m.id,
                    })
                    await load()
                    setMessage("บันทึกการตรวจสื่อแล้ว")
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ")
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                ยืนยันว่าได้ตรวจสื่อนี้แล้ว
              </button>
            )}
          </figure>
        ))}
      </div>
      {!media.length && <p>ยังไม่มีรูปภาพหรือวิดีโอ</p>}
    </section>
  )
}
