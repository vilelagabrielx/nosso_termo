import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iouesuwfqfqemamxnenz.supabase.co';
const supabaseKey = 'sb_publishable_SVw_3C-R4NVdKkmh6QHC8g_PZrOf2Dm';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const counts = {};
  for (let len = 3; len <= 12; len++) {
    const { count, error } = await supabase
      .from('palavras')
      .select('*', { count: 'exact', head: true })
      .eq('Length', len)
      .eq('Enabled', true);
    if (!error) {
      counts[len] = count;
    } else {
      console.error(`Error for length ${len}:`, error);
    }
  }
  console.log("Enabled word counts by length in database:", counts);
}
check();
