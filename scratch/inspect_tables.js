import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iouesuwfqfqemamxnenz.supabase.co';
// We'll use the key from check_challenges_temp.js
const supabaseKey = 'sb_publishable_SVw_3C-R4NVdKkmh6QHC8g_PZrOf2Dm';
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
  console.log("Fetching one row from 'palavras'...");
  const { data, error } = await supabase
    .from('palavras')
    .select('*')
    .limit(1);
    
  if (error) {
    console.error("Error fetching from palavras:", error);
  } else {
    console.log("palavras row:", data);
  }

  console.log("Fetching one row from 'words'...");
  const { data: wordsData, error: wordsError } = await supabase
    .from('words')
    .select('*')
    .limit(1);
    
  if (wordsError) {
    console.error("Error fetching from words:", wordsError);
  } else {
    console.log("words row:", wordsData);
  }
}

inspect();
