import "dotenv/config";
import { defineConfig } from "prisma/config";
if(process.env.APP_ENV==="production"&&process.argv.some(x=>x==="migrate"||x==="db"))throw new Error("Use the separately approved production schema migration configuration");
export default defineConfig({
 schema: "prisma/schema.prisma",
 migrations: { path: "prisma/migrations" },
 datasource: { url: process.env.DATABASE_URL || process.env.VillaCheck_DATABASE_URL || "postgresql://unused:unused@localhost:5432/villacheck" },
});
