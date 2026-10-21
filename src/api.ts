import type { Account } from "./merchantStore"
const adminPortal = () => typeof window !== "undefined" && /^\/admin(?:\/|$)/.test(window.location.pathname)
let csrf = ""
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
    window.dispatchEvent(new Event("auth-session-changed"))
  }
  return value as T
}
// Share only simultaneous public reads. Settled responses are never cached.
const publicReads=new Map<string,Promise<unknown>>();
export function api<T>(path:string,data?:unknown):Promise<T>{
  if(data!==undefined || !(/^\/public\/(?:cms|villas|advertisements)(?:\?|$)/.test(path) || path==="/config"))return request<T>(path,data);
  const existing=publicReads.get(path);if(existing)return existing as Promise<T>;
  const pending=request<T>(path).then(value=>{publicReads.delete(path);return value;},error=>{publicReads.delete(path);throw error;});
  publicReads.set(path,pending);return pending;
}
export async function currentAccount() {
  const session = await api<{ user: Account; csrf: string }>(adminPortal() ? "/auth/admin-me" : "/auth/me")
  csrf = session.csrf
  return session.user
}
export async function authenticate(
  email: string,
  password: string,
  name?: string,
  role: "merchant" | "user" = "merchant",
  businessNameEn?: string,
) {
  const session = await api<{ user: Account; csrf: string }>(
    name === undefined ? "/auth/login" : role === "user" ? "/auth/register-user" : "/auth/register",
    { email, password, name, businessNameEn },
  )
  csrf = session.csrf
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
