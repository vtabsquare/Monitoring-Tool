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
  console.log("Fetching DB state...");
  
  // 1. Organizations
  const { data: orgs } = await supabase.from('organizations').select('*');
  console.log("\n--- Organizations ---");
  console.log(orgs);
  
  // 2. Profiles
  const { data: profiles } = await supabase.from('profiles').select('*');
  console.log("\n--- Profiles ---");
  console.log(profiles);
  
  // 3. User Roles
  const { data: roles } = await supabase.from('user_roles').select('*');
  console.log("\n--- User Roles ---");
  console.log(roles);
  
  // 4. Auth Users (first few)
  const { data: users, error } = await supabase.auth.admin.listUsers();
  if (error) console.error(error);
  console.log("\n--- Auth Users ---");
  users?.users.forEach(u => console.log(`${u.id} - ${u.email}`));
}
main();
