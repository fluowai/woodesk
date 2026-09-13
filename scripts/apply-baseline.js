import fs from "node:fs";
import { Client } from "pg";

async function main() {
  const dbUrl = "postgresql://postgres.qsdcvxjffbezlibythxr:15H0RGfudF24rEST@aws-0-sa-east-1.pooler.supabase.com:6543/postgres";
  const client = new Client({ connectionString: dbUrl });
  
  try {
    await client.connect();
    console.log("Connected to Supabase.");
    
    console.log("Creating extensions...");
    await client.query("CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;");
    await client.query("CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;");
    await client.query("CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA public;");
    await client.query("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\" WITH SCHEMA public;");
    await client.query("CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;");

    console.log("Reading baseline.sql...");
    const sql = fs.readFileSync('supabase/baseline.sql', 'utf8');
    
    console.log("Applying baseline.sql... this might take a minute.");
    await client.query(sql);
    console.log("Baseline applied successfully!");
  } catch (error) {
    console.error("Error applying baseline:", error);
  } finally {
    await client.end();
  }
}

main();
