import { useEffect, useState } from "react";
import { api } from "./api";
import { supportHref } from "./support";
import { useCms,useCopy } from "./cms";
import type { Page } from "./prototype";

type VillaPhoto = { name: string; province: string; qr: string; photoUrl: string };
export default function PublicMedia({ page, go }: { page: Page; go: (page: Page, item?: string) => void }) {
  const t=useCopy();
  const {site}=useCms();
  const [villas, setVillas] = useState<VillaPhoto[]>([]);
  const [loading, setLoading] = useState(page === "gallery");
  const [error, setError] = useState("");
  useEffect(() => {
    if (page !== "gallery") return;
    let active = true;
    setLoading(true);
    setError("");
    void api<{ villas: VillaPhoto[] }>("/public/villas")
      .then(data => { if (active) setVillas(data.villas.filter(v => v.photoUrl)); })
      .catch(e => { if (active) setError(e.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page]);
  const channel = page === "social-facebook" ? "facebook" : page === "social-instagram" ? "instagram" : "line";
  const name = channel === "facebook" ? "Facebook" : channel === "instagram" ? "Instagram" : "LINE Official";
  const href = site[channel] || undefined;
  return <main className="page-bg public-info-page">
    <div className="page-hero container"><h1>{page === "gallery" ? t("media.galleryTitle") : t("media.socialTitle").replace("{channel}",name)}</h1><p>{page === "gallery" ? t("media.galleryDescription") : t("media.socialDescription")}</p></div>
    <div className="container info-body">
      {page === "gallery" ? <>
        {loading && <p role="status">กำลังโหลดรูปที่พัก…</p>}
        {error && <p role="alert">{error}</p>}
        {!loading && !error && !villas.length && <p>ยังไม่มีรูปที่พักที่เผยแพร่</p>}
        <div className="villa-grid">{villas.map(v => <article key={v.qr}><img src={v.photoUrl} alt={v.name} style={{ width: "100%", aspectRatio: "4 / 3", objectFit: "cover", borderRadius: 12 }} /><h2>{v.name}</h2><p>{v.province}</p><button className="outline-button" onClick={() => go("verify", v.qr)}>{t("media.openVilla")}</button></article>)}</div>
      </> : href ? <a className="primary-button" href={href} target="_blank" rel="noopener noreferrer">{t("media.openSocial").replace("{channel}",name)}</a> : <><p>{t("media.unavailable").replace("{channel}",name)}</p><a className="outline-button" href={supportHref("email")}>{t("media.email")}</a><button className="primary-button" onClick={() => go("contact")}>{t("media.contact")}</button></>}
      <button className="text-button" onClick={() => go("home")}>{t("media.home")}</button>
    </div>
  </main>;
}
