import { type DailyWords, FALLBACK_WORDS_BY_LENGTH, generateWordsBatch, normalizeWord } from './grokService';
import { supabase } from './supabaseClient';

export interface ModeResult {
  score: number;
  time: number; // in seconds
  attempts: number;
  success: boolean;
  wordsSolved: number; // how many words they got right
}

export interface DailyResult {
  playerName: 'Gabriel' | 'Alessandra' | 'Ambos';
  date: string; // YYYY-MM-DD
  mode1: ModeResult | null;
  mode2: ModeResult | null;
  mode4: ModeResult | null;
  totalScore: number; // average of the three modes
  completed: boolean;
}

export interface Challenge {
  date: string;
  words: DailyWords;
}

export interface SpecialModeResult {
  playerName: 'Gabriel' | 'Alessandra' | 'Ambos';
  date: string;
  mode: 'bomb' | 'crossword' | 'blitz' | 'afogado';
  success: boolean;
  score: number;
  time: number;
  attempts: number;
  wordsSolved: number;
  detail: string;
}

export type CrosswordClueType = 'direta' | 'contextual' | 'enigmatica';

export interface CrosswordEntry {
  id: string;
  answer: string;
  clue: string;
  clueType: CrosswordClueType;
  row: number;
  col: number;
  direction: 'across' | 'down';
}

export interface CrosswordChallenge {
  date: string;
  size: number;
  entries: CrosswordEntry[];
}


export interface PlayerStats {
  playerName: string;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  bestTime: number; // overall minimum time across any successful single mode
  avgTime: number; // average time in successful matches
  avgAttempts: number; // average attempts in completed matches
  bestScore: number; // best overall daily score
  currentStreak: number;
  maxStreak: number;
}



const WORD_TABLE_CANDIDATES = ['palavras'];

function mapDbWord(row: any) {
  const rawWord = row.palavra || row.Word || row.word || row.termo || row.texto || '';
  const word = normalizeWord(rawWord);
  return {
    id: row.Id || row.id || word,
    word,
    length: row.Length || row.tamanho || row.length || word.length,
    usedCount: row.UsedCount || row.used_count || row.usedCount || row.usos || 0,
    lastUsedAt: row.LastUsedAt || row.last_used_at || row.lastUsedAt || row.usada_em || null,
    createdAt: row.CreatedAt || row.created_at || row.createdAt || new Date().toISOString(),
    source: row.Source || row.source || row.fonte || 'Supabase',
    enabled: row.Enabled !== undefined ? row.Enabled : (row.enabled !== undefined ? row.enabled : true),
    icf: row.Icf !== undefined ? row.Icf : (row.icf !== undefined ? row.icf : 0)
  };
}

async function selectSupabaseWords(length?: number, count: number = 100, seed: number = 0): Promise<any[]> {
  for (const table of WORD_TABLE_CANDIDATES) {
    let query = supabase.from(table).select('*').eq('Enabled', true);
    if (length !== undefined) {
      query = query.eq('Length', length);
    }
    // Exclude raw dictionary sources (lexico and conjugações) from target word selection
    query = query.neq('Source', 'lexico').neq('Source', 'conjugações');

    // Prioritize least used words (UsedCount ASC)
    query = query.order('UsedCount', { ascending: true }).order('Id', { ascending: true });

    const { data, error } = await query.limit(1000);
    if (!error && data) {
      const mapped = data
        .map(mapDbWord)
        .filter((item) => item.word && (!length || item.length === length));
      if (mapped.length > 0) {
        // Ensure deterministic order by sorting alphabetically first if seed > 0
        // otherwise return the least-used ones
        if (seed > 0) {
          mapped.sort((a, b) => a.word.localeCompare(b.word));
          const selected: any[] = [];
          const tempMapped = [...mapped];
          let currentSeed = seed;
          for (let i = 0; i < count && tempMapped.length > 0; i++) {
            const index = currentSeed % tempMapped.length;
            selected.push(tempMapped[index]);
            tempMapped.splice(index, 1); // remove to avoid duplicates
            currentSeed = Math.floor((currentSeed * 1103515245 + 12345) / 65536) % 32768;
          }
          return selected;
        }

        return mapped.slice(0, count);
      }
    }
  }

  // Fallback to local storage cache if database query fails (e.g. offline)
  const localWordsStr = localStorage.getItem('termo_db_words');
  if (localWordsStr) {
    try {
      const localWords = JSON.parse(localWordsStr);
      const filtered = localWords.filter((item: any) => 
        item.word && 
        (!length || item.length === length) &&
        item.source !== 'lexico' &&
        item.source !== 'conjugações'
      );
      if (filtered.length > 0) {
        filtered.sort((a: any, b: any) => a.word.localeCompare(b.word));

        if (seed > 0) {
          const selected: any[] = [];
          const tempMapped = [...filtered];
          let currentSeed = seed;
          for (let i = 0; i < count && tempMapped.length > 0; i++) {
            const index = currentSeed % tempMapped.length;
            selected.push(tempMapped[index]);
            tempMapped.splice(index, 1);
            currentSeed = Math.floor((currentSeed * 1103515245 + 12345) / 65536) % 32768;
          }
          return selected;
        }

        return filtered.slice(0, count);
      }
    } catch (e) {
      console.error('Error parsing local words cache:', e);
    }
  }
  return [];
}

async function selectVaryingWords(count: number, baseSeed: number, excludeList: string[] = []): Promise<string[]> {
  const selectedWords: string[] = [...excludeList];
  const results: string[] = [];
  for (let i = 0; i < count; i++) {
    const len = 4 + ((baseSeed + i) % 3); // 4, 5, or 6 letras
    const candidates = await selectSupabaseWords(len, 20, baseSeed + i * 10);
    const chosen = candidates.find(c => c.word && !selectedWords.includes(c.word))?.word;
    if (chosen) {
      selectedWords.push(chosen);
      results.push(chosen);
    } else {
      const fallback = candidates.find(c => c.word && !selectedWords.includes(c.word))?.word || candidates[0]?.word;
      if (fallback) {
        selectedWords.push(fallback);
        results.push(fallback);
      }
    }
  }
  return results;
}

async function syncSupabaseWordsCache() {
  const remoteWords = await selectSupabaseWords(undefined, 2000);
  const localWordsStr = localStorage.getItem('termo_db_words');
  let localWords: any[] = [];
  if (localWordsStr) {
    try {
      localWords = JSON.parse(localWordsStr);
    } catch (e) {
      console.error('Error parsing local words cache:', e);
    }
  }

  // If local words cache is empty, populate with initial fallback words
  if (localWords.length === 0) {
    let idCounter = 1;
    Object.entries(FALLBACK_WORDS_BY_LENGTH).forEach(([lenStr, list]) => {
      const len = parseInt(lenStr);
      list.forEach(word => {
        localWords.push({
          id: `w-${idCounter++}`,
          word: word.toUpperCase(),
          length: len,
          usedCount: 0,
          lastUsedAt: null,
          createdAt: new Date().toISOString(),
          source: 'importação'
        });
      });
    });
  }

  if (remoteWords.length > 0) {
    // Merge remote words into local cache
    const localWordTexts = new Set(localWords.map(w => w.word));
    remoteWords.forEach((rw: any) => {
      if (rw.word && !localWordTexts.has(rw.word)) {
        localWords.push(rw);
      }
    });
  }

  localStorage.setItem('termo_db_words', JSON.stringify(localWords));
}

