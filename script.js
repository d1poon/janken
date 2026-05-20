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

const RANKING_KEY = 'janken_ranking_v1';
const RANKING_MAX = 5;
const MEDALS = ['🥇', '🥈', '🥉', '4', '5'];

// ===== 状態 =====
let streak = 0;
let isPlaying = false;

// ===== DOM =====
const cpuHandEl   = document.getElementById('cpu-hand');
const callTextEl  = document.getElementById('call-text');
const resultTextEl = document.getElementById('result-text');
const streakEl    = document.getElementById('streak');
const battleArea  = document.getElementById('battle-area');
const choiceBtns  = document.querySelectorAll('.choice-btn');
const rankListEl  = document.getElementById('rank-list');
const bestEl      = document.getElementById('best');
const newRecordBanner = document.getElementById('new-record-banner');
const confettiLayer = document.getElementById('confetti-layer');

// ===== 初期化 =====
function init() {
  renderRanking();
  resetRound();
}

// ===== ラウンドリセット =====
function resetRound() {
  cpuHandEl.textContent = '✊';
  cpuHandEl.className = 'hand-icon idle';
  callTextEl.textContent = 'じゃんけん？';
  resultTextEl.textContent = '';
  resultTextEl.className = 'result-text';
  battleArea.className = 'battle-area';
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

  // 選択ボタンを強調・他を無効化
  choiceBtns.forEach(btn => {
    btn.disabled = true;
    if (btn.dataset.hand === playerKey) btn.classList.add('selected');
  });

  // じゃんけん→ぽん のシーケンス
  callTextEl.textContent = 'じゃんけん…';
  cpuHandEl.className = 'hand-icon shaking';

  setTimeout(() => {
    callTextEl.textContent = 'ぽん！';

    // CPU手をランダム決定
    const keys = Object.keys(HANDS);
    const cpuKey = keys[Math.floor(Math.random() * keys.length)];
    cpuHandEl.textContent = HANDS[cpuKey].icon;
    cpuHandEl.className = 'hand-icon';

    // 判定
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
    resultLabel = '勝ち！🎉';
  } else {
    resultType  = 'lose';
    resultLabel = '負け…💀';
  }

  // スコア更新（あいこは連勝維持・ランキング保存なし）
  if (resultType === 'win') {
    streak++;
    triggerConfetti();
  } else if (resultType === 'lose') {
    if (streak > 0) saveRanking(streak);
    streak = 0;
  }

  updateStreakDisplay();

  // バトルエリアフラッシュ
  battleArea.classList.add(`flash-${resultType}`);

  // 結果テキスト
  resultTextEl.textContent = resultLabel;
  resultTextEl.className = `result-text show ${resultType}`;

  // 次のラウンドへ（あいこは少し早めにリトライ）
  const delay = resultType === 'win' ? 1200 : resultType === 'draw' ? 1000 : 1600;
  setTimeout(resetRound, delay);
}

// ===== ストリーク表示 =====
function updateStreakDisplay() {
  streakEl.textContent = streak;
  streakEl.classList.remove('pop');
  void streakEl.offsetWidth; // reflow
  streakEl.classList.add('pop');
}

// ===== 紙吹雪 =====
function triggerConfetti() {
  confettiLayer.innerHTML = '';
  const colors = ['#e94560', '#f5a623', '#4caf50', '#2196f3', '#9c27b0', '#f7c94e'];
  for (let i = 0; i < 28; i++) {
    const el = document.createElement('div');
    el.className = 'confetti-piece';
    el.style.left = `${Math.random() * 100}%`;
    el.style.background = colors[Math.floor(Math.random() * colors.length)];
    el.style.animationDelay = `${Math.random() * 0.4}s`;
    el.style.animationDuration = `${0.9 + Math.random() * 0.6}s`;
    el.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
    confettiLayer.appendChild(el);
  }
  setTimeout(() => confettiLayer.innerHTML = '', 1800);
}

// ===== ランキング保存 =====
function saveRanking(score) {
  const list = loadRanking();
  list.push({ score, date: new Date().toLocaleDateString('ja-JP') });
  list.sort((a, b) => b.score - a.score);
  const trimmed = list.slice(0, RANKING_MAX);
  localStorage.setItem(RANKING_KEY, JSON.stringify(trimmed));

  // 新記録チェック（1位更新または初エントリー）
  const isNewRecord = trimmed[0].score === score && list.length > 0;
  if (isNewRecord && score >= (list[1]?.score ?? 0)) {
    showNewRecordBanner();
  }

  renderRanking();
  // 新記録アイテムをハイライト
  setTimeout(() => {
    const items = rankListEl.querySelectorAll('.rank-item');
    items.forEach((item, idx) => {
      if (trimmed[idx]?.score === score) {
        item.classList.add('new-record');
        setTimeout(() => item.classList.remove('new-record'), 1600);
      }
    });
  }, 100);
}

function loadRanking() {
  try {
    return JSON.parse(localStorage.getItem(RANKING_KEY) || '[]');
  } catch {
    return [];
  }
}

function renderRanking() {
  const list = loadRanking();

  // 自己ベスト更新
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
