import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iouesuwfqfqemamxnenz.supabase.co';
const supabaseKey = 'sb_publishable_SVw_3C-R4NVdKkmh6QHC8g_PZrOf2Dm';
const supabase = createClient(supabaseUrl, supabaseKey);

const threeLetterWords = [
  "SOL", "RUA", "LUA", "TIO", "RIO", "MAU", "OVO", "REI", "DIA", "PAI",
  "MAE", "BOI", "TOM", "SIM", "NAO", "VER", "DAR", "TER", "SER", "IR",
  "VIR", "CRU", "LEI", "ATO", "BAU", "FEZ", "DEU", "FOI", "VOU", "ELA",
  "ELE", "NOS", "VOS", "CAO", "LAR", "VEZ", "MAR", "AR", "GEL", "MEL",
  "CEU", "MAL", "BEM", "PAZ", "VOZ", "LUZ", "DOM", "CHA", "FIM", "DEZ",
  "MIL", "ANO", "MES", "UVA", "BAR", "COR", "ASA", "AVE", "SAL", "SUL",
  "REU", "LEU", "SAI", "PAU", "TEU", "SEU", "MEU", "SUA", "TUA", "DOR",
  "IRA", "USO", "VOO", "IMO", "ZOO", "ECO", "OLA", "ALO", "OBA", "OPA",
  "GAS", "PIA", "BOA", "BOM", "NOZ", "GIZ", "LA", "PA", "NO", "PO",
  "FE", "SO", "VO", "RE", "BIA", "LEO", "RUI", "NEY", "GIL", "ZE"
];

function normalizeWord(word) {
  return word
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .trim();
}

async function run() {
  console.log("1. Normalizing input words...");
  const uniqueNormalized = Array.from(new Set(threeLetterWords.map(normalizeWord)));
  console.log(`Normalized to ${uniqueNormalized.length} unique words.`);

  console.log("2. Fetching existing words from database to avoid duplicates...");
  const { data: existing, error: fetchErr } = await supabase
    .from('palavras')
    .select('Word')
    .eq('Length', 3);
    
  if (fetchErr) {
    console.error("Error fetching existing:", fetchErr);
    return;
  }
  
  const existingSet = new Set(existing.map(r => normalizeWord(r.Word)));
  const toInsert = uniqueNormalized.filter(w => !existingSet.has(w));
  console.log(`Need to insert ${toInsert.length} new words.`);

  if (toInsert.length === 0) {
    console.log("No new words to insert.");
    return;
  }

  console.log("3. Fetching maximum Id in palavras...");
  const { data: maxIdData, error: maxIdErr } = await supabase
    .from('palavras')
    .select('Id')
    .order('Id', { ascending: false })
    .limit(1);
    
  if (maxIdErr) {
    console.error("Error fetching max ID:", maxIdErr);
    return;
  }
  
  let startId = (maxIdData && maxIdData[0] ? Number(maxIdData[0].Id) : 0) + 1;
  console.log(`Starting Id will be: ${startId}`);

  const rows = toInsert.map((w, idx) => ({
    Id: startId + idx,
    Word: w,
    Length: 3,
    Source: 'Dicionário',
    Enabled: true,
    UsedCount: 0
  }));

  console.log(`4. Inserting ${rows.length} rows into palavras...`);
  const { error: insertErr } = await supabase
    .from('palavras')
    .insert(rows);
    
  if (insertErr) {
    console.error("Error inserting rows:", insertErr);
  } else {
    console.log("Successfully inserted all 3-letter words!");
  }
}

run();
