import CmsMediaPicker,{type CmsMedia} from "./CmsMediaPicker";
import type { CmsContent, HomeBannerItem } from "./cms"
export default function BannerEditor({
  content,
  onChange,media,onUploaded,
}: {
  media:CmsMedia[]
  onUploaded:(media:CmsMedia)=>void
  content: CmsContent
  onChange: (content: CmsContent) => void
}) {
  const banners = content.home.banners || []
  const save = (items: HomeBannerItem[]) =>
    onChange({ ...content, home: { ...content.home, banners: items } })
  const update = (index: number, patch: Partial<HomeBannerItem>) =>
    save(banners.map((b, i) => (i === index ? { ...b, ...patch } : b)))
  return (
    <section>
      <h2>แบนเนอร์พร้อมลิงก์และตารางแสดงผล</h2>
      <p>
        รายการที่เปิดใช้และอยู่ในช่วงเวลาจะแสดงตามลำดับนี้ เมื่อยังไม่มีรายการจะใช้ภาพสไลด์เดิม
        วันเวลาใช้เขตเวลาประเทศไทย
      </p>
      <label>
        ช่วงเวลาเลื่อน (วินาที)
        <input
          type="number"
          min="2"
          max="60"
          value={(content.home.slideIntervalMs || 5200) / 1000}
          onChange={(e) =>
            onChange({
              ...content,
              home: {
                ...content.home,
                slideIntervalMs: Number(e.target.value) * 1000,
              },
            })
          }
        />
      </label>
      {banners.map((b, i) => (
        <fieldset className="cms-block-editor" key={b.id}>
          <legend>แบนเนอร์ {i + 1}</legend>
          <CmsMediaPicker library={media} onUploaded={onUploaded} label="รูปคอมพิวเตอร์" value={b.image} onChange={image=>update(i,{image})}/>
          <CmsMediaPicker label="รูปมือถือ" value={b.mobileImage} onChange={mobileImage=>update(i,{mobileImage})}/>
          {([
            ["title", "หัวข้อ"],
            ["description", "คำอธิบาย"],
            ["href", "ลิงก์ปลายทาง HTTPS หรือ #page=…"],
            ["label", "ข้อความปุ่ม"],
          ] as const).map(([key, label]) => (
            <label key={key}>
              {label}
              <input
                value={b[key]}
                onChange={(e) => update(i, { [key]: e.target.value })}
              />
            </label>
          ))}
          {(["startsAt", "endsAt"] as const).map((key) => (
            <label key={key}>
              {key === "startsAt" ? "เริ่มแสดง (เวลาไทย)" : "สิ้นสุด (เวลาไทย)"}
              <input
                type="datetime-local"
                value={
                  b[key]
                    ? new Date(Date.parse(b[key]) + 7 * 3600000)
                        .toISOString()
                        .slice(0, 16)
                    : ""
                }
                onChange={(e) =>
                  update(i, {
                    [key]: e.target.value
                      ? new Date(e.target.value + ":00+07:00").toISOString()
                      : "",
                  })
                }
              />
            </label>
          ))}
          <label>
            <input
              type="checkbox"
              checked={b.visible}
              onChange={(e) => update(i, { visible: e.target.checked })}
            />
            เปิดใช้งาน
          </label>
          <p>แบนเนอร์โฆษณาที่พักให้จัดการใน Admin → Packages → โฆษณาและคอนเทนต์ Social เพื่อให้ระบบตรวจสิทธิ์แพ็กเกจก่อนแสดง</p>
          {b.image && (
            <img
              src={b.image}
              alt={b.title}
              style={{ maxWidth: "100%", maxHeight: 180, objectFit: "contain" }}
            />
          )}
          <div className="button-row">
            <button
              type="button"
              disabled={!i}
              onClick={() => {
                const rows = [...banners]
                ;[rows[i - 1], rows[i]] = [rows[i], rows[i - 1]]
                save(rows)
              }}
            >
              เลื่อนขึ้น
            </button>
            <button
              type="button"
              disabled={i === banners.length - 1}
              onClick={() => {
                const rows = [...banners]
                ;[rows[i + 1], rows[i]] = [rows[i], rows[i + 1]]
                save(rows)
              }}
            >
              เลื่อนลง
            </button>
            <button
              type="button"
              onClick={() => save(banners.filter((x) => x.id !== b.id))}
            >
              ลบแบนเนอร์
            </button>
          </div>
        </fieldset>
      ))}
      <button
        type="button"
        className="outline-button"
        onClick={() =>
          save([
            ...banners,
            {
              id: `banner-${crypto.randomUUID()}`,
              title: "แบนเนอร์ใหม่",
              description: "",
              image: content.home.images[0],
              mobileImage: "",
              href: "#page=directory",
              label: "ดูรายละเอียด",
              visible: false,
              sponsored: false,
              startsAt: "",
              endsAt: "",
            },
          ])
        }
      >
        เพิ่มแบนเนอร์
      </button>
    </section>
  )
}
