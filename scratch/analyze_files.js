import fs from 'fs';
import path from 'path';

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

async function analyze() {
  const allWords = new Map(); // normalized -> { original, source }
  
  for (const file of files) {
    const filePath = path.join(palavrasDir, file.name);
    if (!fs.existsSync(filePath)) {
      console.log(`File not found: ${filePath}`);
      continue;
    }
    
    console.log(`Reading ${file.name}...`);
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split(/\r?\n/);
    
    let count = 0;
    let added = 0;
    
    for (const line of lines) {
      count++;
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      const normalized = normalizeWord(trimmed);
      if (normalized.length >= 4 && normalized.length <= 10) {
        if (!allWords.has(normalized)) {
          allWords.set(normalized, {
            original: trimmed.toUpperCase(),
            source: file.source
          });
          added++;
        }
      }
    }
    console.log(`Finished ${file.name}. Total lines: ${count}, valid unique added: ${added}`);
  }
  
  console.log(`Total unique words of length 4-10: ${allWords.size}`);
  
  const lengthCounts = {};
  for (const [norm] of allWords) {
    const len = norm.length;
    lengthCounts[len] = (lengthCounts[len] || 0) + 1;
  }
  console.log("Counts by length:", lengthCounts);
}

analyze();
