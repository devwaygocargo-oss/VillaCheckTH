import {cleanupCustomerOAuthTransient,prepareCustomerOAuthFlow,saveCustomerOAuthFlow,consumeCustomerOAuthFlow,assertCustomerOAuthBinding,recordCustomerOAuthProof} from "./customer-oauth-security.mjs";
import {enrollVerifiedNewMerchant} from './merchant-free-period.mjs'
import { randomBytes, createHash, createHmac } from "node:crypto"
import { createUser, transaction, audit } from "./database.mjs"
const digest = (value) => createHash("sha256").update(value).digest("hex")
export function safeReturn(value) {
  if (typeof value !== "string" || !value.startsWith("#") || value.length > 500)
    return "#page=user-dashboard"
  const params = new URLSearchParams(value.slice(1))
  if(['owner-dashboard','owner-information','owner-profile','owner-package','user-profile'].includes(params.get('page')))return `#page=${params.get('page')}`
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
      /^\/api\/auth\/oauth\/(google|facebook|line)\/(start|callback|link|reauth)$/,
    )
    if (!match || req.method !== (['link','reauth'].includes(match[2])?'POST':'GET')) return false
    const [, provider, action] = match
    if(['link','reauth'].includes(action)&&!['user','merchant'].includes(linkUser?.role))throw Object.assign(Error('เฉพาะ Merchant'),{status:403})
    let returnTo=['link','reauth'].includes(action)?(linkUser.role==='merchant'?'#page=owner-profile':'#page=user-profile'):safeReturn(url.searchParams.get('returnTo'))
    const isMerchant=()=>returnTo.startsWith('#page=owner-')
    const enabled = oauthProviders(config)[provider]
    const redirect = (location) => {
      res.writeHead(302, { Location: location })
      res.end()
    }
    const failure = (error) =>
      redirect(
        `${config.appUrl}/#page=${returnTo==='#page=user-profile'?'user-profile':returnTo==='#page=owner-profile'?'owner-profile':isMerchant()?'owner-auth':'login'}&oauth_error=${encodeURIComponent(error)}`,
      )
    if (!enabled) {
      if(['link','reauth'].includes(action))throw Object.assign(Error('ช่องทางนี้ยังไม่พร้อมใช้งาน'),{status:503})
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
    if (action === "start" || ['link','reauth'].includes(action)) {
      if (req.headers["sec-fetch-site"] === "cross-site") {
        failure("invalid_state")
        return true
      }
      const state = randomBytes(32).toString("hex"),
        verifier = randomBytes(32).toString("base64url")
      await transaction(db,async()=>{
        await cleanupCustomerOAuthTransient(db)
        const flow=['link','reauth'].includes(action)?await prepareCustomerOAuthFlow(db,linkUser,provider,action):null
        await db.prepare("DELETE FROM oauth_states WHERE expires<=?").run(Date.now())
        const old=req.headers.cookie?.match(/(?:^|;\s*)vc_oauth=([a-f0-9]{64})(?:;|$)/)?.[1]
        if(old){await db.prepare("DELETE FROM oauth_states WHERE state_hash=?").run(digest(old));await consumeCustomerOAuthFlow(db,digest(old))}
        await db.prepare("INSERT INTO oauth_states(state_hash,provider,verifier,return_to,expires) VALUES (?,?,?,?,?)").run(digest(state),provider,verifier,flow?`${returnTo}&${action==='link'?'linkAccount':'reauthAccount'}=${encodeURIComponent(linkUser.id)}`:returnTo,Date.now()+600000)
        if(flow)await saveCustomerOAuthFlow(db,digest(state),flow)
      })
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
      // Google account selection/consent proves linked-provider control, not a
      // fresh provider credentials. LINE additionally supports fresh-login age.
      if(action==='reauth'&&google)authUrl.searchParams.set('prompt','select_account consent')
      if(action==='reauth'&&line){authUrl.searchParams.set('prompt','login');authUrl.searchParams.set('max_age','0')}
      res.setHeader("Set-Cookie", stateCookie(state))
      if(['link','reauth'].includes(action)){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({authorizeUrl:authUrl.toString()}))}else redirect(authUrl.toString())
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
    const consumed=await transaction(db,async()=>{const stateRow=await db.prepare("DELETE FROM oauth_states WHERE state_hash=? AND provider=? AND expires>? RETURNING *").get(digest(state),provider,Date.now());return{flow:stateRow,binding:stateRow?await consumeCustomerOAuthFlow(db,digest(state)):null}})
    const flow=consumed.flow,flowBinding=consumed.binding
    if (!flow) {
      failure("invalid_state")
      return true
    }
    returnTo=safeReturn(flow.return_to)
    const bindingId=new URLSearchParams(flow.return_to.slice(1)).get('linkAccount')||new URLSearchParams(flow.return_to.slice(1)).get('reauthAccount')
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
        if(flowBinding?.action==='reauth'&&(!Number.isFinite(profile.auth_time)||profile.auth_time<flowBinding.startedAt/1000-60||profile.auth_time>Date.now()/1000+60))throw Error('provider_failed')
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
      let boundSessionCookie
      if(bindingId){
        if(!flowBinding||linkUser?.id!==bindingId||!['user','merchant'].includes(linkUser.role))throw Error('account_type_mismatch')
        const completed=await transaction(db,async()=>{
          const snapshot=await assertCustomerOAuthBinding(db,linkUser,flowBinding.binding),owner=snapshot.current
          if(flowBinding.action==='reauth'){
            await recordCustomerOAuthProof(db,linkUser,flowBinding,provider,subject)
            return {reauthenticated:true}
          }
          if(flowBinding.action!=='link'||flowBinding.provider!==provider)throw Error('account_type_mismatch')
          if(linked&&linked.id!==owner.id)throw Error('identity_exists')
          const emailOwner=typeof profile.email==='string'?await db.prepare('SELECT id FROM users WHERE email=?').get(profile.email.toLowerCase()):null
          if(emailOwner&&emailOwner.id!==owner.id)throw Error('email_exists')
          await db.prepare('DELETE FROM oauth_identities WHERE provider=? AND user_id=?').run(provider,owner.id)
          await db.prepare('INSERT INTO oauth_identities VALUES (?,?,?)').run(provider,subject,owner.id)
          await audit(db,owner,'account.oauth_identity_linked',owner.id)
          const issued=await issueSession(req,owner,{expectedPasswordHash:owner.password_hash,expectedOAuthIdentity:{provider,subject}})
          return {user:owner,cookie:issued.cookie}
        })
        if(completed.reauthenticated){redirect(`${config.appUrl}/${returnTo}&oauth_verified=1`);return true}
        user=completed.user;boundSessionCookie=completed.cookie
      }
      if(config.oauthExistingAccountsOnly&&!user)throw Error('identity_not_linked');
      if(user&&config.oauthAccountAllowed)config.oauthAccountAllowed(user);
      if(user?.role==='admin')throw Error('account_type_mismatch');
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
          await enrollVerifiedNewMerchant(db,created,new Date().toISOString(),{createdNow:true})
          return created
        })
      }
      if(bindingId&&user.role==='user')returnTo='#page=user-profile';
      if(isMerchant()&&user.role!=='merchant')throw Error('account_type_mismatch')
      const sessionCookie = boundSessionCookie||(await issueSession(req, user,{expectedOAuthIdentity:{provider,subject}})).cookie
      res.setHeader("Set-Cookie", [stateCookie("", 0), sessionCookie])
      const onboarding=user.role==='merchant'&&(!user.business_name||!user.business_name_en||!user.phone||!user.address||user.email.endsWith('@phone.villacheck.invalid'))
      const target=user.role==='admin'?'#page=admin-dashboard':user.role==='merchant'?(bindingId?'#page=owner-profile':onboarding?'#page=owner-information':isMerchant()?returnTo:'#page=owner-dashboard'):returnTo
      redirect(`${config.appUrl}/${target}`)
    } catch (error) {
      failure(
        ["email_required", "email_exists", "identity_exists", "identity_not_linked", "account_type_mismatch"].includes(error.message)
          ? error.message
          : "provider_failed",
      )
    }
    return true
  }
}
