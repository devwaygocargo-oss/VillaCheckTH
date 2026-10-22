import { useEffect, useState } from "react";
const pages = new Set(["admin-villa-page","admin-advertising","admin-reviews","admin-owner-verification","admin-receiving-bank","admin-approved-villas","admin-verify","admin-pending-villas","admin-login","admin-cms", "cms-page", "user-registration", "admin-users", "admin-leads", "admin-settings", "admin-payments", "admin-subscriptions", "home", "directory", "detail", "scan", "verify", "pricing", "login", "about", "verification-standard", "articles", "article-detail", "owner-guide", "help", "contact", "privacy", "terms", "social-facebook", "social-instagram", "social-line", "gallery", "owner-auth", "owner-registration", "owner-information", "owner-onboarding-villa", "package-confirmation", "owner-select-villa", "package-request-pending", "owner-profile", "owner-dashboard", "owner-villas", "owner-villa-detail", "owner-villa-edit", "owner-add-villa", "owner-preview", "owner-pending", "owner-analytics", "owner-reports", "owner-package", "user-dashboard", "user-checks", "user-check-detail", "user-reports", "user-report-detail", "user-precheck", "user-check-success", "villa-report", "villa-report-success", "admin-dashboard", "admin-owners", "admin-villas", "admin-checks", "admin-reports", "admin-qr", "admin-packages"]);
const adminReturnKey="villacheck-admin-return";
const returnableAdmin=(page:string)=>pages.has(page)&&page.startsWith("admin-")&&!["admin-login","admin-verify","admin-villa-page"].includes(page);
export function lastAdminPage(){
 try{const saved=JSON.parse(sessionStorage.getItem(adminReturnKey)||"null");if(saved&&returnableAdmin(saved.page)&&typeof saved.item==="string")return {page:saved.page as import("./prototype").Page,item:saved.item};}catch{}
 return {page:"admin-approved-villas" as import("./prototype").Page,item:""};
}
function rememberAdminPage(location:{page:string;item:string}){
 try{if(location.page==="admin-login")sessionStorage.removeItem(adminReturnKey);else if(returnableAdmin(location.page))sessionStorage.setItem(adminReturnKey,JSON.stringify(location));}catch{}
}
function readLocation() {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const requestedAdmin = params.get("page")?.startsWith("admin-");
  const adminPath = /^\/admin(?:\/|$)/.test(window.location.pathname);
  if((requestedAdmin || adminPath) && window.location.hostname.endsWith(".vercel.app") && window.location.hostname !== "design-villacheck.vercel.app"){window.location.replace("https://design-villacheck.vercel.app/admin/login");return {page:"admin-login",item:""};}
  if(adminPath && params.has("page") && !requestedAdmin){window.location.replace("/#"+params);return {page:"home",item:""};}
  if(requestedAdmin && !adminPath){window.location.replace("/admin/login");return {page:"admin-login",item:""};}
  if(window.location.pathname === "/admin/login")return {page:"admin-login",item:""};
  const requested = params.get("page") || (window.location.pathname === "/admin/login" ? "admin-login" : window.location.pathname === "/admin" ? "admin-cms" : "home");
  const page = requested === "admin-review" ? "admin-pending-villas" : requested;
  return { page: pages.has(page) ? page : "home", item: params.get("item") || "" };
}
export function usePageNavigation<T extends string>() {
  const [location, setLocation] = useState(readLocation);
  useEffect(()=>{rememberAdminPage(location)},[location.page,location.item]);
  useEffect(() => {
    const restore = () => { setLocation(readLocation()); window.scrollTo(0, 0); };
    window.addEventListener("popstate", restore);
    window.addEventListener("hashchange", restore);
    return () => { window.removeEventListener("popstate", restore); window.removeEventListener("hashchange", restore); };
  }, []);
  const navigate = (page: T, item = "") => {
    if (!pages.has(page)) return;
    const params = new URLSearchParams({ page });
    if (item) params.set("item", item);
    const hash = page === "admin-login" ? "/admin/login" : page.startsWith("admin-") ? `/admin#${params}` : `/${window.location.pathname === "/" ? window.location.search : ""}#${params}`;
    if(/^\/admin(?:\/|$)/.test(window.location.pathname) !== page.startsWith("admin-")){window.location.assign(hash);return;}
    if (window.location.pathname + window.location.hash !== hash) window.history.pushState(null, "", hash);
    setLocation({ page, item });
    window.dispatchEvent(new Event("app-navigation"));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  return [location.page as T, navigate, location.item] as const;
}
