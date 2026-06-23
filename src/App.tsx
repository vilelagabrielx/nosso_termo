import { useState, useEffect, useRef } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';
import {
  initLocalStorage,
  getActivePlayer,
  setActivePlayer,
  getTodayDateString,
  getChallengeForDate,
  getPlayerResultForDate,
  saveModeResult,
  getDailyHistoryList,
  getHeadToHeadScore,
  getPlayerStats,
  getVersusMatchForDate,
  saveVersusMatch,
  getVersusHistory,
  getBlitzRecords,
  saveBlitzMatch,
  getBlitzHistory,
  getBlitzWordPool,
  getBombWordForDate,
  getCrosswordForDate,
  getSpecialResultForDate,
  saveSpecialModeResult,
  getVersusWordsForDate,
  startupCheckJobs,
  getDbStatsFromSupabase,
  getDbConfig,
  saveDbConfig,
  createWordGenJob,
  syncSupabaseData,
  getAmbosDailyHistory,
  ensureWordsLoaded,
  validateWord,
  type Challenge,
  type DailyResult,
  type VersusResult,
  type BlitzMatch,
  type BlitzRecord,
  type SpecialModeResult,
  type CrosswordChallenge
} from './services/mockDb';
import { GameBoard, getLetterStatuses } from './components/GameBoard';
import { supabase } from './services/supabaseClient';
import { Keyboard } from './components/Keyboard';
import { Confetti } from './components/Confetti';
import {
  Calendar,
  Play,
  ArrowLeft,
  TrendingUp,
  Clock,
  Activity,
  Users,
  Zap,
  Flame,
  Trophy,
  Bomb,
  Grid3X3,
  Sparkles
} from 'lucide-react';

interface OpponentState {
  round: number; // 1: Termo, 2: Dueto, 3: Quarteto, 4: Concluído
  elapsedTime: number;
  guessesCount: number;
  wordsSolved: number;
  progress: number;
  ticker: string[];
  termoScore: number;
  duetoScore: number;
  quartetoScore: number;
  bombScore?: number;
  crosswordScore?: number;
  blitzScore?: number;
  totalScore: number;
  completed: boolean;
}

