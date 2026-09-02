import { defineConfig } from "drizzle-kit";
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required (Replit provisions it; on-prem set it in .env)");
export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL },
});
