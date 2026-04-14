import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf8');
const supabaseUrl = envFile.match(/VITE_SUPABASE_URL=(.*)/)?.[1] || '';
const supabaseKey = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1] || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function update() {
  const { data, error } = await supabase
    .from('settings')
    .update({ value: 15 })
    .eq('key', 'monthly_due_day');
  console.log('Update result:', data, error);
}
update();
