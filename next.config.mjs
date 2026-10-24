export default {
 async headers() { return [{ source: "/:path*", headers: [
  {key:"X-Content-Type-Options",value:"nosniff"},
  {key:"X-Frame-Options",value:"DENY"},
  {key:"Referrer-Policy",value:"strict-origin-when-cross-origin"},
  {key:"Permissions-Policy",value:"camera=(self), microphone=(), geolocation=(self)"},
  {key:"Content-Security-Policy",value:"frame-ancestors 'none'; object-src 'none'; base-uri 'self'"}
 ]}]; },
 env: { NEXT_PUBLIC_LINE_URL: process.env.NEXT_PUBLIC_LINE_URL || "", NEXT_PUBLIC_SUPPORT_EMAIL: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || process.env.VITE_SUPPORT_EMAIL || "villacheck69@gmail.com", NEXT_PUBLIC_SUPPORT_PHONE: process.env.NEXT_PUBLIC_SUPPORT_PHONE || process.env.VITE_SUPPORT_PHONE || "", NEXT_PUBLIC_FACEBOOK_URL: process.env.NEXT_PUBLIC_FACEBOOK_URL || process.env.VITE_FACEBOOK_URL || "", NEXT_PUBLIC_INSTAGRAM_URL: process.env.NEXT_PUBLIC_INSTAGRAM_URL || process.env.VITE_INSTAGRAM_URL || "" },
 serverExternalPackages: ["@nestjs/core", "@nestjs/common", "@nestjs/platform-express", "@prisma/client", "@prisma/adapter-pg", "pg", "nodemailer"],
 outputFileTracingIncludes: { "/api/*": ["./.build/**/*", "./server/*.sql"] },
};
