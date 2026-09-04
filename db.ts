import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Add a PostgreSQL database in Replit, or set it in .env on-premises.");
}

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
export const db = drizzle(pool, { schema });
export type Db = typeof db;
