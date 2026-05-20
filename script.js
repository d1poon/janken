'use strict';

// ===== 定数 =====
const HANDS = {
  rock:     { icon: '✊', label: 'グー' },
  scissors: { icon: '✌️', label: 'チョキ' },
  paper:    { icon: '🖐️', label: 'パー' },
};

// 勝ち判定: WIN_MAP[player] = cpuの手（playerが勝つ場合）
const WIN_MAP = {
  rock: 'scissors',
  scissors: 'paper',
  paper: 'rock',
};

const RANKING_KEY  = 'janken_ranking_v1';
const RANKING_MAX  = 5;
const MEDALS       = ['🥇', '🥈', '🥉', '4', '5'];
const HISTORY_SIZE = 10;

// 掛け声バリエーション（§02 Content）
const CALLS = [
  'じゃんけん…',
  '最初はグー…',
  'いくぞ…',
  'さぁいくよ…',
  'そーれ…',
];

// ===== 状態 =====
let streak = 0;
let isPlaying = false;
const playerHistory = [];

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

// ===== 効果音（Web Audio API） =====
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
      // タム音
      const osc = ctx.createOscillator();
      const g   = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(55, now + 0.12);
      g.gain.setValueAtTime(0.45, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.start(now); osc.stop(now + 0.15);
    }

    if (type === 'win') {
      // 三和音（C-E-G）
      [523, 659, 784].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const g   = ctx.createGain();
        osc.connect(g); g.connect(ctx.destination);
        osc.type = 'triangle';
        osc.frequency.value = freq;
        g.gain.setValueAtTime(0.22, now + i * 0.11);
        g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.11 + 0.25);
        osc.start(now + i * 0.11); osc.stop(now + i * 0.11 + 0.28);
      });
    }

    if (type === 'lose') {
      // 下降音
      const osc = ctx.createOscillator();
      const g   = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(350, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.45);
      g.gain.setValueAtTime(0.22, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc.start(now); osc.stop(now + 0.5);
    }

    if (type === 'record') {
      // ファンファーレ（C-E-G-C'）
      [523, 659, 784, 1047].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const g   = ctx.createGain();
        osc.connect(g); g.connect(ctx.destination);
        osc.type = 'triangle';
        osc.frequency.value = freq;
        g.gain.setValueAtTime(0.22, now + i * 0.1);
        g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.25);
        osc.start(now + i * 0.1); osc.stop(now + i * 0.1 + 0.3);
      });
    }
  } catch (_) { /* 未対応ブラウザは無視 */ }
}

// ===== CPU AI（§01 Engineering） =====
function getCpuHand() {
  const keys = Object.keys(HANDS);

  // 履歴が少ない間はランダム
  if (playerHistory.length < 3) {
    return keys[Math.floor(Math.random() * keys.length)];
  }

  // 直近の手でプレイヤーの傾向を分析
  const recent = playerHistory.slice(-HISTORY_SIZE);
  const counts = { rock: 0, scissors: 0, paper: 0 };
  recent.forEach(h => counts[h]++);
  const mostUsed = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];

  // 50%でカウンター手、50%でランダム（ランダム要素を残してゲーム性を維持）
  if (Math.random() < 0.5) {
    return Object.entries(WIN_MAP).find(([, v]) => v === mostUsed)[0];
  }
  return keys[Math.floor(Math.random() * keys.length)];
}

// ===== 連勝メッセージ（§02 Content） =====
function getWinMessage(s) {
  if (s >= 10) return `${s}連勝！伝説だ🏆`;
  if (s >= 8)  return `${s}連勝…バケモノか👹`;
  if (s >= 5)  return `${s}連勝！本当に人間？😱`;
  if (s >= 3)  return `${s}連勝！調子いいね🔥`;
  return '勝ち！🎉';
}

