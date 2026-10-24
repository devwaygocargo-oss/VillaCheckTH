import type { Account } from "./merchantStore"
const adminPortal = () => typeof window !== "undefined" && /^\/admin(?:\/|$)/.test(window.location.pathname)
let csrf = ""
let sessionEpoch = 0
let accountRead: {path:string;epoch:number;promise:Promise<Account>} | null = null
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}
async function request<T>(path: string, data?: unknown): Promise<T> {
  let response: Response
  try {
    response = await fetch(`/api${path}`, {
      method: data === undefined ? "GET" : "POST",
      credentials: "same-origin",
      headers: { ...(adminPortal() ? {"X-VillaCheck-Portal":"admin"} : {}), ...(data === undefined ? {} : { "Content-Type": "application/json", "X-CSRF-Token": csrf }) },
      body: data === undefined ? undefined : JSON.stringify(data),
    })
  } catch {
    throw new ApiError(503, "เชื่อมต่อ Backend ไม่สำเร็จ กรุณาตรวจสอบว่าเซิร์ฟเวอร์เปิดอยู่")
  }
  const value = await response
    .json()
    .catch(() => ({ error: "เชื่อมต่อ Backend ไม่สำเร็จ" }))
  if (!response.ok)
    throw new ApiError(response.status, value.error || "ดำเนินการไม่สำเร็จ")
  if (data !== undefined && (path.startsWith("/auth/") || path.startsWith("/otp/"))) {
    sessionEpoch++
    window.dispatchEvent(new Event("auth-session-changed"))
  }
  return value as T
}
// Share only simultaneous public reads. Settled responses are never cached.
const publicReads=new Map<string,Promise<unknown>>();
export function api<T>(path:string,data?:unknown):Promise<T>{
  if(data!==undefined && /^\/(?:auth|otp)\//.test(path))sessionEpoch++;
  if(data!==undefined || !(/^\/public\/(?:cms|villas|advertisements)(?:\?|$)/.test(path) || path==="/config"))return request<T>(path,data);
  const existing=publicReads.get(path);if(existing)return existing as Promise<T>;
  const pending=request<T>(path).then(value=>{publicReads.delete(path);return value;},error=>{publicReads.delete(path);throw error;});
  publicReads.set(path,pending);return pending;
}
export async function currentAccount() {
  const path=adminPortal()?"/auth/admin-me":"/auth/me",epoch=sessionEpoch
  if(accountRead?.path===path&&accountRead.epoch===epoch)return accountRead.promise
  const promise=api<{user:Account;csrf:string}>(path).then(session=>{
    if(epoch!==sessionEpoch)throw new ApiError(409,"บัญชีเข้าสู่ระบบเปลี่ยนแล้ว กรุณาโหลดข้อมูลอีกครั้ง")
    csrf=session.csrf
    return session.user
  }).finally(()=>{if(accountRead?.promise===promise)accountRead=null})
  accountRead={path,epoch,promise}
  return promise
}
export async function authenticate(email: string,password: string) {
 const session=await api<{user:Account;csrf:string}>("/auth/login",{email,password})
 csrf=session.csrf
 return session.user
}
export async function authenticateAdmin(email:string,password:string) {
  const session=await api<{user:Account;csrf:string}>("/auth/admin-login",{email,password});
  csrf=session.csrf;return session.user;
}
export async function logout() {
  await currentAccount()
  await api(adminPortal() ? "/auth/admin-logout" : "/auth/logout", {})
  csrf = ""
}
