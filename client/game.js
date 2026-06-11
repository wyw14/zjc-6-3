const API_BASE_URL = 'http://localhost:6032/api';

const CARD_EMOJIS = {
  1: '🍎',
  2: '🍊',
  3: '🍋',
  4: '🍇',
  5: '🍓',
  6: '🍒',
  7: '🍑',
  8: '🥝'
};

const gameBoard = document.getElementById('gameBoard');
const timerEl = document.getElementById('timer');
const movesEl = document.getElementById('moves');
const matchedEl = document.getElementById('matched');
const restartBtn = document.getElementById('restartBtn');
const leaderboardBtn = document.getElementById('leaderboardBtn');
const winModal = document.getElementById('winModal');
const leaderboardModal = document.getElementById('leaderboardModal');
const finalTimeEl = document.getElementById('finalTime');
const finalMovesEl = document.getElementById('finalMoves');
const playerNameInput = document.getElementById('playerName');
const submitScoreBtn = document.getElementById('submitScoreBtn');
const playAgainBtn = document.getElementById('playAgainBtn');
const closeLeaderboardBtn = document.getElementById('closeLeaderboardBtn');
const leaderboardList = document.getElementById('leaderboardList');
const leaderboardTitle = document.getElementById('leaderboardTitle');
const winTitle = document.getElementById('winTitle');
const newRecordHint = document.getElementById('newRecordHint');

const normalModeBtn = document.getElementById('normalModeBtn');
const dailyModeBtn = document.getElementById('dailyModeBtn');
const dailyStatus = document.getElementById('dailyStatus');
const todayDateEl = document.getElementById('todayDate');
const completionStatusEl = document.getElementById('completionStatus');
const dailyBestTimeEl = document.getElementById('dailyBestTime');

let cards = [];
let flippedCards = [];
let matchedPairs = 0;
let moves = 0;
let timer = null;
let startTime = null;
let elapsedTime = 0;
let gameStarted = false;
let isProcessing = false;

let gameMode = 'normal';
let dailyChallengeData = null;

function getPlayerId() {
  let playerId = localStorage.getItem('playerId');
  if (!playerId) {
    playerId = 'player_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('playerId', playerId);
  }
  return playerId;
}

function getSavedPlayerName() {
  return localStorage.getItem('playerName') || '';
}

function savePlayerName(name) {
  if (name) {
    localStorage.setItem('playerName', name);
  }
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

async function initGame() {
  resetGameState();
  let shuffledCards;
  
  if (gameMode === 'daily') {
    await loadDailyChallenge();
    if (dailyChallengeData) {
      shuffledCards = dailyChallengeData.cards;
      updateDailyStatusUI();
    } else {
      shuffledCards = await fetchShuffledCards();
    }
  } else {
    shuffledCards = await fetchShuffledCards();
  }
  
  renderCards(shuffledCards);
}

function resetGameState() {
  cards = [];
  flippedCards = [];
  matchedPairs = 0;
  moves = 0;
  elapsedTime = 0;
  gameStarted = false;
  isProcessing = false;
  
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  
  updateTimerDisplay();
  movesEl.textContent = '0';
  matchedEl.textContent = '0/8';
  gameBoard.innerHTML = '';
  newRecordHint.classList.add('hidden');
}

async function fetchShuffledCards() {
  try {
    const response = await fetch(`${API_BASE_URL}/shuffle`);
    const data = await response.json();
    return data.cards;
  } catch (error) {
    console.error('获取洗牌数据失败:', error);
    const fallbackCards = [];
    for (let i = 1; i <= 8; i++) {
      fallbackCards.push(i, i);
    }
    for (let i = fallbackCards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [fallbackCards[i], fallbackCards[j]] = [fallbackCards[j], fallbackCards[i]];
    }
    return fallbackCards;
  }
}

async function loadDailyChallenge() {
  try {
    const playerId = getPlayerId();
    const response = await fetch(`${API_BASE_URL}/daily-challenge?playerId=${playerId}`);
    dailyChallengeData = await response.json();
    return dailyChallengeData;
  } catch (error) {
    console.error('获取每日挑战失败:', error);
    dailyChallengeData = null;
    return null;
  }
}

function updateDailyStatusUI() {
  if (!dailyChallengeData) return;
  
  todayDateEl.textContent = dailyChallengeData.date;
  
  if (dailyChallengeData.hasCompleted) {
    completionStatusEl.textContent = '已完成 ✓';
    completionStatusEl.style.color = '#009933';
  } else {
    completionStatusEl.textContent = '未完成';
    completionStatusEl.style.color = '#cc6600';
  }
  
  if (dailyChallengeData.playerBest) {
    dailyBestTimeEl.textContent = formatTime(dailyChallengeData.playerBest);
  } else {
    dailyBestTimeEl.textContent = '-';
  }
}

function renderCards(cardIds) {
  cardIds.forEach((cardId, index) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.id = cardId;
    card.dataset.index = index;
    
    const cardBack = document.createElement('div');
    cardBack.className = 'card-face card-back';
    
    const cardFront = document.createElement('div');
    cardFront.className = 'card-face card-front';
    cardFront.textContent = CARD_EMOJIS[cardId] || '❓';
    
    card.appendChild(cardBack);
    card.appendChild(cardFront);
    
    card.addEventListener('click', () => handleCardClick(card));
    
    gameBoard.appendChild(card);
    cards.push(card);
  });
}

