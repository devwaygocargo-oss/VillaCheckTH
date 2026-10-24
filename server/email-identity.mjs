import { randomBytes } from "node:crypto"
import { hashPassword } from "./database.mjs"

// Called only after the provider or local OTP has verified mailbox ownership,
// within the same transaction as consuming the OTP.
export async function claimVerifiedEmail(db, user) {
  if (user.role === "admin") return user // Admin recovery is an operator workflow.
  const key = `verified_email:${user.id}:${user.email}`
  if (await db.prepare("SELECT value FROM system_settings WHERE key=?").get(key)) return user
  // An earlier registrant may still know the password and hold active sessions.
  await db.prepare("UPDATE users SET password_hash=? WHERE id=?")
    .run(hashPassword(randomBytes(48).toString("hex")), user.id)
  await db.prepare("DELETE FROM sessions WHERE user_id=?").run(user.id)
  await db.prepare("INSERT INTO system_settings(key,value) VALUES (?,?)").run(key, JSON.stringify({ verifiedAt: new Date().toISOString(), method: "EMAIL_OTP" }))
  return db.prepare("SELECT * FROM users WHERE id=?").get(user.id)
}
