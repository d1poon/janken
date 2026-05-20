'use strict';

// ===== 定数 =====
const HANDS = {
  rock:     { icon: '✊', label: 'グー' },
  scissors: { icon: '✌️', label: 'チョキ' },
  paper:    { icon: '🖐️', label: 'パー' },
};

const WIN_MAP = {
  rock: 'scissors',
  scissors: 'paper',
  paper: 'rock',
};

const RANKING_KEY    = 'janken_ranking_v1';
const TA_RANKING_KEY = 'janken_ta_ranking_v1';
const BADGE_KEY      = 'janken_badges_v1';
const RANKING_MAX    = 5;
const MEDALS         = ['🥇', '🥈', '🥉', '4', '5'];
const HISTORY_SIZE   = 10;
const TA_DURATION    = 30; // タイムアタック秒数

const CALLS = ['じゃんけん…', '最初はグー…', 'いくぞ…', 'さぁいくよ…', 'そーれ…'];

// バッジ定義
const BADGES = [
  { id: 'first_win',   icon: '🎉', name: '初勝利',        desc: '初めて勝った' },
  { id: 'streak3',     icon: '🔥', name: '3連勝',         desc: '3連勝達成' },
  { id: 'streak5',     icon: '⚡', name: '5連勝',         desc: '5連勝達成' },
  { id: 'streak10',    icon: '👑', name: '10連勝',        desc: '10連勝達成' },
  { id: 'ta_played',   icon: '⏱', name: 'タイムアタック', desc: 'TAモードに挑戦した' },
  { id: 'ta15',        icon: '🚀', name: 'スピードスター', desc: 'TAで15勝以上' },
  { id: 'pvp_played',  icon: '👥', name: '友達と対戦',    desc: 'PvPモードを使った' },
  { id: 'beat_insane', icon: '🤖', name: 'CPU撃破',       desc: '鬼CPUに勝った' },
];

// ===== 状態 =====
let streak    = 0;
let pvpStreak = 0;
let isPlaying = false;
const playerHistory = [];

// 難易度
let difficulty = 'normal'; // 'easy' | 'normal' | 'hard' | 'insane'

// ゲームモード
let gameMode        = 'streak'; // 'streak' | 'timeattack'
let taScore         = 0;
let taTimeLeft      = TA_DURATION;
let taTimerInterval = null;
let taActive        = false;

// PvPモード
let pvpMode   = false;
let roomId    = null;
let playerNum = null;
let myHandPvp = null;
let pollTimer = null;

// ===== DOM =====
const cpuHandEl        = document.getElementById('cpu-hand');
const callTextEl       = document.getElementById('call-text');
const resultTextEl     = document.getElementById('result-text');
const streakEl         = document.getElementById('streak');
const bestEl           = document.getElementById('best');
const battleArea       = document.getElementById('battle-area');
const choiceBtns       = document.querySelectorAll('.choice-btn');
const rankListEl       = document.getElementById('rank-list');
const onlineRankListEl = document.getElementById('online-rank-list');
const newRecordBanner  = document.getElementById('new-record-banner');
const confettiLayer    = document.getElementById('confetti-layer');
const shareBtn         = document.getElementById('share-btn');
const pvpCreateBtn     = document.getElementById('pvp-create-btn');
const pvpInviteEl      = document.getElementById('pvp-invite');
const pvpUrlBoxEl      = document.getElementById('pvp-url-box');
const pvpCopyBtnEl     = document.getElementById('pvp-copy-btn');
const pvpStatusBarEl   = document.getElementById('pvp-status-bar');
const pvpStatusTextEl  = document.getElementById('pvp-status-text');
const pvpExitBtnEl     = document.getElementById('pvp-exit-btn');
const opponentLabelEl  = document.getElementById('opponent-label');
const rankingSection   = document.getElementById('ranking-section');
const headerSub        = document.getElementById('header-sub');
const taTimerEl        = document.getElementById('ta-timer');
const taTimeLeftEl     = document.getElementById('ta-time-left');
const modeBar          = document.getElementById('mode-bar');
const difficultyBar    = document.getElementById('difficulty-bar');
const badgeSection     = document.getElementById('badge-section');
const scoreLabelLeft   = document.getElementById('score-label-left');
const scoreLabelRight  = document.getElementById('score-label-right');

