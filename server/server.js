﻿﻿﻿const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 6032;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client')));

const CARD_PAIRS = 8;
const DATA_FILE = path.join(__dirname, 'data.json');

let leaderboard = [];
let dailyChallenges = {};

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
      leaderboard = data.leaderboard || [];
      dailyChallenges = data.dailyChallenges || {};
    }
  } catch (err) {
    console.error('加载数据失败:', err);
  }
}

function saveData() {
  try {
    const data = {
      leaderboard: leaderboard,
      dailyChallenges: dailyChallenges
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('保存数据失败:', err);
  }
}

loadData();

function seededRandom(seed) {
  let s = seed;
  return function() {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function getDateKey(date) {
  const d = date || new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getDateSeed(dateKey) {
  let hash = 0;
  for (let i = 0; i < dateKey.length; i++) {
    const char = dateKey.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function shuffleWithSeed(array, seed) {
  const arr = [...array];
  const random = seededRandom(seed);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function generateDailyCards(dateKey) {
  const cardIds = [];
  for (let i = 1; i <= CARD_PAIRS; i++) {
    cardIds.push(i, i);
  }
  const seed = getDateSeed(dateKey);
  return shuffleWithSeed(cardIds, seed);
}

function getOrCreateDailyChallenge(dateKey) {
  if (!dailyChallenges[dateKey]) {
    dailyChallenges[dateKey] = {
      date: dateKey,
      cards: generateDailyCards(dateKey),
      leaderboard: [],
      playerRecords: {}
    };
    saveData();
  }
  return dailyChallenges[dateKey];
}

app.get('/api/shuffle', (req, res) => {
  const cardIds = [];
  for (let i = 1; i <= CARD_PAIRS; i++) {
    cardIds.push(i, i);
  }
  const shuffled = shuffle(cardIds);
  res.json({ cards: shuffled });
});

app.get('/api/daily-challenge', (req, res) => {
  const dateKey = getDateKey();
  const challenge = getOrCreateDailyChallenge(dateKey);
  const playerId = req.query.playerId;
  
  let playerBest = null;
  let hasCompleted = false;
  if (playerId && challenge.playerRecords[playerId]) {
    playerBest = challenge.playerRecords[playerId].bestTime;
    hasCompleted = challenge.playerRecords[playerId].hasCompleted;
  }
  
  res.json({
    date: dateKey,
    cards: challenge.cards,
    playerBest: playerBest,
    hasCompleted: hasCompleted,
    leaderboard: challenge.leaderboard.slice(0, 10)
  });
});

app.get('/api/daily-challenge/leaderboard', (req, res) => {
  const dateKey = req.query.date || getDateKey();
  const challenge = getOrCreateDailyChallenge(dateKey);
  res.json({
    date: dateKey,
    leaderboard: challenge.leaderboard.slice(0, 10)
  });
});

function isValidDateKey(dateStr) {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) return false;
  const d = new Date(dateStr);
  return d instanceof Date && !isNaN(d) && dateStr === getDateKey(d);
}

app.post('/api/daily-challenge/score', (req, res) => {
  const { time, playerName, playerId, moves, challengeDate } = req.body;
  
  if (typeof time !== 'number' || time <= 0) {
    return res.status(400).json({ error: '无效的成绩数据' });
  }

  if (!challengeDate || !isValidDateKey(challengeDate)) {
    return res.status(400).json({ error: '无效的挑战日期，格式应为 YYYY-MM-DD' });
  }

  const challenge = getOrCreateDailyChallenge(challengeDate);

  const entry = {
    id: Date.now() + Math.random(),
    time: time,
    moves: moves || 0,
    playerName: playerName || '匿名玩家',
    playerId: playerId || null,
    challengeDate: challengeDate,
    submittedAt: new Date().toISOString()
  };

  challenge.leaderboard.push(entry);
  challenge.leaderboard.sort((a, b) => a.time - b.time);
  challenge.leaderboard = challenge.leaderboard.slice(0, 50);

  if (playerId) {
    if (!challenge.playerRecords[playerId] || time < challenge.playerRecords[playerId].bestTime) {
      challenge.playerRecords[playerId] = {
        bestTime: time,
        bestMoves: moves || 0,
        hasCompleted: true,
        playerName: playerName || '匿名玩家',
        lastSubmit: new Date().toISOString()
      };
    }
  }

  saveData();

  const rank = challenge.leaderboard.findIndex(e => e.id === entry.id) + 1;

  res.json({
    success: true,
    rank: rank,
    isNewRecord: playerId && challenge.playerRecords[playerId] && challenge.playerRecords[playerId].bestTime === time,
    leaderboard: challenge.leaderboard.slice(0, 10)
  });
});

app.post('/api/score', (req, res) => {
  const { time, playerName } = req.body;
  
  if (typeof time !== 'number' || time <= 0) {
    return res.status(400).json({ error: '无效的成绩数据' });
  }

  const entry = {
    id: Date.now(),
    time: time,
    playerName: playerName || '匿名玩家',
    date: new Date().toLocaleString('zh-CN')
  };

  leaderboard.push(entry);
  leaderboard.sort((a, b) => a.time - b.time);
  leaderboard = leaderboard.slice(0, 10);

  saveData();

  const rank = leaderboard.findIndex(e => e.id === entry.id) + 1;

  res.json({
    success: true,
    rank: rank,
    leaderboard: leaderboard
  });
});

app.get('/api/leaderboard', (req, res) => {
  res.json({ leaderboard: leaderboard });
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
