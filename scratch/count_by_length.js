import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iouesuwfqfqemamxnenz.supabase.co';
const supabaseKey = 'sb_publishable_SVw_3C-R4NVdKkmh6QHC8g_PZrOf2Dm';
const supabase = createClient(supabaseUrl, supabaseKey);

async function count() {
  const counts = {};
  for (let len = 4; len <= 10; len++) {
    const { count, error } = await supabase
      .from('palavras')
      .select('*', { count: 'exact', head: true })
      .eq('Length', len);
    if (!error) {
      counts[len] = count;
    } else {
      console.error(`Error for length ${len}:`, error);
    }
  }
  console.log("Word counts by length in database:", counts);
}
count();