// ===== 効果音 =====
let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) audioCtx = new Ctx();
  }
  return audioCtx;
}

function playSound(type) {
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    if (type === 'pon') {
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(55, now + 0.12);
      g.gain.setValueAtTime(0.45, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.start(now); osc.stop(now + 0.15);
    }

    if (type === 'win') {
      [523, 659, 784].forEach((freq, i) => {
        const osc = ctx.createOscillator(), g = ctx.createGain();
        osc.connect(g); g.connect(ctx.destination);
        osc.type = 'triangle'; osc.frequency.value = freq;
        g.gain.setValueAtTime(0.22, now + i * 0.11);
        g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.11 + 0.25);
        osc.start(now + i * 0.11); osc.stop(now + i * 0.11 + 0.28);
      });
    }

    if (type === 'lose') {
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(350, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.45);
      g.gain.setValueAtTime(0.22, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc.start(now); osc.stop(now + 0.5);
    }

    if (type === 'record') {
      [523, 659, 784, 1047].forEach((freq, i) => {
        const osc = ctx.createOscillator(), g = ctx.createGain();
        osc.connect(g); g.connect(ctx.destination);
        osc.type = 'triangle'; osc.frequency.value = freq;
        g.gain.setValueAtTime(0.22, now + i * 0.1);
        g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.25);
        osc.start(now + i * 0.1); osc.stop(now + i * 0.1 + 0.3);
      });
    }

    if (type === 'pvp-join') {
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(660, now + 0.1);
      g.gain.setValueAtTime(0.2, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.start(now); osc.stop(now + 0.3);
    }
  } catch (_) { /* 未対応ブラウザは無視 */ }
}

// ===== CPU AI（難易度対応） =====
function getCpuHand() {
  const keys = Object.keys(HANDS);

  // やさしい: 完全ランダム
  if (difficulty === 'easy') return keys[Math.floor(Math.random() * keys.length)];

  // 難易度別パラメータ
  const historySize = difficulty === 'insane' ? 3 : difficulty === 'hard' ? 5 : HISTORY_SIZE;
  const counterProb = difficulty === 'insane' ? 1.0 : difficulty === 'hard' ? 0.8 : 0.5;

  if (playerHistory.length < 3) return keys[Math.floor(Math.random() * keys.length)];

  const recent = playerHistory.slice(-historySize);
  const counts  = { rock: 0, scissors: 0, paper: 0 };
  recent.forEach(h => counts[h]++);
  const mostUsed = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];

  if (Math.random() < counterProb) {
    return Object.entries(WIN_MAP).find(([, v]) => v === mostUsed)[0];
  }
  return keys[Math.floor(Math.random() * keys.length)];
}

// ===== 連勝メッセージ =====
function getWinMessage(s) {
  if (s >= 10) return `${s}連勝！伝説だ🏆`;
  if (s >= 8)  return `${s}連勝…バケモノか👹`;
  if (s >= 5)  return `${s}連勝！本当に人間？😱`;
  if (s >= 3)  return `${s}連勝！調子いいね🔥`;
  return '勝ち！🎉';
}

// ===========================
// ===== バッジシステム =====
// ===========================

function loadBadges() {
  try { return JSON.parse(localStorage.getItem(BADGE_KEY) || '[]'); }
  catch { return []; }
}

function unlockBadge(id) {
  const unlocked = loadBadges();
  if (unlocked.includes(id)) return false;
  unlocked.push(id);
  localStorage.setItem(BADGE_KEY, JSON.stringify(unlocked));
  renderBadges(id); // アニメーション付きで再描画
  return true;
}

function checkAndUnlockBadges() {
  const s = pvpMode ? pvpStreak : streak;
  if (s >= 1)  unlockBadge('first_win');
  if (s >= 3)  unlockBadge('streak3');
  if (s >= 5)  unlockBadge('streak5');
  if (s >= 10) unlockBadge('streak10');
  if (!pvpMode && difficulty === 'insane') unlockBadge('beat_insane');
  if (pvpMode) unlockBadge('pvp_played');
}

