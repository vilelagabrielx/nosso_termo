import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iouesuwfqfqemamxnenz.supabase.co';
const supabaseKey = 'sb_publishable_SVw_3C-R4NVdKkmh6QHC8g_PZrOf2Dm';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { count, error } = await supabase
    .from('palavras')
    .select('*', { count: 'exact', head: true })
    .eq('Length', 3);
    
  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Total words of length 3 in database (enabled or disabled):", count);
  }
}

check();