export function formatTime(seconds: number): string {
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

export default function App() {
  // App navigation state
  const [view, setView] = useState<'dashboard' | 'playing' | 'lobby' | 'versus-recap' | 'versus-end' | 'blitz-end' | 'admin'>('dashboard');
  const [activePlayer, setActivePlayerState] = useState<'Gabriel' | 'Alessandra' | 'Ambos'>('Gabriel');
  const [todayChallenge, setTodayChallenge] = useState<Challenge | null>(null);
  const [todayResult, setTodayResult] = useState<DailyResult | null>(null);
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [h2hScore, setH2hScore] = useState<any>(null);
  const [playerStats, setPlayerStats] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // State for countdown until next day
  const [timeUntilMidnight, setTimeUntilMidnight] = useState<string>('');

  // Versus States
  const [versusInviteVisible, setVersusInviteVisible] = useState<boolean>(false);
  const [versusMatchToday, setVersusMatchToday] = useState<VersusResult | null>(null);
  const [versusHistory, setVersusHistory] = useState<VersusResult[]>([]);
  const [versusRound, setVersusRound] = useState<1 | 2 | 3>(1);
  const [versusWords, setVersusWords] = useState<any>(null);
  const [lobbyStep, setLobbyStep] = useState<'connecting' | 'ready' | 'countdown'>('connecting');
  const [countdownVal, setCountdownVal] = useState<number>(3);

  // Multiplayer real-time states
  const [multiplayerChannel, setMultiplayerChannel] = useState<any>(null);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [waitingForOpponent, setWaitingForOpponent] = useState<boolean>(false);
  const [versusOpponentType, setVersusOpponentType] = useState<'bot' | 'real'>('bot');
  const [woRemainingTime, setWoRemainingTime] = useState<number | null>(null);
  const woTimerRef = useRef<any>(null);

  // Blitz States
  const [blitzRecordsList, setBlitzRecordsList] = useState<BlitzRecord[]>([]);
  const [blitzHistoryList, setBlitzHistoryList] = useState<BlitzMatch[]>([]);
  const [blitzConfigDuration, setBlitzConfigDuration] = useState<number>(3); // Default 3 min
  const [blitzRemainingTime, setBlitzRemainingTime] = useState<number>(180);
  const [blitzWordPoolList, setBlitzWordPoolList] = useState<string[]>([]);
  const [blitzCurrentWordIdx, setBlitzCurrentWordIdx] = useState<number>(0);
  const [blitzSolvedCount, setBlitzSolvedCount] = useState<number>(0);
  const [blitzAttemptsCount, setBlitzAttemptsCount] = useState<number>(0);
  const [blitzCurrentStreak, setBlitzCurrentStreak] = useState<number>(0);
  const [blitzMaxStreak, setBlitzMaxStreak] = useState<number>(0);
  const [blitzSolvedTimesList, setBlitzSolvedTimesList] = useState<number[]>([]);
  const [blitzWordStartSeconds, setBlitzWordStartSeconds] = useState<number>(0);
  const [blitzIsNewRecord, setBlitzIsNewRecord] = useState<boolean>(false);

  // Special daily modes
  const [bombResultToday, setBombResultToday] = useState<SpecialModeResult | null>(null);
  const [crosswordResultToday, setCrosswordResultToday] = useState<SpecialModeResult | null>(null);
  const [blitzResultToday, setBlitzResultToday] = useState<SpecialModeResult | null>(null);
  const [bombCharge, setBombCharge] = useState<number>(50);
  const [bombLastDelta, setBombLastDelta] = useState<number>(0);
  const [crosswordChallenge, setCrosswordChallenge] = useState<CrosswordChallenge | null>(null);
  const [crosswordConfigDifficulty, setCrosswordConfigDifficulty] = useState<'facil' | 'medio' | 'dificil'>('medio');
  const [crosswordConfigDuration, setCrosswordConfigDuration] = useState<number>(5); // 2, 5, or 10 min
  const [crosswordCells, setCrosswordCells] = useState<Record<string, string>>({});
  const [crosswordSelectedId, setCrosswordSelectedId] = useState<string>('1A');
  const [crosswordFocusedKey, setCrosswordFocusedKey] = useState<string | null>(null);
  const [crosswordSolvedIds, setCrosswordSolvedIds] = useState<string[]>([]);
  const [crosswordMessage, setCrosswordMessage] = useState<string>('');

  // Admin Panel States
  const [adminStats, setAdminStats] = useState<any>({ total: 0, neverUsed: 0, usedOnce: 0, usedMultiple: 0, lowUsagePercent: 0, lastJob: null, pendingJobsCount: 0 });
  const [generationJobs, setGenerationJobs] = useState<any[]>([]);
  const [configThreshold, setConfigThreshold] = useState<number>(20);
  const [configBatchSize, setConfigBatchSize] = useState<number>(250);

  // Gabriel & Alessandra Versus Scores accumulated
  const [gabrielVersusScores, setGabrielVersusScores] = useState({ termo: 0, dueto: 0, quarteto: 0, bomb: 0, crossword: 0, blitz: 0, total: 0 });
  const [alessandraVersusScores, setAlessandraVersusScores] = useState({ termo: 0, dueto: 0, quarteto: 0, bomb: 0, crossword: 0, blitz: 0, total: 0 });

  // Real-time Opponent Sim state
  const [oppState, setOppState] = useState<OpponentState>({
    round: 1,
    elapsedTime: 0,
    guessesCount: 0,
    wordsSolved: 0,
    progress: 0,
    ticker: [],
    termoScore: 0,
    duetoScore: 0,
    quartetoScore: 0,
    bombScore: 0,
    crosswordScore: 0,
    blitzScore: 0,
    totalScore: 0,
    completed: false
  });

  // Gameplay state
  const [gameModeType, setGameModeType] = useState<'daily' | 'versus' | 'blitz' | 'bomb' | 'crossword'>('daily');
  const [activeMode, setActiveMode] = useState<1 | 2 | 4>(1);
  const [targetWords, setTargetWords] = useState<string[]>([]);
  const [guesses, setGuesses] = useState<string[]>([]);
  const [currentGuess, setCurrentGuess] = useState<string>('');
  const [focusedCharIndex, setFocusedCharIndex] = useState<number | null>(0);
  const [solvedBoards, setSolvedBoards] = useState<boolean[]>([]);
  const boardInputRef = useRef<HTMLInputElement | null>(null);

  // Timer state
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const timerRef = useRef<any>(null);
  const oppIntervalRef = useRef<any>(null);

  // Animations & Modals
  const [shakeRowIndex, setShakeRowIndex] = useState<number | null>(null);
  const [showGameModal, setShowGameModal] = useState<boolean>(false);
  const [modalSuccess, setModalSuccess] = useState<boolean>(false);
  const [modalScore, setModalScore] = useState<number>(0);
  const [modalAttempts, setModalAttempts] = useState<number>(0);
  const [modalTime, setModalTime] = useState<number>(0);

  // Confetti triggering state
  const [triggerConfetti, setTriggerConfetti] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
  };

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(''), 2500);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const todayStr = getTodayDateString();
  const opponentName = activePlayer === 'Gabriel' ? 'Alessandra' : 'Gabriel';
  const myVersusScores = activePlayer === 'Gabriel' ? gabrielVersusScores : alessandraVersusScores;
  const opponentVersusScores = activePlayer === 'Gabriel' ? alessandraVersusScores : gabrielVersusScores;
  const currentRoundName = activeMode === 1 ? 'Termo' : activeMode === 2 ? 'Dueto' : 'Quarteto';
  const currentRoundScore = activeMode === 1 ? myVersusScores.termo : activeMode === 2 ? myVersusScores.dueto : myVersusScores.quarteto;

  // Initialize DB and load initial data
  useEffect(() => {
    initLocalStorage();
    const current = getActivePlayer();
    setActivePlayerState(current as 'Gabriel' | 'Alessandra' | 'Ambos');
    syncSupabaseData().finally(() => {
      startupCheckJobs();
      loadDashboardData(current as 'Gabriel' | 'Alessandra' | 'Ambos');
    });

    // Easter Egg: Disabled auto-mock versus invite pop-up to allow pure real-time versus matches
  }, [view]);

  // Load validation words of active length
  useEffect(() => {
    if (targetWords.length > 0) {
      const len = targetWords[0].length;
      ensureWordsLoaded(len).catch(err => {
        console.error("Failed to load validation words of length " + len, err);
      });
    }
  }, [targetWords]);

  const gabrielVersusScoresRef = useRef(gabrielVersusScores);
  const alessandraVersusScoresRef = useRef(alessandraVersusScores);

  useEffect(() => {
    gabrielVersusScoresRef.current = gabrielVersusScores;
  }, [gabrielVersusScores]);

  useEffect(() => {
    alessandraVersusScoresRef.current = alessandraVersusScores;
  }, [alessandraVersusScores]);

  // Supabase Realtime Lobby and Multiplayer Channel
  useEffect(() => {
    if (activePlayer === 'Ambos') {
      return;
    }

    const opponent = activePlayer === 'Gabriel' ? 'Alessandra' : 'Gabriel';

    const channel = supabase.channel('versus-lobby', {
      config: {
        presence: {
          key: activePlayer,
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const users = Object.keys(state);
        setOnlineUsers(users);
      })
      .on('broadcast', { event: 'invite' }, (payload) => {
        const { to } = payload.payload;
        if (to === activePlayer) {
          // Received invite from 'from'
          setVersusInviteVisible(true);
        }
      })
      .on('broadcast', { event: 'accept' }, (payload) => {
        const { to } = payload.payload;
        if (to === activePlayer) {
          // Opponent accepted invite!
          setVersusOpponentType('real');
          setWaitingForOpponent(false);
          setLobbyStep('countdown');
          setCountdownVal(3);
          startCountdown();
        }
      })
      .on('broadcast', { event: 'decline' }, (payload) => {
        const { from, to } = payload.payload;
        if (to === activePlayer) {
          setWaitingForOpponent(false);
          setVersusInviteVisible(false);
          if (viewRef.current === 'lobby') {
            alert(`${from} cancelou o convite.`);
            setView('dashboard');
          } else {
            alert(`${from} recusou o seu convite.`);
            setView('dashboard');
          }
        }
      })
      .on('broadcast', { event: 'game-update' }, (payload) => {
        const { from, data } = payload.payload;
        if (from === opponent) {
          // Update local opponent scores first so they are correct in recap
          if (opponent === 'Gabriel') {
            setGabrielVersusScores(prev => {
              const updated = { ...prev };
              if (data.termoScore !== undefined) updated.termo = data.termoScore;
              if (data.duetoScore !== undefined) updated.dueto = data.duetoScore;
              if (data.quartetoScore !== undefined) updated.quarteto = data.quartetoScore;
              if (data.gabrielScoreUpdate) {
                const { game, score } = data.gabrielScoreUpdate;
                if (game === 'bomb') updated.bomb = score;
                if (game === 'crossword') updated.crossword = score;
                if (game === 'blitz') updated.blitz = score;
              }
              updated.total = updated.termo + updated.dueto + updated.quarteto + (updated.bomb || 0) + (updated.crossword || 0) + (updated.blitz || 0);

              const aScores = alessandraVersusScoresRef.current;
              const finalizedVersus: VersusResult = {
                date: todayStr,
                gabrielTermo: updated.termo,
                gabrielDueto: updated.dueto,
                gabrielQuarteto: updated.quarteto,
                gabrielBomb: updated.bomb,
                gabrielCrossword: updated.crossword,
                gabrielBlitz: updated.blitz,
                gabrielTotal: updated.total,
                alessandraTermo: aScores.termo,
                alessandraDueto: aScores.dueto,
                alessandraQuarteto: aScores.quarteto,
                alessandraBomb: aScores.bomb,
                alessandraCrossword: aScores.crossword,
                alessandraBlitz: aScores.blitz,
                alessandraTotal: aScores.total,
                winner: updated.total > aScores.total ? 'Gabriel' : aScores.total > updated.total ? 'Alessandra' : 'Empate'
              };
              saveVersusMatch(finalizedVersus);
              setVersusMatchToday(finalizedVersus);
              setVersusHistory(getVersusHistory());
              return updated;
            });
          } else {
            setAlessandraVersusScores(prev => {
              const updated = { ...prev };
              if (data.termoScore !== undefined) updated.termo = data.termoScore;
              if (data.duetoScore !== undefined) updated.dueto = data.duetoScore;
              if (data.quartetoScore !== undefined) updated.quarteto = data.quartetoScore;
              if (data.alessandraScoreUpdate) {
                const { game, score } = data.alessandraScoreUpdate;
                if (game === 'bomb') updated.bomb = score;
                if (game === 'crossword') updated.crossword = score;
                if (game === 'blitz') updated.blitz = score;
              }
              updated.total = updated.termo + updated.dueto + updated.quarteto + (updated.bomb || 0) + (updated.crossword || 0) + (updated.blitz || 0);

              const gScores = gabrielVersusScoresRef.current;
              const finalizedVersus: VersusResult = {
                date: todayStr,
                gabrielTermo: gScores.termo,
                gabrielDueto: gScores.dueto,
                gabrielQuarteto: gScores.quarteto,
                gabrielBomb: gScores.bomb,
                gabrielCrossword: gScores.crossword,
                gabrielBlitz: gScores.blitz,
                gabrielTotal: gScores.total,
                alessandraTermo: updated.termo,
                alessandraDueto: updated.dueto,
                alessandraQuarteto: updated.quarteto,
                alessandraBomb: updated.bomb,
                alessandraCrossword: updated.crossword,
                alessandraBlitz: updated.blitz,
                alessandraTotal: updated.total,
                winner: gScores.total > updated.total ? 'Gabriel' : updated.total > gScores.total ? 'Alessandra' : 'Empate'
              };
              saveVersusMatch(finalizedVersus);
              setVersusMatchToday(finalizedVersus);
              setVersusHistory(getVersusHistory());
              return updated;
            });
          }

          setOppState(prev => {
            const nextTicker = [...prev.ticker];
            if (data.tickerMessage && !nextTicker.includes(data.tickerMessage)) {
              nextTicker.push(data.tickerMessage);
            }
            const gUpdate = opponent === 'Gabriel' ? data.gabrielScoreUpdate : data.alessandraScoreUpdate;
            return {
              ...prev,
              round: data.round !== undefined ? data.round : prev.round,
              guessesCount: data.guessesCount !== undefined ? data.guessesCount : prev.guessesCount,
              wordsSolved: data.wordsSolved !== undefined ? data.wordsSolved : prev.wordsSolved,
              progress: data.progress !== undefined ? data.progress : prev.progress,
              completed: data.completed !== undefined ? data.completed : prev.completed,
              termoScore: data.termoScore !== undefined ? data.termoScore : prev.termoScore,
              duetoScore: data.duetoScore !== undefined ? data.duetoScore : prev.duetoScore,
              quartetoScore: data.quartetoScore !== undefined ? data.quartetoScore : prev.quartetoScore,
              bombScore: gUpdate?.game === 'bomb' ? gUpdate.score : data.bombScore !== undefined ? data.bombScore : prev.bombScore,
              crosswordScore: gUpdate?.game === 'crossword' ? gUpdate.score : data.crosswordScore !== undefined ? data.crosswordScore : prev.crosswordScore,
              blitzScore: gUpdate?.game === 'blitz' ? gUpdate.score : data.blitzScore !== undefined ? data.blitzScore : prev.blitzScore,
              totalScore: data.totalScore !== undefined ? data.totalScore : (opponent === 'Gabriel' ? gabrielVersusScoresRef.current.total : alessandraVersusScoresRef.current.total),
              ticker: nextTicker
            };
          });
        }
      });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ player: activePlayer, status: 'online' });
      }
    });

    setMultiplayerChannel(channel);

    return () => {
      channel.unsubscribe();
    };
  }, [activePlayer]);

  // Helper to send game updates in real-time
  const broadcastGameUpdate = (guessesCountVal?: number, wordsSolvedVal?: number, completedVal?: boolean, extraData = {}) => {
    if (activePlayer === 'Ambos' || !multiplayerChannel) return;

    // Calculate progress (how many boards solved out of total)
    const solvedCount = wordsSolvedVal !== undefined ? wordsSolvedVal : solvedBoards.filter(Boolean).length;
    const guessesCount = guessesCountVal !== undefined ? guessesCountVal : guesses.length;
    const progressPercent = Math.round((solvedCount / activeMode) * 100);
    const completed = completedVal !== undefined ? completedVal : (solvedCount === activeMode);

    const opponent = activePlayer === 'Gabriel' ? 'Alessandra' : 'Gabriel';

    multiplayerChannel.send({
      type: 'broadcast',
      event: 'game-update',
      payload: {
        from: activePlayer,
        to: opponent,
        data: {
          round: versusRound,
          guessesCount: guessesCount,
          wordsSolved: solvedCount,
          progress: progressPercent,
          completed: completed,
          ...extraData
        }
      }
    });
  };

  const updateVersusScore = (game: 'termo' | 'dueto' | 'quarteto' | 'bomb' | 'crossword' | 'blitz', score: number) => {
    if (activePlayer === 'Ambos') return;

    const gScores = { ...gabrielVersusScoresRef.current };
    const aScores = { ...alessandraVersusScoresRef.current };

    if (activePlayer === 'Gabriel') {
      if (game === 'termo') gScores.termo = score;
      if (game === 'dueto') gScores.dueto = score;
      if (game === 'quarteto') gScores.quarteto = score;
      if (game === 'bomb') gScores.bomb = score;
      if (game === 'crossword') gScores.crossword = score;
      if (game === 'blitz') gScores.blitz = score;
      gScores.total = gScores.termo + gScores.dueto + gScores.quarteto + (gScores.bomb || 0) + (gScores.crossword || 0) + (gScores.blitz || 0);
      setGabrielVersusScores(gScores);
    } else {
      if (game === 'termo') aScores.termo = score;
      if (game === 'dueto') aScores.dueto = score;
      if (game === 'quarteto') aScores.quarteto = score;
      if (game === 'bomb') aScores.bomb = score;
      if (game === 'crossword') aScores.crossword = score;
      if (game === 'blitz') aScores.blitz = score;
      aScores.total = aScores.termo + aScores.dueto + aScores.quarteto + (aScores.bomb || 0) + (aScores.crossword || 0) + (aScores.blitz || 0);
      setAlessandraVersusScores(aScores);
    }

    const finalGabrielTotal = activePlayer === 'Gabriel' ? gScores.total : gabrielVersusScoresRef.current.total;
    const finalAlessandraTotal = activePlayer === 'Alessandra' ? aScores.total : alessandraVersusScoresRef.current.total;

    const winner = finalGabrielTotal > finalAlessandraTotal
      ? 'Gabriel'
      : finalAlessandraTotal > finalGabrielTotal
      ? 'Alessandra'
      : 'Empate';

    const finalizedVersus: VersusResult = {
      date: todayStr,
      gabrielTermo: activePlayer === 'Gabriel' ? gScores.termo : gabrielVersusScoresRef.current.termo,
      gabrielDueto: activePlayer === 'Gabriel' ? gScores.dueto : gabrielVersusScoresRef.current.dueto,
      gabrielQuarteto: activePlayer === 'Gabriel' ? gScores.quarteto : gabrielVersusScoresRef.current.quarteto,
      gabrielBomb: activePlayer === 'Gabriel' ? gScores.bomb : gabrielVersusScoresRef.current.bomb,
      gabrielCrossword: activePlayer === 'Gabriel' ? gScores.crossword : gabrielVersusScoresRef.current.crossword,
      gabrielBlitz: activePlayer === 'Gabriel' ? gScores.blitz : gabrielVersusScoresRef.current.blitz,
      gabrielTotal: finalGabrielTotal,
      alessandraTermo: activePlayer === 'Alessandra' ? aScores.termo : alessandraVersusScoresRef.current.termo,
      alessandraDueto: activePlayer === 'Alessandra' ? aScores.dueto : alessandraVersusScoresRef.current.dueto,
      alessandraQuarteto: activePlayer === 'Alessandra' ? aScores.quarteto : alessandraVersusScoresRef.current.quarteto,
      alessandraBomb: activePlayer === 'Alessandra' ? aScores.bomb : alessandraVersusScoresRef.current.bomb,
      alessandraCrossword: activePlayer === 'Alessandra' ? aScores.crossword : alessandraVersusScoresRef.current.crossword,
      alessandraBlitz: activePlayer === 'Alessandra' ? aScores.blitz : alessandraVersusScoresRef.current.blitz,
      alessandraTotal: finalAlessandraTotal,
      winner: winner
    };

    saveVersusMatch(finalizedVersus);
    setVersusMatchToday(finalizedVersus);
    setVersusHistory(getVersusHistory());

    if (versusOpponentType === 'real' && multiplayerChannel) {
      multiplayerChannel.send({
        type: 'broadcast',
        event: 'game-update',
        payload: {
          from: activePlayer,
          to: activePlayer === 'Gabriel' ? 'Alessandra' : 'Gabriel',
          data: {
            [`${activePlayer.toLowerCase()}ScoreUpdate`]: {
              game,
              score
            }
          }
        }
      });
    }
  };

  const startCountdown = () => {
    let counter = 3;
    const countInt = setInterval(() => {
      counter--;
      setCountdownVal(counter);
      if (counter === 0) {
        clearInterval(countInt);
        launchVersusMatch();
      }
    }, 1000);
  };

  // Ticker for countdown until next day
  useEffect(() => {
    if (view !== 'dashboard') return;

    const updateTimer = () => {
      const now = new Date();
      const midnight = new Date();
      midnight.setHours(24, 0, 0, 0);
      const diffMs = midnight.getTime() - now.getTime();

      const hours = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));
      const minutes = Math.max(0, Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60)));
      const seconds = Math.max(0, Math.floor((diffMs % (1000 * 60)) / 1000));

      const pad = (n: number) => n.toString().padStart(2, '0');
      setTimeUntilMidnight(`${pad(hours)}:${pad(minutes)}:${pad(seconds)}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [view]);


  const loadDashboardData = async (playerName: 'Gabriel' | 'Alessandra' | 'Ambos') => {
    setLoading(true);
    try {
      const challenge = await getChallengeForDate(todayStr);
      setTodayChallenge(challenge);

      // Load active player/Ambos details
      const result = getPlayerResultForDate(playerName, todayStr);
      setTodayResult(result);
      setBombResultToday(getSpecialResultForDate(playerName, todayStr, 'bomb'));
      setCrosswordResultToday(getSpecialResultForDate(playerName, todayStr, 'crossword'));
      setBlitzResultToday(getSpecialResultForDate(playerName, todayStr, 'blitz'));

      const stats = getPlayerStats(playerName);
      setPlayerStats(stats);

      if (playerName !== 'Ambos') {
        const vMatch = getVersusMatchForDate(todayStr);
        setVersusMatchToday(vMatch);

        if (vMatch) {
          setGabrielVersusScores({
            termo: vMatch.gabrielTermo || 0,
            dueto: vMatch.gabrielDueto || 0,
            quarteto: vMatch.gabrielQuarteto || 0,
            bomb: vMatch.gabrielBomb || 0,
            crossword: vMatch.gabrielCrossword || 0,
            blitz: vMatch.gabrielBlitz || 0,
            total: vMatch.gabrielTotal || 0
          });
          setAlessandraVersusScores({
            termo: vMatch.alessandraTermo || 0,
            dueto: vMatch.alessandraDueto || 0,
            quarteto: vMatch.alessandraQuarteto || 0,
            bomb: vMatch.alessandraBomb || 0,
            crossword: vMatch.alessandraCrossword || 0,
            blitz: vMatch.alessandraBlitz || 0,
            total: vMatch.alessandraTotal || 0
          });

          // Sync opponent state from saved match
          const oppName = playerName === 'Gabriel' ? 'Alessandra' : 'Gabriel';
          const oppTermo = oppName === 'Gabriel' ? vMatch.gabrielTermo : vMatch.alessandraTermo;
          const oppDueto = oppName === 'Gabriel' ? vMatch.gabrielDueto : vMatch.alessandraDueto;
          const oppQuarteto = oppName === 'Gabriel' ? vMatch.gabrielQuarteto : vMatch.alessandraQuarteto;
          const oppBomb = oppName === 'Gabriel' ? (vMatch.gabrielBomb || 0) : (vMatch.alessandraBomb || 0);
          const oppCrossword = oppName === 'Gabriel' ? (vMatch.gabrielCrossword || 0) : (vMatch.alessandraCrossword || 0);
          const oppBlitz = oppName === 'Gabriel' ? (vMatch.gabrielBlitz || 0) : (vMatch.alessandraBlitz || 0);
          const oppTotal = oppName === 'Gabriel' ? vMatch.gabrielTotal : vMatch.alessandraTotal;
          let oppRound = 1;
          let oppCompleted = false;
          if (oppQuarteto > 0) {
            oppRound = 4;
            oppCompleted = true;
          } else if (oppDueto > 0) {
            oppRound = 3;
          } else if (oppTermo > 0) {
            oppRound = 2;
          }

          setOppState(prev => ({
            ...prev,
            round: oppRound,
            completed: oppCompleted,
            termoScore: oppTermo,
            duetoScore: oppDueto,
            quartetoScore: oppQuarteto,
            bombScore: oppBomb,
            crosswordScore: oppCrossword,
            blitzScore: oppBlitz,
            totalScore: oppTotal
          }));
        } else {
          setGabrielVersusScores({ termo: 0, dueto: 0, quarteto: 0, bomb: 0, crossword: 0, blitz: 0, total: 0 });
          setAlessandraVersusScores({ termo: 0, dueto: 0, quarteto: 0, bomb: 0, crossword: 0, blitz: 0, total: 0 });
          setOppState(prev => ({
            ...prev,
            round: 1,
            completed: false,
            termoScore: 0,
            duetoScore: 0,
            quartetoScore: 0,
            bombScore: 0,
            crosswordScore: 0,
            blitzScore: 0,
            totalScore: 0,
            ticker: []
          }));
        }

        // Check if both completed today, and trigger confetti if active player matches today's winner
        const history = getDailyHistoryList();
        const todayHistory = history.find(h => h.date === todayStr);
        if (todayHistory && todayHistory.winner === playerName) {
          setTriggerConfetti(true);
          setTimeout(() => setTriggerConfetti(false), 6000);
        }
      } else {
        setVersusMatchToday(null);

        // Load Blitz details under 'Ambos' profile
        const bRecs = getBlitzRecords();
        setBlitzRecordsList(bRecs);

        const bHist = getBlitzHistory();
        setBlitzHistoryList(bHist);
      }

      setHistoryList(getDailyHistoryList());
      setH2hScore(getHeadToHeadScore());
      setVersusHistory(getVersusHistory());
    } catch (e) {
      console.error("Error loading dashboard data", e);
    } finally {
      setLoading(false);
    }
  };

  const loadAdminData = async () => {
    const jobs = JSON.parse(localStorage.getItem('termo_db_jobs') || '[]');
    const sorted = [...jobs].sort((a: any, b: any) => b.requestedAt.localeCompare(a.requestedAt));
    setGenerationJobs(sorted);

    const config = getDbConfig();
    setConfigThreshold(config.minLimitPercent);
    setConfigBatchSize(config.autoGenBatchSize);

    try {
      const remoteStats = await getDbStatsFromSupabase();
      const pendingJobsCount = jobs.filter((j: any) => j.status === 'Pending' || j.status === 'Processing').length;
      let lastJob = null;
      if (jobs.length > 0) {
        const sortedJobs = [...jobs].sort((a: any, b: any) => b.requestedAt.localeCompare(a.requestedAt));
        lastJob = sortedJobs[0];
      }

      setAdminStats({
        ...remoteStats,
        lastJob,
        pendingJobsCount,
        lowUsagePercent: remoteStats.total > 0 ? (remoteStats.neverUsed / remoteStats.total) * 100 : 0
      });
    } catch (err) {
      console.error("Failed to load admin stats:", err);
    }
  };

  useEffect(() => {
    if (view === 'admin') {
      loadAdminData();

      const interval = setInterval(() => {
        loadAdminData();
      }, 2500);

      return () => clearInterval(interval);
    }
  }, [view]);

  const handleTriggerGeneration = (wordsCount: number) => {
    createWordGenJob(wordsCount, false);
    loadAdminData();
  };

  const handleSaveConfig = () => {
    saveDbConfig({
      minLimitPercent: configThreshold,
      autoGenBatchSize: configBatchSize
    });
    alert('Configurações de reabastecimento salvas com sucesso!');
    loadAdminData();
  };

  // Switch player toggle handler
  const handlePlayerChange = (name: 'Gabriel' | 'Alessandra' | 'Ambos') => {
    setActivePlayer(name);
    setActivePlayerState(name);
    setTriggerConfetti(false);
    setVersusInviteVisible(false);
    loadDashboardData(name);
  };

  // Switch back to dashboard
  const handleBackToDashboard = () => {
    setView('dashboard');
    // Clear timers
    if (timerRef.current) clearInterval(timerRef.current);
    if (oppIntervalRef.current) clearInterval(oppIntervalRef.current);
    setTriggerConfetti(false);
    loadDashboardData(activePlayer);
  };

  // The guess size is the maximum length among all currently unsolved boards.
  // If all boards are solved, it defaults to the length of the first word.
  const getActiveGuessLen = () => {
    if (!targetWords || targetWords.length === 0) return 5;
    const unsolvedLengths = targetWords
      .filter((_, idx) => !solvedBoards[idx])
      .map(w => w.length);
    if (unsolvedLengths.length === 0) {
      return targetWords[0].length;
    }
    return Math.max(...unsolvedLengths);
  };

  const getWordsLengthsString = () => {
    if (!targetWords || targetWords.length === 0) return '';
    if (targetWords.length === 1) return `${targetWords[0].length} letras`;

    const lengths = targetWords.map(w => w.length);
    if (targetWords.length === 2) {
      return `${lengths[0]} e ${lengths[1]} letras`;
    }
    return `${lengths.slice(0, -1).join(', ')} e ${lengths[lengths.length - 1]} letras`;
  };

  // Dynamic attempts bounds: Quantidade de letras (tamanho máximo das palavras) + 1
  const maxAttempts = targetWords.length > 0
    ? Math.max(...targetWords.map(w => w.length)) + 1
    : 6;

  // Synchronize currentGuess with spaces when target words or guesses count changes
  useEffect(() => {
    if (view === 'playing') {
      const len = getActiveGuessLen();
      setCurrentGuess(' '.repeat(len));
      setFocusedCharIndex(0);
    }
  }, [targetWords, guesses.length, activeMode, view, gameModeType]);

  // Initiate daily challenge mode
  const handleStartGame = (mode: 1 | 2 | 4) => {
    if (!todayChallenge) return;

    let words: string[] = [];
    if (mode === 1) {
      words = [todayChallenge.words.mode1];
    } else if (mode === 2) {
      words = todayChallenge.words.mode2;
    } else {
      words = todayChallenge.words.mode4;
    }

    setGameModeType('daily');
    setActiveMode(mode);
    setTargetWords(words);
    setGuesses([]);
    setCurrentGuess('');
    setSolvedBoards(Array(mode).fill(false));
    setElapsedTime(0);
    setShowGameModal(false);
    setTriggerConfetti(false);
    setView('playing');

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);
  };

  const handleStartBomb = async () => {
    if (bombResultToday) return;

    const word = await getBombWordForDate(todayStr);
    setGameModeType('bomb');
    setActiveMode(1);
    setTargetWords([word]);
    setGuesses([]);
    setCurrentGuess('');
    setSolvedBoards([false]);
    setBombCharge(50);
    setBombLastDelta(0);
    setElapsedTime(0);
    setShowGameModal(false);
    setTriggerConfetti(false);
    setView('playing');

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);
  };

  const buildInitialCrosswordCells = (challenge: CrosswordChallenge) => {
    const cells: Record<string, string> = {};
    challenge.entries.forEach(entry => {
      for (let i = 0; i < entry.answer.length; i++) {
        const row = entry.direction === 'down' ? entry.row + i : entry.row;
        const col = entry.direction === 'across' ? entry.col + i : entry.col;
        cells[`${row}-${col}`] = '';
      }
    });
    return cells;
  };

  const handleStartCrossword = () => {
    if (crosswordResultToday) return;

    // In Versus mode, lock crossword difficulty to 'medio' and duration to 5 minutes
    const isVersus = activePlayer !== 'Ambos';
    const diff = isVersus ? 'medio' : crosswordConfigDifficulty;
    const dur = isVersus ? 5 : crosswordConfigDuration;

    const challenge = getCrosswordForDate(todayStr, diff, dur);
    setGameModeType('crossword');
    setCrosswordChallenge(challenge);
    setTargetWords(challenge.entries.map(entry => entry.answer));
    setCrosswordCells(buildInitialCrosswordCells(challenge));
    setCrosswordSelectedId(challenge.entries[0]?.id || '1A');
    setCrosswordSolvedIds([]);
    setCrosswordMessage('');
    setElapsedTime(0);
    setModalScore(0);
    setShowGameModal(false);
    setTriggerConfetti(false);
    setView('playing');

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);
  };

  const finishSpecialMode = (
    mode: 'bomb' | 'crossword',
    success: boolean,
    attempts: number,
    wordsSolved: number,
    detail: string,
    score: number
  ) => {
    if (timerRef.current) clearInterval(timerRef.current);

    const result: SpecialModeResult = {
      playerName: activePlayer,
      date: todayStr,
      mode,
      success,
      score,
      time: elapsedTime,
      attempts,
      wordsSolved,
      detail
    };

    saveSpecialModeResult(result);
    if (mode === 'bomb') setBombResultToday(result);
    if (mode === 'crossword') setCrosswordResultToday(result);

    if (activePlayer !== 'Ambos') {
      updateVersusScore(mode, score);

      if (versusOpponentType === 'bot') {
        const botScoreSim = mode === 'bomb' ? Math.round(70 + Math.random() * 35) : Math.round(90 + Math.random() * 45);
        const oppName = activePlayer === 'Gabriel' ? 'Alessandra' : 'Gabriel';
        setTimeout(() => {
          const vMatch = getVersusMatchForDate(todayStr);
          if (vMatch) {
            if (oppName === 'Gabriel') {
              if (mode === 'bomb') vMatch.gabrielBomb = botScoreSim;
              else vMatch.gabrielCrossword = botScoreSim;
              vMatch.gabrielTotal = (vMatch.gabrielTermo || 0) + (vMatch.gabrielDueto || 0) + (vMatch.gabrielQuarteto || 0) + (vMatch.gabrielBomb || 0) + (vMatch.gabrielCrossword || 0) + (vMatch.gabrielBlitz || 0);
            } else {
              if (mode === 'bomb') vMatch.alessandraBomb = botScoreSim;
              else vMatch.alessandraCrossword = botScoreSim;
              vMatch.alessandraTotal = (vMatch.alessandraTermo || 0) + (vMatch.alessandraDueto || 0) + (vMatch.alessandraQuarteto || 0) + (vMatch.alessandraBomb || 0) + (vMatch.alessandraCrossword || 0) + (vMatch.alessandraBlitz || 0);
            }
            vMatch.winner = vMatch.gabrielTotal > vMatch.alessandraTotal ? 'Gabriel' : vMatch.alessandraTotal > vMatch.gabrielTotal ? 'Alessandra' : 'Empate';
            saveVersusMatch(vMatch);
            setVersusMatchToday(vMatch);
            setVersusHistory(getVersusHistory());

            setOppState(prev => ({
              ...prev,
              bombScore: mode === 'bomb' ? botScoreSim : prev.bombScore,
              crosswordScore: mode === 'crossword' ? botScoreSim : prev.crosswordScore,
              totalScore: oppName === 'Gabriel' ? vMatch.gabrielTotal : vMatch.alessandraTotal
            }));
          }
        }, 1000);
      }
    }

    setModalSuccess(success);
    setModalScore(score);
    setModalAttempts(attempts);
    setModalTime(elapsedTime);
    setShowGameModal(true);

    if (success) {
      setTriggerConfetti(true);
    }
  };

  // Keyboards evaluation status across all boards
  const aggregatedLetterStatuses = () => {
    const statusMap: Record<string, 'correct' | 'present' | 'absent'> = {};

    targetWords.forEach((target) => {
      // Find the index of the guess that solved this board (if any)
      const solvedIdx = guesses.findIndex(g => g.slice(0, target.length) === target);
      // Only evaluate guesses up to the solving guess (inclusive)
      const relevantGuesses = solvedIdx !== -1 ? guesses.slice(0, solvedIdx + 1) : guesses;

      relevantGuesses.forEach((guess) => {
        const evaluation = getLetterStatuses(guess, target);
        for (let i = 0; i < evaluation.length; i++) {
          const char = guess[i];
          const status = evaluation[i];
          const currentBest = statusMap[char];

          if (status === 'correct') {
            statusMap[char] = 'correct';
          } else if (status === 'present' && currentBest !== 'correct') {
            statusMap[char] = 'present';
          } else if (status === 'absent' && !currentBest) {
            statusMap[char] = 'absent';
          }
        }
      });
    });

    return statusMap;
  };

  // Keyboard action helpers
  const handleCharInput = (char: string) => {
    const wordLen = getActiveGuessLen();
    if (guesses.length >= maxAttempts || showGameModal) return;

    const targetIdx = focusedCharIndex !== null ? focusedCharIndex : currentGuess.indexOf(' ');
    if (targetIdx !== -1 && targetIdx < wordLen) {
      setCurrentGuess(prev => {
        const letters = prev.split('');
        letters[targetIdx] = char;
        return letters.join('');
      });

      const nextIdx = targetIdx + 1;
      if (nextIdx < wordLen) {
        setFocusedCharIndex(nextIdx);
      } else {
        // If reached the end of the word, find first remaining empty (space) cell
        const letters = currentGuess.split('');
        letters[targetIdx] = char;
        const firstEmpty = letters.indexOf(' ');
        if (firstEmpty !== -1) {
          setFocusedCharIndex(firstEmpty);
        } else {
          setFocusedCharIndex(null);
        }
      }
    }
  };

  const handleDeleteInput = () => {
    const wordLen = getActiveGuessLen();
    if (showGameModal) return;

    const letters = currentGuess.split('');
    if (focusedCharIndex !== null) {
      if (letters[focusedCharIndex] !== ' ') {
        // Clear character in current cell
        letters[focusedCharIndex] = ' ';
        setCurrentGuess(letters.join(''));
      } else {
        // Cell is already empty, move focus back and clear previous cell
        if (focusedCharIndex > 0) {
          const prevIdx = focusedCharIndex - 1;
          letters[prevIdx] = ' ';
          setCurrentGuess(letters.join(''));
          setFocusedCharIndex(prevIdx);
        }
      }
    } else {
      // Find the last non-empty character to delete
      let deleteIdx = -1;
      for (let i = wordLen - 1; i >= 0; i--) {
        if (letters[i] !== ' ') {
          deleteIdx = i;
          break;
        }
      }
      if (deleteIdx !== -1) {
        letters[deleteIdx] = ' ';
        setCurrentGuess(letters.join(''));
        setFocusedCharIndex(deleteIdx);
      }
    }
  };

  const handleEnterInput = () => {
    const hasSpaces = currentGuess.includes(' ');
    if (hasSpaces) {
      // Trigger shake animation
      setShakeRowIndex(guesses.length);
      setTimeout(() => setShakeRowIndex(null), 500);
      return;
    }

    // Validate if the word is in the lexicon
    if (targetWords.length > 0) {
      const activeLength = targetWords[0].length;
      if (!validateWord(currentGuess, activeLength, targetWords)) {
        setShakeRowIndex(guesses.length);
        setTimeout(() => setShakeRowIndex(null), 500);
        showToast("Palavra não aceita");
        return;
      }
    }

    const nextGuesses = [...guesses, currentGuess];
    setGuesses(nextGuesses);
    setCurrentGuess('');

    if (gameModeType === 'bomb') {
      const target = targetWords[0];
      const evaluation = getLetterStatuses(currentGuess, target);
      const delta = evaluation.reduce((total, status) => {
        if (status === 'correct') return total - 8;
        if (status === 'present') return total + 6;
        return total + 12;
      }, 0);
      const nextCharge = Math.max(0, Math.min(100, bombCharge + delta));
      const success = currentGuess === target;
      const exploded = nextCharge >= 100;
      const runsOut = nextGuesses.length >= maxAttempts;

      setBombCharge(nextCharge);
      setBombLastDelta(delta);
      setSolvedBoards([success]);

      if (success || exploded || runsOut) {
        const finalCharge = success ? nextCharge : exploded ? 100 : nextCharge;
        const score = success ? Math.max(25, 180 - nextGuesses.length * 18 - finalCharge) : 0;
        finishSpecialMode(
          'bomb',
          success,
          nextGuesses.length,
          success ? 1 : 0,
          success ? `Carga final: ${finalCharge}%` : exploded ? 'A bomba chegou a 100%.' : `Carga final: ${finalCharge}%`,
          score
        );
      }
      return;
    }

    // Check newly solved boards (guesses are compared sliced to target word length)
    const nextSolved = targetWords.map((word) => {
      return nextGuesses.some(guess => guess.slice(0, word.length) === word);
    });
    setSolvedBoards(nextSolved);

    const allSolved = nextSolved.every(s => s === true);
    const runsOut = nextGuesses.length >= maxAttempts;

    // Real-time intermediate progress updates for versus mode
    if (gameModeType === 'versus' && versusOpponentType === 'real' && !(allSolved || runsOut)) {
      const newlySolvedCount = nextSolved.filter(Boolean).length;
      const prevSolvedCount = solvedBoards.filter(Boolean).length;
      let tickerMsg = `${formatTickerTime(elapsedTime)} - ${activePlayer} enviou palpite (${nextGuesses.length}/${maxAttempts})`;

      if (newlySolvedCount > prevSolvedCount) {
        const solvedIndex = nextSolved.findIndex((solved, idx) => solved && !solvedBoards[idx]);
        if (solvedIndex !== -1) {
          tickerMsg = `${formatTickerTime(elapsedTime)} - ${activePlayer} resolveu a Palavra ${solvedIndex + 1}!`;
        }
      }

      broadcastGameUpdate(
        nextGuesses.length,
        newlySolvedCount,
        false,
        {
          tickerMessage: tickerMsg
        }
      );
    }

    if (gameModeType !== 'blitz') {
      if (allSolved || runsOut) {
        // End daily/versus game
        if (timerRef.current) clearInterval(timerRef.current);

        const wordsSolved = nextSolved.filter(s => s === true).length;
        const success = allSolved;

        if (gameModeType === 'daily') {
          const updatedDailyResult = saveModeResult(
            activePlayer,
            todayStr,
            activeMode,
            nextGuesses.length,
            elapsedTime,
            success,
            wordsSolved
          );

          const score = updatedDailyResult[activeMode === 1 ? 'mode1' : activeMode === 2 ? 'mode2' : 'mode4']?.score || 0;

          setModalSuccess(success);
          setModalScore(score);
          setModalAttempts(nextGuesses.length);
          setModalTime(elapsedTime);
          setShowGameModal(true);

          if (success) {
            setTriggerConfetti(true);
          }
        } else {
          // Versus Round Ended
          const activeScore = calculateVersusScore(activeMode, nextGuesses.length, elapsedTime, success, wordsSolved);

          let updatedG = { ...gabrielVersusScores };
          let updatedA = { ...alessandraVersusScores };

          if (activePlayer === 'Gabriel') {
            if (activeMode === 1) updatedG.termo = activeScore;
            if (activeMode === 2) updatedG.dueto = activeScore;
            if (activeMode === 4) updatedG.quarteto = activeScore;
            updatedG.total = updatedG.termo + updatedG.dueto + updatedG.quarteto + (updatedG.bomb || 0) + (updatedG.crossword || 0) + (updatedG.blitz || 0);
          } else {
            if (activeMode === 1) updatedA.termo = activeScore;
            if (activeMode === 2) updatedA.dueto = activeScore;
            if (activeMode === 4) updatedA.quarteto = activeScore;
            updatedA.total = updatedA.termo + updatedA.dueto + updatedA.quarteto + (updatedA.bomb || 0) + (updatedA.crossword || 0) + (updatedA.blitz || 0);
          }

          if (oppIntervalRef.current) clearInterval(oppIntervalRef.current);

          if (versusOpponentType === 'bot') {
            const attemptsSim = activeMode === 1 ? 3 : activeMode === 2 ? 5 : 7;
            const timeSim = activeMode === 1 ? 35 : activeMode === 2 ? 75 : 145;
            const botScore = calculateVersusScore(activeMode, attemptsSim, timeSim, true, activeMode);

            if (opponentName === 'Gabriel') {
              if (activeMode === 1) updatedG.termo = botScore;
              if (activeMode === 2) updatedG.dueto = botScore;
              if (activeMode === 4) updatedG.quarteto = botScore;
              updatedG.total = updatedG.termo + updatedG.dueto + updatedG.quarteto + (updatedG.bomb || 0) + (updatedG.crossword || 0) + (updatedG.blitz || 0);
            } else {
              if (activeMode === 1) updatedA.termo = botScore;
              if (activeMode === 2) updatedA.dueto = botScore;
              if (activeMode === 4) updatedA.quarteto = botScore;
              updatedA.total = updatedA.termo + updatedA.dueto + updatedA.quarteto + (updatedA.bomb || 0) + (updatedA.crossword || 0) + (updatedA.blitz || 0);
            }
            resolveRemainingOpponent(activeMode);
          }

          setGabrielVersusScores(updatedG);
          setAlessandraVersusScores(updatedA);

          let matchWinner: 'Gabriel' | 'Alessandra' | 'Empate' = 'Empate';
          if (updatedG.total > updatedA.total) matchWinner = 'Gabriel';
          else if (updatedA.total > updatedG.total) matchWinner = 'Alessandra';

          const finalizedVersus: VersusResult = {
            date: todayStr,
            gabrielTermo: updatedG.termo,
            gabrielDueto: updatedG.dueto,
            gabrielQuarteto: updatedG.quarteto,
            gabrielBomb: updatedG.bomb,
            gabrielCrossword: updatedG.crossword,
            gabrielBlitz: updatedG.blitz,
            gabrielTotal: updatedG.total,
            alessandraTermo: updatedA.termo,
            alessandraDueto: updatedA.dueto,
            alessandraQuarteto: updatedA.quarteto,
            alessandraBomb: updatedA.bomb,
            alessandraCrossword: updatedA.crossword,
            alessandraBlitz: updatedA.blitz,
            alessandraTotal: updatedA.total,
            winner: matchWinner
          };
          saveVersusMatch(finalizedVersus);
          setVersusMatchToday(finalizedVersus);
          setVersusHistory(getVersusHistory());

          if (versusOpponentType === 'real') {
            let tickerMsg = '';
            if (success) {
              tickerMsg = `${formatTickerTime(elapsedTime)} - 🎉 ${activePlayer} resolveu o ${activeMode === 1 ? 'Termo' : activeMode === 2 ? 'Dueto' : 'Quarteto'} em ${nextGuesses.length} palpites!`;
            } else {
              tickerMsg = `${formatTickerTime(elapsedTime)} - 🏁 ${activePlayer} encerrou a rodada sem resolver tudo.`;
            }

            const scoreUpdate: any = {};
            if (activeMode === 1) scoreUpdate.termoScore = activeScore;
            if (activeMode === 2) scoreUpdate.duetoScore = activeScore;
            if (activeMode === 4) scoreUpdate.quartetoScore = activeScore;

            const myNewTotal = activePlayer === 'Gabriel' ? updatedG.total : updatedA.total;

            broadcastGameUpdate(
              nextGuesses.length,
              wordsSolved,
              true,
              {
                tickerMessage: tickerMsg,
                ...scoreUpdate,
                totalScore: myNewTotal
              }
            );
          }

          setModalSuccess(success);
          setModalScore(activeScore);
          setModalAttempts(nextGuesses.length);
          setModalTime(elapsedTime);
          setView('versus-recap');
        }
      }
    } else {
      // Blitz Mode specific play transitions
      if (allSolved) {
        // Word solved successfully!
        const solveSeconds = elapsedTime - blitzWordStartSeconds;
        const nextSolvedTimes = [...blitzSolvedTimesList, solveSeconds];
        setBlitzSolvedTimesList(nextSolvedTimes);

        const nextSolvedCount = blitzSolvedCount + 1;
        setBlitzSolvedCount(nextSolvedCount);

        const nextStreak = blitzCurrentStreak + 1;
        setBlitzCurrentStreak(nextStreak);
        if (nextStreak > blitzMaxStreak) {
          setBlitzMaxStreak(nextStreak);
        }

        setBlitzAttemptsCount(prev => prev + nextGuesses.length);

        // Transition instantly to next word
        moveToNextBlitzWord();
      } else if (runsOut) {
        // Failed this word
        setBlitzCurrentStreak(0);
        setBlitzAttemptsCount(prev => prev + maxAttempts);

        // Transition instantly to next word
        moveToNextBlitzWord();
      }
    }
  };

  // Keep state and handlers in refs to avoid rebuilding the keydown event listener unnecessarily
  const viewRef = useRef(view);
  const gameModeTypeRef = useRef(gameModeType);
  const handleCharInputRef = useRef(handleCharInput);
  const handleDeleteInputRef = useRef(handleDeleteInput);
  const handleEnterInputRef = useRef(handleEnterInput);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  useEffect(() => {
    gameModeTypeRef.current = gameModeType;
  }, [gameModeType]);

  useEffect(() => {
    handleCharInputRef.current = handleCharInput;
  }, [handleCharInput]);

  useEffect(() => {
    handleDeleteInputRef.current = handleDeleteInput;
  }, [handleDeleteInput]);

  useEffect(() => {
    handleEnterInputRef.current = handleEnterInput;
  }, [handleEnterInput]);

  // Auto-focus document body when entering gameplay to capture physical keyboard inputs immediately
  useEffect(() => {
    if (view === 'playing') {
      const timer = setTimeout(() => {
        if (boardInputRef.current) {
          boardInputRef.current.focus();
        } else {
          window.focus();
          document.body.focus();
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [view]);

  // Listen to physical keyboard events globally when playing
  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      // Ignore key events when user is typing in form inputs/textarea,
      // but allow our hidden board input to continue working.
      const target = event.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        if (target !== boardInputRef.current) {
          return;
        }
      }

      console.log('Teclado físico detectado:', event.key, 'view:', viewRef.current, 'mode:', gameModeTypeRef.current);

      if (viewRef.current !== 'playing') return;
      if (gameModeTypeRef.current === 'crossword') return;

      // Ignore keyboard shortcuts using modifier keys (Ctrl, Alt, Command)
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      const key = event.key.toUpperCase();

      if (key === 'ENTER') {
        event.preventDefault();
        handleEnterInputRef.current();
      } else if (key === 'BACKSPACE') {
        event.preventDefault();
        handleDeleteInputRef.current();
      } else if (/^[A-Z]$/.test(key)) {
        event.preventDefault();
        handleCharInputRef.current(key);
      }
    };

    // Listen on document level to ensure it captures events even if window loses focus state
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Blitz: Go to next word instantly
  const moveToNextBlitzWord = async () => {
    const nextIdx = blitzCurrentWordIdx + 1;
    setBlitzCurrentWordIdx(nextIdx);
    setBlitzWordStartSeconds(elapsedTime);

    const nextWord = blitzWordPoolList[nextIdx];
    if (nextWord) {
      setTargetWords([nextWord]);
      setGuesses([]);
      setCurrentGuess('');
      setSolvedBoards([false]);
    } else {
      // Out of words in pool (rare) - reload pool
      const freshPool = await getBlitzWordPool();
      setBlitzWordPoolList(freshPool);
      setBlitzCurrentWordIdx(0);
      setTargetWords([freshPool[0]]);
      setGuesses([]);
      setCurrentGuess('');
      setSolvedBoards([false]);
    }
  };

  const calculateVersusScore = (mode: 1 | 2 | 4, attempts: number, time: number, success: boolean, solvedCount: number) => {
    // Improved Versus scoring:
    // - Fast, accurate solves earn more points
    // - Higher modes are worth more
    // - Failed rounds still give partial points based on progress
    const maxScore = mode === 1 ? 120 : mode === 2 ? 260 : 520;
    const minScore = mode === 1 ? 20 : mode === 2 ? 40 : 80;
    const attemptPenalty = (attempts - 1) * (mode === 1 ? 10 : mode === 2 ? 14 : 18);
    const timePenalty = Math.min(
      mode === 1 ? 40 : mode === 2 ? 50 : 70,
      Math.round(time / (mode === 1 ? 6 : mode === 2 ? 5 : 4))
    );

    if (!success) {
      const failBase = mode === 1 ? 18 : mode === 2 ? 40 : 80;
      const perWord = mode === 1 ? 24 : mode === 2 ? 42 : 60;
      return Math.min(
        mode === 1 ? 50 : mode === 2 ? 110 : 220,
        failBase + perWord * solvedCount
      );
    }

    const rawScore = Math.round(maxScore - attemptPenalty - timePenalty);
    return Math.max(minScore, rawScore);
  };

  // Auto-resolve opponent simulation in case player finishes early
  const resolveRemainingOpponent = (mode: 1 | 2 | 4): OpponentState => {
    let finalState = { ...oppState };
    if (!finalState.completed && finalState.round === (mode === 1 ? 1 : mode === 2 ? 2 : 3)) {
      const attemptsSim = mode === 1 ? 3 : mode === 2 ? 5 : 7;
      const timeSim = mode === 1 ? 35 : mode === 2 ? 75 : 145;
      const roundScore = calculateVersusScore(mode, attemptsSim, timeSim, true, mode);

      if (opponentName === 'Gabriel') {
        const nextScores = { ...gabrielVersusScores };
        if (mode === 1) nextScores.termo = roundScore;
        if (mode === 2) nextScores.dueto = roundScore;
        if (mode === 4) nextScores.quarteto = roundScore;
        nextScores.total = nextScores.termo + nextScores.dueto + nextScores.quarteto + (nextScores.bomb || 0) + (nextScores.crossword || 0) + (nextScores.blitz || 0);
        setGabrielVersusScores(nextScores);
      } else {
        const nextScores = { ...alessandraVersusScores };
        if (mode === 1) nextScores.termo = roundScore;
        if (mode === 2) nextScores.dueto = roundScore;
        if (mode === 4) nextScores.quarteto = roundScore;
        nextScores.total = nextScores.termo + nextScores.dueto + nextScores.quarteto + (nextScores.bomb || 0) + (nextScores.crossword || 0) + (nextScores.blitz || 0);
        setAlessandraVersusScores(nextScores);
      }

      if (mode === 1) {
        finalState.termoScore = roundScore;
        finalState.round = 2;
      } else if (mode === 2) {
        finalState.duetoScore = roundScore;
        finalState.round = 3;
      } else {
        finalState.quartetoScore = roundScore;
        finalState.round = 4;
        finalState.completed = true;
      }
      finalState.progress = 100;
      finalState.ticker = [...finalState.ticker, `${formatTickerTime(timeSim)} - ${opponentName} resolveu com ${attemptsSim} palpites!`];
      setOppState(finalState);
    }
    return finalState;
  };

  const formatTickerTime = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `[${min}:${sec.toString().padStart(2, '0')}]`;
  };

  // Versus Invite triggers
  const handleAcceptInvite = () => {
    setVersusInviteVisible(false);
    setVersusOpponentType('real');
    if (multiplayerChannel) {
      multiplayerChannel.send({
        type: 'broadcast',
        event: 'accept',
        payload: { from: activePlayer, to: opponentName }
      });
    }
    setLobbyStep('countdown');
    setCountdownVal(3);
    setView('lobby');
    startCountdown();
  };

  const handleDeclineInvite = () => {
    setVersusInviteVisible(false);
    if (multiplayerChannel) {
      multiplayerChannel.send({
        type: 'broadcast',
        event: 'decline',
        payload: { from: activePlayer, to: opponentName }
      });
    }
  };

  const declareWO = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (oppIntervalRef.current) clearInterval(oppIntervalRef.current);
    if (woTimerRef.current) clearInterval(woTimerRef.current);
    woTimerRef.current = null;
    setWoRemainingTime(null);

    const gScores = gabrielVersusScoresRef.current;
    const aScores = alessandraVersusScoresRef.current;

    const finalizedVersus: VersusResult = {
      date: todayStr,
      gabrielTermo: gScores.termo,
      gabrielDueto: gScores.dueto,
      gabrielQuarteto: gScores.quarteto,
      gabrielBomb: gScores.bomb,
      gabrielCrossword: gScores.crossword,
      gabrielBlitz: gScores.blitz,
      gabrielTotal: gScores.termo + gScores.dueto + gScores.quarteto + (gScores.bomb || 0) + (gScores.crossword || 0) + (gScores.blitz || 0),
      alessandraTermo: aScores.termo,
      alessandraDueto: aScores.dueto,
      alessandraQuarteto: aScores.quarteto,
      alessandraBomb: aScores.bomb,
      alessandraCrossword: aScores.crossword,
      alessandraBlitz: aScores.blitz,
      alessandraTotal: aScores.termo + aScores.dueto + aScores.quarteto + (aScores.bomb || 0) + (aScores.crossword || 0) + (aScores.blitz || 0),
      winner: activePlayer === 'Gabriel' ? 'Gabriel' : activePlayer === 'Alessandra' ? 'Alessandra' : 'Empate'
    };

    saveVersusMatch(finalizedVersus);
    setVersusMatchToday(finalizedVersus);
    setVersusHistory(getVersusHistory());

    alert(`O oponente ficou offline por mais de 5 minutos. Vitória por W.O. para você! 🏆`);
    setView('versus-end');
  };

  useEffect(() => {
    if (gameModeType !== 'versus' || versusOpponentType !== 'real') {
      return;
    }

    const isActiveGame = view === 'playing' || view === 'versus-recap';
    const isOpponentOnline = onlineUsers.includes(opponentName);
    const isOpponentFinished = oppState.completed;

    if (isActiveGame && !isOpponentFinished) {
      if (isOpponentOnline) {
        // Opponent is back online, clear timer
        if (woTimerRef.current) {
          clearInterval(woTimerRef.current);
          woTimerRef.current = null;
          setWoRemainingTime(null);
        }
      } else {
        // Opponent is offline, start 5 min timer if not already running
        if (!woTimerRef.current) {
          setWoRemainingTime(300);
          let secondsLeft = 300;
          woTimerRef.current = setInterval(() => {
            secondsLeft--;
            setWoRemainingTime(secondsLeft);
            if (secondsLeft <= 0) {
              clearInterval(woTimerRef.current);
              woTimerRef.current = null;
              setWoRemainingTime(null);
              declareWO();
            }
          }, 1000);
        }
      }
    } else {
      // Game ended or not in active state, clear timer
      if (woTimerRef.current) {
        clearInterval(woTimerRef.current);
        woTimerRef.current = null;
        setWoRemainingTime(null);
      }
    }

    return () => {
      if (woTimerRef.current) {
        clearInterval(woTimerRef.current);
      }
    };
  }, [onlineUsers, view, gameModeType, versusOpponentType, opponentName, oppState.completed]);

  // Initiate Versus Lobby connection
  const startVersusFlow = () => {
    setView('lobby');
    setCountdownVal(3);

    const opponentOnline = onlineUsers.includes(opponentName);

    if (opponentOnline && multiplayerChannel) {
      // Online mode: Send invite and wait for opponent to accept
      setVersusOpponentType('real');
      setLobbyStep('connecting');
      setWaitingForOpponent(true);

      multiplayerChannel.send({
        type: 'broadcast',
        event: 'invite',
        payload: { from: activePlayer, to: opponentName }
      });
    } else {
      // Offline mode (Bot simulation fallback)
      setVersusOpponentType('bot');
      setLobbyStep('connecting');
      setWaitingForOpponent(false);

      // Simulate connecting to the bot/offline opponent after 1.5s
      setTimeout(() => {
        setLobbyStep('ready');
        setTimeout(() => {
          setLobbyStep('countdown');
          let counter = 3;
          const countInt = setInterval(() => {
            counter--;
            setCountdownVal(counter);
            if (counter === 0) {
              clearInterval(countInt);
              launchVersusMatch();
            }
          }, 1000);
        }, 1500);
      }, 1500);
    }
  };

  // Generate Versus exclusive words
  const launchVersusMatch = async () => {
    const vWords = await getVersusWordsForDate(todayStr);
    setVersusWords(vWords);

    const vMatch = getVersusMatchForDate(todayStr);
    let startRound: 1 | 2 | 3 = 1;

    if (vMatch) {
      setGabrielVersusScores({
        termo: vMatch.gabrielTermo,
        dueto: vMatch.gabrielDueto,
        quarteto: vMatch.gabrielQuarteto,
        bomb: vMatch.gabrielBomb || 0,
        crossword: vMatch.gabrielCrossword || 0,
        blitz: vMatch.gabrielBlitz || 0,
        total: vMatch.gabrielTotal
      });
      setAlessandraVersusScores({
        termo: vMatch.alessandraTermo,
        dueto: vMatch.alessandraDueto,
        quarteto: vMatch.alessandraQuarteto,
        bomb: vMatch.alessandraBomb || 0,
        crossword: vMatch.alessandraCrossword || 0,
        blitz: vMatch.alessandraBlitz || 0,
        total: vMatch.alessandraTotal
      });

      // Determine what round the active player should start from
      const activeScores = activePlayer === 'Gabriel' ?
        { termo: vMatch.gabrielTermo, dueto: vMatch.gabrielDueto, quarteto: vMatch.gabrielQuarteto } :
        { termo: vMatch.alessandraTermo, dueto: vMatch.alessandraDueto, quarteto: vMatch.alessandraQuarteto };

      if (activeScores.quarteto > 0) {
        // Player already finished everything, show recap
        setVersusRound(3);
        setView('versus-recap');
        return;
      } else if (activeScores.dueto > 0) {
        startRound = 3;
      } else if (activeScores.termo > 0) {
        startRound = 2;
      }
    } else {
      setGabrielVersusScores({ termo: 0, dueto: 0, quarteto: 0, bomb: 0, crossword: 0, blitz: 0, total: 0 });
      setAlessandraVersusScores({ termo: 0, dueto: 0, quarteto: 0, bomb: 0, crossword: 0, blitz: 0, total: 0 });
    }

    setVersusRound(startRound);
    startVersusRound(startRound, vWords);
  };

  const startVersusRound = (round: 1 | 2 | 3, wordsPack: any) => {
    let mode: 1 | 2 | 4 = 1;
    let targets: string[] = [];

    if (round === 1) {
      mode = 1;
      targets = [wordsPack.mode1];
    } else if (round === 2) {
      mode = 2;
      targets = wordsPack.mode2;
    } else {
      mode = 4;
      targets = wordsPack.mode4;
    }

    setGameModeType('versus');
    setActiveMode(mode);
    setTargetWords(targets);
    setGuesses([]);
    setCurrentGuess('');
    setSolvedBoards(Array(mode).fill(false));
    setElapsedTime(0);
    setShowGameModal(false);
    setView('playing');

    setOppState(prev => {
      // Preserve opponent scores from today's saved match if available
      const vMatch = getVersusMatchForDate(todayStr);
      let oppTermo = 0;
      let oppDueto = 0;
      let oppQuarteto = 0;
      let oppTotal = 0;
      let oppCompleted = false;
      let oppRound = 1;

      if (vMatch) {
        if (opponentName === 'Gabriel') {
          oppTermo = vMatch.gabrielTermo;
          oppDueto = vMatch.gabrielDueto;
          oppQuarteto = vMatch.gabrielQuarteto;
          oppTotal = vMatch.gabrielTotal;
        } else {
          oppTermo = vMatch.alessandraTermo;
          oppDueto = vMatch.alessandraDueto;
          oppQuarteto = vMatch.alessandraQuarteto;
          oppTotal = vMatch.alessandraTotal;
        }
        if (oppQuarteto > 0) {
          oppCompleted = true;
          oppRound = 4;
        } else if (oppDueto > 0) {
          oppRound = 3;
        } else if (oppTermo > 0) {
          oppRound = 2;
        }
      }

      return {
        ...prev,
        round: versusOpponentType === 'bot' ? round : oppRound,
        elapsedTime: 0,
        guessesCount: 0,
        wordsSolved: 0,
        progress: 0,
        completed: versusOpponentType === 'bot' ? false : oppCompleted,
        termoScore: oppTermo,
        duetoScore: oppDueto,
        quartetoScore: oppQuarteto,
        totalScore: oppTotal,
        ticker: [`[0:00] - ${opponentName} iniciou a rodada!`]
      };
    });

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);

    // Opponent simulation interval
    if (oppIntervalRef.current) clearInterval(oppIntervalRef.current);
    if (versusOpponentType === 'bot') {
      oppIntervalRef.current = setInterval(() => {
        setOppState(prev => {
          const nextTime = prev.elapsedTime + 1;
          let nextGuessesCount = prev.guessesCount;
          let nextWordsSolved = prev.wordsSolved;
          let nextProgress = prev.progress;
          let nextTicker = [...prev.ticker];
          let nextRound = prev.round;
          let nextTermoScore = prev.termoScore;
          let nextDuetoScore = prev.duetoScore;
          let nextQuartetoScore = prev.quartetoScore;
          let nextCompleted = prev.completed;

          if (round === 1) {
            if (nextTime === 10) {
              nextGuessesCount = 1;
              nextProgress = 25;
              nextTicker.push(`${formatTickerTime(nextTime)} - ${opponentName} enviou palpite (1/6)`);
            } else if (nextTime === 22) {
              nextGuessesCount = 2;
              nextProgress = 50;
              nextTicker.push(`${formatTickerTime(nextTime)} - ${opponentName} enviou palpite (2/6)`);
            } else if (nextTime === 35) {
              nextGuessesCount = 3;
              nextProgress = 75;
              nextTicker.push(`${formatTickerTime(nextTime)} - ${opponentName} enviou palpite (3/6)`);
            } else if (nextTime === 45) {
              nextGuessesCount = 4;
              nextWordsSolved = 1;
              nextProgress = 100;
              const roundScore = calculateVersusScore(1, 4, 45, true, 1);
              nextTermoScore = roundScore;

              if (opponentName === 'Gabriel') {
                setGabrielVersusScores(s => ({ ...s, termo: roundScore, total: s.total + roundScore }));
              } else {
                setAlessandraVersusScores(s => ({ ...s, termo: roundScore, total: s.total + roundScore }));
              }

              nextTicker.push(`${formatTickerTime(nextTime)} - 🎉 ${opponentName} resolveu o Termo em 4 palpites!`);
              nextRound = 2;
            }
          } else if (round === 2) {
            if (nextTime === 12) {
              nextGuessesCount = 1;
              nextProgress = 20;
              nextTicker.push(`${formatTickerTime(nextTime)} - ${opponentName} enviou palpite (1/7)`);
            } else if (nextTime === 25) {
              nextGuessesCount = 2;
              nextProgress = 40;
              nextTicker.push(`${formatTickerTime(nextTime)} - ${opponentName} enviou palpite (2/7)`);
            } else if (nextTime === 42) {
              nextGuessesCount = 3;
              nextWordsSolved = 1;
              nextProgress = 60;
              nextTicker.push(`${formatTickerTime(nextTime)} - ${opponentName} resolveu a Palavra 1!`);
            } else if (nextTime === 60) {
              nextGuessesCount = 4;
              nextProgress = 80;
              nextTicker.push(`${formatTickerTime(nextTime)} - ${opponentName} enviou palpite (4/7)`);
            } else if (nextTime === 75) {
              nextGuessesCount = 5;
              nextWordsSolved = 2;
              nextProgress = 100;
              const roundScore = calculateVersusScore(2, 5, 75, true, 2);
              nextDuetoScore = roundScore;

              if (opponentName === 'Gabriel') {
                setGabrielVersusScores(s => ({ ...s, dueto: roundScore, total: s.total + roundScore }));
              } else {
                setAlessandraVersusScores(s => ({ ...s, dueto: roundScore, total: s.total + roundScore }));
              }

              nextTicker.push(`${formatTickerTime(nextTime)} - 🎉 ${opponentName} resolveu o Dueto com 5 palpites!`);
              nextRound = 3;
            }
          } else if (round === 3) {
            if (nextTime === 15) {
              nextGuessesCount = 1;
              nextProgress = 15;
              nextTicker.push(`${formatTickerTime(nextTime)} - ${opponentName} enviou palpite (1/9)`);
            } else if (nextTime === 32) {
              nextGuessesCount = 2;
              nextWordsSolved = 1;
              nextProgress = 30;
              nextTicker.push(`${formatTickerTime(nextTime)} - ${opponentName} resolveu a Palavra 1!`);
            } else if (nextTime === 55) {
              nextGuessesCount = 3;
              nextProgress = 45;
              nextTicker.push(`${formatTickerTime(nextTime)} - ${opponentName} enviou palpite (3/9)`);
            } else if (nextTime === 75) {
              nextGuessesCount = 4;
              nextWordsSolved = 2;
              nextProgress = 60;
              nextTicker.push(`${formatTickerTime(nextTime)} - ${opponentName} resolveu a Palavra 2!`);
            } else if (nextTime === 105) {
              nextGuessesCount = 5;
              nextProgress = 75;
              nextTicker.push(`${formatTickerTime(nextTime)} - ${opponentName} enviou palpite (5/9)`);
            } else if (nextTime === 125) {
              nextGuessesCount = 6;
              nextWordsSolved = 3;
              nextProgress = 85;
              nextTicker.push(`${formatTickerTime(nextTime)} - ${opponentName} resolveu a Palavra 3!`);
            } else if (nextTime === 145) {
              nextGuessesCount = 7;
              nextWordsSolved = 4;
              nextProgress = 100;
              const roundScore = calculateVersusScore(4, 7, 145, true, 4);
              nextQuartetoScore = roundScore;
              nextCompleted = true;

              if (opponentName === 'Gabriel') {
                setGabrielVersusScores(s => ({ ...s, quarteto: roundScore, total: s.total + roundScore }));
              } else {
                setAlessandraVersusScores(s => ({ ...s, quarteto: roundScore, total: s.total + roundScore }));
              }

              nextTicker.push(`${formatTickerTime(nextTime)} - 🏁 ${opponentName} completou o Quarteto!`);
              nextRound = 4;
            }
          }

          return {
            ...prev,
            elapsedTime: nextTime,
            guessesCount: nextGuessesCount,
            wordsSolved: nextWordsSolved,
            progress: nextProgress,
            ticker: nextTicker,
            round: nextRound,
            termoScore: nextTermoScore,
            duetoScore: nextDuetoScore,
            quartetoScore: nextQuartetoScore,
            completed: nextCompleted
          };
        });
      }, 1000);
    }

    if (versusOpponentType === 'real') {
      broadcastGameUpdate(
        0, // guessesCount
        0, // wordsSolved
        false, // completed
        {
          tickerMessage: `[0:00] - ${activePlayer} iniciou a rodada!`
        }
      );
    }
  };

  const handleNextVersusRound = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (oppIntervalRef.current) clearInterval(oppIntervalRef.current);

    if (versusRound === 1) {
      setVersusRound(2);
      startVersusRound(2, versusWords);
    } else if (versusRound === 2) {
      setVersusRound(3);
      startVersusRound(3, versusWords);
    } else {
      const gTot = gabrielVersusScores.total;
      const aTot = alessandraVersusScores.total;
      let matchWinner: 'Gabriel' | 'Alessandra' | 'Empate' = 'Empate';
      if (gTot > aTot) matchWinner = 'Gabriel';
      else if (aTot > gTot) matchWinner = 'Alessandra';

      const finalizedVersus: VersusResult = {
        date: todayStr,
        gabrielTermo: gabrielVersusScores.termo,
        gabrielDueto: gabrielVersusScores.dueto,
        gabrielQuarteto: gabrielVersusScores.quarteto,
        gabrielTotal: gTot,
        alessandraTermo: alessandraVersusScores.termo,
        alessandraDueto: alessandraVersusScores.dueto,
        alessandraQuarteto: alessandraVersusScores.quarteto,
        alessandraTotal: aTot,
        winner: matchWinner
      };

      saveVersusMatch(finalizedVersus);
      setVersusMatchToday(finalizedVersus);
      setVersusHistory(getVersusHistory());

      setView('versus-end');

      if (matchWinner === activePlayer) {
        setTriggerConfetti(true);
      }
    }
  };

  // Blitz mode triggers
  const handleStartBlitz = async () => {
    const wordPool = await getBlitzWordPool();
    setBlitzWordPoolList(wordPool);
    setBlitzCurrentWordIdx(0);
    setBlitzSolvedCount(0);
    setBlitzAttemptsCount(0);
    setBlitzCurrentStreak(0);
    setBlitzMaxStreak(0);
    setBlitzSolvedTimesList([]);
    setBlitzWordStartSeconds(0);
    setBlitzIsNewRecord(false);

    // Load first target word
    const firstWord = wordPool[0];
    setTargetWords([firstWord]);
    setGuesses([]);
    setCurrentGuess('');
    setSolvedBoards([false]);

    setGameModeType('blitz');
    setActiveMode(1); // Standard Termo board sizing
    setView('playing');

    const totalSeconds = blitzConfigDuration * 60;
    setBlitzRemainingTime(totalSeconds);

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setBlitzRemainingTime(prev => {
        const nextTime = prev - 1;
        setElapsedTime(totalSeconds - nextTime);

        if (nextTime <= 0) {
          // Timer ended
          clearInterval(timerRef.current);
          handleEndBlitz();
          return 0;
        }
        return nextTime;
      });
    }, 1000);
  };

  // Conclude Blitz Mode
  const handleEndBlitz = () => {
    // Stop timers
    if (timerRef.current) clearInterval(timerRef.current);

    setBlitzSolvedTimesList(prevSolvedTimes => {
      const avg = prevSolvedTimes.length > 0
        ? parseFloat((prevSolvedTimes.reduce((a, b) => a + b, 0) / prevSolvedTimes.length).toFixed(1))
        : 0;

      setBlitzSolvedCount(prevSolvedCount => {
        setBlitzAttemptsCount(prevAttempts => {
          setBlitzMaxStreak(prevMaxStreak => {
            if (activePlayer !== 'Ambos') {
              const blitzScore = prevSolvedCount * 100 + prevMaxStreak * 20;
              const result: SpecialModeResult = {
                playerName: activePlayer,
                date: todayStr,
                mode: 'blitz',
                success: prevSolvedCount > 0,
                score: blitzScore,
                time: blitzConfigDuration * 60,
                attempts: prevAttempts,
                wordsSolved: prevSolvedCount,
                detail: `Resolveu ${prevSolvedCount} palavras (streak max: ${prevMaxStreak})`
              };

              saveSpecialModeResult(result);
              setBlitzResultToday(result);
              updateVersusScore('blitz', blitzScore);

              if (versusOpponentType === 'bot') {
                const botBlitzSim = Math.round(5 + Math.random() * 6); // 5 to 11 solved
                const botMaxStreakSim = Math.round(2 + Math.random() * 3);
                const botScoreSim = botBlitzSim * 100 + botMaxStreakSim * 20;
                const oppName = activePlayer === 'Gabriel' ? 'Alessandra' : 'Gabriel';
                setTimeout(() => {
                  const vMatch = getVersusMatchForDate(todayStr);
                  if (vMatch) {
                    if (oppName === 'Gabriel') {
                      vMatch.gabrielBlitz = botScoreSim;
                      vMatch.gabrielTotal = (vMatch.gabrielTermo || 0) + (vMatch.gabrielDueto || 0) + (vMatch.gabrielQuarteto || 0) + (vMatch.gabrielBomb || 0) + (vMatch.gabrielCrossword || 0) + (vMatch.gabrielBlitz || 0);
                    } else {
                      vMatch.alessandraBlitz = botScoreSim;
                      vMatch.alessandraTotal = (vMatch.alessandraTermo || 0) + (vMatch.alessandraDueto || 0) + (vMatch.alessandraQuarteto || 0) + (vMatch.alessandraBomb || 0) + (vMatch.alessandraCrossword || 0) + (vMatch.alessandraBlitz || 0);
                    }
                    vMatch.winner = vMatch.gabrielTotal > vMatch.alessandraTotal ? 'Gabriel' : vMatch.alessandraTotal > vMatch.gabrielTotal ? 'Alessandra' : 'Empate';
                    saveVersusMatch(vMatch);
                    setVersusMatchToday(vMatch);
                    setVersusHistory(getVersusHistory());

                    setOppState(prev => ({
                      ...prev,
                      blitzScore: botScoreSim,
                      totalScore: oppName === 'Gabriel' ? vMatch.gabrielTotal : vMatch.alessandraTotal
                    }));
                  }
                }, 1000);
              }

              setModalSuccess(prevSolvedCount > 0);
              setModalScore(blitzScore);
              setModalAttempts(prevAttempts);
              setModalTime(blitzConfigDuration * 60);
              setShowGameModal(true);
              setView('dashboard');
            } else {
              const finalMatch: BlitzMatch = {
                id: Math.random().toString(36).substring(2, 9),
                date: todayStr,
                duration: blitzConfigDuration,
                wordsSolved: prevSolvedCount,
                attemptsUsed: prevAttempts,
                maxStreak: prevMaxStreak,
                avgTimePerWord: avg
              };

              const records = getBlitzRecords();
              const matchingRecord = records.find(r => r.duration === blitzConfigDuration);
              let isNew = false;
              if (!matchingRecord || prevSolvedCount > matchingRecord.wordsSolved) {
                isNew = true;
              }

              saveBlitzMatch(finalMatch);
              setBlitzIsNewRecord(isNew);

              setBlitzRecordsList(getBlitzRecords());
              setBlitzHistoryList(getBlitzHistory());

              if (isNew) {
                setTriggerConfetti(true);
              }

              setView('blitz-end');
            }
            return prevMaxStreak;
          });
          return prevAttempts;
        });
        return prevSolvedCount;
      });
      return prevSolvedTimes;
    });
  };

  const getRecordForDuration = (duration: number) => {
    const record = blitzRecordsList.find(r => r.duration === duration);
    return record ? record.wordsSolved : 0;
  };

  const getCrosswordCellMeta = (row: number, col: number) => {
    if (!crosswordChallenge) return null;
    const key = `${row}-${col}`;
    const entries = crosswordChallenge.entries.filter(entry => {
      return Array.from({ length: entry.answer.length }).some((_, i) => {
        const entryRow = entry.direction === 'down' ? entry.row + i : entry.row;
        const entryCol = entry.direction === 'across' ? entry.col + i : entry.col;
        return entryRow === row && entryCol === col;
      });
    });

    if (!Object.prototype.hasOwnProperty.call(crosswordCells, key)) return null;
    return {
      key,
      entries,
      number: crosswordChallenge.entries.find(entry => entry.row === row && entry.col === col)?.id.replace(/[AD]/g, '') || ''
    };
  };

  const isCellInActiveClue = (row: number, col: number) => {
    if (!crosswordChallenge) return false;
    const activeEntry = crosswordChallenge.entries.find(e => e.id === crosswordSelectedId);
    if (!activeEntry) return false;
    return Array.from({ length: activeEntry.answer.length }).some((_, i) => {
      const r = activeEntry.direction === 'down' ? activeEntry.row + i : activeEntry.row;
      const c = activeEntry.direction === 'across' ? activeEntry.col + i : activeEntry.col;
      return r === row && c === col;
    });
  };

  const selectClueForCell = (cellKey: string) => {
    if (!crosswordChallenge) return;
    const [row, col] = cellKey.split('-').map(Number);
    const entries = crosswordChallenge.entries.filter(entry => {
      return Array.from({ length: entry.answer.length }).some((_, i) => {
        const r = entry.direction === 'down' ? entry.row + i : entry.row;
        const c = entry.direction === 'across' ? entry.col + i : entry.col;
        return r === row && c === col;
      });
    });

    if (entries.length === 0) return;
    if (entries.some(e => e.id === crosswordSelectedId)) {
      return;
    }
    setCrosswordSelectedId(entries[0].id);
  };

  const handleCellClick = (cellKey: string) => {
    if (!crosswordChallenge) return;
    const [row, col] = cellKey.split('-').map(Number);
    const entries = crosswordChallenge.entries.filter(entry => {
      return Array.from({ length: entry.answer.length }).some((_, i) => {
        const r = entry.direction === 'down' ? entry.row + i : entry.row;
        const c = entry.direction === 'across' ? entry.col + i : entry.col;
        return r === row && c === col;
      });
    });

    if (entries.length <= 1) return;

    if (crosswordFocusedKey === cellKey) {
      const currentIdx = entries.findIndex(e => e.id === crosswordSelectedId);
      const nextIdx = (currentIdx + 1) % entries.length;
      setCrosswordSelectedId(entries[nextIdx].id);
    }
  };

  const advanceCrosswordFocus = (currentKey: string, direction: 'forward' | 'backward') => {
    if (!crosswordChallenge) return;
    const activeEntry = crosswordChallenge.entries.find(e => e.id === crosswordSelectedId);
    if (!activeEntry) return;

    const keys = Array.from({ length: activeEntry.answer.length }).map((_, i) => {
      const r = activeEntry.direction === 'down' ? activeEntry.row + i : activeEntry.row;
      const c = activeEntry.direction === 'across' ? activeEntry.col + i : activeEntry.col;
      return `${r}-${c}`;
    });

    const idx = keys.indexOf(currentKey);
    if (idx === -1) return;

    if (direction === 'forward') {
      if (idx < keys.length - 1) {
        const nextKey = keys[idx + 1];
        document.getElementById(`crossword-cell-${nextKey}`)?.focus();
      }
    } else {
      if (idx > 0) {
        const prevKey = keys[idx - 1];
        document.getElementById(`crossword-cell-${prevKey}`)?.focus();
      }
    }
  };

  const navigateGrid = (currentKey: string, rowOffset: number, colOffset: number) => {
    if (!crosswordChallenge) return;
    const [row, col] = currentKey.split('-').map(Number);
    const targetRow = row + rowOffset;
    const targetCol = col + colOffset;
    const targetKey = `${targetRow}-${targetCol}`;

    if (Object.prototype.hasOwnProperty.call(crosswordCells, targetKey)) {
      document.getElementById(`crossword-cell-${targetKey}`)?.focus();
    }
  };

  const handleCrosswordKeyDown = (key: string, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace') {
      if (!crosswordCells[key]) {
        event.preventDefault();
        advanceCrosswordFocus(key, 'backward');
        if (crosswordChallenge) {
          const activeEntry = crosswordChallenge.entries.find(e => e.id === crosswordSelectedId);
          if (activeEntry) {
            const keys = Array.from({ length: activeEntry.answer.length }).map((_, i) => {
              const r = activeEntry.direction === 'down' ? activeEntry.row + i : activeEntry.row;
              const c = activeEntry.direction === 'across' ? activeEntry.col + i : activeEntry.col;
              return `${r}-${c}`;
            });
            const idx = keys.indexOf(key);
            if (idx > 0) {
              const prevKey = keys[idx - 1];
              setCrosswordCells(prev => ({ ...prev, [prevKey]: '' }));
            }
          }
        }
      } else {
        setCrosswordCells(prev => ({ ...prev, [key]: '' }));
        event.preventDefault();
        setTimeout(() => advanceCrosswordFocus(key, 'backward'), 10);
      }
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      navigateGrid(key, -1, 0);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      navigateGrid(key, 1, 0);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      navigateGrid(key, 0, -1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      navigateGrid(key, 0, 1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      validateCrosswordEntry(crosswordSelectedId);
    }
  };

  const handleCrosswordCellChange = (key: string, value: string) => {
    const nextValue = value.toUpperCase().replace(/[^A-Z]/g, '').slice(-1);
    setCrosswordCells(prev => ({ ...prev, [key]: nextValue }));
    setCrosswordMessage('');
    if (nextValue) {
      setTimeout(() => advanceCrosswordFocus(key, 'forward'), 10);
    }
  };

  const handleCrosswordCharInput = (char: string) => {
    if (!crosswordFocusedKey) return;
    setCrosswordCells(prev => ({ ...prev, [crosswordFocusedKey]: char.toUpperCase() }));
    setCrosswordMessage('');
    setTimeout(() => advanceCrosswordFocus(crosswordFocusedKey, 'forward'), 10);
  };

  const handleCrosswordDeleteInput = () => {
    if (!crosswordFocusedKey) return;
    if (!crosswordCells[crosswordFocusedKey]) {
      if (crosswordChallenge) {
        const activeEntry = crosswordChallenge.entries.find(e => e.id === crosswordSelectedId);
        if (activeEntry) {
          const keys = Array.from({ length: activeEntry.answer.length }).map((_, i) => {
            const r = activeEntry.direction === 'down' ? activeEntry.row + i : activeEntry.row;
            const c = activeEntry.direction === 'across' ? activeEntry.col + i : activeEntry.col;
            return `${r}-${c}`;
          });
          const idx = keys.indexOf(crosswordFocusedKey);
          if (idx > 0) {
            const prevKey = keys[idx - 1];
            setCrosswordCells(prev => ({ ...prev, [prevKey]: '' }));
            document.getElementById(`crossword-cell-${prevKey}`)?.focus();
          }
        }
      }
    } else {
      setCrosswordCells(prev => ({ ...prev, [crosswordFocusedKey]: '' }));
      setTimeout(() => advanceCrosswordFocus(crosswordFocusedKey, 'backward'), 10);
    }
  };

  const handleCrosswordEnterInput = () => {
    validateCrosswordEntry(crosswordSelectedId);
  };

  const validateCrosswordEntry = (entryId: string) => {
    if (!crosswordChallenge) return;
    const entry = crosswordChallenge.entries.find(item => item.id === entryId);
    if (!entry) return;

    const attempt = Array.from({ length: entry.answer.length }).map((_, i) => {
      const row = entry.direction === 'down' ? entry.row + i : entry.row;
      const col = entry.direction === 'across' ? entry.col + i : entry.col;
      return crosswordCells[`${row}-${col}`] || '';
    }).join('');

    if (attempt.length < entry.answer.length) {
      setCrosswordMessage('Complete todas as casas desta palavra antes de validar.');
      return;
    }

    if (attempt !== entry.answer) {
      setCrosswordMessage('Ainda não encaixou. Revise as letras cruzadas.');
      return;
    }

    const nextSolvedIds = Array.from(new Set([...crosswordSolvedIds, entry.id]));
    setCrosswordSolvedIds(nextSolvedIds);
    setCrosswordMessage('Palavra confirmada.');

    if (nextSolvedIds.length === crosswordChallenge.entries.length) {
      const isVersus = activePlayer !== 'Ambos';
      const activeDiff = isVersus ? 'medio' : crosswordConfigDifficulty;
      const activeDur = isVersus ? 5 : crosswordConfigDuration;

      const diffMultiplier = activeDiff === 'facil' ? 0.8 : activeDiff === 'dificil' ? 1.3 : 1.0;
      const basePoints = activeDur === 2 ? 120 : activeDur === 10 ? 400 : 240;
      const minPoints = activeDur === 2 ? 20 : activeDur === 10 ? 60 : 40;
      const score = Math.max(minPoints, Math.floor((basePoints - Math.floor(elapsedTime / 2)) * diffMultiplier));

      finishSpecialMode('crossword', true, nextSolvedIds.length, nextSolvedIds.length, 'Grade completa.', score);
    }
  };

  const todayHistory = historyList.find(h => h.date === todayStr);

  return (
    <>
      <Confetti active={triggerConfetti} />

      {toastMessage && (
        <div className="game-toast-container">
          <div className="game-toast">{toastMessage}</div>
        </div>
      )}

      {/* Real-time invite alert bottom right */}
      {versusInviteVisible && (
        <div className="invite-alert-overlay">
          <div className="invite-alert-title">⚔️ Convite Recebido!</div>
          <div className="invite-alert-text">
            <strong>{opponentName}</strong> convidou você para o Duelo do Dia.
          </div>
          <div className="invite-alert-buttons">
            <button className="invite-alert-btn accept" onClick={handleAcceptInvite}>
              Aceitar
            </button>
            <button className="invite-alert-btn decline" onClick={handleDeclineInvite}>
              Recusar
            </button>
          </div>
        </div>
      )}

      <header>
        <div className="logo">
          👑 O NOSSO TERMO <span>Diário</span>
        </div>

        <div className="player-toggle-container">
          <button
            className={`player-btn ${activePlayer === 'Gabriel' ? 'active' : ''}`}
            onClick={() => handlePlayerChange('Gabriel')}
          >
            🧔 Gabriel
          </button>
          <button
            className={`player-btn ${activePlayer === 'Alessandra' ? 'active alessandra' : ''}`}
            onClick={() => handlePlayerChange('Alessandra')}
          >
            👩 Alessandra
          </button>
          <button
            className={`player-btn ${activePlayer === 'Ambos' ? 'active' : ''}`}
            style={{ background: activePlayer === 'Ambos' ? 'linear-gradient(135deg, var(--accent-cyan), var(--accent-purple))' : 'transparent' }}
            onClick={() => handlePlayerChange('Ambos')}
          >
            👥 Ambos
          </button>
          <button
            className={`player-btn ${view === 'admin' ? 'active' : ''}`}
            style={{ border: '1px solid rgba(255, 255, 255, 0.15)', background: view === 'admin' ? 'rgba(255,255,255,0.1)' : 'transparent' }}
            onClick={() => setView(view === 'admin' ? 'dashboard' : 'admin')}
          >
            ⚙️ Admin
          </button>
        </div>
      </header>

      {loading ? (
        <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem', padding: '4rem' }}>
          <div className="game-timer" style={{ animation: 'pulse 1.5s infinite' }}>Carregando Desafios...</div>
        </div>
      ) : view === 'admin' ? (
        <div className="lobby-container" style={{ maxWidth: '700px', textAlign: 'left', alignItems: 'stretch' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
            <button className="back-btn" onClick={handleBackToDashboard}>
              <ArrowLeft size={18} />
            </button>
            <h2 style={{ margin: 0, fontSize: '1.8rem' }}>⚙️ Painel Administrativo</h2>
          </div>

          {/* Stats Box */}
          <div className="dashboard-panel" style={{ marginBottom: '2rem' }}>
            <h3 style={{ marginTop: 0, borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem' }}>📊 Estatísticas do Banco de Palavras</h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginTop: '1rem' }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Total de Palavras</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'white', marginTop: '0.25rem' }}>{adminStats.total}</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Nunca Utilizadas</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--accent-cyan)', marginTop: '0.25rem' }}>{adminStats.neverUsed}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({adminStats.total > 0 ? ((adminStats.neverUsed / adminStats.total) * 100).toFixed(1) : 0}%)</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Utilizadas 1 vez</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--color-present)', marginTop: '0.25rem' }}>{adminStats.usedOnce}</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Utilizadas 2+ vezes</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--accent-pink)', marginTop: '0.25rem' }}>{adminStats.usedMultiple}</div>
              </div>
            </div>
          </div>

          {/* Config Box */}
          <div className="dashboard-panel" style={{ marginBottom: '2rem' }}>
            <h3 style={{ marginTop: 0, borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem' }}>⚙️ Configurações de Reabastecimento</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem', marginTop: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>
                  Limite Mínimo (% nunca usadas):
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="number"
                    min="5"
                    max="80"
                    value={configThreshold}
                    onChange={(e) => setConfigThreshold(parseInt(e.target.value) || 20)}
                    style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', color: 'white', padding: '0.5rem', borderRadius: '8px', width: '80px', fontWeight: 'bold', textAlign: 'center' }}
                  />
                  <span>%</span>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.25rem' }}>
                  Geração automática é ativada se palavras nunca usadas caírem abaixo deste limite.
                </span>
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>
                  Lote da Geração Automática:
                </label>
                <select
                  value={configBatchSize}
                  onChange={(e) => setConfigBatchSize(parseInt(e.target.value) || 250)}
                  style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', color: 'white', padding: '0.5rem', borderRadius: '8px', width: '120px', fontWeight: 'bold' }}
                >
                  <option value="100">100 palavras</option>
                  <option value="250">250 palavras</option>
                  <option value="500">500 palavras</option>
                </select>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.25rem' }}>
                  Quantidade de palavras geradas quando o reabastecimento é ativado.
                </span>
              </div>
            </div>
            <button
              className="modal-close-btn"
              style={{ marginTop: '1.5rem', width: 'auto', padding: '0.6rem 1.5rem', fontSize: '0.9rem', background: 'var(--accent-purple)' }}
              onClick={handleSaveConfig}
            >
              Salvar Configurações
            </button>
          </div>

          {/* Trigger Manual Generation */}
          <div className="dashboard-panel" style={{ marginBottom: '2rem' }}>
            <h3 style={{ marginTop: 0, borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem' }}>🤖 Geração Manual de Palavras por IA</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
              Selecione o tamanho do lote para gerar novas palavras em português brasileiro usando a IA Groq (em background).
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
              <button
                className="challenge-btn"
                style={{ background: 'linear-gradient(135deg, var(--accent-cyan), #3b82f6)', padding: '0.75rem' }}
                onClick={() => handleTriggerGeneration(100)}
                disabled={adminStats.pendingJobsCount > 0}
              >
                Gerar +100 palavras
              </button>
              <button
                className="challenge-btn"
                style={{ background: 'linear-gradient(135deg, var(--color-present), #f59e0b)', padding: '0.75rem' }}
                onClick={() => handleTriggerGeneration(250)}
                disabled={adminStats.pendingJobsCount > 0}
              >
                Gerar +250 palavras
              </button>
              <button
                className="challenge-btn"
                style={{ background: 'linear-gradient(135deg, var(--accent-pink), #ec4899)', padding: '0.75rem' }}
                onClick={() => handleTriggerGeneration(500)}
                disabled={adminStats.pendingJobsCount > 0}
              >
                Gerar +500 palavras
              </button>
            </div>
          </div>

          {/* Jobs Status List */}
          <div className="dashboard-panel">
            <h3 style={{ marginTop: 0, borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>📋 Log de Tarefas de Geração</span>
              {adminStats.pendingJobsCount > 0 && <span className="game-timer" style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', animation: 'pulse 1s infinite' }}>Processando...</span>}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem', maxHeight: '300px', overflowY: 'auto' }}>
              {generationJobs.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>Nenhum job de geração executado.</div>
              ) : (
                generationJobs.map((job: any) => (
                  <div key={job.id} style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span>Job <strong>#{job.id}</strong> ({job.isAuto ? 'Auto' : 'Manual'})</span>
                      <span className={`lobby-user-status ${job.status.toLowerCase()}`} style={{ fontSize: '0.75rem', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                        {job.status === 'Pending' && 'Pendente ⏳'}
                        {job.status === 'Processing' && 'Processando ⚡'}
                        {job.status === 'Completed' && 'Sucesso ✓'}
                        {job.status === 'Failed' && 'Falhou ❌'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      <span>Solicitado em: {new Date(job.requestedAt).toLocaleString()}</span>
                      {job.finishedAt && <span>Concluído em: {new Date(job.finishedAt).toLocaleString()}</span>}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 'bold' }}>
                      <span>Palavras solicitadas: {job.requestedWords}</span>
                      {job.status === 'Completed' && <span style={{ color: 'var(--color-correct)' }}>Palavras geradas: {job.generatedWords}</span>}
                    </div>

                    {job.errorMessage && (
                      <div style={{ color: '#ef4444', fontSize: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', padding: '0.4rem 0.6rem', borderRadius: '6px', marginTop: '0.25rem', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                        Erro: {job.errorMessage}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : view === 'lobby' ? (
        /* Connection Lounge screen */
        <div className="lobby-container">
          <div className="lobby-title">Lobby Versus</div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
            {versusOpponentType === 'real'
              ? (waitingForOpponent ? `Aguardando ${opponentName} aceitar o convite...` : 'Duelo iniciando em breve!')
              : 'Conectando oponente simulado para o Duelo...'}
          </p>

          <div className="lobby-users">
            {/* Player Row */}
            <div className="lobby-user-row">
              <span>{activePlayer === 'Gabriel' ? '🧔 Gabriel' : '👩 Alessandra'}</span>
              <span className="lobby-user-status ready">Conectado ✓</span>
            </div>

            {/* Opponent Row */}
            <div className="lobby-user-row">
              <span>{opponentName === 'Gabriel' ? '🧔 Gabriel' : '👩 Alessandra'}</span>
              <span className={`lobby-user-status ${versusOpponentType === 'real'
                ? (onlineUsers.includes(opponentName) ? (waitingForOpponent ? 'waiting' : 'ready') : 'waiting')
                : (lobbyStep === 'connecting' ? 'waiting' : 'ready')
                }`}>
                {versusOpponentType === 'real'
                  ? (onlineUsers.includes(opponentName)
                    ? (waitingForOpponent ? 'Aguardando aceite...' : 'Conectado ✓')
                    : 'Offline ✗')
                  : (lobbyStep === 'connecting' ? 'Conectando Robô...' : 'Conectado ✓')}
              </span>
            </div>
          </div>

          {waitingForOpponent && (
            <button
              className="versus-summary-btn"
              style={{ marginTop: '2rem', background: '#ef4444', border: 'none', boxShadow: 'none' }}
              onClick={() => {
                setWaitingForOpponent(false);
                setView('dashboard');
                if (multiplayerChannel) {
                  multiplayerChannel.send({
                    type: 'broadcast',
                    event: 'decline',
                    payload: { from: activePlayer, to: opponentName }
                  });
                }
              }}
            >
              Cancelar Convite
            </button>
          )}

          {lobbyStep === 'countdown' && (
            <div className="countdown-overlay">
              {countdownVal > 0 ? countdownVal : 'COMEÇAR!'}
            </div>
          )}
        </div>
      ) : view === 'versus-recap' ? (
        /* Intermediate Round Recap Screen */
        <div className="lobby-container" style={{ maxWidth: '600px' }}>
          <div className="lobby-title">Rodada {versusRound} Concluída!</div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
            Desafio: {versusRound === 1 ? 'Termo' : versusRound === 2 ? 'Dueto' : 'Quarteto'}
          </p>

          <div style={{ background: 'rgba(0,0,0,0.2)', width: '100%', borderRadius: '16px', padding: '1.5rem', marginBottom: '2rem', border: '1px solid var(--glass-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem', marginBottom: '0.75rem' }}>
              <span>Jogador</span>
              <span>Pontos nesta Rodada</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0' }}>
              <span style={{ color: 'var(--accent-purple)' }}>🧔 Gabriel</span>
              <span style={{ fontWeight: 'bold' }}>
                {versusRound === 1 ? gabrielVersusScores.termo : versusRound === 2 ? gabrielVersusScores.dueto : gabrielVersusScores.quarteto} pts
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0' }}>
              <span style={{ color: 'var(--accent-cyan)' }}>👩 Alessandra</span>
              <span style={{ fontWeight: 'bold' }}>
                {versusRound === 1 ? alessandraVersusScores.termo : versusRound === 2 ? alessandraVersusScores.dueto : alessandraVersusScores.quarteto} pts
              </span>
            </div>
          </div>

          <button 
            className="modal-close-btn" 
            onClick={handleNextVersusRound}
            disabled={versusRound === 3 && versusOpponentType === 'real' && !oppState.completed}
          >
            {versusRound === 3 
              ? (versusOpponentType === 'real' && !oppState.completed 
                  ? 'Aguardando oponente concluir... ⌛' 
                  : 'Ver Resultado Final') 
              : `Avançar para Rodada ${versusRound + 1}`}
          </button>
        </div>
      ) : view === 'versus-end' ? (
        /* Versus Match Concluding Results screen */
        <div className="lobby-container" style={{ maxWidth: '650px' }}>
          <div className="winner-crown" style={{ fontSize: '4.5rem' }}>🏆</div>
          <h2 className="winner-headline" style={{ fontSize: '2.5rem', marginBottom: '1.5rem' }}>
            {versusMatchToday?.winner === 'Empate'
              ? 'EMPATE NO DUELO DO DIA!'
              : `${versusMatchToday?.winner.toUpperCase()} VENCEU O DUELO!`}
          </h2>

          <div style={{ background: 'rgba(0,0,0,0.2)', width: '100%', borderRadius: '16px', padding: '1.5rem', marginBottom: '2.5rem', border: '1px solid var(--glass-border)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', fontWeight: 'bold', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem', marginBottom: '0.75rem', textAlign: 'left' }}>
              <span>Rodada</span>
              <span style={{ color: 'var(--accent-purple)' }}>Gabriel</span>
              <span style={{ color: 'var(--accent-cyan)' }}>Alessandra</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', padding: '0.5rem 0', textAlign: 'left' }}>
              <span>Termo</span>
              <span>{versusMatchToday?.gabrielTermo || 0} pts</span>
              <span>{versusMatchToday?.alessandraTermo || 0} pts</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', padding: '0.5rem 0', textAlign: 'left' }}>
              <span>Dueto</span>
              <span>{versusMatchToday?.gabrielDueto || 0} pts</span>
              <span>{versusMatchToday?.alessandraDueto || 0} pts</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', padding: '0.5rem 0', textAlign: 'left' }}>
              <span>Quarteto</span>
              <span>{versusMatchToday?.gabrielQuarteto || 0} pts</span>
              <span>{versusMatchToday?.alessandraQuarteto || 0} pts</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', padding: '0.5rem 0', textAlign: 'left' }}>
              <span>Bomba</span>
              <span>{versusMatchToday?.gabrielBomb || 0} pts</span>
              <span>{versusMatchToday?.alessandraBomb || 0} pts</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', padding: '0.5rem 0', textAlign: 'left' }}>
              <span>Cruzadas IA</span>
              <span>{versusMatchToday?.gabrielCrossword || 0} pts</span>
              <span>{versusMatchToday?.alessandraCrossword || 0} pts</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', padding: '0.5rem 0', textAlign: 'left' }}>
              <span>Corrida Blitz</span>
              <span>{versusMatchToday?.gabrielBlitz || 0} pts</span>
              <span>{versusMatchToday?.alessandraBlitz || 0} pts</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', padding: '0.75rem 0', borderTop: '2px solid var(--glass-border)', fontWeight: 'bold', fontSize: '1.15rem', textAlign: 'left', marginTop: '0.5rem' }}>
              <span>Total</span>
              <span style={{ color: 'var(--accent-purple)' }}>{versusMatchToday?.gabrielTotal || 0}</span>
              <span style={{ color: 'var(--accent-cyan)' }}>{versusMatchToday?.alessandraTotal || 0}</span>
            </div>
          </div>

          <button className="modal-close-btn" onClick={handleBackToDashboard}>
            Voltar ao Dashboard
          </button>
        </div>
      ) : view === 'blitz-end' ? (
        /* Blitz Game Concluding results screen */
        <div className="lobby-container" style={{ maxWidth: '550px' }}>
          <div className="winner-crown" style={{ fontSize: '4.5rem' }}>⚡</div>
          <h2 className="winner-headline" style={{ fontSize: '2.3rem', marginBottom: '1rem', background: 'linear-gradient(to right, #f59e0b, #fb7185)' }}>
            FIM DA PARTIDA BLITZ!
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>Duração: {blitzConfigDuration} minuto{blitzConfigDuration > 1 ? 's' : ''}</p>

          {blitzIsNewRecord && (
            <div style={{ background: 'rgba(245, 158, 11, 0.15)', border: '1px solid var(--color-present)', padding: '0.75rem', borderRadius: '12px', color: 'var(--color-present)', fontWeight: 'bold', marginBottom: '1.5rem', animation: 'pulse 1.5s infinite' }}>
              🎉 NOVO RECORDE COOPERATIVO! 🎉
            </div>
          )}

          <div style={{ background: 'rgba(0,0,0,0.2)', width: '100%', borderRadius: '16px', padding: '1.5rem', marginBottom: '2rem', border: '1px solid var(--glass-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <span>Palavras Resolvidas:</span>
              <span style={{ fontWeight: 'bold', color: 'var(--accent-cyan)', fontSize: '1.25rem' }}>{blitzSolvedCount}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <span>Sequência Máxima (Streak):</span>
              <span style={{ fontWeight: 'bold', color: 'var(--color-present)' }}>{blitzMaxStreak} 🔥</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <span>Tempo Médio por Palavra:</span>
              <span style={{ fontWeight: 'bold' }}>{blitzSolvedTimesList.length > 0 ? (blitzSolvedTimesList.reduce((a, b) => a + b, 0) / blitzSolvedTimesList.length).toFixed(1) : 0}s</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0' }}>
              <span>Total de Tentativas:</span>
              <span style={{ fontWeight: 'bold' }}>{blitzAttemptsCount}</span>
            </div>
          </div>

          <button className="modal-close-btn" onClick={handleBackToDashboard}>
            Voltar ao Dashboard
          </button>
        </div>
      ) : view === 'dashboard' ? (
        <main className="dashboard">

          {/* Individual Daily Winner spotlights */}
          {activePlayer !== 'Ambos' && todayHistory && todayHistory.winner !== 'Aguardando' && (
            <div className="winner-spotlight">
              <div className="winner-crown">🏆</div>
              <h2 className="winner-headline">
                {todayHistory.winner === 'Empate'
                  ? 'EMPATE NO DIA DE HOJE!'
                  : `VITÓRIA DE ${todayHistory.winner.toUpperCase()} HOJE!`}
              </h2>
              <p className="winner-score-diff">
                Placar diário: <span>{todayHistory.gabrielScore.toFixed(0)}</span> (Gabriel) vs <span>{todayHistory.alessandraScore.toFixed(0)}</span> (Alessandra)
              </p>
              <div style={{ color: 'var(--accent-cyan)', fontWeight: 'bold', fontSize: '0.9rem' }}>
                {todayHistory.winner === activePlayer ? '🎉 Você conquistou o dia de hoje! Parabéns! 🎉' : '💪 Amanhã tem mais! Continue treinando! 💪'}
              </div>
            </div>
          )}

          <div className="welcome-banner">
            <h1>Olá{activePlayer === 'Ambos' ? ' cooperadores' : `, ${activePlayer}`}!</h1>
            <p>
              {activePlayer === 'Ambos'
                ? 'Modo Cooperativo ativo. Vocês podem jogar os desafios diários juntos ou disputar uma corrida Blitz!'
                : 'Modo Duelo Versus ativo. Desafie o outro jogador para disputar quem se sai melhor hoje!'}
            </p>
          </div>

          {/* Quick Versus Explainer - Shown only under Ambos */}
          {activePlayer === 'Ambos' && (
            <div className="versus-explainer-card">
              <div className="versus-explainer-content">
                <h3 className="versus-explainer-title">
                  ⚔️ Modo Versus Competitivo Disponível
                </h3>
                <p className="versus-explainer-desc">
                  Sabia que todos os 6 modos (Termo, Dueto, Quarteto, Bomba, Cruzadas e Blitz) têm versão **Versus**? 
                  Mude o perfil ativo no topo para **Gabriel** ou **Alessandra** para liberar os duelos e ver as pontuações e histórico!
                </p>
              </div>
              <div className="versus-explainer-actions">
                <button 
                  className="versus-explainer-btn-gabriel"
                  onClick={() => handlePlayerChange('Gabriel')}
                >
                  🧔 Perfil Gabriel
                </button>
                <button 
                  className="versus-explainer-btn-alessandra"
                  onClick={() => handlePlayerChange('Alessandra')}
                >
                  👩 Perfil Alessandra
                </button>
              </div>
            </div>
          )}

          {/* Modo Versus Duel card - Hidden under Ambos */}
          {activePlayer !== 'Ambos' && (
            <div className="versus-summary-card">
              <div className="versus-summary-info">
                <div className="versus-summary-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span>⚔️ Duelo do Dia (Modo Versus)</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.05)', padding: '0.2rem 0.5rem', borderRadius: '9999px', fontSize: '0.7rem' }}>
                    <span style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: onlineUsers.includes(opponentName) ? '#10b981' : '#64748b',
                      boxShadow: onlineUsers.includes(opponentName) ? '0 0 6px #10b981' : 'none',
                      display: 'inline-block'
                    }} />
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {opponentName} está {onlineUsers.includes(opponentName) ? 'online' : 'offline'}
                    </span>
                  </div>
                </div>
                <div className="versus-summary-desc">
                  {versusMatchToday && myVersusScores.quarteto > 0 ? (
                    `Desafio Versus concluído hoje! Vencedor: ${versusMatchToday.winner === 'Empate' ? 'Empate 🤝' : '🏆 ' + versusMatchToday.winner}`
                  ) : versusMatchToday && (myVersusScores.termo > 0 || myVersusScores.dueto > 0) ? (
                    `Duelo em andamento! Sua próxima rodada: ${myVersusScores.dueto > 0 ? 'Quarteto' : 'Dueto'}.`
                  ) : (
                    `Desafie o outro jogador em tempo real nos 3 modos seguidos com palavras exclusivas.`
                  )}
                </div>
              </div>
              <button
                className="versus-summary-btn"
                disabled={
                  (!!versusMatchToday && myVersusScores.quarteto > 0) ||
                  (!versusMatchToday && !onlineUsers.includes(opponentName)) ||
                  (!!versusMatchToday && !(myVersusScores.termo > 0 || myVersusScores.dueto > 0) && !onlineUsers.includes(opponentName))
                }
                onClick={
                  versusMatchToday && (myVersusScores.termo > 0 || myVersusScores.dueto > 0)
                    ? launchVersusMatch
                    : startVersusFlow
                }
              >
                {versusMatchToday && myVersusScores.quarteto > 0 ? (
                  `⏱️ Próximo em ${timeUntilMidnight}`
                ) : versusMatchToday && (myVersusScores.termo > 0 || myVersusScores.dueto > 0) ? (
                  'Continuar Duelo ⚔'
                ) : (
                  onlineUsers.includes(opponentName) ? 'Convidar Jogador ⚔️' : 'Oponente Offline 💤'
                )}
              </button>
            </div>
          )}

          {/* Special daily / versus modes */}
          <div className="special-modes-grid">
            <div className="challenge-card mode-bomb">
              <div className="challenge-header">
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                  <div className="challenge-badge">{activePlayer === 'Ambos' ? 'Bomba' : '⚔️ Bomba Versus'}</div>
                  {activePlayer === 'Ambos' && (
                    <span className="versus-indicator-badge" title="Disponível no Modo Versus">⚔️ Versus</span>
                  )}
                </div>
                <div className="challenge-status-indicator">
                  {activePlayer === 'Ambos'
                    ? (bombResultToday ? '✅' : '❌')
                    : (bombResultToday && oppState.bombScore ? '✅' : bombResultToday || oppState.bombScore ? '⏳' : '❌')}
                </div>
              </div>
              <h3 className="challenge-title">Modo Bomba</h3>
              <p className="challenge-desc">Desarme a palavra antes da carga chegar a 100%. Verdes aliviam a pressão; amarelas e cinzas aumentam o risco.</p>
              {activePlayer === 'Ambos' ? (
                bombResultToday && (
                  <div className="challenge-stats">
                    <div className="challenge-stat-row">
                      <span className="challenge-stat-label">Resultado:</span>
                      <span className="challenge-stat-value">{bombResultToday.success ? 'Vitória' : 'Derrota'}</span>
                    </div>
                    <div className="challenge-stat-row">
                      <span className="challenge-stat-label">Pontos:</span>
                      <span className="challenge-stat-value">{bombResultToday.score}</span>
                    </div>
                  </div>
                )
              ) : (
                <div className="challenge-stats">
                  <div className="challenge-stat-row">
                    <span className="challenge-stat-label">Sua pontuação:</span>
                    <span className="challenge-stat-value">{bombResultToday ? `${bombResultToday.score} pts` : 'Não jogou ❌'}</span>
                  </div>
                  <div className="challenge-stat-row">
                    <span className="challenge-stat-label">Oponente ({opponentName}):</span>
                    <span className="challenge-stat-value">{(oppState.bombScore !== undefined && oppState.bombScore > 0) ? `${oppState.bombScore} pts` : 'Não jogou ❌'}</span>
                  </div>
                  {bombResultToday && oppState.bombScore !== undefined && oppState.bombScore > 0 && (
                    <div style={{ marginTop: '0.5rem', fontWeight: 'bold', fontSize: '0.8rem', color: 'var(--accent-cyan)' }}>
                      {bombResultToday.score > oppState.bombScore
                        ? 'Você venceu este duelo! 🏆'
                        : oppState.bombScore > bombResultToday.score
                        ? `${opponentName} venceu este duelo! 🏆`
                        : 'Empate neste duelo! 🤝'}
                    </div>
                  )}
                </div>
              )}
              <button className="challenge-btn" disabled={!!bombResultToday} onClick={handleStartBomb}>
                {bombResultToday ? `⏱️ Próximo em ${timeUntilMidnight}` : <><Bomb size={16} /> Jogar Bomba</>}
              </button>
            </div>

            <div className="challenge-card mode-crossword">
              <div className="challenge-header">
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                  <div className="challenge-badge">{activePlayer === 'Ambos' ? 'Cruzadas IA' : '⚔️ Cruzadas Versus'}</div>
                  {activePlayer === 'Ambos' && (
                    <span className="versus-indicator-badge" title="Disponível no Modo Versus">⚔️ Versus</span>
                  )}
                </div>
                <div className="challenge-status-indicator">
                  {activePlayer === 'Ambos'
                    ? (crosswordResultToday ? '✅' : '❌')
                    : (crosswordResultToday && oppState.crosswordScore ? '✅' : crosswordResultToday || oppState.crosswordScore ? '⏳' : '❌')}
                </div>
              </div>
              <h3 className="challenge-title">Palavras Cruzadas</h3>
              <p className="challenge-desc">Resolva a grade com pistas diretas, contextuais e enigmáticas preparadas para o desafio do dia.</p>
              {activePlayer === 'Ambos' ? (
                crosswordResultToday && (
                  <div className="challenge-stats">
                    <div className="challenge-stat-row">
                      <span className="challenge-stat-label">Resultado:</span>
                      <span className="challenge-stat-value">{crosswordResultToday.success ? 'Vitória' : 'Derrota'}</span>
                    </div>
                    <div className="challenge-stat-row">
                      <span className="challenge-stat-label">Pontos:</span>
                      <span className="challenge-stat-value">{crosswordResultToday.score}</span>
                    </div>
                  </div>
                )
              ) : (
                <div className="challenge-stats">
                  <div className="challenge-stat-row">
                    <span className="challenge-stat-label">Sua pontuação:</span>
                    <span className="challenge-stat-value">{crosswordResultToday ? `${crosswordResultToday.score} pts` : 'Não jogou ❌'}</span>
                  </div>
                  <div className="challenge-stat-row">
                    <span className="challenge-stat-label">Oponente ({opponentName}):</span>
                    <span className="challenge-stat-value">{(oppState.crosswordScore !== undefined && oppState.crosswordScore > 0) ? `${oppState.crosswordScore} pts` : 'Não jogou ❌'}</span>
                  </div>
                  {crosswordResultToday && oppState.crosswordScore !== undefined && oppState.crosswordScore > 0 && (
                    <div style={{ marginTop: '0.5rem', fontWeight: 'bold', fontSize: '0.8rem', color: 'var(--accent-cyan)' }}>
                      {crosswordResultToday.score > oppState.crosswordScore
                        ? 'Você venceu este duelo! 🏆'
                        : oppState.crosswordScore > crosswordResultToday.score
                        ? `${opponentName} venceu este duelo! 🏆`
                        : 'Empate neste duelo! 🤝'}
                    </div>
                  )}
                </div>
              )}

              {!crosswordResultToday && activePlayer === 'Ambos' && (
                <div style={{ textAlign: 'left', marginTop: '1rem', marginBottom: '1.5rem' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '0.4rem', textTransform: 'uppercase' }}>Dificuldade das Pistas:</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '1rem' }}>
                    {(['facil', 'medio', 'dificil'] as const).map(diff => (
                      <button
                        key={diff}
                        type="button"
                        style={{
                          padding: '0.5rem 0.25rem',
                          borderRadius: '8px',
                          border: '1px solid var(--glass-border)',
                          background: crosswordConfigDifficulty === diff ? 'var(--accent-cyan)' : 'rgba(255,255,255,0.03)',
                          color: crosswordConfigDifficulty === diff ? '#000' : 'white',
                          fontWeight: 'bold',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onClick={() => setCrosswordConfigDifficulty(diff)}
                      >
                        {diff === 'facil' ? 'Fácil' : diff === 'medio' ? 'Médio' : 'Difícil'}
                      </button>
                    ))}
                  </div>

                  <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '0.4rem', textTransform: 'uppercase' }}>Tempo Médio / Palavras:</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                    {[2, 5, 10].map(dur => (
                      <button
                        key={dur}
                        type="button"
                        style={{
                          padding: '0.5rem 0.25rem',
                          borderRadius: '8px',
                          border: '1px solid var(--glass-border)',
                          background: crosswordConfigDuration === dur ? 'var(--accent-cyan)' : 'rgba(255,255,255,0.03)',
                          color: crosswordConfigDuration === dur ? '#000' : 'white',
                          fontWeight: 'bold',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onClick={() => setCrosswordConfigDuration(dur)}
                      >
                        {dur === 2 ? '2 min (4 p.)' : dur === 5 ? '5 min (5 p.)' : '10 min (7 p.)'}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button className="challenge-btn" disabled={!!crosswordResultToday} onClick={handleStartCrossword}>
                {crosswordResultToday ? `⏱️ Próximo em ${timeUntilMidnight}` : <><Grid3X3 size={16} /> Abrir Grade</>}
              </button>
            </div>
          </div>

          {/* Modo Blitz Card */}
          <div className="dashboard-panel" style={{ marginBottom: '2.5rem', background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08), rgba(236, 72, 153, 0.08))', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
            <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <Zap size={22} color="var(--color-present)" /> 
              <span>{activePlayer === 'Ambos' ? 'Modo Blitz Cooperativo' : '⚔️ Corrida Blitz Versus'}</span>
              {activePlayer === 'Ambos' && (
                <span className="versus-indicator-badge" title="Disponível no Modo Versus" style={{ transform: 'translateY(1px)' }}>⚔️ Versus</span>
              )}
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', textAlign: 'left' }}>
              {activePlayer === 'Ambos'
                ? 'Tentem adivinhar o maior número de palavras sequenciais antes do cronômetro zerar. O jogo passa para a próxima palavra instantaneamente.'
                : 'Adivinhe o maior número de palavras sequenciais em 3 minutos. O duelo vale pontos diretos para a pontuação diária do versus!'}
            </p>

            {activePlayer === 'Ambos' ? (
              <>
                {/* Duration selector */}
                <div style={{ textAlign: 'left', marginBottom: '1.5rem' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Duração da partida:</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
                    {[1, 3, 5, 10].map(dur => (
                      <button
                        key={dur}
                        style={{
                          padding: '0.75rem',
                          borderRadius: '10px',
                          border: '1px solid var(--glass-border)',
                          background: blitzConfigDuration === dur ? 'var(--color-present)' : 'rgba(255,255,255,0.03)',
                          color: 'white',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                        onClick={() => setBlitzConfigDuration(dur)}
                      >
                        {dur} min
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  className="challenge-btn"
                  style={{ background: 'linear-gradient(135deg, #f59e0b, #ec4899)', color: 'white', width: '100%', padding: '1rem' }}
                  onClick={handleStartBlitz}
                >
                  <Zap size={18} fill="white" /> Começar Corrida Blitz ({blitzConfigDuration} min)
                </button>
              </>
            ) : (
              <>
                <div className="challenge-stats" style={{ marginBottom: '1.5rem', background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '10px' }}>
                  <div className="challenge-stat-row">
                    <span className="challenge-stat-label">Sua pontuação Blitz:</span>
                    <span className="challenge-stat-value" style={{ fontWeight: 'bold' }}>{blitzResultToday ? `${blitzResultToday.score} pts (${blitzResultToday.wordsSolved} palavras)` : 'Não jogou ❌'}</span>
                  </div>
                  <div className="challenge-stat-row">
                    <span className="challenge-stat-label">Oponente ({opponentName}):</span>
                    <span className="challenge-stat-value" style={{ fontWeight: 'bold' }}>{(oppState.blitzScore !== undefined && oppState.blitzScore > 0) ? `${oppState.blitzScore} pts` : 'Não jogou ❌'}</span>
                  </div>
                  {blitzResultToday && oppState.blitzScore !== undefined && oppState.blitzScore > 0 && (
                    <div style={{ marginTop: '0.5rem', fontWeight: 'bold', fontSize: '0.9rem', color: 'var(--color-present)' }}>
                      {blitzResultToday.score > oppState.blitzScore
                        ? 'Você venceu a corrida Blitz! 🏆'
                        : oppState.blitzScore > blitzResultToday.score
                        ? `${opponentName} venceu a corrida Blitz! 🏆`
                        : 'Empate na corrida Blitz! 🤝'}
                    </div>
                  )}
                </div>
                <button
                  className="challenge-btn"
                  disabled={!!blitzResultToday}
                  style={{ background: blitzResultToday ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #f59e0b, #ec4899)', color: 'white', width: '100%', padding: '1rem' }}
                  onClick={() => {
                    setBlitzConfigDuration(3); // Lock to 3 minutes for versus mode
                    handleStartBlitz();
                  }}
                >
                  {blitzResultToday ? `⏱️ Próximo em ${timeUntilMidnight}` : <><Zap size={18} fill="white" /> Começar Corrida Blitz (3 min)</>}
                </button>
              </>
            )}
          </div>

          {/* H2H Scoreboard - Hidden under Ambos */}
          {activePlayer !== 'Ambos' && h2hScore && (
            <div className="scoreboard">
              <div className="scoreboard-title">Placar Geral Histórico</div>
              <div className="scoreboard-players">
                <div className="player-score-card gabriel">
                  <div className="player-avatar">🧔</div>
                  <div className="player-score-name">Gabriel</div>
                  <div className="player-score-value">{h2hScore.gabrielWins}</div>
                </div>

                <div className="scoreboard-divider">
                  vs
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'normal', marginTop: '0.25rem' }}>
                    {h2hScore.draws} empates
                  </div>
                </div>

                <div className="player-score-card alessandra">
                  <div className="player-avatar">👩</div>
                  <div className="player-score-name">Alessandra</div>
                  <div className="player-score-value">{h2hScore.alessandraWins}</div>
                </div>
              </div>
            </div>
          )}

          {/* Today's Mode challenges list - Visible under Ambos */}
          {activePlayer === 'Ambos' && (
            <>
              <h2 className="section-title"><Calendar size={22} color="var(--accent-cyan)" /> Desafios Cooperativos de Hoje ({todayStr})</h2>
              <div className="challenge-grid">

                {/* Mode 1 */}
                <div className="challenge-card mode-1">
                  <div className="challenge-header">
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                      <div className="challenge-badge">Termo</div>
                      <span className="versus-indicator-badge" title="Disponível no Modo Versus">⚔️ Versus</span>
                    </div>
                    <div className="challenge-status-indicator">
                      {todayResult?.mode1 ? '✅' : '❌'}
                    </div>
                  </div>
                  <h3 className="challenge-title">Termo</h3>
                  <p className="challenge-desc">Adivinhe uma única palavra de {todayChallenge ? todayChallenge.words.mode1.length : '5'} letras em até {todayChallenge ? todayChallenge.words.mode1.length + 1 : 6} tentativas.</p>

                  {todayResult?.mode1 && (
                    <div className="challenge-stats">
                      <div className="challenge-stat-row">
                        <span className="challenge-stat-label">Tentativas:</span>
                        <span className="challenge-stat-value">{todayResult.mode1.attempts}/{todayChallenge ? todayChallenge.words.mode1.length + 1 : 6}</span>
                      </div>
                      <div className="challenge-stat-row">
                        <span className="challenge-stat-label">Tempo:</span>
                        <span className="challenge-stat-value">{formatTime(todayResult.mode1.time)}</span>
                      </div>
                      <div className="challenge-stat-row">
                        <span className="challenge-stat-label">Pontos:</span>
                        <span className="challenge-stat-value" style={{ color: 'var(--color-correct)' }}>{todayResult.mode1.score}</span>
                      </div>
                    </div>
                  )}

                  <button
                    className="challenge-btn"
                    disabled={!!todayResult?.mode1}
                    onClick={() => handleStartGame(1)}
                  >
                    {todayResult?.mode1 ? `⏱️ Próximo em ${timeUntilMidnight}` : <><Play size={16} fill="white" /> Jogar</>}
                  </button>
                </div>

                {/* Mode 2 */}
                <div className="challenge-card mode-2">
                  <div className="challenge-header">
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                      <div className="challenge-badge">Dueto</div>
                      <span className="versus-indicator-badge" title="Disponível no Modo Versus">⚔️ Versus</span>
                    </div>
                    <div className="challenge-status-indicator">
                      {todayResult?.mode2 ? '✅' : '❌'}
                    </div>
                  </div>
                  <h3 className="challenge-title">Dueto</h3>
                  <p className="challenge-desc">
                    Adivinhe duas palavras de{' '}
                    {todayChallenge
                      ? todayChallenge.words.mode2.map(w => w.length).join(' e ')
                      : 'tamanhos variados'}{' '}
                    letras simultaneamente em até{' '}
                    {todayChallenge
                      ? Math.max(...todayChallenge.words.mode2.map(w => w.length)) + 1
                      : 7}{' '}
                    tentativas. Palpites valem para ambas.
                  </p>

                  {todayResult?.mode2 && (
                    <div className="challenge-stats">
                      <div className="challenge-stat-row">
                        <span className="challenge-stat-label">Tentativas:</span>
                        <span className="challenge-stat-value">
                          {todayResult.mode2.attempts}/
                          {todayChallenge
                            ? Math.max(...todayChallenge.words.mode2.map(w => w.length)) + 1
                            : 7}
                        </span>
                      </div>
                      <div className="challenge-stat-row">
                        <span className="challenge-stat-label">Tempo:</span>
                        <span className="challenge-stat-value">{formatTime(todayResult.mode2.time)}</span>
                      </div>
                      <div className="challenge-stat-row">
                        <span className="challenge-stat-label">Pontos:</span>
                        <span className="challenge-stat-value" style={{ color: 'var(--color-present)' }}>{todayResult.mode2.score}</span>
                      </div>
                    </div>
                  )}

                  <button
                    className="challenge-btn"
                    disabled={!!todayResult?.mode2}
                    onClick={() => handleStartGame(2)}
                  >
                    {todayResult?.mode2 ? `⏱️ Próximo em ${timeUntilMidnight}` : <><Play size={16} fill="white" /> Jogar</>}
                  </button>
                </div>

                {/* Mode 4 */}
                <div className="challenge-card mode-4">
                  <div className="challenge-header">
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                      <div className="challenge-badge">Quarteto</div>
                      <span className="versus-indicator-badge" title="Disponível no Modo Versus">⚔️ Versus</span>
                    </div>
                    <div className="challenge-status-indicator">
                      {todayResult?.mode4 ? '✅' : '❌'}
                    </div>
                  </div>
                  <h3 className="challenge-title">Quarteto</h3>
                  <p className="challenge-desc">
                    Adivinhe quatro palavras de{' '}
                    {todayChallenge
                      ? todayChallenge.words.mode4.map(w => w.length).slice(0, -1).join(', ') + ' e ' + todayChallenge.words.mode4.slice(-1)[0].length
                      : 'tamanhos variados'}{' '}
                    letras simultaneamente em até{' '}
                    {todayChallenge
                      ? Math.max(...todayChallenge.words.mode4.map(w => w.length)) + 1
                      : 9}{' '}
                    tentativas. O teste supremo.
                  </p>

                  {todayResult?.mode4 && (
                    <div className="challenge-stats">
                      <div className="challenge-stat-row">
                        <span className="challenge-stat-label">Tentativas:</span>
                        <span className="challenge-stat-value">
                          {todayResult.mode4.attempts}/
                          {todayChallenge
                            ? Math.max(...todayChallenge.words.mode4.map(w => w.length)) + 1
                            : 9}
                        </span>
                      </div>
                      <div className="challenge-stat-row">
                        <span className="challenge-stat-label">Tempo:</span>
                        <span className="challenge-stat-value">{formatTime(todayResult.mode4.time)}</span>
                      </div>
                      <div className="challenge-stat-row">
                        <span className="challenge-stat-label">Pontos:</span>
                        <span className="challenge-stat-value" style={{ color: 'var(--accent-pink)' }}>{todayResult.mode4.score}</span>
                      </div>
                    </div>
                  )}

                  <button
                    className="challenge-btn"
                    disabled={!!todayResult?.mode4}
                    onClick={() => handleStartGame(4)}
                  >
                    {todayResult?.mode4 ? `⏱️ Próximo em ${timeUntilMidnight}` : <><Play size={16} fill="white" /> Jogar</>}
                  </button>
                </div>

              </div>
            </>
          )}

          {/* Stats & History Sections - Shown for individuals, records shown for Ambos */}
          {activePlayer !== 'Ambos' ? (
            <div className="stats-history-row">

              {/* Player Stats Dashboard */}
              <div className="dashboard-panel">
                <h2 className="section-title" style={{ marginBottom: '1.5rem' }}>
                  <TrendingUp size={20} color="var(--accent-purple)" /> Estatísticas de {activePlayer} (no Duelo)
                </h2>
                {playerStats && (
                  <div className="stats-cards-grid">
                    <div className="stat-mini-card">
                      <span className="stat-mini-label">Taxa de Vitória</span>
                      <span className="stat-mini-value">{playerStats.winRate}%</span>
                      <span className="stat-mini-sub">{playerStats.wins}V - {playerStats.losses}D - {playerStats.draws}E</span>
                    </div>

                    <div className="stat-mini-card">
                      <span className="stat-mini-label">Sequência de Vitórias</span>
                      <span className="stat-mini-value">{playerStats.currentStreak} 🔥</span>
                      <span className="stat-mini-sub">Máxima histórica: {playerStats.maxStreak}</span>
                    </div>

                    <div className="stat-mini-card">
                      <span className="stat-mini-label">Melhor Duelo Diário</span>
                      <span className="stat-mini-value" style={{ color: 'var(--accent-cyan)' }}>
                        {playerStats.bestScore.toFixed(0)} <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>pontos</span>
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Historical Challenges List - Now showing Versus History since there are no individual daily challenges */}
              <div className="dashboard-panel">
                <h2 className="section-title" style={{ marginBottom: '1.5rem' }}>
                  <Users size={20} color="var(--accent-cyan)" /> Histórico do Duelo Versus
                </h2>
                <div className="history-list">
                  {versusHistory.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>Nenhuma partida versus registrada.</div>
                  ) : (
                    versusHistory.map((v) => (
                      <div className="history-item" key={v.date} style={{ borderLeft: `4px solid ${v.winner === 'Gabriel' ? 'var(--accent-purple)' : v.winner === 'Alessandra' ? 'var(--accent-cyan)' : 'var(--text-muted)'}` }}>
                        <div className="history-date-info">
                          <span className="history-date">{v.date}</span>
                          <span className="history-words">Duelo Versus Diário</span>
                        </div>

                        <div className="history-scores">
                          <div className="history-player-val gabriel">
                            <span>{v.gabrielTotal}</span>
                            GAB
                          </div>
                          <div className="history-player-val alessandra">
                            <span>{v.alessandraTotal}</span>
                            ALE
                          </div>

                          <div className={`history-winner-badge ${v.winner.toLowerCase()}`}>
                            {v.winner === 'Gabriel' && '🧔 Gabriel'}
                            {v.winner === 'Alessandra' && '👩 Alessandra'}
                            {v.winner === 'Empate' && '🤝 Empate'}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          ) : (
            /* 'Ambos' Profile specific records grids and match history lists */
            <div className="stats-history-row">

              {/* Recordes/Stats Cooperativos */}
              <div>
                {/* Estatísticas Cooperativas */}
                <div className="dashboard-panel" style={{ marginBottom: '2rem' }}>
                  <h2 className="section-title" style={{ marginBottom: '1.5rem' }}>
                    <TrendingUp size={20} color="var(--accent-purple)" /> Estatísticas Cooperativas (Ambos)
                  </h2>
                  {playerStats && (
                    <div className="stats-cards-grid">
                      <div className="stat-mini-card">
                        <span className="stat-mini-label">Sequência Diária</span>
                        <span className="stat-mini-value">{playerStats.currentStreak} 🔥</span>
                        <span className="stat-mini-sub">Máxima histórica: {playerStats.maxStreak}</span>
                      </div>

                      <div className="stat-mini-card">
                        <span className="stat-mini-label">Desafios Concluídos</span>
                        <span className="stat-mini-value">{getAmbosDailyHistory().length}</span>
                        <span className="stat-mini-sub">Dias de cooperação</span>
                      </div>

                      <div className="stat-mini-card">
                        <span className="stat-mini-label">Média de Tentativas</span>
                        <span className="stat-mini-value">{playerStats.avgAttempts}</span>
                        <span className="stat-mini-sub">Por modo concluído</span>
                      </div>

                      <div className="stat-mini-card">
                        <span className="stat-mini-label">Média de Tempo</span>
                        <span className="stat-mini-value">{formatTime(playerStats.avgTime)}</span>
                        <span className="stat-mini-sub">Por modo bem-sucedido</span>
                      </div>

                      <div className="stat-mini-card" style={{ gridColumn: 'span 2' }}>
                        <span className="stat-mini-label">Melhor Pontuação Diária</span>
                        <span className="stat-mini-value" style={{ color: 'var(--accent-cyan)' }}>
                          {playerStats.bestScore.toFixed(0)} <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>pontos</span>
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Recordes Blitz */}
                <div className="dashboard-panel">
                  <h2 className="section-title" style={{ marginBottom: '1.5rem' }}>
                    <Trophy size={20} color="var(--color-present)" /> Recordes Blitz (Gabriel + Alessandra)
                  </h2>

                  <div className="stats-cards-grid">
                    <div className="stat-mini-card" style={{ borderLeft: '3px solid var(--accent-cyan)' }}>
                      <span className="stat-mini-label">⏱️ Recorde 1 min</span>
                      <span className="stat-mini-value" style={{ color: 'var(--accent-cyan)' }}>{getRecordForDuration(1)} <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 'normal' }}>palavras</span></span>
                      <span className="stat-mini-sub">Cooperativo Ambos</span>
                    </div>

                    <div className="stat-mini-card" style={{ borderLeft: '3px solid var(--color-present)' }}>
                      <span className="stat-mini-label">⏱️ Recorde 3 min</span>
                      <span className="stat-mini-value" style={{ color: 'var(--color-present)' }}>{getRecordForDuration(3)} <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 'normal' }}>palavras</span></span>
                      <span className="stat-mini-sub">Cooperativo Ambos</span>
                    </div>

                    <div className="stat-mini-card" style={{ borderLeft: '3px solid var(--accent-purple)' }}>
                      <span className="stat-mini-label">⏱️ Recorde 5 min</span>
                      <span className="stat-mini-value" style={{ color: 'var(--accent-purple)' }}>{getRecordForDuration(5)} <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 'normal' }}>palavras</span></span>
                      <span className="stat-mini-sub">Cooperativo Ambos</span>
                    </div>

                    <div className="stat-mini-card" style={{ borderLeft: '3px solid var(--accent-pink)' }}>
                      <span className="stat-mini-label">⏱️ Recorde 10 min</span>
                      <span className="stat-mini-value" style={{ color: 'var(--accent-pink)' }}>{getRecordForDuration(10)} <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 'normal' }}>palavras</span></span>
                      <span className="stat-mini-sub">Cooperativo Ambos</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Históricos Cooperativos */}
              <div>
                {/* Histórico Cooperativo Diário */}
                <div className="dashboard-panel" style={{ marginBottom: '2rem' }}>
                  <h2 className="section-title" style={{ marginBottom: '1.5rem' }}>
                    <Activity size={20} color="var(--accent-cyan)" /> Histórico Cooperativo Diário
                  </h2>
                  <div className="history-list">
                    {(() => {
                      const ambosHistory = getAmbosDailyHistory();
                      return ambosHistory.length === 0 ? (
                        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>Nenhum desafio diário cooperativo concluído ainda.</div>
                      ) : (
                        ambosHistory.map((day) => (
                          <div className="history-item" key={day.date}>
                            <div className="history-date-info">
                              <span className="history-date">{day.date}</span>
                              <span className="history-words">Pontuação Total: {day.totalScore} pts</span>
                            </div>
                            <div style={{ display: 'flex', gap: '0.4rem' }}>
                              <span className="history-winner-badge completed" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)' }}>Concluído ✓</span>
                            </div>
                          </div>
                        ))
                      );
                    })()}
                  </div>
                </div>

                {/* Histórico Blitz */}
                <div className="dashboard-panel">
                  <h2 className="section-title" style={{ marginBottom: '1.5rem' }}>
                    <Activity size={20} color="var(--accent-pink)" /> Histórico Blitz
                  </h2>
                  <div className="history-list">
                    {blitzHistoryList.length === 0 ? (
                      <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>Nenhuma corrida Blitz disputada ainda.</div>
                    ) : (
                      blitzHistoryList.map((b) => (
                        <div className="history-item" key={b.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <div className="history-date-info">
                            <span className="history-date">{b.date}</span>
                            <span className="history-words">Duração: {b.duration} min | Streak: {b.maxStreak} 🔥</span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '1.4rem', fontWeight: '900', color: 'var(--color-present)' }}>{b.wordsSolved}</span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: '600' }}>PALAVRAS</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

            </div>
          )}

        </main>
      ) : (
        /* Gameplay Screen View */
        <div className="game-container">
          <div className="game-header">
            <div className="game-header-left">
              <button className="back-btn" onClick={handleBackToDashboard}>
                <ArrowLeft size={18} />
              </button>
              <div className="game-title-info">
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <span>
                    {gameModeType === 'blitz'
                      ? `Modo Blitz`
                      : gameModeType === 'bomb'
                        ? 'Modo Bomba'
                        : gameModeType === 'crossword'
                          ? 'Palavras Cruzadas'
                          : (activeMode === 1 ? 'Termo' : activeMode === 2 ? 'Dueto' : 'Quarteto')}
                  </span>
                  {gameModeType !== 'crossword' && targetWords.length > 0 && (
                    <span className="word-len-badge">
                      {getWordsLengthsString()}
                    </span>
                  )}
                </h2>
                <p>
                  {gameModeType === 'blitz'
                    ? `Ambos (Gabriel + Alessandra) | Palavra ${blitzCurrentWordIdx + 1}`
                    : gameModeType === 'bomb'
                      ? `Jogador: ${activePlayer} | Tentativa única diária`
                      : gameModeType === 'crossword'
                        ? `Jogador: ${activePlayer} | Pistas com IA`
                        : `Jogador: ${activePlayer} ${gameModeType === 'versus' ? `(Duelo Rodada ${versusRound}/3)` : ''}`}
                </p>
              </div>
            </div>

            <div className="game-timer" style={{ borderColor: gameModeType === 'blitz' || gameModeType === 'bomb' ? 'var(--color-present)' : 'var(--glass-border)' }}>
              {gameModeType === 'blitz' ? (
                <>
                  <Zap size={18} color="var(--color-present)" style={{ animation: 'pulse 1s infinite' }} />
                  <span style={{ color: 'var(--color-present)' }}>{formatTime(blitzRemainingTime)}</span>
                </>
              ) : gameModeType === 'bomb' ? (
                <>
                  <Bomb size={18} color="var(--color-present)" />
                  <span style={{ color: 'var(--color-present)' }}>{bombCharge}%</span>
                </>
              ) : (
                <>
                  <Clock size={18} color="var(--accent-cyan)" />
                  {formatTime(elapsedTime)}
                </>
              )}
            </div>
          </div>

          {/* Solved details counter during active Blitz gameplay */}
          {gameModeType === 'blitz' && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginBottom: '1.25rem', padding: '0.4rem 1rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', borderRadius: '12px', width: 'fit-content', margin: '0 auto 1.5rem auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Zap size={16} color="var(--accent-cyan)" />
                <span>Resolvidas: <strong style={{ color: 'var(--accent-cyan)', fontSize: '1.1rem' }}>{blitzSolvedCount}</strong></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Flame size={16} color="var(--color-present)" />
                <span>Streak: <strong style={{ color: 'var(--color-present)', fontSize: '1.1rem' }}>{blitzCurrentStreak}</strong></span>
              </div>
            </div>
          )}

          {gameModeType === 'bomb' && (
            <div className="bomb-panel">
              <div className="bomb-meter-header">
                <span>Carga da bomba</span>
                <strong>{bombCharge}%</strong>
              </div>
              <div className="bomb-meter">
                <div className="bomb-meter-fill" style={{ width: `${bombCharge}%` }} />
              </div>
              <div className="bomb-meter-note">
                {bombLastDelta === 0 ? 'A primeira tentativa define o ritmo.' : bombLastDelta > 0 ? `+${bombLastDelta}% de carga nesta tentativa.` : `${bombLastDelta}% de carga nesta tentativa.`}
              </div>
            </div>
          )}

          {gameModeType === 'crossword' && crosswordChallenge ? (
            <div className="crossword-layout-container">
              <div className="crossword-layout">
                <div className="crossword-grid" style={{ gridTemplateColumns: `repeat(${crosswordChallenge.size}, 1fr)` }}>
                  {Array.from({ length: crosswordChallenge.size * crosswordChallenge.size }).map((_, index) => {
                    const row = Math.floor(index / crosswordChallenge.size);
                    const col = index % crosswordChallenge.size;
                    const meta = getCrosswordCellMeta(row, col);
                    const solved = !!meta?.entries.every(entry => crosswordSolvedIds.includes(entry.id));
                    return meta ? (
                      <label
                        key={meta.key}
                        className={`crossword-cell ${solved ? 'solved' : ''} ${isCellInActiveClue(row, col) ? 'active-word' : ''} ${crosswordFocusedKey === meta.key ? 'focused' : ''}`}
                      >
                        {meta.number && <span>{meta.number}</span>}
                        <input
                          id={`crossword-cell-${meta.key}`}
                          value={crosswordCells[meta.key] || ''}
                          onFocus={() => {
                            setCrosswordFocusedKey(meta.key);
                            selectClueForCell(meta.key);
                          }}
                          onClick={() => handleCellClick(meta.key)}
                          onKeyDown={(event) => handleCrosswordKeyDown(meta.key, event)}
                          onChange={(event) => handleCrosswordCellChange(meta.key, event.target.value)}
                          maxLength={1}
                          autoComplete="off"
                        />
                      </label>
                    ) : (
                      <div key={`${row}-${col}`} className="crossword-cell blocked" />
                    );
                  })}
                </div>

                <div className="crossword-clues">
                  <div className="crossword-clues-title">
                    <Sparkles size={18} color="var(--accent-cyan)" /> Pistas Diárias com IA
                  </div>

                  <div className="crossword-clues-sections">
                    <div className="crossword-clues-column">
                      <h4 className="clues-column-title">➡️ Horizontais</h4>
                      <div className="clues-list">
                        {crosswordChallenge.entries
                          .filter(entry => entry.direction === 'across')
                          .map(entry => (
                            <button
                              key={entry.id}
                              className={`crossword-clue ${crosswordSelectedId === entry.id ? 'active' : ''} ${crosswordSolvedIds.includes(entry.id) ? 'solved' : ''}`}
                              onClick={() => {
                                setCrosswordSelectedId(entry.id);
                                const firstCellKey = `${entry.row}-${entry.col}`;
                                setCrosswordFocusedKey(firstCellKey);
                                document.getElementById(`crossword-cell-${firstCellKey}`)?.focus();
                              }}
                            >
                              <div className="clue-meta-row">
                                <span className="clue-id-badge">{entry.id.replace(/[AD]/g, '')}</span>
                                <span className="clue-type-badge">{entry.clueType}</span>
                              </div>
                              <strong>{entry.clue}</strong>
                            </button>
                          ))}
                      </div>
                    </div>

                    <div className="crossword-clues-column">
                      <h4 className="clues-column-title">⬇️ Verticais</h4>
                      <div className="clues-list">
                        {crosswordChallenge.entries
                          .filter(entry => entry.direction === 'down')
                          .map(entry => (
                            <button
                              key={entry.id}
                              className={`crossword-clue ${crosswordSelectedId === entry.id ? 'active' : ''} ${crosswordSolvedIds.includes(entry.id) ? 'solved' : ''}`}
                              onClick={() => {
                                setCrosswordSelectedId(entry.id);
                                const firstCellKey = `${entry.row}-${entry.col}`;
                                setCrosswordFocusedKey(firstCellKey);
                                document.getElementById(`crossword-cell-${firstCellKey}`)?.focus();
                              }}
                            >
                              <div className="clue-meta-row">
                                <span className="clue-id-badge">{entry.id.replace(/[AD]/g, '')}</span>
                                <span className="clue-type-badge">{entry.clueType}</span>
                              </div>
                              <strong>{entry.clue}</strong>
                            </button>
                          ))}
                      </div>
                    </div>
                  </div>

                  {crosswordMessage && <div className="crossword-message">{crosswordMessage}</div>}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                    <button className="modal-close-btn" style={{ margin: 0 }} onClick={() => validateCrosswordEntry(crosswordSelectedId)}>
                      Validar Palavra
                    </button>
                    <button
                      className="crossword-giveup-btn"
                      onClick={() => finishSpecialMode('crossword', false, crosswordSolvedIds.length, crosswordSolvedIds.length, 'Tentativa encerrada.', 0)}
                    >
                      Encerrar Tentativa
                    </button>
                  </div>
                </div>
              </div>

              {/* On-screen virtual keyboard */}
              <div style={{ marginTop: '2.5rem', width: '100%' }}>
                <Keyboard
                  onChar={handleCrosswordCharInput}
                  onDelete={handleCrosswordDeleteInput}
                  onEnter={handleCrosswordEnterInput}
                  letterStatuses={{}}
                />
              </div>
            </div>
          ) : (
            <div className={gameModeType === 'versus' ? 'versus-layout' : ''}>
              <div>
                {woRemainingTime !== null && (
                  <div className="wo-warning-banner" style={{
                    background: 'rgba(239, 68, 68, 0.95)',
                    color: '#fff',
                    padding: '0.75rem',
                    textAlign: 'center',
                    fontWeight: 'bold',
                    fontSize: '0.9rem',
                    borderRadius: '8px',
                    marginBottom: '1rem',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    boxShadow: '0 4px 15px rgba(239, 68, 68, 0.4)'
                  }}>
                    ⚠️ Oponente desconectado! Vitória por W.O. em {formatTime(woRemainingTime)}
                  </div>
                )}
                <input
                  ref={boardInputRef}
                  type="text"
                  inputMode="text"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck="false"
                  value=" "
                  onChange={(event: ChangeEvent<HTMLInputElement>) => {
                    const val = event.target.value;
                    if (val.length > 1) {
                      const char = val.slice(-1).toUpperCase();
                      if (/^[A-Z]$/.test(char)) {
                        handleCharInput(char);
                      }
                    } else if (val.length === 0) {
                      handleDeleteInput();
                    }
                    event.target.value = " ";
                  }}
                  onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
                    if (event.key === 'Enter') {
                      handleEnterInput();
                    }
                  }}
                  aria-label="Entrada de letras do jogo"
                  className="hidden-native-input"
                />

                {gameModeType === 'versus' && (
                  <div className="versus-live-score">
                    <div className="versus-live-title">Seu Placar</div>
                    <div className="versus-live-row">
                      <div>
                        <div className="versus-live-label">Jogador</div>
                        <div className="versus-live-value">{activePlayer}</div>
                      </div>
                      <div>
                        <div className="versus-live-label">Total</div>
                        <div className="versus-live-value">{myVersusScores.total} pts</div>
                      </div>
                      <div>
                        <div className="versus-live-label">Rodada</div>
                        <div className="versus-live-value">{currentRoundName}</div>
                      </div>
                    </div>
                    <div className="versus-live-row">
                      <div>
                        <div className="versus-live-label">Esta rodada</div>
                        <div className="versus-live-value">{currentRoundScore || 0} pts</div>
                      </div>
                      <div>
                        <div className="versus-live-label">Oponente</div>
                        <div className="versus-live-value">{opponentName}: {opponentVersusScores.total} pts</div>
                      </div>
                    </div>
                  </div>
                )}

                <GameBoard
                  mode={activeMode}
                  words={targetWords}
                  guesses={guesses}
                  currentGuess={currentGuess}
                  maxAttempts={maxAttempts}
                  shakeRowIndex={shakeRowIndex}
                  onCellClick={(idx) => {
                    setFocusedCharIndex(idx);
                    if (boardInputRef.current) {
                      boardInputRef.current.focus();
                    }
                  }}
                  focusedCellIndex={focusedCharIndex}
                />

                <Keyboard
                  onChar={handleCharInput}
                  onDelete={handleDeleteInput}
                  onEnter={handleEnterInput}
                  onBeginInput={() => {
                    if (boardInputRef.current) {
                      boardInputRef.current.focus();
                    }
                  }}
                  letterStatuses={aggregatedLetterStatuses()}
                />
              </div>

              {/* Versus Opponent Live Tracker Sidepanel */}
              {gameModeType === 'versus' && (
                <div className="versus-opp-panel">
                  <div className="versus-opp-header">
                    <div style={{ fontSize: '1.5rem' }}>{opponentName === 'Gabriel' ? '🧔' : '👩'}</div>
                    <div style={{ textAlign: 'left' }}>
                      <div className="versus-opp-name">{opponentName}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Oponente em Tempo Real</div>
                    </div>
                    <div className="versus-opp-status">
                      {oppState.completed ? 'Concluído 🏁' : 'Jogando ⚡'}
                    </div>
                  </div>

                  <div className="versus-opp-round">
                    <span>
                      <strong>Rodada {oppState.round <= 3 ? oppState.round : 3}/3:</strong>{' '}
                      {oppState.round === 1 ? 'Termo' : oppState.round === 2 ? 'Dueto' : 'Quarteto'}
                    </span>
                    <span>{oppState.progress}%</span>
                  </div>

                  <div className="versus-progress-bg">
                    <div
                      className="versus-progress-bar"
                      style={{ width: `${oppState.progress}%` }}
                    />
                  </div>

                  <div style={{ textAlign: 'left', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                    Progresso do Oponente:
                  </div>
                  <div className="versus-ticker">
                    {oppState.ticker.slice(-5).map((line, idx) => {
                      let textClass = 'versus-ticker-text';
                      if (line.includes('resolveu') || line.includes('completou')) textClass += ' solved';
                      else if (line.includes('enviou') || line.includes('iniciou')) textClass += ' action';

                      const timestamp = line.substring(0, 8);
                      const rest = line.substring(8);

                      return (
                        <div className="versus-ticker-line" key={idx}>
                          <span className="versus-ticker-time">{timestamp}</span>
                          <span className={textClass}>{rest}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Individual Game Result Modal */}
          {showGameModal && (
            <div className="modal-overlay">
              <div className={`modal-content ${modalSuccess ? 'success' : 'fail'}`}>
                <div className="modal-icon">{modalSuccess ? '🎉' : '💀'}</div>
                <h2 className="modal-title">{modalSuccess ? 'Vitória!' : 'Derrota!'}</h2>
                <p className="modal-subtitle">
                  {modalSuccess
                    ? `Parabéns, ${activePlayer}! Você completou este desafio com sucesso.`
                    : `Infelizmente você não conseguiu descobrir todas as palavras secreta(s).`}
                </p>

                <div className="modal-stats-summary">
                  <div className="modal-stat-box">
                    <span className="modal-stat-label">Pontuação</span>
                    <span className="modal-stat-value" style={{ color: 'var(--accent-cyan)' }}>{modalScore}</span>
                  </div>
                  <div className="modal-stat-box">
                    <span className="modal-stat-label">Tentativas</span>
                    <span className="modal-stat-value">{modalAttempts}/{maxAttempts}</span>
                  </div>
                  <div className="modal-stat-box">
                    <span className="modal-stat-label">Tempo</span>
                    <span className="modal-stat-value">{formatTime(modalTime)}</span>
                  </div>
                </div>

                <div className="modal-words-list">
                  <div className="modal-words-title">Palavra{targetWords.length > 1 ? 's' : ''} do desafio:</div>
                  {targetWords.map((word, idx) => (
                    <span key={word} className="modal-word-badge">
                      {word} {solvedBoards[idx] ? '✅' : '❌'}
                    </span>
                  ))}
                </div>

                <button className="modal-close-btn" onClick={handleBackToDashboard}>
                  Voltar ao Dashboard
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