function renderBadges(newlyUnlockedId = null) {
  const badgeGrid  = document.getElementById('badge-grid');
  const badgeCount = document.getElementById('badge-count');
  if (!badgeGrid) return;

  const unlocked = loadBadges();
  if (badgeCount) badgeCount.textContent = `${unlocked.length}/${BADGES.length}`;

  badgeGrid.innerHTML = BADGES.map(b => `
    <div class="badge-item ${unlocked.includes(b.id) ? 'unlocked' : ''} ${b.id === newlyUnlockedId ? 'newly-unlocked' : ''}" title="${b.desc}">
      <span class="badge-icon">${b.icon}</span>
      <span class="badge-name">${b.name}</span>
    </div>
  `).join('');
}

// ===========================
// ===== タイムアタックモード =====
// ===========================

function startTimeAttack() {
  taActive   = true;
  taScore    = 0;
  taTimeLeft = TA_DURATION;

  taTimerEl.style.display = 'flex';
  taTimeLeftEl.classList.remove('danger');
  taTimeLeftEl.textContent = taTimeLeft;
  streakEl.textContent = taScore;
  updateScoreLabels();
  renderLocalRanking(); // TAランキング表示に切替

  // 難易度ボタン無効化（TA中は変更不可）
  document.querySelectorAll('.diff-btn').forEach(btn => { btn.disabled = true; });

  unlockBadge('ta_played');
  resetRound();

  taTimerInterval = setInterval(tickTimer, 1000);
}

function tickTimer() {
  taTimeLeft--;
  taTimeLeftEl.textContent = taTimeLeft;
  if (taTimeLeft <= 10) taTimeLeftEl.classList.add('danger');
  if (taTimeLeft <= 0)  endTimeAttack();
}

function endTimeAttack() {
  clearInterval(taTimerInterval);
  taTimerInterval = null;
  taActive = false;

  // 操作を一時停止
  choiceBtns.forEach(btn => { btn.disabled = true; });
  isPlaying = true;

  callTextEl.textContent   = '⏱ タイム！';
  resultTextEl.textContent = `${taScore}勝！`;
  resultTextEl.className   = 'result-text show win';

  if (taScore >= 15) {
    triggerConfetti();
    playSound('record');
    showNewRecordBanner();
    unlockBadge('ta15');
  } else if (taScore > 0) {
    triggerConfetti();
    playSound('win');
  }

  saveTaRanking(taScore);

  setTimeout(() => {
    taTimerEl.style.display = 'none';
    taTimeLeftEl.classList.remove('danger');
    document.querySelectorAll('.diff-btn').forEach(btn => { btn.disabled = false; });
    choiceBtns.forEach(btn => { btn.disabled = false; });
    isPlaying = false;
    resetRound();
  }, 3000);
}

function updateScoreLabels() {
  if (gameMode === 'timeattack') {
    if (scoreLabelLeft)  scoreLabelLeft.textContent  = '⏱ 今回の勝数';
    if (scoreLabelRight) scoreLabelRight.textContent = '⏱ ベスト';
  } else {
    if (scoreLabelLeft)  scoreLabelLeft.textContent  = '現在の連勝';
    if (scoreLabelRight) scoreLabelRight.textContent = '🏆 自己ベスト';
  }
}

function saveTaRanking(score) {
  const list = loadTaRanking();
  list.push({ score, date: new Date().toLocaleDateString('ja-JP') });
  list.sort((a, b) => b.score - a.score);
  const trimmed = list.slice(0, RANKING_MAX);
  localStorage.setItem(TA_RANKING_KEY, JSON.stringify(trimmed));
  renderLocalRanking();
}

function loadTaRanking() {
  try { return JSON.parse(localStorage.getItem(TA_RANKING_KEY) || '[]'); }
  catch { return []; }
}

