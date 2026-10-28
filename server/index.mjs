import {existingCustomerOAuth} from "./customer-oauth-runtime.mjs";
import {stagedProviderEnvironment} from "./staged-provider-configuration.mjs";
import {sharedApplicationEnvironment} from './shared-application-environment.mjs';
import {verifyRuntime} from "./staging-interactive-policy.mjs";
import {stagingDemoEnvironment} from './staging-demo-safety.mjs'
import {productionRuntimePolicy,verifyProductionData,isProductionRuntime} from "./production-runtime.mjs"
import {stagingMailTransport} from "./staging-mail.mjs"
import {paymentConfiguration} from "./payment-access.mjs"
import {smtpTransportOptions} from "./smtp-diagnostics.mjs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createApp } from "./app.mjs"
import { hashPassword, openDatabase } from "./database.mjs"
import { openPostgres } from "./postgres.mjs"
/** @param {NodeJS.ProcessEnv} env
 * @param {{listen?: boolean, databaseFactory?: (url?: string) => Promise<any>, allowLegacyEnvironment?: boolean}} options */
export async function startServer(env = process.env, { listen = true, databaseFactory, allowLegacyEnvironment = false } = {}) {
  const customerOAuth=existingCustomerOAuth(env);
  env=sharedApplicationEnvironment(stagedProviderEnvironment(env),stagingDemoEnvironment)
  const policy=productionRuntimePolicy(env,{allowLegacyEnvironment})
  env = {
    ...env,
    DATABASE_URL: env.DATABASE_URL || env.VillaCheck_DATABASE_URL,
  }
  const paymentAccessMode=paymentConfiguration(env)
  const production = env.NODE_ENV === "production"
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
  const appUrl = (env.APP_URL || "http://localhost:8443").replace(/\/$/, "")
  if (production && (!env.APP_URL || !appUrl.startsWith("https://")))
    throw Error("APP_URL must be your public HTTPS URL in production")
  if (production && env.SEED_DEMO_ACCOUNTS === "true")
    throw Error("Demo accounts cannot be enabled in production")
  const seedDemo = false
  const db = databaseFactory ? await databaseFactory(env.DATABASE_URL) : env.DATABASE_URL
    ? await openPostgres(env.DATABASE_URL,{bootstrap:false})
    : openDatabase(
        env.DATABASE_PATH || resolve(root, "server/data/villacheck.sqlite"),
      )
  let server
  try {
    if(isProductionRuntime(env))await verifyProductionData(db,{allowUninitializedCatalog:policy.businessInitializationDisabled===true});else await verifyRuntime(db,env);
    if (
      isProductionRuntime(env) &&
      (await db
        .prepare(
          "SELECT id FROM users WHERE email IN ('owner@villacheck.test','admin@villacheck.test','user@villacheck.test')",
        )
        .get())
    )
      throw Error("Use a clean production database without local demo users")
    if (
      production &&
      !(await db.prepare("SELECT id FROM users WHERE role='admin'").get())
    )
      throw Error(policy.phase1?"Phase1 Admin must be provisioned separately":"Set ADMIN_EMAIL and ADMIN_PASSWORD for initial setup")
    let transport
    if ((!policy.phase1||policy.emailOtpDelivery==='SMTP') && env.SMTP_HOST && env.SMTP_FROM) {
      const { default: nodemailer } = await import("nodemailer")
      transport = nodemailer.createTransport(smtpTransportOptions(env))
    }
    transport=stagingMailTransport(transport,env)
    const config = {
      interactiveDemo:env.APP_ENV==='staging',
      businessInitializationDisabled:policy.businessInitializationDisabled===true,
      productionPrelaunch:policy.prelaunch,
      productionRuntime:isProductionRuntime(env)||policy.phase1,
      productionDemoDataApproval:isProductionRuntime(env)?"ZERO_DEMO_DATA":undefined,
      productionReleaseMode:policy.releaseMode||(policy.phase1?'PHASE1':isProductionRuntime(env)?'PRELAUNCH':undefined),
      phase1EmailOtpDelivery:policy.phase1?policy.emailOtpDelivery:undefined,
      phase1RequirementsRevision:env.PHASE1_REQUIREMENTS_REVISION,
      phase1ActivationMode:policy.phase1?env.PHASE1_ACTIVATION_MODE:undefined,
      phase1InitialGrantPolicy:policy.phase1?env.PHASE1_INITIAL_GRANT_POLICY:undefined,
      phase1EmailOtpApproval:env.PHASE1_EMAIL_OTP_APPROVAL,
      appUrl,
      appEnvironment:env.APP_ENV,
      stagingEmailAllowlist:(env.STAGING_EMAIL_ALLOWLIST||"").split(",").map(x=>x.trim().toLowerCase()).filter(Boolean),
      paymentAccessMode,
      omiseTestPublicKey:env.OMISE_TEST_PUBLIC_KEY,
      omiseTestMethods:(env.OMISE_TEST_METHODS||"").split(",").map(x=>x.trim()).filter(Boolean),
      demoMode:env.DEMO_MODE === "true",
      paymentVerificationMode: env.PAYMENT_VERIFICATION_MODE || "MANUAL",
      otpSecret: env.OTP_SECRET,
      otpLoginEnabled: env.OTP_LOGIN_ENABLED==='true',
      phoneRegistrationEnabled: env.STAGING_SECURITY_REGISTRATION_ENABLED==='true',
      stagingRegistrationPhones:{user:env.STAGING_REGISTRATION_PHONE_USER,merchant:env.STAGING_REGISTRATION_PHONE_MERCHANT},
      stagingSmsAllowlist:[env.STAGING_REGISTRATION_PHONE_USER,env.STAGING_REGISTRATION_PHONE_MERCHANT].filter(Boolean),
      thaiBulkSmsApiKey: policy.phase1?undefined:env.THAIBULKSMS_API_KEY,
      thaiBulkSmsApiSecret: policy.phase1?undefined:env.THAIBULKSMS_API_SECRET,
      thaiBulkSmsSender: policy.phase1?undefined:env.THAIBULKSMS_SENDER,
      thaiBulkSmsOtpKey: policy.phase1?undefined:env.THAIBULKSMS_OTP_KEY,
      thaiBulkSmsOtpSecret: policy.phase1?undefined:env.THAIBULKSMS_OTP_SECRET,
      thaiBulkSmsEmailOtpTemplateId: policy.phase1?undefined:env.THAIBULKSMS_EMAIL_OTP_TEMPLATE_ID,
      lineClientId: policy.phase1?undefined:env.LINE_CHANNEL_ID,
      lineClientSecret: policy.phase1?undefined:env.LINE_CHANNEL_SECRET,
      googleClientId: policy.phase1?undefined:env.GOOGLE_CLIENT_ID,
      googleClientSecret: policy.phase1?undefined:env.GOOGLE_CLIENT_SECRET,
      ...customerOAuth,
      facebookClientId: policy.phase1?undefined:env.FACEBOOK_APP_ID,
      facebookClientSecret: policy.phase1?undefined:env.FACEBOOK_APP_SECRET,
      facebookVersion: env.FACEBOOK_GRAPH_VERSION,
      seedDemo,
      serverless: !listen,
      trustVercelProxy: env.VERCEL === "1",
      secureCookies: production || env.COOKIE_SECURE === "true",
      allowedOrigins: [
        new URL(appUrl).origin,
        ...(!production
          ? [
              "http://localhost:8443",
              "http://127.0.0.1:8443",
              "http://localhost:3001",
            ]
          : []),
      ],
      smtpFrom: env.SMTP_FROM,
      requireDualApproval:false,
      omiseTestEnabled:env.OMISE_TEST_ENABLED === "true",
      omiseTestSecretKey:env.OMISE_TEST_SECRET_KEY,
      cronSecret:env.CRON_SECRET,
      facebookLoginEnabled:env.FACEBOOK_LOGIN_ENABLED==='true',
      paymentInstructions: env.PAYMENT_INSTRUCTIONS,
      staticDir:
        env.SERVE_FRONTEND === "true" || production
          ? resolve(root, "dist")
          : undefined,
      fakeHash: hashPassword("unmatchable-placeholder-password"),
    }
    server = createApp(db, config, transport)
    if (!listen) return { server, db }
    await new Promise((resolve, reject) => {
      server.once("error", reject)
      server.listen(
        Number(env.BACKEND_PORT || env.PORT || 3001),
        env.BACKEND_HOST || "127.0.0.1",
        resolve,
      )
    })
    console.log(
      `VillaCheck Backend: http://${env.BACKEND_HOST || "127.0.0.1"}:${server.address().port}`,
    )
    console.log(
      `SMTP: ${
        transport ? "configured" : "not configured; messages remain queued"
      }`,
    )
    return { server, db }
  } catch (error) {
    server?.emit("close")
    await db.close()
    throw error
  }
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const { server, db } = await startServer()
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => {
      server.close(async () => {
        await db.close()
        process.exit(0)
      })
    })
}