// ===== オンラインランキング =====
async function fetchOnlineRanking() {
  try {
    const res = await fetch('/api/ranking');
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function submitOnlineScore(score) {
  try {
    await fetch('/api/ranking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ score }),
    });
    renderOnlineRanking(); // 送信後に最新状態を再取得
  } catch { /* ネットワークエラーは無視 */ }
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

// ===== SNSシェア（§03 Business） =====
function shareToX(streakCount) {
  const text = `じゃんけん${streakCount}連勝でゲームオーバー…あなたは勝てる？🤜✌️🖐️ #じゃんけん`;
  const url  = 'https://janken-xi.vercel.app';
  window.open(
    `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
    '_blank'
  );
}

// ===== 初期化 =====
function init() {
  renderLocalRanking();
  renderOnlineRanking();
  resetRound();

  // タブ切り替え
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab).classList.add('active');
    });
  });
}

// ===== ラウンドリセット =====
function resetRound() {
  cpuHandEl.textContent = '✊';
  cpuHandEl.className   = 'hand-icon idle';
  callTextEl.textContent = 'じゃんけん？';
  resultTextEl.textContent = '';
  resultTextEl.className   = 'result-text';
  battleArea.className     = 'battle-area';
  if (shareBtn) shareBtn.style.display = 'none';
  choiceBtns.forEach(btn => {
    btn.disabled = false;
    btn.classList.remove('selected');
  });
  isPlaying = false;
}

// ===== プレイヤーが選択 =====
function onPlayerChoice(playerKey) {
  if (isPlaying) return;
  isPlaying = true;

  // 履歴を記録（CPU AIの学習用）
  playerHistory.push(playerKey);
  if (playerHistory.length > HISTORY_SIZE) playerHistory.shift();

  choiceBtns.forEach(btn => {
    btn.disabled = true;
    if (btn.dataset.hand === playerKey) btn.classList.add('selected');
  });

  // 掛け声ランダム選択
  const call = CALLS[Math.floor(Math.random() * CALLS.length)];
  callTextEl.textContent = call;
  cpuHandEl.className = 'hand-icon shaking';

  setTimeout(() => {
    callTextEl.textContent = 'ぽん！';
    playSound('pon');

    const cpuKey = getCpuHand();
    cpuHandEl.textContent = HANDS[cpuKey].icon;
    cpuHandEl.className   = 'hand-icon';

    setTimeout(() => showResult(playerKey, cpuKey), 200);
  }, 800);
}

// ===== 結果表示 =====
function showResult(playerKey, cpuKey) {
  let resultType, resultLabel;

  if (playerKey === cpuKey) {
    resultType  = 'draw';
    resultLabel = 'あいこ！もう一回！';
  } else if (WIN_MAP[playerKey] === cpuKey) {
    resultType  = 'win';
    resultLabel = getWinMessage(streak + 1); // +1後のメッセージをpreview
  } else {
    resultType  = 'lose';
    resultLabel = '負け…💀';
  }

  // スコア更新
  if (resultType === 'win') {
    streak++;
    triggerConfetti();
    playSound('win');
  } else if (resultType === 'lose') {
    playSound('lose');
    const finalStreak = streak;
    if (finalStreak > 0) {
      saveLocalRanking(finalStreak);
      submitOnlineScore(finalStreak);
      // シェアボタン表示
      if (shareBtn) {
        shareBtn.style.display = 'inline-flex';
        shareBtn.onclick = () => shareToX(finalStreak);
      }
    }
    streak = 0;
  }
  // draw: 連勝維持・ランキング保存なし

  updateStreakDisplay();
  battleArea.classList.add(`flash-${resultType}`);
  resultTextEl.textContent = resultLabel;
  resultTextEl.className   = `result-text show ${resultType}`;

  const delay = resultType === 'draw' ? 1000 : resultType === 'win' ? 1200 : 1800;
  setTimeout(resetRound, delay);
}

// ===== ストリーク表示 =====
function updateStreakDisplay() {
  streakEl.textContent = streak;
  streakEl.classList.remove('pop');
  void streakEl.offsetWidth;
  streakEl.classList.add('pop');
}

// ===== 紙吹雪 =====
function triggerConfetti() {
  confettiLayer.innerHTML = '';
  const colors = ['#e94560','#f5a623','#4caf50','#2196f3','#9c27b0','#f7c94e'];
  for (let i = 0; i < 28; i++) {
    const el = document.createElement('div');
    el.className = 'confetti-piece';
    el.style.left             = `${Math.random() * 100}%`;
    el.style.background       = colors[Math.floor(Math.random() * colors.length)];
    el.style.animationDelay   = `${Math.random() * 0.4}s`;
    el.style.animationDuration = `${0.9 + Math.random() * 0.6}s`;
    el.style.borderRadius     = Math.random() > 0.5 ? '50%' : '2px';
    confettiLayer.appendChild(el);
  }
  setTimeout(() => { confettiLayer.innerHTML = ''; }, 1800);
}

// ===== ローカルランキング =====
function saveLocalRanking(score) {
  const list = loadLocalRanking();
  list.push({ score, date: new Date().toLocaleDateString('ja-JP') });
  list.sort((a, b) => b.score - a.score);
  const trimmed = list.slice(0, RANKING_MAX);
  localStorage.setItem(RANKING_KEY, JSON.stringify(trimmed));

  // 1位更新かどうか判定
  const prevBest = list.length > 1 ? list[1]?.score ?? 0 : 0;
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
  try {
    return JSON.parse(localStorage.getItem(RANKING_KEY) || '[]');
  } catch {
    return [];
  }
}

function renderLocalRanking() {
  const list = loadLocalRanking();
  bestEl.textContent = list.length > 0 ? `${list[0].score}連勝` : '—';

  if (list.length === 0) {
    rankListEl.innerHTML = '<li class="rank-empty">まだ記録がありません</li>';
    return;
  }
  rankListEl.innerHTML = list.map((item, i) => `
    <li class="rank-item">
      <span class="rank-medal">${MEDALS[i]}</span>
      <span class="rank-score">${item.score}</span>
      <span class="rank-unit">連勝</span>
      <span class="rank-date">${item.date}</span>
    </li>
  `).join('');
}

// ===== NEW RECORD バナー =====
function showNewRecordBanner() {
  newRecordBanner.textContent = '🏆 NEW RECORD!';
  newRecordBanner.classList.remove('show');
  void newRecordBanner.offsetWidth;
  newRecordBanner.classList.add('show');
  setTimeout(() => newRecordBanner.classList.remove('show'), 2200);
}

// ===== イベント登録 =====
choiceBtns.forEach(btn => {
  btn.addEventListener('click', () => onPlayerChoice(btn.dataset.hand));
});

// ===== 起動 =====
init();