// ===== オンラインランキング =====
async function fetchOnlineRanking() {
  try {
    const res = await fetch('/api/ranking');
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

async function submitOnlineScore(score) {
  try {
    await fetch('/api/ranking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ score }),
    });
    renderOnlineRanking();
  } catch { /* 無視 */ }
}

async function renderOnlineRanking() {
  onlineRankListEl.innerHTML = '<li class="rank-empty">読み込み中…</li>';
  const list = await fetchOnlineRanking();
  if (!list || list.length === 0) {
    onlineRankListEl.innerHTML = '<li class="rank-empty">まだ記録がありません</li>';
    return;
  }
  onlineRankListEl.innerHTML = list.map((item, i) => `
    <li class="rank-item">
      <span class="rank-medal">${MEDALS[i]}</span>
      <span class="rank-score">${item.score}</span>
      <span class="rank-unit">連勝</span>
      <span class="rank-date">${item.date}</span>
    </li>
  `).join('');
}

// ===== SNSシェア =====
function shareToX(streakCount) {
  const text = `じゃんけん${streakCount}連勝でゲームオーバー…あなたは勝てる？🤜✌️🖐️ #じゃんけん`;
  window.open(
    `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent('https://janken-xi.vercel.app')}`,
    '_blank'
  );
}

// ===========================
// ===== PvPモード =====
// ===========================

function parsePvpParams() {
  const params = new URLSearchParams(window.location.search);
  return { room: params.get('room'), p: parseInt(params.get('p')) || null };
}

async function createRoom() {
  pvpCreateBtn.disabled = true;
  try {
    const res = await fetch('/api/room', { method: 'POST' });
    const data = await res.json();
    roomId    = data.id;
    playerNum = 1;
    enterPvpMode();
    history.replaceState(null, '', `?room=${roomId}&p=1`);
    const shareUrl = `${location.origin}?room=${roomId}&p=2`;
    pvpUrlBoxEl.textContent = shareUrl;
    pvpInviteEl.style.display = 'flex';
    pvpStatusTextEl.textContent = '友達の参加を待っています…';
    startPolling();
  } catch {
    pvpCreateBtn.disabled = false;
    alert('ルームの作成に失敗しました');
  }
}

async function joinRoom(rid, pNum) {
  roomId    = rid;
  playerNum = pNum;
  enterPvpMode();
  pvpInviteEl.style.display = 'none';
  pvpStatusTextEl.textContent = '接続中…';
  startPolling();
}

function enterPvpMode() {
  // TAモード中なら終了
  if (taActive) {
    clearInterval(taTimerInterval);
    taTimerInterval = null;
    taActive = false;
    taTimerEl.style.display = 'none';
    document.querySelectorAll('.diff-btn').forEach(btn => { btn.disabled = false; });
  }

  pvpMode   = true;
  pvpStreak = 0;
  pvpCreateBtn.style.display  = 'none';
  rankingSection.style.display = 'none';
  badgeSection.style.display  = 'none';
  modeBar.style.display       = 'none';
  difficultyBar.style.display = 'none';
  pvpStatusBarEl.style.display = 'flex';
  opponentLabelEl.textContent = '友達';
  opponentLabelEl.classList.add('pvp');
  battleArea.classList.add('pvp-active');
  headerSub.textContent = '友達と対戦中！';
  headerSub.classList.add('pvp-mode');
  unlockBadge('pvp_played');
  updateStreakDisplay();
}

function exitPvpMode() {
  stopPolling();
  pvpMode   = false;
  roomId    = null;
  playerNum = null;
  myHandPvp = null;
  pvpStreak = 0;
  pvpCreateBtn.disabled        = false;
  pvpCreateBtn.style.display   = '';
  rankingSection.style.display = '';
  badgeSection.style.display   = '';
  modeBar.style.display        = '';
  difficultyBar.style.display  = '';
  pvpInviteEl.style.display    = 'none';
  pvpStatusBarEl.style.display = 'none';
  opponentLabelEl.textContent  = 'CPU';
  opponentLabelEl.classList.remove('pvp');
  battleArea.classList.remove('pvp-active');
  headerSub.textContent = '何連勝できるかチャレンジ';
  headerSub.classList.remove('pvp-mode');
  history.replaceState(null, '', location.pathname);
  streak = 0;
  updateStreakDisplay();
  updateScoreLabels();
  resetRound();
}

function startPolling() {
  if (pollTimer) return;
  pollTimer = setInterval(() => pollRoom(), 1200);
}

function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}

async function pollRoom() {
  if (!roomId) return;
  try {
    const res = await fetch(`/api/room?id=${roomId}`);
    if (!res.ok) { stopPolling(); return; }
    handleRoomState(await res.json());
  } catch { /* 無視 */ }
}