export async function syncSupabaseData() {
  initLocalStorage();

  const lastSync = localStorage.getItem('termo_db_last_sync');
  const today = getTodayDateString();
  const hasLocalWords = !!localStorage.getItem('termo_db_words');

  if (lastSync !== today || !hasLocalWords) {
    await syncSupabaseWordsCache();
    localStorage.setItem('termo_db_last_sync', today);
  }

  const { data: challenges } = await supabase
    .from('challenges')
    .select('*')
    .order('date', { ascending: false })
    .limit(30);

  if (challenges) {
    const localChallenges: Challenge[] = JSON.parse(localStorage.getItem('termo_challenges') || '[]');
    const remoteChallenges = challenges.map((row: any) => ({
      date: String(row.date),
      words: {
        mode1: normalizeWord(row.word_1 || row.mode1 || row.palavra_1 || ''),
        mode2: (row.words_2 || row.mode2 || row.palavras_2 || []).map(normalizeWord),
        mode4: (row.words_4 || row.mode4 || row.palavras_4 || []).map(normalizeWord)
      }
    }));
    
    // Merge: prefer local challenge if it exists, otherwise add remote
    const merged = [...localChallenges];
    remoteChallenges.forEach(rc => {
      const idx = merged.findIndex(lc => lc.date === rc.date);
      if (idx === -1) {
        merged.push(rc);
      } else {
        if (!merged[idx].words || !merged[idx].words.mode1) {
          merged[idx] = rc;
        }
      }
    });
    localStorage.setItem('termo_challenges', JSON.stringify(merged));
  }

  const { data: results } = await supabase.from('results').select('*, profiles(name)').order('date', { ascending: false }).limit(100);
  if (results) {
    localStorage.setItem('termo_results', JSON.stringify(results.map((row: any) => {
      const playerName = row.profiles?.name || row.player_name || row.playerName || 'Gabriel';
      const mode1 = row.mode_1_attempts ? { score: row.mode_1_score, time: row.mode_1_time, attempts: row.mode_1_attempts, success: row.mode_1_score > 0, wordsSolved: row.mode_1_score > 0 ? 1 : 0 } : null;
      const mode2 = row.mode_2_attempts ? { score: row.mode_2_score, time: row.mode_2_time, attempts: row.mode_2_attempts, success: row.mode_2_score >= 80, wordsSolved: row.mode_2_score > 0 ? 2 : 0 } : null;
      const mode4 = row.mode_4_attempts ? { score: row.mode_4_score, time: row.mode_4_time, attempts: row.mode_4_attempts, success: row.mode_4_score >= 180, wordsSolved: row.mode_4_score > 0 ? 4 : 0 } : null;
      return {
        playerName,
        date: normalizeDateString(row.date),
        mode1,
        mode2,
        mode4,
        totalScore: Number(row.total_score || 0),
        completed: !!(mode1 && mode2 && mode4)
      };
    })));
  }

  const { data: versus, error: versusError } = await supabase.from('versus_results').select('*').order('date', { ascending: false }).limit(50);
  if (versusError) {
    console.error("Erro ao carregar versus_results do Supabase:", versusError);
  } else if (versus) {
    localStorage.setItem('termo_versus_results', JSON.stringify(versus.map((row: any) => ({
      date: normalizeDateString(row.date),
      gabrielTermo: row.gabriel_termo_score || 0,
      gabrielDueto: row.gabriel_dueto_score || 0,
      gabrielQuarteto: row.gabriel_quarteto_score || 0,
      gabrielBomb: row.gabriel_bomb_score || 0,
      gabrielCrossword: row.gabriel_crossword_score || 0,
      gabrielBlitz: row.gabriel_blitz_score || 0,
      gabrielAfogado: row.gabriel_afogado_score || 0,
      gabrielTotal: row.gabriel_total_score || 0,
      alessandraTermo: row.alessandra_termo_score || 0,
      alessandraDueto: row.alessandra_dueto_score || 0,
      alessandraQuarteto: row.alessandra_quarteto_score || 0,
      alessandraBomb: row.alessandra_bomb_score || 0,
      alessandraCrossword: row.alessandra_crossword_score || 0,
      alessandraBlitz: row.alessandra_blitz_score || 0,
      alessandraAfogado: row.alessandra_afogado_score || 0,
      alessandraTotal: row.alessandra_total_score || 0,
      winner: row.winner || 'Empate'
    }))));
  }
}

// Initialize LocalStorage if not set
export function initLocalStorage() {
  if (!localStorage.getItem('termo_challenges')) {
    localStorage.setItem('termo_challenges', JSON.stringify([]));
  }
  if (!localStorage.getItem('termo_results')) {
    localStorage.setItem('termo_results', JSON.stringify([]));
  }
  if (!localStorage.getItem('termo_versus_results')) {
    localStorage.setItem('termo_versus_results', JSON.stringify([]));
  }
  if (!localStorage.getItem('termo_blitz_records')) {
    localStorage.setItem('termo_blitz_records', JSON.stringify([]));
  }
  if (!localStorage.getItem('termo_blitz_matches')) {
    localStorage.setItem('termo_blitz_matches', JSON.stringify([]));
  }
  if (!localStorage.getItem('termo_afogado_records')) {
    localStorage.setItem('termo_afogado_records', JSON.stringify([]));
  }
  if (!localStorage.getItem('termo_afogado_matches')) {
    localStorage.setItem('termo_afogado_matches', JSON.stringify([]));
  }
  if (!localStorage.getItem('termo_special_results')) {
    localStorage.setItem('termo_special_results', JSON.stringify([]));
  }
  if (!localStorage.getItem('termo_crossword_challenges')) {
    localStorage.setItem('termo_crossword_challenges', JSON.stringify({}));
  }
  if (!localStorage.getItem('termo_active_player')) {
    localStorage.setItem('termo_active_player', 'Gabriel');
  }
  if (!localStorage.getItem('termo_db_words')) {
    const initialWords: any[] = [];
    let idCounter = 1;
    Object.entries(FALLBACK_WORDS_BY_LENGTH).forEach(([lenStr, list]) => {
      const len = parseInt(lenStr);
      list.forEach(word => {
        initialWords.push({
          id: `w-${idCounter++}`,
          word: word.toUpperCase(),
          length: len,
          usedCount: 0,
          lastUsedAt: null,
          createdAt: new Date().toISOString(),
          source: 'importação'
        });
      });
    });
    localStorage.setItem('termo_db_words', JSON.stringify(initialWords));
  }
  if (!localStorage.getItem('termo_db_jobs')) {
    localStorage.setItem('termo_db_jobs', JSON.stringify([]));
  }
  if (!localStorage.getItem('termo_db_config')) {
    localStorage.setItem('termo_db_config', JSON.stringify({
      minLimitPercent: 20,
      autoGenBatchSize: 250
    }));
  }
}

// Get Active Player
export function getActivePlayer(): 'Gabriel' | 'Alessandra' | 'Ambos' {
  initLocalStorage();
  return (localStorage.getItem('termo_active_player') as 'Gabriel' | 'Alessandra' | 'Ambos') || 'Gabriel';
}

// Set Active Player
export function setActivePlayer(name: 'Gabriel' | 'Alessandra' | 'Ambos') {
  localStorage.setItem('termo_active_player', name);
}

