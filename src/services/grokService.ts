// Groq AI integration for O Nosso Termo word generation.

// Fallback Portuguese word bank by length (normalized, uppercase, no accents)
// This is date-seeded so offline/fallback generation is identical for both players on the same day.
export const FALLBACK_WORDS_BY_LENGTH: Record<number, string[]> = {
  4: ['CASA', 'BOLA', 'MESA', 'ROSA', 'GATO', 'LEAO', 'VACA', 'PATO', 'FOGO', 'AGUA', 'MATO', 'LAMA', 'LUZ', 'MAO', 'SOL', 'VIDA', 'BOM', 'MAL', 'DADO', 'COPO', 'PULO', 'RIZO', 'SACO', 'BOLO', 'FOTO', 'PIZA', 'BOTA', 'SINO', 'REDE', 'NADA'],
  5: ['TERMO', 'AUDIO', 'PORTA', 'VENTO', 'CHAVE', 'PLACA', 'PRATO', 'FESTA', 'LIVRO', 'CORPO', 'ALMA', 'TEMPO', 'NOITE', 'JOGO', 'CAMPO', 'PEDRA', 'FOLHA', 'CHUVA', 'CANETA', 'PASTA', 'MANGA', 'AMIGO', 'GRUPO', 'TEXTO', 'FORÇA', 'MENTE', 'RADIO', 'TRENO', 'SONHO', 'AREIA', 'GENTE'],
  6: ['ABACAXI', 'CANETA', 'JANELA', 'PAREDE', 'CAMISA', 'SAPATO', 'XICARA', 'PRATO', 'ESCOLA', 'ESTADO', 'BRASIL', 'CIDADE', 'FLORESTA', 'ANIMAL', 'PLANTA', 'MUSICA', 'VIAGEM', 'QUARTO', 'COZINHA', 'ESPORTE', 'TRABALHO', 'MEDICO', 'PROVA', 'CANÇÃO', 'FUTURO', 'PASSADO', 'PESSOA', 'BELEZA', 'CARROS', 'QUEIJO'],
  7: ['CADERNO', 'ESPELHO', 'TECLADO', 'CELULAR', 'GARRAFA', 'MOCHILA', 'CARTEIRA', 'COLEGA', 'HISTORIA', 'DESENHO', 'PROJETO', 'SUCESSO', 'VONTADE', 'CRIANÇA', 'CORAÇÃO', 'SABEDORIA', 'REUNIÃO', 'TRABALHO', 'ESFORÇO', 'AMIZADE', 'CULTURA', 'EMPRESA', 'ARTEATO', 'REMEDIO', 'DESAFIO', 'GOVERNO', 'VERDADE', 'LIBERDADE', 'DESTINO', 'PLANETA'],
  8: ['TELEFONE', 'COMPUTAR', 'FLORESTA', 'PROBLEMA', 'DIFICIL', 'PERGUNTA', 'RESPOSTA', 'PRESENTE', 'PASSADO', 'PROXIMO', 'ESCRITOR', 'PROFESSOR', 'ALIMENTOS', 'MEDICINA', 'CARINHO', 'FELIZES', 'ESPECIAL', 'NEGOCIO', 'TRABALHO', 'SOCIEDADE', 'ELEMENTO', 'NATUREZA', 'FAMILIAR', 'SEGURANÇA', 'PROCESSO', 'SIMPLES', 'CONVERSA', 'UNIVERSO', 'AMIGAVEL', 'VITORIOS'],
  9: ['COMPUTADOR', 'TECNOLOGIA', 'EDUCACIONAL', 'INFORMAÇÃO', 'DIFERENTE', 'IMPORTANTE', 'GEOGRAFIA', 'SOCIEDADE', 'ATIVIDADE', 'EXERCICIO', 'DOCUMENTO', 'ESTUDANTE', 'RESULTADO', 'CATEGORIA', 'FELICIDADE', 'ESPERANÇA', 'SEGURANÇA', 'SITUACAO', 'COMPANHIA', 'QUALIDADE', 'DIFERENÇA', 'PROBLEMAS', 'VANTAGENS', 'PRINCIPAL', 'LITERATURA', 'PROGRAMAR', 'DESENVOLVE', 'PRODUÇÃO', 'RELAÇOES', 'ELEMENTOS'],
  10: ['TECNOLOGICO', 'INFORMÁTICA', 'UNIVERSIDADE', 'MATEMÁTICA', 'CONHECIMENTO', 'NASCIMENTO', 'CASAMENTO', 'TRABALHADOR', 'DISCIPLINA', 'PATRIMONIO', 'DESENVOLVE', 'ENGENHARIA', 'SECRETARIA', 'LITERATURA', 'ESTATISTICA', 'SOCIEDADE', 'ORGANIZAÇÃO', 'PREPARAÇÃO', 'ASSOCIAÇÃO', 'ILUSTRAÇÃO', 'RESPONSÁVEL', 'ATUALIDADE', 'COMPETIÇÃO', 'CONSTRUÇÃO', 'TRANSPORTE', 'PUBLICIDADE', 'APRESENTAÇÃO', 'DECLARAÇÃO', 'IMAGINAÇÃO', 'SENTIMENTO']
};