let prevStatus = null;

function handleRoomState(room) {
  if (!pvpMode) return;

  const myHand  = playerNum === 1 ? room.player1_hand : room.player2_hand;
  const oppHand = playerNum === 1 ? room.player2_hand : room.player1_hand;

  if (prevStatus === 'waiting' && (room.status === 'playing' || room.status === 'ready')) {
    playSound('pvp-join');
    pvpStatusTextEl.textContent = '対戦相手が参加しました！手を選んでください';
    pvpStatusTextEl.classList.add('ready');
    pvpInviteEl.style.display = 'none';
    resetRound();
  }
  prevStatus = room.status;

  if (room.status === 'waiting') {
    pvpStatusTextEl.textContent = '友達の参加を待っています…';
    return;
  }

  if (room.status === 'ready') {
    pvpStatusTextEl.textContent = '手を選んでください';
    pvpStatusTextEl.classList.add('ready');
    return;
  }

  if (room.status === 'playing' && !myHand && !isPlaying) {
    pvpStatusTextEl.textContent = '手を選んでください';
    pvpStatusTextEl.classList.add('ready');
  }

  if (myHand && !oppHand) {
    pvpStatusTextEl.textContent = '相手の手を待っています…';
    pvpStatusTextEl.classList.remove('ready');
  }

  if (room.status === 'done' && myHand && oppHand && !resultTextEl.classList.contains('show')) {
    stopPolling();
    showPvpResult(myHand, oppHand);
  }
}

async function submitHandPvp(hand) {
  myHandPvp = hand;
  await fetch(`/api/room?id=${roomId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerNum, hand }),
  });
  pvpStatusTextEl.textContent = '相手の手を待っています…';
  pvpStatusTextEl.classList.remove('ready');
}

function showPvpResult(myHand, oppHand) {
  callTextEl.textContent = 'ぽん！';
  playSound('pon');
  cpuHandEl.textContent = HANDS[oppHand].icon;
  cpuHandEl.className   = 'hand-icon';

  let resultType, resultLabel;
  if (myHand === oppHand) {
    resultType  = 'draw';
    resultLabel = 'あいこ！もう一回！';
  } else if (WIN_MAP[myHand] === oppHand) {
    resultType  = 'win';
    pvpStreak++;
    resultLabel = getWinMessage(pvpStreak);
    triggerConfetti();
    playSound('win');
    checkAndUnlockBadges();
  } else {
    resultType  = 'lose';
    pvpStreak   = 0;
    resultLabel = '負け…💀';
    playSound('lose');
  }

  updateStreakDisplay();
  battleArea.classList.add(`flash-${resultType}`);
  resultTextEl.textContent = resultLabel;
  resultTextEl.className   = `result-text show ${resultType}`;

  const delay = resultType === 'draw' ? 1000 : 2000;
  setTimeout(() => resetPvpRound(), delay);
}

async function resetPvpRound() {
  myHandPvp = null;
  try {
    await fetch(`/api/room?id=${roomId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reset: true }),
    });
  } catch { /* 無視 */ }
  resetRound();
  prevStatus = 'ready';
  pvpStatusTextEl.textContent = '手を選んでください';
  pvpStatusTextEl.classList.add('ready');
  startPolling();
}

// ===========================
// ===== CPUモード共通 =====
// ===========================

