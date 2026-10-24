import type { PaymentQrData } from "./PaymentQr";
export type Document = { name: string; data: string; type: string }
export type Invoice = {
  gateway?: "OMISE"|"MANUAL"
  packageName: string
  updatedAt: string
  bankQrImage: string
  paymentQr: PaymentQrData | null
  scope: "merchant" | "villa"
  id: string
  villaId: string
  amount: number
  months: number
  paymentInstructions: string | null
  paymentStatus: "WAITING_FOR_SLIP" | "PENDING_REVIEW" | "VERIFYING" | "VERIFIED" | "REJECTED" | "FAILED"
  verificationMode: "MANUAL" | "AUTO"
  status: "pending" | "submitted" | "paid"
  reference: string
  reason: string
  created: string
  paidAt: string | null
  proof: Document | null
}
export type VillaReviewRequest = {id:string|null;kind:string;submittedAt:string|null;submittedBy:string|null;summary:string;changes:{field:string;label:string;before:string;after:string}[]}
export type MerchantVilla = {
  approvalStatus?: "APPROVED"|"REJECTED"|"CHANGE_REQUESTED"|"PENDING_APPROVAL"
  paymentStatus?: "PENDING_REVIEW"|"UNPAID"|"PAID"|"NO_PAYMENT_REQUIRED"|"FAILED"|"RECONCILIATION_REQUIRED"
  subscriptionStatus?: "PROMOTIONAL"|"ACTIVE"|"EXPIRED"|"SUSPENDED"|"CANCELLED"
  reviewRequest?: VillaReviewRequest
  id: string
  name: string
  createdAt: string
  trialUnlimited: boolean
  nameEn: string
  photoUploadedAt: string | null
  photoTakenAt: string | null
  photoReviewedAt: string | null
  photoUrl: string
  guestCapacity: number | null
  province: string
  phone: string
  bankName: string
  accountName: string
  accountNumber: string
  merchant: string
  email: string
  package: string
  packageId: string
  document: Document
  status: "pending" | "approved" | "changes" | "rejected"
  qrStatus: string
  verificationLevel: string
  premiumBanner: boolean
  reason: string
  qr: string
  expires: string
  payments: number
  paymentPending: boolean
  invoices: Invoice[]
}
export type Mail = {
  id: string
  villaId: string
  to: string
  subject: string
  body: string
  created: string
  status: string
  error: string
}
export type Account = {
  id: string
  name: string
  email: string
  role: "merchant" | "admin" | "user"
}
export type Store = {
  packageModel?: "PER_VILLA"
  subscription: { packageId: string; name: string; amount: number; billingCycle: string; billingMonths: number; capacity: number; used: number; expires: string | null; active: boolean; status: string; renewalDate: string | null; payments: number } | null
  villas: MerchantVilla[]
  mails: Mail[]
  user: Account
  paymentBankQrImage: string
  paymentInstructions: string
  paymentConfigured: boolean
  demoMode: boolean
  smtpConfigured: boolean
  createdId?: string
}
