import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iouesuwfqfqemamxnenz.supabase.co';
const supabaseKey = 'sb_publishable_SVw_3C-R4NVdKkmh6QHC8g_PZrOf2Dm';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase
    .from('palavras')
    .select('Source, Length')
    .eq('Enabled', true);
    
  if (error) {
    console.error("Error:", error);
    return;
  }
  
  const counts = {};
  for (const row of data) {
    const key = `${row.Source || 'unknown'}_len${row.Length}`;
    counts[key] = (counts[key] || 0) + 1;
  }
  
  console.log("Enabled word counts by Source and Length:", counts);
}

check();