function init() {
  renderLocalRanking();
  renderOnlineRanking();
  renderBadges();
  updateScoreLabels();

  // URLパラメータでPvPモード自動起動
  const { room, p } = parsePvpParams();
  if (room && p) {
    joinRoom(room, p);
  } else {
    resetRound();
  }

  // タブ切り替え
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab).classList.add('active');
    });
  });

  // モード切替
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (taActive) return; // タイムアタック中は切り替え不可
      document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      gameMode = btn.dataset.mode;

      if (gameMode === 'timeattack') {
        streak = 0;
        startTimeAttack();
      } else {
        // 連勝モードに戻る
        taTimerEl.style.display = 'none';
        taTimeLeftEl.classList.remove('danger');
        streak = 0;
        updateStreakDisplay();
        updateScoreLabels();
        renderLocalRanking();
        resetRound();
      }
    });
  });

  // 難易度切替
  document.querySelectorAll('.diff-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      difficulty = btn.dataset.diff;

      // 鬼モード演出
      if (difficulty === 'insane') {
        callTextEl.textContent = '…読んでいる👁';
        setTimeout(() => { callTextEl.textContent = 'じゃんけん？'; }, 1400);
      }
    });
  });

  pvpCreateBtn.addEventListener('click', createRoom);
  pvpExitBtnEl.addEventListener('click', exitPvpMode);

  pvpCopyBtnEl.addEventListener('click', () => {
    const url = `${location.origin}?room=${roomId}&p=2`;
    navigator.clipboard.writeText(url).then(() => {
      pvpCopyBtnEl.textContent = '✓ コピーしました';
      pvpCopyBtnEl.classList.add('copied');
      setTimeout(() => {
        pvpCopyBtnEl.textContent = '📋 URLをコピー';
        pvpCopyBtnEl.classList.remove('copied');
      }, 2000);
    });
  });
}

function resetRound() {
  cpuHandEl.textContent = pvpMode ? '❓' : '✊';
  cpuHandEl.className   = pvpMode ? 'hand-icon' : 'hand-icon idle';
  callTextEl.textContent   = 'じゃんけん？';
  resultTextEl.textContent = '';
  resultTextEl.className   = 'result-text';
  battleArea.className     = pvpMode ? 'battle-area pvp-active' : 'battle-area';
  if (shareBtn) shareBtn.style.display = 'none';
  choiceBtns.forEach(btn => {
    btn.disabled = false;
    btn.classList.remove('selected');
  });
  isPlaying = false;
}

function onPlayerChoice(playerKey) {
  if (isPlaying) return;
  isPlaying = true;

  playerHistory.push(playerKey);
  if (playerHistory.length > HISTORY_SIZE) playerHistory.shift();

  choiceBtns.forEach(btn => {
    btn.disabled = true;
    if (btn.dataset.hand === playerKey) btn.classList.add('selected');
  });

  // ===== PvPモード =====
  if (pvpMode) {
    submitHandPvp(playerKey).catch(() => {});
    callTextEl.textContent = '相手の手を待っています…';
    cpuHandEl.textContent  = '⏳';
    cpuHandEl.className    = 'hand-icon waiting';
    return;
  }

  // ===== CPUモード =====
  const call = CALLS[Math.floor(Math.random() * CALLS.length)];
  callTextEl.textContent = call;
  cpuHandEl.className    = 'hand-icon shaking';

  setTimeout(() => {
    callTextEl.textContent = 'ぽん！';
    playSound('pon');

    const cpuKey = getCpuHand();
    cpuHandEl.textContent = HANDS[cpuKey].icon;
    cpuHandEl.className   = 'hand-icon';

    setTimeout(() => showResult(playerKey, cpuKey), 200);
  }, 800);
}

function showResult(playerKey, cpuKey) {
  let resultType, resultLabel;

  if (playerKey === cpuKey) {
    resultType  = 'draw';
    resultLabel = 'あいこ！もう一回！';
  } else if (WIN_MAP[playerKey] === cpuKey) {
    resultType  = 'win';
    resultLabel = gameMode === 'timeattack'
      ? `${taScore + 1}勝目！`
      : getWinMessage(streak + 1);
  } else {
    resultType  = 'lose';
    resultLabel = '負け…💀';
  }

  if (resultType === 'win') {
    if (gameMode === 'timeattack') {
      taScore++;
      streakEl.textContent = taScore;
    } else {
      streak++;
      updateStreakDisplay();
    }
    triggerConfetti();
    playSound('win');
    checkAndUnlockBadges();
  } else if (resultType === 'lose') {
    playSound('lose');
    if (gameMode === 'streak') {
      updateStreakDisplay();
      const finalStreak = streak;
      if (finalStreak > 0) {
        saveLocalRanking(finalStreak);
        submitOnlineScore(finalStreak);
        if (shareBtn) {
          shareBtn.style.display = 'inline-flex';
          shareBtn.onclick = () => shareToX(finalStreak);
        }
      }
      streak = 0;
    }
  }

  battleArea.classList.add(`flash-${resultType}`);
  resultTextEl.textContent = resultLabel;
  resultTextEl.className   = `result-text show ${resultType}`;

  const delay = resultType === 'draw' ? 1000 : resultType === 'win' ? 1200 : 1800;
  setTimeout(() => {
    // TAモードでタイム切れ後は endTimeAttack() に任せる
    if (gameMode === 'timeattack' && !taActive) return;
    resetRound();
  }, delay);
}