export interface DailyWords {
  mode1: string;
  mode2: string[];
  mode4: string[];
}

// Strip diacritics and convert to uppercase for standardized Wordle play
export function normalizeWord(word: string): string {
  return word
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
}

// Generate date-seeded random word of specific length
function getSeedForDate(dateStr: string): number {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = dateStr.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

function getDeterministicWord(dateStr: string, length: number, offset: number = 0): string {
  const words = FALLBACK_WORDS_BY_LENGTH[length] || FALLBACK_WORDS_BY_LENGTH[5];
  const seed = getSeedForDate(dateStr) + offset;
  const index = seed % words.length;
  return normalizeWord(words[index]);
}

// Generates words deterministically based on date (for backup)
export function getDeterministicDailyWords(dateStr: string): DailyWords {
  // Use mixed lengths (e.g. 5, 6, 7)
  const seed = getSeedForDate(dateStr);
  const len1 = 5 + (seed % 3); // 5, 6, 7
  const len2 = 4 + ((seed + 1) % 4); // 4, 5, 6, 7
  const len4 = 5 + ((seed + 2) % 3); // 5, 6, 7

  const mode1 = getDeterministicWord(dateStr, len1, 10);
  const mode2 = [
    getDeterministicWord(dateStr, len2, 20),
    getDeterministicWord(dateStr, len2, 30),
  ];
  // Ensure mode 2 has unique words
  if (mode2[0] === mode2[1]) {
    mode2[1] = getDeterministicWord(dateStr, len2, 35);
  }

  const mode4 = [
    getDeterministicWord(dateStr, len4, 40),
    getDeterministicWord(dateStr, len4, 50),
    getDeterministicWord(dateStr, len4, 60),
    getDeterministicWord(dateStr, len4, 70),
  ];
  // Ensure mode 4 has unique words
  const uniqueMode4 = Array.from(new Set(mode4));
  while (uniqueMode4.length < 4) {
    uniqueMode4.push(getDeterministicWord(dateStr, len4, 80 + uniqueMode4.length * 10));
  }

  return {
    mode1,
    mode2,
    mode4: uniqueMode4,
  };
}

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;

function getGroqApiKey(): string {
  if (!GROQ_API_KEY) {
    throw new Error('Missing VITE_GROQ_API_KEY environment variable');
  }
  return GROQ_API_KEY;
}

export async function fetchDailyWords(dateStr: string): Promise<DailyWords> {
  const apiKey = getGroqApiKey();

  // Calculate random word lengths for today's challenge
  const seed = getSeedForDate(dateStr);
  const len1 = 5 + (seed % 3); // 5 to 7
  const len2 = 5 + ((seed + 1) % 3); // 5 to 7
  const len4 = 5 + ((seed + 2) % 3); // 5 to 7

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        temperature: 0.7,
        max_tokens: 500,
        response_format: { type: "json_object" },
        messages: [
          {
            role: 'system',
            content: `Você é um gerador de palavras para o jogo de Wordle/Termo. 
Sua tarefa é retornar um objeto JSON contendo palavras válidas da língua portuguesa (Português do Brasil).
Regras estritas:
1. Sem nomes próprios, siglas, abreviações, estrangeirismos, gírias regionais.
2. Evite acentuações no JSON retornado se possível, ou retorne com acentos mas saiba que elas serão limpas. Todas em MAIÚSCULAS.
3. Formato do JSON esperado:
{
  "mode1": "PALAVRA", // exatamente 1 palavra de ${len1} letras
  "mode2": ["PALAVRA1", "PALAVRA2"], // exatamente 2 palavras diferentes de ${len2} letras
  "mode4": ["PALAVRA1", "PALAVRA2", "PALAVRA3", "PALAVRA4"] // exatamente 4 palavras diferentes de ${len4} letras
}
Não inclua nenhuma outra resposta além do JSON.`
          },
          {
            role: 'user',
            content: `Gere as palavras do dia para a data ${dateStr}. 
Garanta que as palavras sejam válidas, desafiadoras e sigam os tamanhos solicitados:
Mode 1: ${len1} letras.
Mode 2: duas de ${len2} letras.
Mode 4: quatro de ${len4} letras.`
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`Groq API returned status ${response.status}`);
    }

    const data = await response.json();
    const contentText = data.choices?.[0]?.message?.content;
    if (!contentText) {
      throw new Error('Invalid Groq API response structure');
    }

    const parsed = JSON.parse(contentText);
    if (parsed.mode1 && Array.isArray(parsed.mode2) && parsed.mode2.length === 2 && Array.isArray(parsed.mode4) && parsed.mode4.length === 4) {
      return {
        mode1: normalizeWord(parsed.mode1),
        mode2: parsed.mode2.map(normalizeWord),
        mode4: parsed.mode4.map(normalizeWord),
      };
    } else {
      throw new Error('Parsed Groq response does not match schema');
    }
  } catch (error) {
    console.warn('Failed to fetch daily words from Groq. Falling back to deterministic generation.', error);
    return getDeterministicDailyWords(dateStr);
  }
}

