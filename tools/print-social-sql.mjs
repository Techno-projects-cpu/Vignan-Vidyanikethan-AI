#!/usr/bin/env node
/**
 * Print the SQL that turns on Friends, Chat and Play.
 *
 * Supabase cannot be changed from inside the app (the server only ever gets a
 * PostgREST key, not a database connection), so the one migration that creates
 * those tables has to be pasted into the Supabase SQL editor once:
 *
 *   npm run sql:social
 *
 * then copy the output into https://supabase.com/dashboard → SQL Editor → Run.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATION = path.join(ROOT, "supabase", "migrations", "20261028000000_vignan_social.sql");

const sql = await fs.readFile(MIGRATION, "utf8");

if (process.argv.includes("--sql-only")) {
  process.stdout.write(sql);
} else {
  process.stdout.write(
    [
      "-- Vignan Vidyanikethan AI · friends, chat and games",
      "-- 1. Open https://supabase.com/dashboard → your project → SQL Editor → New query",
      "-- 2. Paste everything below the ruler and press Run",
      "-- 3. Wait ~10 seconds, then reload the site. No redeploy is needed.",
      "-- This migration is safe to run more than once.",
      "",
      "-".repeat(72),
      "",
      sql,
    ].join("\n"),
  );
}
