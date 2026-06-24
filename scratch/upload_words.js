import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iouesuwfqfqemamxnenz.supabase.co';
const supabaseKey = 'sb_publishable_SVw_3C-R4NVdKkmh6QHC8g_PZrOf2Dm';
const supabase = createClient(supabaseUrl, supabaseKey);

const palavrasDir = './palavras';

const files = [
  { name: 'verbos.txt', source: 'verbos' },
  { name: 'lexico.txt', source: 'lexico' },
  { name: 'conjugações.txt', source: 'conjugações' }
];

function normalizeWord(word) {
  return word
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .trim();
}

async function upload() {
  console.log("1. Reading text files...");
  const uniqueWordsMap = new Map(); // normalized -> { original, source }
  
  for (const file of files) {
    const filePath = path.join(palavrasDir, file.name);
    if (!fs.existsSync(filePath)) {
      console.log(`File not found: ${filePath}`);
      continue;
    }
    
    console.log(`- Reading ${file.name}...`);
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split(/\r?\n/);
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      const normalized = normalizeWord(trimmed);
      if (normalized.length >= 4 && normalized.length <= 10) {
        if (!uniqueWordsMap.has(normalized)) {
          uniqueWordsMap.set(normalized, {
            original: trimmed.toUpperCase(),
            source: file.source
          });
        }
      }
    }
  }
  console.log(`Total unique words parsed from files: ${uniqueWordsMap.size}`);

  console.log("2. Fetching existing words from Supabase...");
  let existingWords = [];
  let fetchError = null;
  
  // We may have more than 1000 words (we have ~3800), so we need to fetch in pages
  let page = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('palavras')
      .select('Word')
      .range(page * pageSize, (page + 1) * pageSize - 1);
      
    if (error) {
      fetchError = error;
      break;
    }
    if (!data || data.length === 0) {
      break;
    }
    existingWords = existingWords.concat(data);
    page++;
  }
  
  if (fetchError) {
    console.error("Error fetching existing words:", fetchError);
    return;
  }
  
  console.log(`Fetched ${existingWords.length} existing words from database.`);
  
  const existingSet = new Set(
    existingWords.map(w => normalizeWord(w.Word)).filter(Boolean)
  );

  console.log("3. Filtering out words already in database...");
  const wordsToInsert = [];
  for (const [normalized, details] of uniqueWordsMap) {
    if (!existingSet.has(normalized)) {
      wordsToInsert.push({
        Word: details.original,
        Length: normalized.length,
        Source: details.source
      });
    }
  }
  
  console.log(`Words to insert: ${wordsToInsert.length}`);
  if (wordsToInsert.length === 0) {
    console.log("No new words to upload. Everything is already in the database.");
    return;
  }

  console.log("4. Fetching max Id from database to compute start ID...");
  const { data: maxIdData, error: maxIdError } = await supabase
    .from('palavras')
    .select('Id')
    .order('Id', { ascending: false })
    .limit(1);
    
  if (maxIdError) {
    console.error("Error fetching max Id:", maxIdError);
    return;
  }
  
  let startId = 1;
  if (maxIdData && maxIdData[0]) {
    startId = Number(maxIdData[0].Id) + 1;
  }
  console.log(`Starting Id for new words: ${startId}`);

  console.log("5. Uploading in batches...");
  const batchSize = 1000;
  const total = wordsToInsert.length;
  
  for (let i = 0; i < total; i += batchSize) {
    const chunk = wordsToInsert.slice(i, i + batchSize);
    const rows = chunk.map((wordObj, idx) => ({
      Id: startId + i + idx,
      Word: wordObj.Word,
      Length: wordObj.Length,
      UsedCount: 0,
      LastUsedAt: null,
      CreatedAt: new Date().toISOString(),
      Source: wordObj.Source,
      Icf: 0,
      Enabled: false // Disabled/Deactivated as requested
    }));
    
    let success = false;
    let attempts = 0;
    while (!success && attempts < 3) {
      attempts++;
      const { error } = await supabase.from('palavras').insert(rows);
      if (error) {
        console.error(`Attempt ${attempts} failed for batch ${i / batchSize + 1}. Error:`, error.message);
        // Wait 2 seconds before retry
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        success = true;
      }
    }
    
    if (!success) {
      console.error(`FATAL: Failed to insert batch starting at index ${i}`);
      break;
    }
    
    console.log(`Uploaded batch ${i / batchSize + 1}/${Math.ceil(total / batchSize)}: ${i + chunk.length}/${total} words`);
    // Wait 200ms between batches to avoid spamming the API
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  console.log("Upload completed successfully!");
}

upload();
