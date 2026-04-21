import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";
const { Pool } = pkg;
import * as schema from "@shared/schema";
import { env } from "./config/env";

const pool = new Pool({ connectionString: env.database.url });
export const db = drizzle(pool, { schema });
