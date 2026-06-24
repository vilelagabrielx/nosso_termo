import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iouesuwfqfqemamxnenz.supabase.co';
const supabaseKey = 'sb_publishable_SVw_3C-R4NVdKkmh6QHC8g_PZrOf2Dm';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log("Fetching recent challenges from Supabase...");
  const { data, error } = await supabase
    .from('challenges')
    .select('*')
    .order('date', { ascending: false })
    .limit(10);
    
  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Recent challenges:", data);
  }
}

check();