// Format date to YYYY-MM-DD
export function getTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function normalizeDateString(value: string | Date | null | undefined): string {
  if (!value) return '';
  if (value instanceof Date) {
    const year = value.getUTCFullYear();
    const month = String(value.getUTCMonth() + 1).padStart(2, '0');
    const day = String(value.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  const trimmed = String(value).trim();
  const isoDateOnlyMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoDateOnlyMatch) {
    return isoDateOnlyMatch[1];
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    const year = parsed.getUTCFullYear();
    const month = String(parsed.getUTCMonth() + 1).padStart(2, '0');
    const day = String(parsed.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return trimmed;
}

// Get challenge for date
export async function getChallengeForDate(dateStr: string): Promise<Challenge> {
  initLocalStorage();
  const challenges: Challenge[] = JSON.parse(localStorage.getItem('termo_challenges') || '[]');
  const existing = challenges.find(c => c.date === dateStr);
  if (existing) {
    return existing;
  }

  const remoteExisting = await supabase.from('challenges').select('*').eq('date', dateStr).maybeSingle();
  if (remoteExisting.data) {
    const challenge: Challenge = {
      date: String(remoteExisting.data.date),
      words: {
        mode1: normalizeWord(remoteExisting.data.word_1 || remoteExisting.data.mode1 || remoteExisting.data.palavra_1 || ''),
        mode2: (remoteExisting.data.words_2 || remoteExisting.data.mode2 || remoteExisting.data.palavras_2 || []).map(normalizeWord),
        mode4: (remoteExisting.data.words_4 || remoteExisting.data.mode4 || remoteExisting.data.palavras_4 || []).map(normalizeWord)
      }
    };
    challenges.push(challenge);
    localStorage.setItem('termo_challenges', JSON.stringify(challenges));
    return challenge;
  }

  // Select from Supabase table `palavras`.
  const seed = getSeedForDate(dateStr);
  const len1 = 4 + (seed % 3); // 4, 5, 6 letras

  const mode1 = (await selectSupabaseWords(len1, 1, seed))[0]?.word;
  const mode2 = await selectVaryingWords(2, seed + 1, [mode1]);
  const mode4 = await selectVaryingWords(4, seed + 2, [mode1, ...mode2]);

  if (!mode1 || mode2.length < 2 || mode4.length < 4) {
    throw new Error('A tabela palavras no Supabase não tem palavras suficientes para montar o desafio de hoje.');
  }

  const words = { mode1, mode2, mode4 };
  const newChallenge: Challenge = { date: dateStr, words };
  challenges.push(newChallenge);
  localStorage.setItem('termo_challenges', JSON.stringify(challenges));

  // Increment usage for newly drawn daily words
  incrementWordsUsage([mode1, ...mode2, ...mode4]).catch(err =>
    console.error('Failed to increment daily challenge words usage:', err)
  );

  await supabase.from('challenges').insert({
    date: dateStr,
    word_1: mode1,
    words_2: mode2,
    words_4: mode4
  });

  return newChallenge;
}

// Get Player result for date
export function getPlayerResultForDate(playerName: 'Gabriel' | 'Alessandra' | 'Ambos', dateStr: string): DailyResult {
  initLocalStorage();
  const results: DailyResult[] = JSON.parse(localStorage.getItem('termo_results') || '[]');
  const existing = results.find(r => r.playerName === playerName && r.date === dateStr);
  if (existing) {
    return existing;
  }

  // Create new blank result
  const newResult: DailyResult = {
    playerName,
    date: dateStr,
    mode1: null,
    mode2: null,
    mode4: null,
    totalScore: 0,
    completed: false
  };
  return newResult;
}

// Calculate score for a game mode
export function calculateModeScore(
  mode: 1 | 2 | 4,
  attempts: number,
  timeInSeconds: number,
  success: boolean,
  wordsSolved: number
): number {
  if (!success) {
    if (mode === 2) {
      return wordsSolved * 40; // 40 points per word solved (max 80)
    }
    if (mode === 4) {
      return wordsSolved * 45; // 45 points per word solved (max 180)
    }
    return 0;
  }

  if (mode === 1) {
    // Termo (max 100 points)
    return Math.max(10, Math.round(100 - (attempts - 1) * 8 - Math.min(10, timeInSeconds / 15)));
  }

  if (mode === 2) {
    // Dueto (max 200 points)
    return Math.max(20, Math.round(200 - (attempts - 1) * 12 - Math.min(20, timeInSeconds / 15)));
  }

  // Quarteto (mode === 4, max 400 points)
  return Math.max(40, Math.round(400 - (attempts - 1) * 20 - Math.min(40, timeInSeconds / 15)));
}

async function getProfileId(playerName: 'Gabriel' | 'Alessandra' | 'Ambos'): Promise<string | null> {
  const existing = await supabase.from('profiles').select('id').eq('name', playerName).maybeSingle();
  if (existing.data?.id) return existing.data.id;

  const created = await supabase.from('profiles').insert({ name: playerName }).select('id').single();
  return created.data?.id || null;
}

async function getChallengeId(dateStr: string): Promise<string | null> {
  const existing = await supabase.from('challenges').select('id').eq('date', dateStr).maybeSingle();
  return existing.data?.id || null;
}

async function persistModeResult(
  playerName: 'Gabriel' | 'Alessandra' | 'Ambos',
  dateStr: string,
  playerResult: DailyResult
) {
  const profileId = await getProfileId(playerName);
  if (!profileId) return;

  const challengeId = await getChallengeId(dateStr);
  await supabase.from('results').upsert({
    profile_id: profileId,
    challenge_id: challengeId,
    date: dateStr,
    mode_1_score: playerResult.mode1?.score || 0,
    mode_1_time: playerResult.mode1?.time || 0,
    mode_1_attempts: playerResult.mode1?.attempts || 0,
    mode_2_score: playerResult.mode2?.score || 0,
    mode_2_time: playerResult.mode2?.time || 0,
    mode_2_attempts: playerResult.mode2?.attempts || 0,
    mode_4_score: playerResult.mode4?.score || 0,
    mode_4_time: playerResult.mode4?.time || 0,
    mode_4_attempts: playerResult.mode4?.attempts || 0,
    total_score: playerResult.totalScore
  }, { onConflict: 'profile_id,date' });
}

// Save result for a specific mode
export function saveModeResult(
  playerName: 'Gabriel' | 'Alessandra' | 'Ambos',
  dateStr: string,
  mode: 1 | 2 | 4,
  attempts: number,
  timeInSeconds: number,
  success: boolean,
  wordsSolved: number
): DailyResult {
  initLocalStorage();
  const results: DailyResult[] = JSON.parse(localStorage.getItem('termo_results') || '[]');
  let playerResult = results.find(r => r.playerName === playerName && r.date === dateStr);

  if (!playerResult) {
    playerResult = {
      playerName,
      date: dateStr,
      mode1: null,
      mode2: null,
      mode4: null,
      totalScore: 0,
      completed: false
    };
    results.push(playerResult);
  }

  const score = calculateModeScore(mode, attempts, timeInSeconds, success, wordsSolved);
  const modeResult: ModeResult = {
    score,
    time: timeInSeconds,
    attempts,
    success,
    wordsSolved
  };

  if (mode === 1) playerResult.mode1 = modeResult;
  if (mode === 2) playerResult.mode2 = modeResult;
  if (mode === 4) playerResult.mode4 = modeResult;

  // Check if all modes are complete (either played and succeeded, or played and failed)
  if (playerResult.mode1 && playerResult.mode2 && playerResult.mode4) {
    playerResult.completed = true;
    playerResult.totalScore = playerResult.mode1.score + playerResult.mode2.score + playerResult.mode4.score;
  }

  // Update in array
  const index = results.findIndex(r => r.playerName === playerName && r.date === dateStr);
  if (index !== -1) {
    results[index] = playerResult;
  }

  localStorage.setItem('termo_results', JSON.stringify(results));
  void persistModeResult(playerName, dateStr, playerResult);
  return playerResult;
}

// Get Head-to-Head record & history summary
export interface DailyWinner {
  date: string;
  gabrielScore: number;
  alessandraScore: number;
  winner: 'Gabriel' | 'Alessandra' | 'Empate' | 'Aguardando';
  gabrielDone: boolean;
  alessandraDone: boolean;
  words: DailyWords | null;
}

export function getDailyHistoryList(): DailyWinner[] {
  initLocalStorage();
  const results: DailyResult[] = JSON.parse(localStorage.getItem('termo_results') || '[]');
  const challenges: Challenge[] = JSON.parse(localStorage.getItem('termo_challenges') || '[]');

  // Group by date
  const dates = Array.from(new Set([...results.map(r => r.date), ...challenges.map(c => c.date)]));
  // Sort dates descending
  dates.sort((a, b) => b.localeCompare(a));

  return dates.map(date => {
    const gabResult = results.find(r => r.playerName === 'Gabriel' && r.date === date);
    const aleResult = results.find(r => r.playerName === 'Alessandra' && r.date === date);
    const challenge = challenges.find(c => c.date === date);

    const gabrielDone = !!(gabResult && gabResult.completed);
    const alessandraDone = !!(aleResult && aleResult.completed);

    let winner: 'Gabriel' | 'Alessandra' | 'Empate' | 'Aguardando' = 'Aguardando';
    if (gabrielDone && alessandraDone) {
      const gScore = gabResult!.totalScore;
      const aScore = aleResult!.totalScore;
      if (gScore > aScore) {
        winner = 'Gabriel';
      } else if (aScore > gScore) {
        winner = 'Alessandra';
      } else {
        winner = 'Empate';
      }
    }

    return {
      date,
      gabrielScore: gabResult?.totalScore || 0,
      alessandraScore: aleResult?.totalScore || 0,
      winner,
      gabrielDone,
      alessandraDone,
      words: challenge?.words || null
    };
  });
}

export function getAmbosDailyHistory(): DailyResult[] {
  initLocalStorage();
  const results: DailyResult[] = JSON.parse(localStorage.getItem('termo_results') || '[]');
  return results
    .filter(r => r.playerName === 'Ambos' && r.completed)
    .sort((a, b) => b.date.localeCompare(a.date));
}

// Get Head-to-head score
export function getHeadToHeadScore() {
  const versusHistory = getVersusHistory();
  let gabrielWins = 0;
  let alessandraWins = 0;
  let draws = 0;

  versusHistory.forEach(match => {
    if (match.winner === 'Gabriel') gabrielWins++;
    else if (match.winner === 'Alessandra') alessandraWins++;
    else if (match.winner === 'Empate') draws++;
  });

  return {
    gabrielWins,
    alessandraWins,
    draws,
    totalMatchdays: gabrielWins + alessandraWins + draws
  };
}

// Get statistics for a player
export function getPlayerStats(playerName: 'Gabriel' | 'Alessandra' | 'Ambos'): PlayerStats {
  initLocalStorage();
  const results: DailyResult[] = JSON.parse(localStorage.getItem('termo_results') || '[]');
  const playerCompletedResults = results.filter(r => r.playerName === playerName && r.completed);

  // Performance calculations
  let bestTime = Infinity;
  let totalTime = 0;
  let successfulModesCount = 0;
  
  let totalAttempts = 0;
  let completedModesCount = 0;

  let bestScore = 0;

  playerCompletedResults.forEach(r => {
    if (r.totalScore > bestScore) {
      bestScore = r.totalScore;
    }

    const modes = [r.mode1, r.mode2, r.mode4];
    modes.forEach(m => {
      if (m) {
        totalAttempts += m.attempts;
        completedModesCount++;

        if (m.success) {
          totalTime += m.time;
          successfulModesCount++;
          if (m.time < bestTime) {
            bestTime = m.time;
          }
        }
      }
    });
  });

  const avgTime = successfulModesCount > 0 ? Math.round(totalTime / successfulModesCount) : 0;
  const avgAttempts = completedModesCount > 0 ? parseFloat((totalAttempts / completedModesCount).toFixed(1)) : 0;

  // Streak & H2H calculations
  let wins = 0;
  let losses = 0;
  let draws = 0;
  let winRate = 0;
  let currentStreak = 0;
  let maxStreak = 0;
  if (playerName === 'Ambos') {
    // Cooperative stats: sort results chronologically
    const cronResults = results
      .filter(r => r.playerName === 'Ambos' && r.completed)
      .sort((a, b) => a.date.localeCompare(b.date));

    let lastDate: Date | null = null;
    cronResults.forEach(r => {
      const currentDate = new Date(r.date);
      if (lastDate === null) {
        currentStreak = 1;
      } else {
        const diffTime = Math.abs(currentDate.getTime() - lastDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          currentStreak++;
        } else if (diffDays > 1) {
          currentStreak = 1;
        }
      }
      if (currentStreak > maxStreak) {
        maxStreak = currentStreak;
      }
      lastDate = currentDate;
    });
  } else {
    // Individual players: base on completed Versus matches (since individual daily challenges do not exist)
    const versusHistory = getVersusHistory();
    
    versusHistory.forEach(h => {
      if (h.winner === playerName) {
        wins++;
      } else if (h.winner === 'Empate') {
        draws++;
      } else {
        losses++;
      }
    });

    const totalFinalized = wins + losses + draws;
    winRate = totalFinalized > 0 ? Math.round((wins / totalFinalized) * 100) : 0;

    // Streak calculations based on chronological Versus matches
    const cronVersus = [...versusHistory].sort((a, b) => a.date.localeCompare(b.date));

    cronVersus.forEach(h => {
      if (h.winner === playerName) {
        currentStreak++;
        if (currentStreak > maxStreak) {
          maxStreak = currentStreak;
        }
      } else if (h.winner === 'Empate') {
        // Tie preserves the streak
      } else {
        currentStreak = 0; // Reset on loss
      }
    });

    // Best score is the highest score this player got in any Versus match
    bestScore = versusHistory.reduce((max, h) => {
      const score = playerName === 'Gabriel' ? h.gabrielTotal : h.alessandraTotal;
      return score > max ? score : max;
    }, 0);
  }

  return {
    playerName,
    wins,
    losses,
    draws,
    winRate,
    bestTime: bestTime === Infinity ? 0 : bestTime,
    avgTime,
    avgAttempts,
    bestScore,
    currentStreak,
    maxStreak
  };
}

export interface VersusResult {
  date: string; // YYYY-MM-DD
  gabrielTermo: number;
  gabrielDueto: number;
  gabrielQuarteto: number;
  gabrielBomb?: number;
  gabrielCrossword?: number;
  gabrielBlitz?: number;
  gabrielAfogado?: number;
  gabrielTotal: number;
  alessandraTermo: number;
  alessandraDueto: number;
  alessandraQuarteto: number;
  alessandraBomb?: number;
  alessandraCrossword?: number;
  alessandraBlitz?: number;
  alessandraAfogado?: number;
  alessandraTotal: number;
  winner: 'Gabriel' | 'Alessandra' | 'Empate';
}



export function getVersusMatchForDate(dateStr: string): VersusResult | null {
  initLocalStorage();
  const normalizedDate = normalizeDateString(dateStr);
  const list: VersusResult[] = JSON.parse(localStorage.getItem('termo_versus_results') || '[]');
  return list.find(v => normalizeDateString(v.date) === normalizedDate) || null;
}

export function saveVersusMatch(match: VersusResult) {
  initLocalStorage();
  const normalizedMatch: VersusResult = {
    ...match,
    date: normalizeDateString(match.date)
  };
  const list: VersusResult[] = JSON.parse(localStorage.getItem('termo_versus_results') || '[]');
  const existingIndex = list.findIndex(v => normalizeDateString(v.date) === normalizedMatch.date);
  if (existingIndex !== -1) {
    list[existingIndex] = normalizedMatch;
  } else {
    list.push(normalizedMatch);
  }
  localStorage.setItem('termo_versus_results', JSON.stringify(list));

  // Persist to Supabase
  supabase.from('versus_results').upsert({
    date: match.date,
    gabriel_termo_score: match.gabrielTermo,
    gabriel_dueto_score: match.gabrielDueto,
    gabriel_quarteto_score: match.gabrielQuarteto,
    gabriel_bomb_score: match.gabrielBomb || 0,
    gabriel_crossword_score: match.gabrielCrossword || 0,
    gabriel_blitz_score: match.gabrielBlitz || 0,
    gabriel_afogado_score: match.gabrielAfogado || 0,
    gabriel_total_score: match.gabrielTotal,
    alessandra_termo_score: match.alessandraTermo,
    alessandra_dueto_score: match.alessandraDueto,
    alessandra_quarteto_score: match.alessandraQuarteto,
    alessandra_bomb_score: match.alessandraBomb || 0,
    alessandra_crossword_score: match.alessandraCrossword || 0,
    alessandra_blitz_score: match.alessandraBlitz || 0,
    alessandra_afogado_score: match.alessandraAfogado || 0,
    alessandra_total_score: match.alessandraTotal,
    winner: match.winner
  }, { onConflict: 'date' }).then(({ error }) => {
    if (error) {
      console.error("Erro ao salvar Duelo Versus no Supabase:", error);
    } else {
      console.log("Duelo Versus salvo com sucesso no Supabase.");
    }
  });
}

export function getVersusHistory(): VersusResult[] {
  initLocalStorage();
  const list: VersusResult[] = JSON.parse(localStorage.getItem('termo_versus_results') || '[]');
  return list
    .map(v => ({ ...v, date: normalizeDateString(v.date) }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export interface BlitzMatch {
  id: string;
  date: string;
  duration: number; // in minutes (1, 3, 5, 10)
  wordsSolved: number;
  attemptsUsed: number;
  maxStreak: number;
  avgTimePerWord: number;
}

export interface BlitzRecord {
  duration: number; // 1, 3, 5, 10
  wordsSolved: number;
  date: string;
}

export function getBlitzRecords(): BlitzRecord[] {
  initLocalStorage();
  return JSON.parse(localStorage.getItem('termo_blitz_records') || '[]');
}

export function saveBlitzMatch(match: BlitzMatch) {
  initLocalStorage();
  const matches: BlitzMatch[] = JSON.parse(localStorage.getItem('termo_blitz_matches') || '[]');
  matches.push(match);
  localStorage.setItem('termo_blitz_matches', JSON.stringify(matches));

  // Check if it's a new record for this duration
  const records: BlitzRecord[] = JSON.parse(localStorage.getItem('termo_blitz_records') || '[]');
  const existingRecordIndex = records.findIndex(r => r.duration === match.duration);
  if (existingRecordIndex !== -1) {
    if (match.wordsSolved > records[existingRecordIndex].wordsSolved) {
      records[existingRecordIndex] = {
        duration: match.duration,
        wordsSolved: match.wordsSolved,
        date: match.date
      };
    }
  } else {
    records.push({
      duration: match.duration,
      wordsSolved: match.wordsSolved,
      date: match.date
    });
  }
  localStorage.setItem('termo_blitz_records', JSON.stringify(records));
}

export function getBlitzHistory(): BlitzMatch[] {
  initLocalStorage();
  const matches: BlitzMatch[] = JSON.parse(localStorage.getItem('termo_blitz_matches') || '[]');
  return matches.sort((a, b) => b.date.localeCompare(a.date));
}

export async function getBlitzWordPool(count: number = 100): Promise<string[]> {
  initLocalStorage();
  const remoteWords = await selectSupabaseWords(undefined, count);
  if (remoteWords.length > 0) {
    localStorage.setItem('termo_db_words', JSON.stringify(remoteWords));
    const pool = remoteWords.map(item => item.word);
    incrementWordsUsage(pool).catch(err =>
      console.error('Failed to increment blitz words usage:', err)
    );
    return pool.sort(() => Math.random() - 0.5);
  }

  const words = JSON.parse(localStorage.getItem('termo_db_words') || '[]');
  
  // Sort candidates by UsedCount (ascending), then LastUsedAt (ascending)
  const sorted = [...words].sort((a: any, b: any) => {
    if (a.usedCount !== b.usedCount) {
      return a.usedCount - b.usedCount;
    }
    const timeA = a.lastUsedAt ? new Date(a.lastUsedAt).getTime() : 0;
    const timeB = b.lastUsedAt ? new Date(b.lastUsedAt).getTime() : 0;
    if (timeA !== timeB) {
      return timeA - timeB;
    }
    return Math.random() - 0.5;
  });

  const selected = sorted.slice(0, count).map((w: any) => w.word);
  
  // Update usage count locally
  const now = new Date().toISOString();
  selected.forEach(wordStr => {
    const idx = words.findIndex((w: any) => w.word === wordStr);
    if (idx !== -1) {
      words[idx].usedCount += 1;
      words[idx].lastUsedAt = now;
    }
  });
  
  localStorage.setItem('termo_db_words', JSON.stringify(words));
  checkAndTriggerAutoReplenish();

  // Increment usage in database as well (best-effort)
  incrementWordsUsage(selected).catch(err =>
    console.error('Failed to increment blitz words usage in DB:', err)
  );
  
  return selected.sort(() => Math.random() - 0.5);
}

// Deterministic seed helper based on string
export function getSeedForDate(dateStr: string): number {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = dateStr.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

// Select count words from DB favoring low used counts and oldest last used dates
export function getWordsFromDb(length: number, count: number): string[] {
  initLocalStorage();
  const words = JSON.parse(localStorage.getItem('termo_db_words') || '[]');
  const candidates = words.filter((w: any) => w.length === length);
  
  if (candidates.length < count) {
    console.warn(`Not enough words of length ${length} in DB. Needed ${count}, found ${candidates.length}. Seeding fallbacks.`);
    const list = FALLBACK_WORDS_BY_LENGTH[length] || FALLBACK_WORDS_BY_LENGTH[5];
    let addedCount = 0;
    list.forEach(word => {
      const normalized = word.toUpperCase();
      if (!words.some((w: any) => w.word === normalized)) {
        words.push({
          id: `w-fallback-${Date.now()}-${addedCount++}`,
          word: normalized,
          length: length,
          usedCount: 0,
          lastUsedAt: null,
          createdAt: new Date().toISOString(),
          source: 'importação'
        });
      }
    });
    localStorage.setItem('termo_db_words', JSON.stringify(words));
    // Try selection again recursively
    return getWordsFromDb(length, count);
  }

  const sorted = [...candidates].sort((a: any, b: any) => {
    if (a.usedCount !== b.usedCount) {
      return a.usedCount - b.usedCount;
    }
    const timeA = a.lastUsedAt ? new Date(a.lastUsedAt).getTime() : 0;
    const timeB = b.lastUsedAt ? new Date(b.lastUsedAt).getTime() : 0;
    if (timeA !== timeB) {
      return timeA - timeB;
    }
    return Math.random() - 0.5;
  });

  const selected = sorted.slice(0, count).map((w: any) => w.word);
  
  const now = new Date().toISOString();
  selected.forEach(wordStr => {
    const idx = words.findIndex((w: any) => w.word === wordStr);
    if (idx !== -1) {
      words[idx].usedCount += 1;
      words[idx].lastUsedAt = now;
    }
  });
  
  localStorage.setItem('termo_db_words', JSON.stringify(words));
  checkAndTriggerAutoReplenish();
  return selected;
}

export async function getBombWordForDate(dateStr: string): Promise<string> {
  initLocalStorage();
  const key = 'termo_bomb_challenges';
  const challenges = JSON.parse(localStorage.getItem(key) || '{}');
  if (challenges[dateStr]) {
    return challenges[dateStr];
  }

  const seed = getSeedForDate(dateStr + '_bomb');
  const length = 5 + (seed % 3);
  const word = (await selectSupabaseWords(length, 1, seed))[0]?.word;
  if (!word) {
    throw new Error('A tabela palavras no Supabase não tem palavra suficiente para o Modo Bomba.');
  }

  // Increment usage for newly drawn bomb target word
  incrementWordUsage(word).catch(err =>
    console.error('Failed to increment bomb word usage:', err)
  );

  challenges[dateStr] = word;
  localStorage.setItem(key, JSON.stringify(challenges));
  return word;
}

const CROSSWORD_TEMPLATES: Record<string, CrosswordChallenge> = {
  facil_2: {
    date: '',
    size: 6,
    entries: [
      { id: '1A', answer: 'CASA', row: 1, col: 1, direction: 'across', clue: 'Local onde moramos e nos abrigamos.', clueType: 'direta' },
      { id: '2D', answer: 'AMOR', row: 1, col: 2, direction: 'down', clue: 'Sentimento profundo de afeto e carinho.', clueType: 'direta' },
      { id: '3A', answer: 'BOLA', row: 3, col: 1, direction: 'across', clue: 'Objeto esférico usado para praticar esportes.', clueType: 'direta' },
      { id: '4A', answer: 'REI', row: 4, col: 2, direction: 'across', clue: 'Monarca que lidera um reino.', clueType: 'direta' }
    ]
  },
  facil_5: {
    date: '',
    size: 9,
    entries: [
      { id: '1A', answer: 'GATO', row: 1, col: 1, direction: 'across', clue: 'Pequeno felino doméstico que mia.', clueType: 'direta' },
      { id: '2D', answer: 'TERRA', row: 1, col: 3, direction: 'down', clue: 'O planeta habitado por seres humanos.', clueType: 'direta' },
      { id: '3A', answer: 'RATO', row: 3, col: 3, direction: 'across', clue: 'Pequeno roedor que costuma roer coisas.', clueType: 'direta' },
      { id: '4D', answer: 'AMIGO', row: 3, col: 6, direction: 'down', clue: 'Pessoa com quem se tem afeição companheira.', clueType: 'direta' },
      { id: '5A', answer: 'MAU', row: 4, col: 6, direction: 'across', clue: 'Aquele que pratica maldades.', clueType: 'direta' }
    ]
  },
  facil_10: {
    date: '',
    size: 11,
    entries: [
      { id: '1A', answer: 'PORTA', row: 1, col: 1, direction: 'across', clue: 'Abertura para entrar ou sair de recintos.', clueType: 'direta' },
      { id: '2D', answer: 'ROSA', row: 1, col: 3, direction: 'down', clue: 'Flor com perfume marcante e espinhos.', clueType: 'direta' },
      { id: '3A', answer: 'SOL', row: 3, col: 3, direction: 'across', clue: 'Estrela gigante central do sistema solar.', clueType: 'direta' },
      { id: '4D', answer: 'LIVRO', row: 3, col: 5, direction: 'down', clue: 'Objeto com páginas para leitura.', clueType: 'direta' },
      { id: '5A', answer: 'RUA', row: 6, col: 5, direction: 'across', clue: 'Via pavimentada pública na cidade.', clueType: 'direta' },
      { id: '6D', answer: 'AZUL', row: 6, col: 7, direction: 'down', clue: 'Cor do céu em dias ensolarados.', clueType: 'direta' },
      { id: '7A', answer: 'LUA', row: 9, col: 7, direction: 'across', clue: 'Satélite natural da Terra que brilha à noite.', clueType: 'direta' }
    ]
  },
  medio_2: {
    date: '',
    size: 6,
    entries: [
      { id: '1A', answer: 'CASA', row: 1, col: 1, direction: 'across', clue: 'Tem teto, paredes e abriga uma família.', clueType: 'contextual' },
      { id: '2D', answer: 'AMOR', row: 1, col: 2, direction: 'down', clue: 'O sentimento que uniu Romeu e Julieta.', clueType: 'contextual' },
      { id: '3A', answer: 'BOLA', row: 3, col: 1, direction: 'across', clue: 'Rola no gramado e faz a torcida vibrar.', clueType: 'contextual' },
      { id: '4A', answer: 'REI', row: 4, col: 2, direction: 'across', clue: 'Usa coroa, senta no trono e vive no castelo.', clueType: 'contextual' }
    ]
  },
  medio_5: {
    date: '',
    size: 9,
    entries: [
      { id: '1A', answer: 'GATO', row: 1, col: 1, direction: 'across', clue: 'Gosta de deitar no sol e persegue ratos.', clueType: 'contextual' },
      { id: '2D', answer: 'TERRA', row: 1, col: 3, direction: 'down', clue: 'O planeta azul onde nós todos moramos.', clueType: 'contextual' },
      { id: '3A', answer: 'RATO', row: 3, col: 3, direction: 'across', clue: 'Roedor cinzento que adora comer queijo.', clueType: 'contextual' },
      { id: '4D', answer: 'AMIGO', row: 3, col: 6, direction: 'down', clue: 'Aquele que é como um irmão de outra mãe.', clueType: 'contextual' },
      { id: '5A', answer: 'MAU', row: 4, col: 6, direction: 'across', clue: 'O antônimo de uma pessoa bondosa.', clueType: 'contextual' }
    ]
  },
  medio_10: {
    date: '',
    size: 11,
    entries: [
      { id: '1A', answer: 'PORTA', row: 1, col: 1, direction: 'across', clue: 'Fica na entrada esperando baterem nela.', clueType: 'contextual' },
      { id: '2D', answer: 'ROSA', row: 1, col: 3, direction: 'down', clue: 'Bela flor vermelha muito associada ao romance.', clueType: 'contextual' },
      { id: '3A', answer: 'SOL', row: 3, col: 3, direction: 'across', clue: 'Sua presença dita o ritmo dos dias de verão.', clueType: 'contextual' },
      { id: '4D', answer: 'LIVRO', row: 3, col: 5, direction: 'down', clue: 'Fica na cabeceira esperando sua leitura noturna.', clueType: 'contextual' },
      { id: '5A', answer: 'RUA', row: 6, col: 5, direction: 'across', clue: 'O endereço onde as crianças jogavam bola.', clueType: 'contextual' },
      { id: '6D', answer: 'AZUL', row: 6, col: 7, direction: 'down', clue: 'A cor da camisa da seleção e do oceano profundo.', clueType: 'contextual' },
      { id: '7A', answer: 'LUA', row: 9, col: 7, direction: 'across', clue: 'Muda de fase toda semana e guia os namorados.', clueType: 'contextual' }
    ]
  },
  dificil_2: {
    date: '',
    size: 6,
    entries: [
      { id: '1A', answer: 'CASA', row: 1, col: 1, direction: 'across', clue: 'Quatro paredes erguidas para conter as dores do mundo.', clueType: 'enigmatica' },
      { id: '2D', answer: 'AMOR', row: 1, col: 2, direction: 'down', clue: 'Fogo invisível que queima o peito sem deixar marcas.', clueType: 'enigmatica' },
      { id: '3A', answer: 'BOLA', row: 3, col: 1, direction: 'across', clue: 'Orbe que dita o choro e o riso coletivo aos domingos.', clueType: 'enigmatica' },
      { id: '4A', answer: 'REI', row: 4, col: 2, direction: 'across', clue: 'Tira a paz do próprio crânio em troca de uma coroa.', clueType: 'enigmatica' }
    ]
  },
  dificil_5: {
    date: '',
    size: 9,
    entries: [
      { id: '1A', answer: 'GATO', row: 1, col: 1, direction: 'across', clue: 'Pequena pantera silenciosa que governa os sofás.', clueType: 'enigmatica' },
      { id: '2D', answer: 'TERRA', row: 1, col: 3, direction: 'down', clue: 'Vastidão de argila e água girando no infinito escuro.', clueType: 'enigmatica' },
      { id: '3A', answer: 'RATO', row: 3, col: 3, direction: 'across', clue: 'O primeiro passageiro a desembarcar do barco trágico.', clueType: 'enigmatica' },
      { id: '4D', answer: 'AMIGO', row: 3, col: 6, direction: 'down', clue: 'Espelho da nossa alma que diz verdades cruas com afeto.', clueType: 'enigmatica' },
      { id: '5A', answer: 'MAU', row: 4, col: 6, direction: 'across', clue: 'A força da ausência de luz na conduta humana.', clueType: 'enigmatica' }
    ]
  },
  dificil_10: {
    date: '',
    size: 11,
    entries: [
      { id: '1A', answer: 'PORTA', row: 1, col: 1, direction: 'across', clue: 'Guardiã inerte que decide sobre as idas e vindas.', clueType: 'enigmatica' },
      { id: '2D', answer: 'ROSA', row: 1, col: 3, direction: 'down', clue: 'Frágil rainha coroada cercada de espinhos cruéis.', clueType: 'enigmatica' },
      { id: '3A', answer: 'SOL', row: 3, col: 3, direction: 'across', clue: 'Divindade dourada consumindo a si mesma no vácuo gelado.', clueType: 'enigmatica' },
      { id: '4D', answer: 'LIVRO', row: 3, col: 5, direction: 'down', clue: 'Portal de papel feito de árvores mortas que revive mentes.', clueType: 'enigmatica' },
      { id: '5A', answer: 'RUA', row: 6, col: 5, direction: 'across', clue: 'Linha de asfalto que corta o silêncio da noite.', clueType: 'enigmatica' },
      { id: '6D', answer: 'AZUL', row: 6, col: 7, direction: 'down', clue: 'A cor do manto celeste e da melancolia dos poetas.', clueType: 'enigmatica' },
      { id: '7A', answer: 'LUA', row: 9, col: 7, direction: 'across', clue: 'A lanterna dos loucos, poetas e lobos solitários.', clueType: 'enigmatica' }
    ]
  }
};

export function getCrosswordForDate(dateStr: string, difficulty: 'facil' | 'medio' | 'dificil' = 'medio', duration: number = 5): CrosswordChallenge {
  initLocalStorage();
  const templateKey = `${difficulty}_${duration}`;
  const template = CROSSWORD_TEMPLATES[templateKey] || CROSSWORD_TEMPLATES['medio_5'];
  
  return {
    date: dateStr,
    size: template.size,
    entries: template.entries.map(entry => ({
      ...entry,
      direction: entry.direction as 'across' | 'down'
    }))
  };
}

export function getSpecialResultForDate(
  playerName: 'Gabriel' | 'Alessandra' | 'Ambos',
  dateStr: string,
  mode: 'bomb' | 'crossword' | 'blitz' | 'afogado'
): SpecialModeResult | null {
  initLocalStorage();
  const results: SpecialModeResult[] = JSON.parse(localStorage.getItem('termo_special_results') || '[]');
  return results.find(r => r.playerName === playerName && r.date === dateStr && r.mode === mode) || null;
}

export function saveSpecialModeResult(result: SpecialModeResult) {
  initLocalStorage();
  const results: SpecialModeResult[] = JSON.parse(localStorage.getItem('termo_special_results') || '[]');
  const existingIndex = results.findIndex(r => r.playerName === result.playerName && r.date === result.date && r.mode === result.mode);
  if (existingIndex !== -1) {
    results[existingIndex] = result;
  } else {
    results.push(result);
  }
  localStorage.setItem('termo_special_results', JSON.stringify(results));
}

// Generate versus exclusive words from DB
export async function getVersusWordsForDate(dateStr: string): Promise<DailyWords> {
  initLocalStorage();
  const key = 'termo_versus_challenges';
  const challenges = JSON.parse(localStorage.getItem(key) || '{}');
  if (challenges[dateStr]) {
    return challenges[dateStr];
  }
  
  const seed = getSeedForDate(dateStr + "_versus");
  const len1 = 5 + (seed % 3); // 5, 6, 7
  const len2 = 4 + ((seed + 1) % 4); // 4, 5, 6, 7
  const len4 = 5 + ((seed + 2) % 3); // 5, 6, 7

  const usedWords = new Set<string>();

  const candidates1 = await selectSupabaseWords(len1, 10, seed);
  const mode1 = candidates1.find(c => !usedWords.has(c.word))?.word || candidates1[0]?.word;
  usedWords.add(mode1);

  const candidates2 = await selectSupabaseWords(len2, 10, seed + 1);
  const mode2: string[] = [];
  candidates2.forEach(c => {
    if (mode2.length < 2 && !usedWords.has(c.word)) {
      mode2.push(c.word);
      usedWords.add(c.word);
    }
  });
  while (mode2.length < 2) {
    const fallback = candidates2.find(c => !mode2.includes(c.word))?.word || candidates2[0]?.word;
    mode2.push(fallback);
  }

  const candidates4 = await selectSupabaseWords(len4, 10, seed + 2);
  const mode4: string[] = [];
  candidates4.forEach(c => {
    if (mode4.length < 4 && !usedWords.has(c.word)) {
      mode4.push(c.word);
      usedWords.add(c.word);
    }
  });
  while (mode4.length < 4) {
    const fallback = candidates4.find(c => !mode4.includes(c.word))?.word || candidates4[0]?.word;
    mode4.push(fallback);
  }

  if (!mode1 || mode2.length < 2 || mode4.length < 4) {
    throw new Error('A tabela palavras no Supabase não tem palavras suficientes para o Versus.');
  }

  const words = { mode1, mode2, mode4 };
  challenges[dateStr] = words;
  localStorage.setItem(key, JSON.stringify(challenges));
  return words;
}

export interface DbConfig {
  minLimitPercent: number;
  autoGenBatchSize: number;
}

export function getDbConfig(): DbConfig {
  initLocalStorage();
  return JSON.parse(localStorage.getItem('termo_db_config') || '{"minLimitPercent": 20, "autoGenBatchSize": 250}');
}

export function saveDbConfig(config: DbConfig) {
  localStorage.setItem('termo_db_config', JSON.stringify(config));
}

export interface DbStats {
  total: number;
  neverUsed: number;
  usedOnce: number;
  usedMultiple: number;
  lowUsagePercent: number;
  lastJob: any | null;
  pendingJobsCount: number;
}

export function getDbStats(): DbStats {
  initLocalStorage();
  const words = JSON.parse(localStorage.getItem('termo_db_words') || '[]');
  const jobs = JSON.parse(localStorage.getItem('termo_db_jobs') || '[]');
  
  let neverUsed = 0;
  let usedOnce = 0;
  let usedMultiple = 0;
  
  words.forEach((w: any) => {
    if (w.usedCount === 0) neverUsed++;
    else if (w.usedCount === 1) usedOnce++;
    else usedMultiple++;
  });
  
  const total = words.length;
  const lowUsagePercent = total > 0 ? (neverUsed / total) * 100 : 0;
  
  let lastJob = null;
  if (jobs.length > 0) {
    const sortedJobs = [...jobs].sort((a: any, b: any) => b.requestedAt.localeCompare(a.requestedAt));
    lastJob = sortedJobs[0];
  }
  
  const pendingJobsCount = jobs.filter((j: any) => j.status === 'Pending' || j.status === 'Processing').length;
  
  return {
    total,
    neverUsed,
    usedOnce,
    usedMultiple,
    lowUsagePercent,
    lastJob,
    pendingJobsCount
  };
}

export function checkAndTriggerAutoReplenish() {
  const stats = getDbStats();
  const config = getDbConfig();
  
  if (stats.lowUsagePercent < config.minLimitPercent && stats.pendingJobsCount === 0) {
    console.log(`Low usage words percentage (${stats.lowUsagePercent.toFixed(1)}%) is below threshold (${config.minLimitPercent}%). Triggering auto replenish...`);
    createWordGenJob(config.autoGenBatchSize, true);
  }
}

export function createWordGenJob(requestedWords: number, isAuto: boolean = false): string {
  initLocalStorage();
  const jobs = JSON.parse(localStorage.getItem('termo_db_jobs') || '[]');
  const newJob = {
    id: Math.random().toString(36).substring(2, 9),
    status: 'Pending',
    requestedAt: new Date().toISOString(),
    finishedAt: null,
    requestedWords,
    generatedWords: 0,
    errorMessage: null,
    isAuto
  };
  jobs.push(newJob);
  localStorage.setItem('termo_db_jobs', JSON.stringify(jobs));
  
  // Trigger async execution sequentially via the promise queue
  queueWordGenJob(newJob.id);
  
  return newJob.id;
}

let activeJobChain = Promise.resolve();

export function queueWordGenJob(jobId: string) {
  activeJobChain = activeJobChain.then(async () => {
    try {
      await runWordGenJob(jobId);
    } catch (e) {
      console.error(`Error executing job ${jobId} in queue:`, e);
    }
  });
}

export async function runWordGenJob(jobId: string) {
  console.log(`Starting background job ${jobId}...`);
  
  const updateJobStatus = (status: 'Processing' | 'Completed' | 'Failed', extra = {}) => {
    const jobs = JSON.parse(localStorage.getItem('termo_db_jobs') || '[]');
    const idx = jobs.findIndex((j: any) => j.id === jobId);
    if (idx !== -1) {
      jobs[idx] = { ...jobs[idx], status, ...extra };
      localStorage.setItem('termo_db_jobs', JSON.stringify(jobs));
      window.dispatchEvent(new Event('termo_db_updated'));
    }
  };
  
  updateJobStatus('Processing');
  
  try {
    const jobs = JSON.parse(localStorage.getItem('termo_db_jobs') || '[]');
    const job = jobs.find((j: any) => j.id === jobId);
    if (!job) throw new Error('Job not found');
    
    const totalToGenerate = job.requestedWords;
    let generatedCount = 0;
    const newWordsList: string[] = [];
    
    const dbWords = JSON.parse(localStorage.getItem('termo_db_words') || '[]');
    const existingWordsSet = new Set<string>(dbWords.map((w: any) => w.word));
    
    const batchSize = 125;
    const maxAttempts = Math.ceil(totalToGenerate / batchSize) * 2;
    let attempts = 0;
    
    while (generatedCount < totalToGenerate && attempts < maxAttempts) {
      attempts++;
      const needed = totalToGenerate - generatedCount;
      const countToFetch = Math.min(needed, batchSize);
      
      try {
        console.log(`Fetching batch ${attempts} for job ${jobId}. Fetching: ${countToFetch}...`);
        const batch = await generateWordsBatch(countToFetch, existingWordsSet);
        
        let validBatchCount = 0;
        batch.forEach(word => {
          const normalized = normalizeWord(word);
          if (
            normalized.length >= 4 &&
            normalized.length <= 10 &&
            /^[A-Z]+$/.test(normalized) &&
            !existingWordsSet.has(normalized) &&
            !newWordsList.includes(normalized)
          ) {
            newWordsList.push(normalized);
            validBatchCount++;
            generatedCount++;
          }
        });
        
        console.log(`Batch ${attempts} completed. Valid: ${validBatchCount}. Total: ${generatedCount}/${totalToGenerate}`);
        // Wait 5 seconds between batches to avoid hitting Groq API RPM rate limit
        await new Promise(resolve => setTimeout(resolve, 5000));
      } catch (err) {
        console.error(`Error in batch ${attempts} for job ${jobId}:`, err);
        // Wait 15 seconds after an error (like a 429 rate limit) to cool down
        await new Promise(resolve => setTimeout(resolve, 15000));
      }
    }
    
    if (newWordsList.length === 0) {
      throw new Error('Nenhuma palavra válida gerada. Verifique conexão com a API Groq.');
    }
    
    const updatedDbWords = JSON.parse(localStorage.getItem('termo_db_words') || '[]');
    let idCounter = updatedDbWords.length + 1;
    
    newWordsList.forEach(word => {
      updatedDbWords.push({
        id: `w-${idCounter++}-${Math.random().toString(36).substring(2,5)}`,
        word,
        length: word.length,
        usedCount: 0,
        lastUsedAt: null,
        createdAt: new Date().toISOString(),
        source: 'IA'
      });
    });
    
    localStorage.setItem('termo_db_words', JSON.stringify(updatedDbWords));

    // Upload generated words to Supabase 'palavras' table
    try {
      let startId = 1;
      const { data: maxIdData } = await supabase.from('palavras').select('Id').order('Id', { ascending: false }).limit(1);
      if (maxIdData && maxIdData[0]) {
        startId = Number(maxIdData[0].Id) + 1;
      }
      
      const wordsToInsert = newWordsList.map((word, idx) => ({
        Id: startId + idx,
        Word: word,
        Length: word.length,
        UsedCount: 0,
        LastUsedAt: null,
        CreatedAt: new Date().toISOString(),
        Source: 'IA'
      }));

      const { error: insertErr } = await supabase.from('palavras').insert(wordsToInsert);
      if (insertErr) {
        console.error('Error inserting new generated words into Supabase:', insertErr);
      } else {
        console.log(`Successfully uploaded ${newWordsList.length} words to Supabase 'palavras' table.`);
      }
    } catch (supabaseErr) {
      console.error('Failed to sync new generated words to Supabase:', supabaseErr);
    }
    
    updateJobStatus('Completed', {
      finishedAt: new Date().toISOString(),
      generatedWords: newWordsList.length
    });
    
  } catch (error: any) {
    console.error(`Job ${jobId} failed:`, error);
    updateJobStatus('Failed', {
      finishedAt: new Date().toISOString(),
      errorMessage: error.message || String(error)
    });
  }
}

export function startupCheckJobs() {
  initLocalStorage();
  const jobs = JSON.parse(localStorage.getItem('termo_db_jobs') || '[]');
  let changed = false;
  jobs.forEach((j: any) => {
    if (j.status === 'Processing') {
      j.status = 'Failed';
      j.finishedAt = new Date().toISOString();
      j.errorMessage = 'Interrompido por recarregamento da página';
      changed = true;
    }
  });
  if (changed) {
    localStorage.setItem('termo_db_jobs', JSON.stringify(jobs));
  }
  
  const pending = jobs.filter((j: any) => j.status === 'Pending');
  pending.forEach((j: any) => {
    queueWordGenJob(j.id);
  });
}

// Memory cache for word validation (lowercase)
export const loadedWordsCache = new Set<string>();
export const loadedWordLengths = new Set<number>();

export async function ensureWordsLoaded(length: number) {
  if (loadedWordLengths.has(length)) {
    return;
  }

  try {
    const { data, error } = await supabase
      .from('palavras')
      .select('Word')
      .eq('Length', length)
      .eq('Enabled', true);
    
    if (!error && data) {
      data.forEach(row => {
        if (row.Word) {
          loadedWordsCache.add(row.Word.toLowerCase().trim());
        }
      });
      loadedWordLengths.add(length);
      console.log(`Loaded ${data.length} words of length ${length} into validation cache.`);
    }
  } catch (err) {
    console.error("Error loading words of length " + length, err);
  }
}

export function validateWord(word: string, length: number, targets: string[] = []): { valid: boolean; code?: string } {
  // 1. Normalização
  const normalized = word
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '')
    .trim();

  // 2. Validação por tamanho
  if (normalized.length !== length) {
    return { valid: false, code: 'INVALID_LENGTH' };
  }

  // Target word is always valid
  const normalizedTargets = targets.map(t => 
    t.normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z]/g, '')
      .trim()
  );
  if (normalizedTargets.includes(normalized)) {
    return { valid: true };
  }

  // 3. Validação local (memória)
  if (loadedWordsCache.has(normalized)) {
    return { valid: true };
  }

  // 4. Fallback local cache
  const localWordsStr = localStorage.getItem('termo_db_words');
  if (localWordsStr) {
    try {
      const localWords = JSON.parse(localWordsStr);
      const exists = localWords.some((w: any) => {
        const normLocal = w.word
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .replace(/[^a-z]/g, '')
          .trim();
        return normLocal === normalized && w.length === length && w.enabled !== false;
      });
      if (exists) return { valid: true };
    } catch (e) {
      console.error(e);
    }
  }

  // 5. Fallback hardcoded list
  const fallbackList = FALLBACK_WORDS_BY_LENGTH[length] || [];
  const normalizedFallbacks = fallbackList.map(w => 
    w.normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z]/g, '')
      .trim()
  );
  if (normalizedFallbacks.includes(normalized)) {
    return { valid: true };
  }

  return { valid: false, code: 'WORD_NOT_FOUND' };
}

export async function incrementWordUsage(word: string) {
  await incrementWordsUsage([word]);
}

export async function incrementWordsUsage(words: string[]) {
  const normalizedList = words.map(w => w.toLowerCase().trim()).filter(Boolean);
  if (normalizedList.length === 0) return;
  
  try {
    const { data, error } = await supabase
      .from('palavras')
      .select('Id, UsedCount')
      .in('Word', normalizedList);
    
    if (!error && data) {
      // Perform updates in parallel chunks to prevent connection/rate limits
      const batchSize = 10;
      for (let i = 0; i < data.length; i += batchSize) {
        const chunk = data.slice(i, i + batchSize);
        await Promise.all(chunk.map(row => {
          const newUsedCount = (Number(row.UsedCount) || 0) + 1;
          return supabase
            .from('palavras')
            .update({
              UsedCount: newUsedCount,
              LastUsedAt: new Date().toISOString()
            })
            .eq('Id', row.Id);
        }));
      }
    }
  } catch (err) {
    console.error('Failed to increment words usage:', err);
  }
}

export async function getDbStatsFromSupabase() {
  try {
    const [totalRes, neverRes, onceRes, multRes] = await Promise.all([
      supabase.from('palavras').select('*', { count: 'exact', head: true }),
      supabase.from('palavras').select('*', { count: 'exact', head: true }).eq('UsedCount', 0),
      supabase.from('palavras').select('*', { count: 'exact', head: true }).eq('UsedCount', 1),
      supabase.from('palavras').select('*', { count: 'exact', head: true }).gt('UsedCount', 1)
    ]);
    
    return {
      total: totalRes.count || 0,
      neverUsed: neverRes.count || 0,
      usedOnce: onceRes.count || 0,
      usedMultiple: multRes.count || 0
    };
  } catch (err) {
    console.error("Error fetching db stats from Supabase:", err);
    return { total: 0, neverUsed: 0, usedOnce: 0, usedMultiple: 0 };
  }
}

// === MODO AFOGADO ===

export interface AfogadoMatch {
  date: string;
  timeSurvived: number; // in seconds
  wordsSolved: number;
  maxStreak: number;
  dicasUsed: number;
  score: number;
  playerName: string;
}

export interface AfogadoRecord {
  maxWordsSolved: number;
  maxScore: number;
  maxStreak: number;
  maxTimeSurvived: number;
  playerName: string;
}

export function getAfogadoHistory(): AfogadoMatch[] {
  initLocalStorage();
  return JSON.parse(localStorage.getItem('termo_afogado_matches') || '[]');
}

export function saveAfogadoMatch(match: AfogadoMatch) {
  initLocalStorage();
  const matches: AfogadoMatch[] = JSON.parse(localStorage.getItem('termo_afogado_matches') || '[]');
  matches.unshift(match);
  localStorage.setItem('termo_afogado_matches', JSON.stringify(matches));

  const records: AfogadoRecord[] = JSON.parse(localStorage.getItem('termo_afogado_records') || '[]');
  const existingIndex = records.findIndex(r => r.playerName === match.playerName);
  if (existingIndex !== -1) {
    const r = records[existingIndex];
    r.maxWordsSolved = Math.max(r.maxWordsSolved, match.wordsSolved);
    r.maxScore = Math.max(r.maxScore, match.score);
    r.maxStreak = Math.max(r.maxStreak, match.maxStreak);
    r.maxTimeSurvived = Math.max(r.maxTimeSurvived, match.timeSurvived);
  } else {
    records.push({
      playerName: match.playerName,
      maxWordsSolved: match.wordsSolved,
      maxScore: match.score,
      maxStreak: match.maxStreak,
      maxTimeSurvived: match.timeSurvived
    });
  }
  localStorage.setItem('termo_afogado_records', JSON.stringify(records));
}

export function getAfogadoRecords(): AfogadoRecord[] {
  initLocalStorage();
  return JSON.parse(localStorage.getItem('termo_afogado_records') || '[]');
}

export async function getAfogadoWordForIndex(
  dateStr: string,
  index: number,
  difficulty: 'easy' | 'medium' | 'difficult',
  isVersus: boolean
): Promise<string> {
  let seed: number;
  if (isVersus) {
    seed = getSeedForDate(`${dateStr}_afogado_${index}`);
  } else {
    seed = Math.floor(Math.random() * 1000000);
  }

  let length = 5;
  if (difficulty === 'easy') {
    length = 4 + (seed % 2); // 4 or 5
  } else if (difficulty === 'medium') {
    length = 6 + (seed % 2); // 6 or 7
  } else {
    length = 8 + (seed % 3); // 8, 9, or 10
  }

  const result = await selectSupabaseWords(length, 1, seed);
  const word = result[0]?.word;
  if (!word) {
    const fallbackEasy = ['casa', 'gato', 'vida', 'bola', 'dado', 'fogo', 'agua', 'mato', 'copo', 'foto'];
    const fallbackMedium = ['escada', 'janela', 'montar', 'cadeira', 'caneta', 'sapato', 'parede', 'camisa', 'abacaxi', 'buzina'];
    const fallbackDifficult = ['horizonte', 'descobrir', 'ferramenta', 'computador', 'televisao', 'borboleta', 'felicidade', 'gravidade', 'dinossauro', 'astronomia'];

    const fallbackList = difficulty === 'easy' ? fallbackEasy : difficulty === 'medium' ? fallbackMedium : fallbackDifficult;
    return fallbackList[seed % fallbackList.length];
  }

  incrementWordUsage(word).catch(err =>
    console.error('Failed to increment afogado word usage:', err)
  );

  return word;
}


