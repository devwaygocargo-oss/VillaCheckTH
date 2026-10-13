import { randomBytes, createHash, createHmac } from "node:crypto"
import { createUser, transaction } from "./database.mjs"
const digest = (value) => createHash("sha256").update(value).digest("hex")
export function safeReturn(value) {
  if (typeof value !== "string" || !value.startsWith("#") || value.length > 500)
    return "#page=user-dashboard"
  const params = new URLSearchParams(value.slice(1))
  if(['owner-dashboard','owner-information','owner-profile'].includes(params.get('page')))return `#page=${params.get('page')}`
  if (
    params.get("page") !== "verify" ||
    !/^VC-[a-zA-Z0-9-]+$/.test(params.get("item") || "")
  )
    return "#page=user-dashboard"
  return `#${new URLSearchParams({ page: "verify", item: params.get("item") })}`
}
export function oauthProviders(config) {
  return {
    google: Boolean(config.googleClientId && config.googleClientSecret),
    line: Boolean(config.lineClientId && config.lineClientSecret),
    facebook: Boolean(
      config.facebookLoginEnabled !== false && config.facebookClientId &&
        config.facebookClientSecret &&
        /^v\d+\.0$/.test(config.facebookVersion || ""),
    ),
  }
}
export function createOAuth(db, config, issueSession, fetchProvider = fetch) {
  const stateCookie = (state, age = 600) =>
    `vc_oauth=${state}; HttpOnly; Path=/api/auth/oauth; SameSite=Lax; Max-Age=${age}${
      config.secureCookies ? "; Secure" : ""
    }`
  async function getJson(url, options) {
    const response = await fetchProvider(url, {
      ...options,
      signal: AbortSignal.timeout(15000),
      redirect: "error",
    })
    if (!response.ok) throw Error("provider_failed")
    return response.json()
  }
  return async (req, res, url, linkUser=null) => {
    const match = url.pathname.match(
      /^\/api\/auth\/oauth\/(google|facebook|line)\/(start|callback|link)$/,
    )
    if (!match || req.method !== (match[2]==='link'?'POST':'GET')) return false
    const [, provider, action] = match
    if(action==='link'&&linkUser?.role!=='merchant')throw Object.assign(Error('เฉพาะ Merchant'),{status:403})
    let returnTo=action==='link'?'#page=owner-profile':safeReturn(url.searchParams.get('returnTo'))
    const isMerchant=()=>returnTo.startsWith('#page=owner-')
    const enabled = oauthProviders(config)[provider]
    const redirect = (location) => {
      res.writeHead(302, { Location: location })
      res.end()
    }
    const failure = (error) =>
      redirect(
        `${config.appUrl}/#page=${action==='link'||returnTo==='#page=owner-profile'?'owner-profile':isMerchant()?'owner-auth':'login'}&oauth_error=${encodeURIComponent(error)}`,
      )
    if (!enabled) {
      if(action==='link')throw Object.assign(Error('ช่องทางนี้ยังไม่พร้อมใช้งาน'),{status:503})
      failure("not_configured")
      return true
    }
    const line = provider === "line"
    const google = provider === "google"
    const clientId = line ? config.lineClientId : google ? config.googleClientId : config.facebookClientId
    const secret = line ? config.lineClientSecret : google
      ? config.googleClientSecret
      : config.facebookClientSecret
    const callback = `${config.appUrl}/api/auth/oauth/${provider}/callback`
    if (action === "start" || action==='link') {
      if (req.headers["sec-fetch-site"] === "cross-site") {
        failure("invalid_state")
        return true
      }
      const state = randomBytes(32).toString("hex"),
        verifier = randomBytes(32).toString("base64url")
      await db
        .prepare("DELETE FROM oauth_states WHERE expires<=?")
        .run(Date.now())
      const old = req.headers.cookie?.match(
        /(?:^|;\s*)vc_oauth=([a-f0-9]{64})(?:;|$)/,
      )?.[1]
      if (old)
        await db
          .prepare("DELETE FROM oauth_states WHERE state_hash=?")
          .run(digest(old))
      await db
        .prepare("INSERT INTO oauth_states(state_hash,provider,verifier,return_to,expires) VALUES (?,?,?,?,?)")
        .run(
          digest(state),
          provider,
          verifier,
          action==='link'?`${returnTo}&linkAccount=${encodeURIComponent(linkUser.id)}`:returnTo,
          Date.now() + 600000,
        )
      const authUrl = new URL(
        line ? "https://access.line.me/oauth2/v2.1/authorize" : google
          ? "https://accounts.google.com/o/oauth2/v2/auth"
          : `https://www.facebook.com/${config.facebookVersion}/dialog/oauth`,
      )
      authUrl.search = new URLSearchParams({
        client_id: clientId,
        redirect_uri: callback,
        response_type: "code",
        scope: line ? "openid profile email" : google ? "openid email profile" : "email,public_profile",
        state,
      }).toString()
      if (google || line) {
        authUrl.searchParams.set(
          "code_challenge",
          createHash("sha256").update(verifier).digest("base64url"),
        )
        authUrl.searchParams.set("code_challenge_method", "S256")
      }
      if (line) authUrl.searchParams.set("nonce", verifier)
      res.setHeader("Set-Cookie", stateCookie(state))
      if(action==='link'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({authorizeUrl:authUrl.toString()}))}else redirect(authUrl.toString())
      return true
    }
    const state = url.searchParams.get("state")
    const cookieState = req.headers.cookie?.match(
      /(?:^|;\s*)vc_oauth=([a-f0-9]{64})(?:;|$)/,
    )?.[1]
    if (!state || !/^[a-f0-9]{64}$/.test(state) || state !== cookieState) {
      failure("invalid_state")
      return true
    }
    const flow = await db
      .prepare(
        "DELETE FROM oauth_states WHERE state_hash=? AND provider=? AND expires>? RETURNING *",
      )
      .get(digest(state), provider, Date.now())
    if (!flow) {
      failure("invalid_state")
      return true
    }
    returnTo=safeReturn(flow.return_to)
    const bindingId=new URLSearchParams(flow.return_to.slice(1)).get('linkAccount')
    await db
      .prepare("DELETE FROM oauth_states WHERE state_hash=?")
      .run(digest(state))
    res.setHeader("Set-Cookie", stateCookie("", 0))
    if (url.searchParams.has("error")) {
      failure("cancelled")
      return true
    }
    const code = url.searchParams.get("code")
    if (!code || code.length > 4096) {
      failure("invalid_state")
      return true
    }
    try {
      const params = new URLSearchParams({
        client_id: clientId,
        client_secret: secret,
        redirect_uri: callback,
        code,
      })
      if (google || line) {
        params.set("grant_type", "authorization_code")
        params.set("code_verifier", flow.verifier)
      }
      const tokens = await getJson(
        line ? "https://api.line.me/oauth2/v2.1/token" : google
          ? "https://oauth2.googleapis.com/token"
          : `https://graph.facebook.com/${config.facebookVersion}/oauth/access_token`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: params.toString(),
        },
      )
      if (typeof tokens.access_token !== "string" || !tokens.access_token)
        throw Error("provider_failed")
      let profile
      if (line) {
        if (typeof tokens.id_token !== "string" || !tokens.id_token) throw Error("provider_failed")
        profile = await getJson("https://api.line.me/oauth2/v2.1/verify", {
          method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({id_token: tokens.id_token, client_id: clientId, nonce: flow.verifier}).toString(),
        })
        if (profile.iss !== "https://access.line.me" || profile.aud !== clientId || profile.nonce !== flow.verifier || !Number.isFinite(profile.exp) || profile.exp <= Date.now()/1000) throw Error("provider_failed")
      } else {
      const profileUrl = new URL(
        google
          ? "https://openidconnect.googleapis.com/v1/userinfo"
          : `https://graph.facebook.com/${config.facebookVersion}/me`,
      )
      if (!google) {
        profileUrl.searchParams.set("fields", "id,name,email")
        profileUrl.searchParams.set(
          "appsecret_proof",
          createHmac("sha256", secret)
            .update(tokens.access_token)
            .digest("hex"),
        )
      }
      profile = await getJson(profileUrl, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      })
      }
      const subject = google || line ? profile.sub : profile.id
      if (typeof subject !== "string" || !subject || subject.length > 255)
        throw Error("provider_failed")
      if (google && profile.email_verified !== true)
        throw Error("email_required")
      const linked = await db
        .prepare(
          "SELECT u.* FROM oauth_identities o JOIN users u ON u.id=o.user_id WHERE o.provider=? AND o.subject=?",
        )
        .get(provider, subject)
      let user = linked
      if(bindingId){
        if(linkUser?.id!==bindingId||linkUser.role!=='merchant')throw Error('account_type_mismatch')
        const owner=await db.prepare('SELECT * FROM users WHERE id=?').get(bindingId)
        if(!owner||owner.role!=='merchant')throw Error('account_type_mismatch')
        if(linked&&linked.id!==owner.id)throw Error('identity_exists')
        const emailOwner=typeof profile.email==='string'?await db.prepare('SELECT id FROM users WHERE email=?').get(profile.email.toLowerCase()):null
        if(emailOwner&&emailOwner.id!==owner.id)throw Error('email_exists')
        await transaction(db,async()=>{await db.prepare('DELETE FROM oauth_identities WHERE provider=? AND user_id=?').run(provider,owner.id);await db.prepare('INSERT INTO oauth_identities VALUES (?,?,?)').run(provider,subject,owner.id)})
        user=owner
      }
      if (!user) {
        if (
          typeof profile.email !== "string" ||
          profile.email.length > 254 ||
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)
        )
          throw Error("email_required")
        const address = profile.email.toLowerCase()
        // Never silently link an OAuth identity to an existing email/password or privileged account.
        if (await db.prepare("SELECT id FROM users WHERE email=?").get(address))
          throw Error("email_exists")
        user = await transaction(db, async () => {
          const name =
            typeof profile.name === "string"
              ? profile.name.slice(0, 200).replace(/[\x00-\x1f]/g, "")
              : "User"
          const created = await createUser(
            db,
            address,
            randomBytes(48).toString("hex"),
            name || "User",
            isMerchant()?"merchant":"user",
          )
          await db
            .prepare("INSERT INTO oauth_identities VALUES (?,?,?)")
            .run(provider, subject, created.id)
          return created
        })
      }
      if(isMerchant()&&user.role!=='merchant')throw Error('account_type_mismatch')
      const sessionCookie = (await issueSession(req, user)).cookie
      res.setHeader("Set-Cookie", [stateCookie("", 0), sessionCookie])
      const onboarding=user.role==='merchant'&&(!user.business_name||!user.phone||!user.address||user.email.endsWith('@phone.villacheck.invalid'))
      const target=user.role==='admin'?'#page=admin-dashboard':user.role==='merchant'?(bindingId?'#page=owner-profile':onboarding?'#page=owner-information':isMerchant()?returnTo:'#page=owner-dashboard'):returnTo
      redirect(`${config.appUrl}/${target}`)
    } catch (error) {
      failure(
        ["email_required", "email_exists", "identity_exists", "account_type_mismatch"].includes(error.message)
          ? error.message
          : "provider_failed",
      )
    }
    return true
  }
}
