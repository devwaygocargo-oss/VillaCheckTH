import { useEffect, useState } from "react"
import { api, currentAccount } from "./api"
import type { Account } from "./merchantStore"
type Review = {
  id: string
  villaName?: string
  rating: number
  content: string
  author: string
  status?: string
  reason?: string
  createdAt: string
  reviewedAt?: string
  reviewedByName?: string
  reply?: {
    content: string
    author: string
  }
  history?: {
    action: string
    reason?: string
    detail?: string
    at: string
  }[]
}
const statuses: Record<string, string> = {
  pending: "รอตรวจสอบ",
  published: "เผยแพร่",
  more_info: "ขอข้อมูลเพิ่ม",
  rejected: "ไม่อนุมัติ",
}
export default function Reviews({
  qr,
  mode = "public",
}: {
  qr?: string
  mode?: "public" | "admin" | "merchant" | "user"
}) {
  const [rows, setRows] = useState<Review[]>([]),
    [account, setAccount] = useState<Account | null>(null),
    [content, setContent] = useState(""),
    [rating, setRating] = useState(5),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [reasons, setReasons] = useState<Record<string, string>>({}),
    [reasonCode, setReasonCode] = useState("spam"),
    [reason, setReason] = useState("")
  const path =
    mode === "public"
      ? `/public/reviews?qr=${encodeURIComponent(qr || "")}`
      : mode === "admin"
        ? "/admin/reviews"
        : mode === "merchant"
          ? "/merchant/reviews"
          : "/reviews"
  const load = async () => {
    const data = await api<{
      reviews: Review[]
      reasons?: Record<string, string>
    }>(path)
    setRows(data.reviews)
    if (data.reasons) setReasons(data.reasons)
  }
  useEffect(() => {
    let active = true
    void currentAccount()
      .then((a) => {
        if (active) setAccount(a)
      })
      .catch(() => {})
    void load().catch((e) => {
      if (active) setError(e.message)
    })
    return () => {
      active = false
    }
  }, [path])
  const act = async (path: string, data: unknown) => {
    setBusy(true)
    setError("")
    setMessage("")
    try {
      await api(path, data)
      await load()
      setMessage("บันทึกแล้ว")
      setContent("")
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ")
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="merchant-panel">
      <h2>
        {mode === "admin"
          ? "ตรวจสอบรีวิวตามกติกา"
          : mode === "user"
            ? "รีวิวของฉัน"
            : mode === "merchant"
              ? "รีวิวที่พักและคำชี้แจง"
              : "รีวิวจากผู้เข้าพัก"}
      </h2>
      <p>
        ทุกแพ็กเกจมีรีวิว ใช้กติกาเดียวกันทุกคะแนน ความเห็นเชิงลบที่ไม่ผิดกติกาเผยแพร่ได้
        เจ้าของที่พักตอบชี้แจงได้
      </p>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {mode === "admin" && (
        <div className="portal-form">
          <label>
            เหตุผลตามกติกา
            <select
              value={reasonCode}
              onChange={(e) => setReasonCode(e.target.value)}
            >
              {Object.entries(reasons).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            รายละเอียดประกอบการพิจารณา
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
        </div>
      )}
      {!rows.length && <p>ยังไม่มีรีวิว</p>}
      {rows.map((r) => (
        <article
          key={r.id}
          style={{ padding: "20px 0", borderBottom: "1px solid #dbe5df" }}
        >
          <strong>
            {"★".repeat(r.rating)}
            {"☆".repeat(5 - r.rating)} · {r.author}
          </strong>
          {r.villaName && <p>{r.villaName}</p>}
          <p style={{ whiteSpace: "pre-wrap" }}>{r.content}</p>
          <small>
            {new Date(r.createdAt).toLocaleString("th-TH", {
              timeZone: "Asia/Bangkok",
            })}
            {r.status && ` · ${statuses[r.status]}`}
          </small>
          {r.reason && <p>เหตุผล: {r.reason}</p>}
          {r.reviewedAt && (
            <p>
              ผู้พิจารณา: {r.reviewedByName} ·{" "}
              {new Date(r.reviewedAt).toLocaleString("th-TH", {
                timeZone: "Asia/Bangkok",
              })}
            </p>
          )}
          {r.reply && (
            <blockquote>
              <strong>เจ้าของที่พักชี้แจง</strong>
              <p>{r.reply.content}</p>
            </blockquote>
          )}
          {mode === "admin" && (
            <div className="button-row">
              {(["published", "more_info", "rejected"] as const).map(
                (status) => (
                  <button
                    disabled={busy}
                    key={status}
                    onClick={() =>
                      void act(`/admin/reviews/${r.id}/moderate`, {
                        status,
                        reasonCode,
                        reason,
                      })
                    }
                  >
                    {statuses[status]}
                  </button>
                ),
              )}
            </div>
          )}
          {(mode === "merchant" ||
            (mode === "user" &&
              ["rejected", "more_info"].includes(r.status || ""))) && (
            <form
              className="portal-form"
              onSubmit={(e) => {
                e.preventDefault()
                const data = new FormData(e.currentTarget),
                  text = String(data.get("text"))
                void act(
                  mode === "merchant"
                    ? `/merchant/reviews/${r.id}/reply`
                    : `/reviews/${r.id}/appeal`,
                  mode === "merchant" ? { content: text } : { detail: text },
                )
              }}
            >
              <label>
                {mode === "merchant" ? "ตอบชี้แจงรีวิว" : "ข้อมูลเพิ่มเติม / ขอทบทวนผล"}
                <textarea name="text" required maxLength={4000} />
              </label>
              <button disabled={busy}>
                {mode === "merchant" ? "ส่งคำชี้แจง" : "ส่งคำขอทบทวน"}
              </button>
            </form>
          )}
          {mode === "admin" && r.history?.length && (
            <details>
              <summary>ประวัติการพิจารณา</summary>
              {r.history.map((h, i) => (
                <p key={i}>
                  {h.action} · {h.reason || h.detail} ·{" "}
                  {new Date(h.at).toLocaleString("th-TH", {
                    timeZone: "Asia/Bangkok",
                  })}
                </p>
              ))}
            </details>
          )}
        </article>
      ))}
      {mode === "public" && account?.role === "user" && (
        <form
          className="portal-form"
          onSubmit={(e) => {
            e.preventDefault()
            void act("/reviews", { qr, rating, content })
          }}
        >
          <h3>เขียนรีวิว</h3>
          <label>
            คะแนน
            <select
              value={rating}
              onChange={(e) => setRating(Number(e.target.value))}
            >
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {n} ดาว
                </option>
              ))}
            </select>
          </label>
          <label>
            ประสบการณ์ของคุณ
            <textarea
              required
              maxLength={4000}
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </label>
          <p>
            รีวิวจะรอตรวจสอบตามกติกาก่อนเผยแพร่ ดูสถานะและขอทบทวนผลได้ที่รีวิวของฉันในบัญชี
            User
          </p>
          <button className="primary-button" disabled={busy}>
            ส่งรีวิว
          </button>
        </form>
      )}
      {mode === "public" && !account && (
        <a
          className="outline-button"
          href={`#page=login&item=${encodeURIComponent(qr || "")}`}
        >
          เข้าสู่ระบบเพื่อเขียนรีวิว
        </a>
      )}
    </section>
  )
}
