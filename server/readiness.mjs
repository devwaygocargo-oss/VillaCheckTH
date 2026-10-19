import { cmsLoginConfig } from "./cms-business.mjs"
import { oauthProviders } from "./oauth.mjs"
import { otpChannels } from "./login-otp.mjs"
import { demoMode } from "./demo-payment.mjs"
import { cmsPaymentInstructions } from "./cms.mjs"
export async function readiness(db,config,transport) {
  const loginConfig=await cmsLoginConfig(db,config),stamp=new Date().toISOString()
  const diagnostics=async key=>{const row=await db.prepare("SELECT value FROM system_settings WHERE key=?").get(key);return row?JSON.parse(row.value):null}
  const mailCounts=await db.prepare("SELECT status,COUNT(*) AS count FROM mails GROUP BY status").all()
  const lastError=await db.prepare("SELECT last_error,created FROM mails WHERE status='failed' ORDER BY created DESC LIMIT 1").get()
  const capacities=await db.prepare("SELECT COUNT(*) AS count FROM villas WHERE guest_capacity IS NULL").get()
  const legacy=await db.prepare("SELECT COUNT(*) AS count FROM invoices i LEFT JOIN mails m ON m.invoice_id=i.id WHERE i.status!='paid' AND m.payment_instructions IS NULL").get()
  const cms=await db.prepare("SELECT value FROM system_settings WHERE key='cms_published'").get()
  const demo=await demoMode(db,config),oauth=oauthProviders(loginConfig)
  const emailMode=loginConfig.thaiBulkSmsEmailOtpTemplateId?'provider-template':'smtp',smsMode=config.thaiBulkSmsOtpKey&&config.thaiBulkSmsOtpSecret?'provider-template':'sms-api'
  const lastCron=await db.prepare("SELECT value FROM system_settings WHERE key='ops:last_cron'").get()
  return {operations:{dualApprovalRequired:config.requireDualApproval===true,scheduledWorkerConfigured:Boolean(config.cronSecret),lastScheduledRun:lastCron?.value||null},checkedAt:stamp,database:true,demoMode:demo,paymentMode:'MANUAL',paymentConfigured:Boolean(await cmsPaymentInstructions(db,config.paymentInstructions)),smtpConfigured:Boolean(transport),oauth,facebookStatus:loginConfig.facebookLoginEnabled?(oauth.facebook?'enabled-needs-live-acceptance':'credentials-missing'):'waiting-approval',otp:{channels:otpChannels(loginConfig,transport),emailMode,smsMode,emailDelivery:await diagnostics('otp_delivery_email'),smsDelivery:await diagnostics('otp_delivery_sms'),emailVerification:await diagnostics('otp_verification_email'),smsVerification:await diagnostics('otp_verification_sms')},mail:{counts:mailCounts,lastFailure:lastError?{reason:lastError.last_error,at:lastError.created}:null},missingGuestCapacities:Number(capacities.count),legacyInvoicesWithoutBankSnapshot:Number(legacy.count),cms:{publishedRevision:cms?JSON.parse(cms.value).revision:0},acceptance:{physicalDevices:'manual-review-required',businessUat:'manual-review-required',facebook:'external-approval-required',hostedBackupRetention:'operator-review-required'}}
}