function handleCardClick(card) {
  if (isProcessing) return;
  if (card.classList.contains('flipped')) return;
  if (card.classList.contains('matched')) return;
  if (flippedCards.length >= 2) return;

  if (!gameStarted) {
    startTimer();
    gameStarted = true;
  }

  flipCard(card);
  flippedCards.push(card);

  if (flippedCards.length === 2) {
    moves++;
    movesEl.textContent = moves;
    checkMatch();
  }
}

function flipCard(card) {
  card.classList.add('flipped');
}

function unflipCard(card) {
  card.classList.remove('flipped');
}

function checkMatch() {
  isProcessing = true;
  
  const [card1, card2] = flippedCards;
  const id1 = parseInt(card1.dataset.id);
  const id2 = parseInt(card2.dataset.id);

  if (id1 === id2) {
    setTimeout(() => {
      card1.classList.add('matched');
      card2.classList.add('matched');
      matchedPairs++;
      matchedEl.textContent = `${matchedPairs}/8`;
      flippedCards = [];
      isProcessing = false;
      
      if (matchedPairs === 8) {
        endGame();
      }
    }, 500);
  } else {
    setTimeout(() => {
      unflipCard(card1);
      unflipCard(card2);
      flippedCards = [];
      isProcessing = false;
    }, 1000);
  }
}

function startTimer() {
  startTime = Date.now() - elapsedTime;
  timer = setInterval(() => {
    elapsedTime = Date.now() - startTime;
    updateTimerDisplay();
  }, 100);
}

