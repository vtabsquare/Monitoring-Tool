import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf-8');
const env: Record<string, string> = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    let val = match[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    env[match[1].trim()] = val;
  }
});

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const oldUserId = 'b639c6cf-15a5-4d99-a9fb-b640a620cda9'; // typo account
  const newUserId = '822eceee-4e89-4e98-a828-7a18759b18db'; // correct account
  const newEmail = 'vtabmonitoringtool@gmail.com';

  console.log("Fixing typo in profiles...");
  await supabase.from('profiles').update({
    auth_user_id: newUserId,
    email: newEmail,
    full_name: 'vtabmonitoringtool'
  }).eq('auth_user_id', oldUserId);

  console.log("Fixing typo in user_roles...");
  await supabase.from('user_roles').update({
    user_id: newUserId
  }).eq('user_id', oldUserId);

  console.log("Done! Fixed the typo.");
}
main();
