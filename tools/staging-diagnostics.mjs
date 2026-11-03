// Default is configuration-only: no DB connection, network, or mail delivery.
import {smtpTransportOptions,smtpDiagnostic} from "../server/smtp-diagnostics.mjs"
const names=["APP_ENV","APP_URL","DATABASE_URL","DIRECT_URL","OTP_SECRET","STAGING_EMAIL_ALLOWLIST","SMTP_HOST","SMTP_PORT","SMTP_SECURE","SMTP_USER","SMTP_PASSWORD","SMTP_FROM","PAYMENT_ACCESS_MODE","OMISE_TEST_ENABLED","OMISE_TEST_PUBLIC_KEY","OMISE_TEST_SECRET_KEY","OMISE_TEST_METHODS","CRON_SECRET","BACKUP_DATABASE_URL","BACKUP_SECRET","BACKUP_DIR","BACKUP_RETENTION_DAYS","PUBLIC_URL","ALERT_WEBHOOK_URL"]
console.log(JSON.stringify({environment:names.map(name=>({name,configured:Boolean(process.env[name])})),providerAcceptance:false},null,2))
if(process.argv.includes("--verify-smtp")){
 if(process.env.APP_ENV!=="staging"){console.error("SMTP verification requires APP_ENV=staging; no message was sent");process.exitCode=1}
 else{let transport;try{const {default:nodemailer}=await import("nodemailer");transport=nodemailer.createTransport(smtpTransportOptions(process.env));await transport.verify();console.log(JSON.stringify({smtpConnectionVerified:true,messageSent:false,inboxVerified:false}))}catch(error){console.log(JSON.stringify({smtpConnectionVerified:false,...smtpDiagnostic(error),messageSent:false}));process.exitCode=1}finally{transport?.close()}}
}