function updateStreakDisplay() {
  const s = pvpMode ? pvpStreak : streak;
  streakEl.textContent = s;
  streakEl.classList.remove('pop');
  void streakEl.offsetWidth;
  streakEl.classList.add('pop');
}

function triggerConfetti() {
  confettiLayer.innerHTML = '';
  const colors = ['#e94560','#f5a623','#4caf50','#2196f3','#9c27b0','#f7c94e'];
  for (let i = 0; i < 28; i++) {
    const el = document.createElement('div');
    el.className = 'confetti-piece';
    el.style.left              = `${Math.random() * 100}%`;
    el.style.background        = colors[Math.floor(Math.random() * colors.length)];
    el.style.animationDelay    = `${Math.random() * 0.4}s`;
    el.style.animationDuration = `${0.9 + Math.random() * 0.6}s`;
    el.style.borderRadius      = Math.random() > 0.5 ? '50%' : '2px';
    confettiLayer.appendChild(el);
  }
  setTimeout(() => { confettiLayer.innerHTML = ''; }, 1800);
}

function saveLocalRanking(score) {
  const list = loadLocalRanking();
  list.push({ score, date: new Date().toLocaleDateString('ja-JP') });
  list.sort((a, b) => b.score - a.score);
  const trimmed = list.slice(0, RANKING_MAX);
  localStorage.setItem(RANKING_KEY, JSON.stringify(trimmed));
  const prevBest = list.length > 1 ? (list[1]?.score ?? 0) : 0;
  if (trimmed[0].score === score && score > prevBest) {
    showNewRecordBanner();
    playSound('record');
  }
  renderLocalRanking();
  setTimeout(() => {
    const items  = rankListEl.querySelectorAll('.rank-item');
    const latest = loadLocalRanking();
    items.forEach((item, idx) => {
      if (latest[idx]?.score === score) {
        item.classList.add('new-record');
        setTimeout(() => item.classList.remove('new-record'), 1600);
      }
    });
  }, 100);
}

function loadLocalRanking() {
  try { return JSON.parse(localStorage.getItem(RANKING_KEY) || '[]'); }
  catch { return []; }
}

// ローカルランキング描画（モード対応）
function renderLocalRanking() {
  if (gameMode === 'timeattack') {
    const list = loadTaRanking();
    bestEl.textContent = list.length > 0 ? `${list[0].score}勝` : '—';
    rankListEl.innerHTML = list.length === 0
      ? '<li class="rank-empty">まだ記録がありません</li>'
      : list.map((item, i) => `
          <li class="rank-item">
            <span class="rank-medal">${MEDALS[i]}</span>
            <span class="rank-score">${item.score}</span>
            <span class="rank-unit">勝/30秒</span>
            <span class="rank-date">${item.date}</span>
          </li>`).join('');
    return;
  }

  const list = loadLocalRanking();
  bestEl.textContent = list.length > 0 ? `${list[0].score}連勝` : '—';
  rankListEl.innerHTML = list.length === 0
    ? '<li class="rank-empty">まだ記録がありません</li>'
    : list.map((item, i) => `
        <li class="rank-item">
          <span class="rank-medal">${MEDALS[i]}</span>
          <span class="rank-score">${item.score}</span>
          <span class="rank-unit">連勝</span>
          <span class="rank-date">${item.date}</span>
        </li>`).join('');
}

function showNewRecordBanner() {
  newRecordBanner.textContent = '🏆 NEW RECORD!';
  newRecordBanner.classList.remove('show');
  void newRecordBanner.offsetWidth;
  newRecordBanner.classList.add('show');
  setTimeout(() => newRecordBanner.classList.remove('show'), 2200);
}

choiceBtns.forEach(btn => {
  btn.addEventListener('click', () => onPlayerChoice(btn.dataset.hand));
});

init();