function updateTimerDisplay() {
  const totalSeconds = Math.floor(elapsedTime / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  timerEl.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function endGame() {
  clearInterval(timer);
  timer = null;
  
  finalTimeEl.textContent = timerEl.textContent;
  finalMovesEl.textContent = moves;
  
  playerNameInput.value = getSavedPlayerName();
  
  if (gameMode === 'daily') {
    winTitle.textContent = '🔥 每日挑战通关！';
    if (dailyChallengeData && dailyChallengeData.playerBest) {
      const currentTime = Math.floor(elapsedTime / 1000);
      if (currentTime < dailyChallengeData.playerBest) {
        newRecordHint.classList.remove('hidden');
      }
    } else if (!dailyChallengeData || !dailyChallengeData.hasCompleted) {
      newRecordHint.classList.remove('hidden');
    }
  } else {
    winTitle.textContent = '🎉 恭喜通关！';
  }
  
  setTimeout(() => {
    winModal.classList.remove('hidden');
  }, 500);
}

async function submitScore() {
  const playerName = playerNameInput.value.trim() || '匿名玩家';
  savePlayerName(playerName);
  
  const timeInSeconds = Math.floor(elapsedTime / 1000);
  const playerId = getPlayerId();

  try {
    let response, data;
    
    if (gameMode === 'daily') {
      const challengeDate = dailyChallengeData ? dailyChallengeData.date : null;
      
      if (!challengeDate) {
        alert('挑战日期无效，请刷新页面重试');
        return;
      }
      
      response = await fetch(`${API_BASE_URL}/daily-challenge/score`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          time: timeInSeconds,
          playerName: playerName,
          playerId: playerId,
          moves: moves,
          challengeDate: challengeDate
        })
      });
    } else {
      response = await fetch(`${API_BASE_URL}/score`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          time: timeInSeconds,
          playerName: playerName
        })
      });
    }

    data = await response.json();
    
    if (data.success) {
      if (data.isNewRecord) {
        newRecordHint.classList.remove('hidden');
      }
      alert(`恭喜！你排名第 ${data.rank} 名！`);
      winModal.classList.add('hidden');
      
      if (gameMode === 'daily') {
        await loadDailyChallenge();
        updateDailyStatusUI();
      }
      
      showLeaderboard();
    }
  } catch (error) {
    console.error('提交成绩失败:', error);
    alert('提交成绩失败，请稍后重试');
  }
}

async function showLeaderboard() {
  try {
    let data;
    
    if (gameMode === 'daily') {
      const response = await fetch(`${API_BASE_URL}/daily-challenge/leaderboard`);
      data = await response.json();
      leaderboardTitle.textContent = `🔥 每日挑战排行榜 (${data.date})`;
      renderLeaderboard(data.leaderboard, true);
    } else {
      const response = await fetch(`${API_BASE_URL}/leaderboard`);
      data = await response.json();
      leaderboardTitle.textContent = '🏆 总排行榜';
      renderLeaderboard(data.leaderboard, false);
    }
  } catch (error) {
    console.error('获取排行榜失败:', error);
    leaderboardList.innerHTML = '<li>加载排行榜失败</li>';
  }
  
  leaderboardModal.classList.remove('hidden');
}

function renderLeaderboard(leaderboard, showMoves) {
  if (!leaderboard || leaderboard.length === 0) {
    leaderboardList.innerHTML = '<li class="empty-message">暂无记录，快来挑战吧！</li>';
    return;
  }

  leaderboardList.innerHTML = '';
  
  leaderboard.forEach((entry, index) => {
    const li = document.createElement('li');
    li.className = 'rank-item';
    
    const minutes = Math.floor(entry.time / 60);
    const seconds = entry.time % 60;
    const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    
    const movesStr = showMoves && entry.moves ? `<span class="moves">(${entry.moves}步)</span>` : '';
    
    li.innerHTML = `
      <span class="rank-name">
        <span class="rank">#${index + 1}</span>
        <span class="name">${entry.playerName}</span>
      </span>
      <span>
        <span class="time">${timeStr}</span>
        ${movesStr}
      </span>
    `;
    
    leaderboardList.appendChild(li);
  });
}

function switchMode(mode) {
  gameMode = mode;
  
  if (mode === 'daily') {
    dailyModeBtn.classList.add('active');
    normalModeBtn.classList.remove('active');
    dailyStatus.classList.remove('hidden');
  } else {
    normalModeBtn.classList.add('active');
    dailyModeBtn.classList.remove('active');
    dailyStatus.classList.add('hidden');
  }
  
  winModal.classList.add('hidden');
  leaderboardModal.classList.add('hidden');
  initGame();
}

normalModeBtn.addEventListener('click', () => switchMode('normal'));
dailyModeBtn.addEventListener('click', () => switchMode('daily'));

restartBtn.addEventListener('click', initGame);
playAgainBtn.addEventListener('click', () => {
  winModal.classList.add('hidden');
  initGame();
});
leaderboardBtn.addEventListener('click', showLeaderboard);
closeLeaderboardBtn.addEventListener('click', () => {
  leaderboardModal.classList.add('hidden');
});
submitScoreBtn.addEventListener('click', submitScore);

initGame();