export async function generateWordsBatch(count: number, existingWordsSet: Set<string>): Promise<string[]> {
  const apiKey = getGroqApiKey();
  
  const batchCount = Math.min(count, 150);
  const sampleExisting = Array.from(existingWordsSet).slice(0, 30);
  
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      temperature: 0.85,
      max_tokens: 2000,
      response_format: { type: "json_object" },
      messages: [
        {
          role: 'system',
          content: `Você é um gerador de banco de dados de palavras em português do Brasil.
Retorne um objeto JSON contendo um array contendo exatamente ${batchCount} palavras válidas do português brasileiro.
Regras estritas para cada palavra:
1. Deve ser uma palavra real e comum da língua portuguesa.
2. Deve ter entre 4 e 10 letras.
3. Não pode ser nome próprio, sigla, abreviação, gíria vulgar ou palavra ofensiva.
4. Sem hífens ou símbolos.
5. Retorne as palavras sem acentos (ex: "AVIAO" em vez de "AVIÃO", "CACAO" em vez de "CACAU"). Remova acentos e cedilhas.
6. Retorne estritamente o JSON no seguinte formato:
{
  "words": ["PALAVRA1", "PALAVRA2", ...]
}
Não inclua nenhuma outra resposta além do JSON.`
        },
        {
          role: 'user',
          content: `Gere exatamente ${batchCount} palavras novas diferentes. 
Não gere nenhuma destas palavras existentes se possível: ${sampleExisting.join(', ')}.`
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`Groq API returned status ${response.status}`);
  }

  const data = await response.json();
  const contentText = data.choices?.[0]?.message?.content;
  if (!contentText) {
    throw new Error('Invalid Groq API response structure');
  }

  const parsed = JSON.parse(contentText);
  if (parsed.words && Array.isArray(parsed.words)) {
    return parsed.words.map((w: string) => normalizeWord(w));
  } else {
    throw new Error('Parsed response does not contain "words" array');
  }
}

export async function fetchCrosswordClues(
  words: string[],
  difficulty: 'facil' | 'medio' | 'dificil'
): Promise<Record<string, string>> {
  const apiKey = getGroqApiKey();
  
  let clueStyle = '';
  let example = '';
  if (difficulty === 'facil') {
    clueStyle = 'direta, simples e factual';
    example = 'ex: "Pequeno felino doméstico que mia" para GATO';
  } else if (difficulty === 'medio') {
    clueStyle = 'de nível médio, que descreve o conceito de forma mais contextual ou criativa com pensamento lateral moderado';
    example = 'ex: "Gosta de deitar no sol e persegue ratos" para GATO';
  } else {
    clueStyle = 'enigmática, com forte pensamento lateral, metáforas poéticas, charadas ou jogos de palavras desafiadores';
    example = 'ex: "Pequena pantera silenciosa que governa os sofás" para GATO';
  }

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        temperature: 0.8,
        max_tokens: 800,
        response_format: { type: "json_object" },
        messages: [
          {
            role: 'system',
            content: `Você é um gerador de pistas para um jogo de palavras cruzadas em português do Brasil.
Você receberá um array de palavras e deverá gerar exatamente uma pista para cada palavra seguindo o estilo solicitado.
Estilo de pistas: ${clueStyle} (${example}).
Retorne estritamente um objeto JSON no seguinte formato:
{
  "pistas": {
    "PALAVRA1": "Pista gerada 1",
    "PALAVRA2": "Pista gerada 2",
    ...
  }
}
Não inclua nenhuma outra resposta além do JSON.`
          },
          {
            role: 'user',
            content: `Gere as pistas no estilo solicitado para as seguintes palavras: ${words.join(', ')}.`
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`Groq API returned status ${response.status}`);
    }

    const data = await response.json();
    const contentText = data.choices?.[0]?.message?.content;
    if (!contentText) {
      throw new Error('Invalid Groq API response structure');
    }

    const parsed = JSON.parse(contentText);
    if (parsed.pistas && typeof parsed.pistas === 'object') {
      const normalizedPistas: Record<string, string> = {};
      for (const k of Object.keys(parsed.pistas)) {
        normalizedPistas[k.toUpperCase()] = parsed.pistas[k];
      }
      return normalizedPistas;
    } else {
      throw new Error('Parsed response does not contain "pistas" object');
    }
  } catch (error) {
    console.warn('Failed to fetch crossword clues from Groq. Falling back.', error);
    throw error;
  }
}

