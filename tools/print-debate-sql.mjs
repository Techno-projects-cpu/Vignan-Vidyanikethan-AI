#!/usr/bin/env node
import fs from 'node:fs/promises';
const sql = await fs.readFile(new URL('../supabase/migrations/20261029000000_debate_rooms.sql', import.meta.url), 'utf8');
process.stdout.write('-- Private online debate rooms: run once in your Supabase SQL editor.\n');
process.stdout.write('-- Uses the existing server service-role key; never put that key in the browser.\n');
process.stdout.write('-- After applying, deploy the branch/release and test with two student accounts.\n\n');
process.stdout.write(sql);
