const socket = io();

let currentRoomCode = "";
let myPlayerName = "";
let currentAnswerLength = 0;
let row = 0; let col = 0; let score = 0;
let isMyTurnActive = false;

// Variabel Tambahan Mode Solo & Multiplayer Discover Mandiri
let allQuizzes = [];
let isSoloMode = false;
let soloQuestions = [];
let soloCurrentIndex = 0;
let selectedDiscoverQuizId = "";

function showScreen(screenId) {
  document.querySelectorAll('.fullscreen-container').forEach(el => el.classList.add('hidden'));
  document.getElementById(screenId).classList.remove('hidden');
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => showScreen("homeScreen"), 1500);
  initKeyboard();
});

function goToHome() { window.location.reload(); }

// ==========================================
// MENTOR / HOST LOGIC
// ==========================================
document.getElementById("btnHost").addEventListener("click", () => {
  let mentorID = document.getElementById("inputMentorID").value.trim().toLowerCase();
  if(!mentorID) return document.getElementById("hostError").innerText = "Isi Username Mentor!";
  socket.emit('createRoom', mentorID);
});

socket.on('roomCreated', (roomCode) => {
  currentRoomCode = roomCode;
  showScreen("mentorLobby");
  document.getElementById("generatedRoomCode").innerText = roomCode;
});

// Update Daftar Player (Kompatibel untuk Lobby Mentor & Lobby Siswa Host)
socket.on('updatePlayerList', (players) => {
  // 1. Jika di Layar Lobby Mentor
  const mentorCount = document.getElementById("playerCount");
  if (mentorCount) mentorCount.innerText = players.length;
  const list = document.getElementById("playerList");
  if (list) {
    list.innerHTML = "";
    players.forEach(p => {
      let span = document.createElement("span");
      span.className = "player-tag"; span.innerText = p; list.appendChild(span);
    });
  }
  if (players.length > 0 && document.getElementById("mentorOptions")) {
    document.getElementById("mentorOptions").classList.remove("hidden");
  }

  // 2. Jika di Layar Lobby Multiplayer Mandiri Siswa
  const studentCount = document.getElementById("studentPlayerCount");
  if (studentCount) studentCount.innerText = players.length;
  const studentList = document.getElementById("studentHostPlayerList");
  if (studentList) {
    studentList.innerHTML = "";
    players.forEach(p => {
      let span = document.createElement("span");
      span.className = "player-tag"; 
      span.innerText = (p === myPlayerName) ? `${p} (Host Anda)` : p; 
      studentList.appendChild(span);
    });
  }
});

document.getElementById("btnStartPlay").addEventListener("click", () => {
  socket.emit('startGame', currentRoomCode);
});

socket.on('errorMsg', (msg) => {
  document.getElementById("mentorErrorMsg").innerText = msg;
});

function renderLiveLeaderboard(players) {
  players.sort((a,b) => b.score - a.score);
  const lb = document.getElementById("liveLeaderboard");
  lb.innerHTML = "";
  players.forEach((p, idx) => {
    let div = document.createElement("div"); div.className = "live-player";
    let status = p.answered ? "Sudah Menjawab" : "Berpikir...";
    div.innerHTML = `<span>Peringkat ${idx+1}: ${p.name} <strong>[${status}]</strong></span> <span>${p.score} Pts</span>`;
    lb.appendChild(div);
  });
}

socket.on('liveLeaderboardUpdate', (players) => {
  if (currentRoomCode && !myPlayerName) renderLiveLeaderboard(players);
});

// ==========================================
// STUDENT / PLAYER LOGIC
// ==========================================
document.getElementById("btnEnterRoom").addEventListener("click", () => {
  let roomCode = document.getElementById("inputRoomCode").value.toUpperCase().trim();
  let playerName = document.getElementById("inputPlayerName").value.toUpperCase().trim();
  
  if (!roomCode || playerName.length < 2) {
    document.getElementById("joinError").innerText = "Isi PIN dan Nickname!";
    return;
  }
  myPlayerName = playerName;
  socket.emit('joinRoom', { roomCode, playerName });
});

socket.on('joinSuccess', ({ roomCode, playerName }) => {
  currentRoomCode = roomCode; 
  showScreen("studentWaiting");
  document.getElementById("displayName").innerText = playerName;
  document.getElementById("gamePlayerName").innerText = playerName;
});

socket.on('joinError', (msg) => { alert(msg); goToHome(); });

// ==========================================
// GAMEPLAY ENGINE
// ==========================================
socket.on('nextQuestion', ({ questionText, length, index, total, playersData }) => {
  document.getElementById("message").innerText = ""; 
  
  // Jika ini mentor (tidak punya nama player), tampilkan layar monitor
  if (currentRoomCode && !myPlayerName) {
    showScreen("mentorMonitorScreen");
    document.getElementById("monitorProgress").innerText = `${index}/${total}`;
    renderLiveLeaderboard(playersData);
    return;
  }

  // Jika ini siswa (baik host mandiri ataupun teman), langsung masuk game board
  showScreen("gameScreen");
  document.getElementById("question").innerText = questionText;
  currentAnswerLength = length;
  createBoard(length);
  isMyTurnActive = true;
});

socket.on('timerUpdate', (time) => {
  if (currentRoomCode && !myPlayerName) {
    document.getElementById("monitorTimer").innerText = time;
  } else if (myPlayerName) {
    document.getElementById("studentTimer").innerText = time;
  }
});

socket.on('questionTimeout', (correctAnswer) => {
    isMyTurnActive = false;
    let msgEl = document.getElementById("message");
    if(msgEl.innerText === "") showMessage(`WAKTU HABIS! JAWABAN: ${correctAnswer}`, "#e21b3c");
});

function createBoard(length) {
  const board = document.getElementById("board");
  board.innerHTML = ""; row = 0; col = 0;
  resetKeyboardColors();

  for (let i = 0; i < 3; i++) {
    let r = document.createElement("div"); r.className = "row";
    for (let j = 0; j < length; j++) {
      let box = document.createElement("div"); 
      box.className = "box"; 
      r.appendChild(box);
    }
    board.appendChild(r);
  }
}

document.addEventListener("keydown", (e) => {
  if (!isMyTurnActive) return;
  if (e.key === "Backspace") handleInput("DEL");
  else if (e.key === "Enter") handleInput("ENTER");
  else if (/^[a-zA-Z]$/.test(e.key)) handleInput(e.key.toUpperCase());
});

function handleInput(key) {
  let rows = document.getElementById("board").children;
  if (key === "DEL" && col > 0) {
    col--; rows[row].children[col].innerText = "";
  } else if (key === "ENTER") {
    checkGuess();
  } else if (key !== "DEL" && key !== "ENTER" && col < currentAnswerLength) {
    rows[row].children[col].innerText = key; col++;
  }
}

function checkGuess() {
  let rows = document.getElementById("board").children;
  let boxes = rows[row].children;
  let guess = "";
  for (let i = 0; i < boxes.length; i++) guess += boxes[i].innerText;

  if (guess.length !== currentAnswerLength) {
      rows[row].classList.add("shake-row");
      setTimeout(() => rows[row].classList.remove("shake-row"), 300);
      return showMessage("Huruf belum lengkap!", "#e21b3c");
  }

  isMyTurnActive = false;

  if (isSoloMode) {
      let answer = soloQuestions[soloCurrentIndex].a;
      let result = [];
      for (let i = 0; i < answer.length; i++) {
        if (guess[i] === answer[i]) result.push("correct");
        else if (answer.includes(guess[i])) result.push("present");
        else result.push("wrong");
      }
      processGuessResult(result, guess === answer, guess);
  } else {
      socket.emit('submitGuess', { roomCode: currentRoomCode, guess });
      socket.once('guessResult', ({ result, isCorrect }) => {
          processGuessResult(result, isCorrect, guess);
      });
  }
}

function processGuessResult(result, isCorrect, guess) {
  let rows = document.getElementById("board").children;
  let boxes = rows[row].children;

  for (let i = 0; i < result.length; i++) {
    setTimeout(() => {
      boxes[i].classList.add("flip"); 
      boxes[i].classList.add(result[i]);
      updateKeyboardColor(guess[i], result[i]);
    }, i * 150);
  }

  setTimeout(() => {
    if (isCorrect) {
      let kalkulasiPoin = (row === 0) ? 30 : (row === 1) ? 20 : 10;
      score += kalkulasiPoin;
      document.getElementById("score").innerText = score;
      showMessage("BENAR SEKALI!", "#26890c");
      
      if (!isSoloMode) socket.emit('updateScore', { roomCode: currentRoomCode, points: kalkulasiPoin });
      else setTimeout(() => { soloCurrentIndex++; nextSoloQuestion(); }, 2000);
      
    } else {
      row++; col = 0;
      if (row === 3) {
        let correctAns = isSoloMode ? soloQuestions[soloCurrentIndex].a : "ANDA KALAH";
        showMessage(`KESEMPATAN HABIS! KUNCI: ${correctAns}`, "#e21b3c");
        if (!isSoloMode) socket.emit('updateScore', { roomCode: currentRoomCode, points: 0 });
        else setTimeout(() => { soloCurrentIndex++; nextSoloQuestion(); }, 2000);
      } else {
        isMyTurnActive = true;
      }
    }
  }, result.length * 150);
}

function showMessage(text, color) {
  let msg = document.getElementById("message");
  msg.innerText = text; msg.style.color = color;
}

// ==========================================
// PODIUM / END GAME
// ==========================================
socket.on('gameOver', (finalStandings) => {
  showScreen("leaderboardScreen");
  const flb = document.getElementById("finalLeaderboardList");
  flb.innerHTML = "";
  finalStandings.forEach((p, idx) => {
    let div = document.createElement("div"); div.className = "live-player";
    let rank = idx === 0 ? "Juara 1 🥇" : idx === 1 ? "Juara 2 🥈" : idx === 2 ? "Juara 3 🥉" : `Peringkat ${idx+1}`;
    div.innerHTML = `<span>${rank}: ${p.name}</span> <span>${p.score} Pts</span>`;
    flb.appendChild(div);
  });
});

// ==========================================
// KEYBOARD GENERATOR
// ==========================================
function initKeyboard() {
  const layout = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];
  const container = document.getElementById("keyboard-container");
  container.innerHTML = "";
  layout.forEach((rowStr, idx) => {
    let rowDiv = document.createElement("div"); rowDiv.className = "key-row";
    if (idx === 2) {
      let enter = document.createElement("button"); enter.className = "key wide-key"; enter.innerText = "ENTER";
      enter.onclick = () => handleInput("ENTER"); rowDiv.appendChild(enter);
    }
    for (let char of rowStr) {
      let b = document.createElement("button"); b.className = "key"; b.id = "key-" + char; b.innerText = char;
      b.onclick = () => handleInput(char); rowDiv.appendChild(b);
    }
    if (idx === 2) {
      let del = document.createElement("button"); del.className = "key wide-key"; del.innerText = "DEL";
      del.onclick = () => handleInput("DEL"); rowDiv.appendChild(del);
    }
    container.appendChild(rowDiv);
  });
}

function updateKeyboardColor(letter, status) {
  let k = document.getElementById("key-" + letter); if (!k) return;
  if (k.classList.contains("correct")) return;
  if (status === "correct") k.className = "key correct";
  else if (status === "present" && !k.classList.contains("correct")) k.className = "key present";
  else if (status === "wrong" && !k.classList.contains("present")) k.className = "key wrong";
}

function resetKeyboardColors() {
  document.querySelectorAll(".key").forEach(k => {
    k.className = "key"; if(k.innerText === "ENTER" || k.innerText === "DEL") k.classList.add("wide-key");
  });
}

// ==========================================
// FITUR DISCOVER & LOGIKA BERMAIN
// ==========================================
async function openDiscover() {
  showScreen('discoverScreen');
  const res = await fetch('/api/discover');
  allQuizzes = await res.json();
  renderQuizzes(allQuizzes);
}

function renderQuizzes(quizzes) {
  const container = document.getElementById('quizList');
  container.innerHTML = "";
  quizzes.forEach(quiz => {
    let card = document.createElement('div');
    card.className = "kahoot-card discover-card";
    card.innerHTML = `
      <span class="category-badge">${quiz.category}</span>
      <h3>${quiz.title}</h3>
      <p>Oleh: <strong>${quiz.author}</strong> | ${quiz.questions.length} Soal</p>
      <div style="display:flex; gap:5px; margin-top:15px;">
        <button class="kahoot-btn btn-black small-btn" style="flex:1;" onclick="playSolo('${quiz.id}')">Main Solo</button>
        <button class="kahoot-btn btn-blue small-btn" style="flex:1;" onclick="openDiscoverHost('${quiz.id}')">Main Bareng</button>
      </div>
    `;
    container.appendChild(card);
  });
}

function filterQuizzes() {
  const keyword = document.getElementById('searchQuiz').value.toLowerCase();
  const filtered = allQuizzes.filter(q => 
    q.title.toLowerCase().includes(keyword) || 
    q.category.toLowerCase().includes(keyword)
  );
  renderQuizzes(filtered);
}

// MODE A: Main Solo Mandiri
function playSolo(quizId) {
  const quiz = allQuizzes.find(q => q.id === quizId);
  if (!quiz) return;
  
  soloQuestions = [...quiz.questions].sort(() => Math.random() - 0.5);
  soloCurrentIndex = 0;
  isSoloMode = true;
  score = 0;
  document.getElementById("score").innerText = score;
  document.getElementById("gamePlayerName").innerText = "Mode Latihan";
  document.getElementById("message").innerText = ""; 
  
  nextSoloQuestion();
}

function nextSoloQuestion() {
  if (soloCurrentIndex >= soloQuestions.length) {
    alert("Latihan selesai! Skor Akhir Anda: " + score);
    return goToHome();
  }
  const q = soloQuestions[soloCurrentIndex];
  showScreen("gameScreen");
  document.getElementById("question").innerText = q.q;
  document.getElementById("studentTimer").innerText = "∞"; 
  currentAnswerLength = q.a.length;
  createBoard(currentAnswerLength);
  isMyTurnActive = true;
}

// MODE B: Main Bareng Multiplayer Mandiri (Tanpa Mentor)
function openDiscoverHost(quizId) {
  selectedDiscoverQuizId = quizId;
  const quiz = allQuizzes.find(q => q.id === quizId);
  if(quiz) {
    document.getElementById("discoverQuizTitle").innerText = `Kuis: "${quiz.title}"`;
    document.getElementById("inputDiscoverHostName").value = "";
    showScreen("discoverHostScreen");
  }
}

document.getElementById("btnCreateDiscoverRoom").addEventListener("click", () => {
  let playerName = document.getElementById("inputDiscoverHostName").value.toUpperCase().trim();
  if (playerName.length < 2) return alert("Nickname minimal 2 karakter!");
  
  myPlayerName = playerName;
  isSoloMode = false;
  score = 0;
  document.getElementById("score").innerText = score;
  
  socket.emit('createDiscoverRoom', { quizId: selectedDiscoverQuizId, playerName });
});

socket.on('discoverRoomCreated', ({ roomCode, playerName, quizTitle }) => {
  currentRoomCode = roomCode;
  showScreen("studentHostLobby");
  
  document.getElementById("studentRoomCode").innerText = roomCode;
  document.getElementById("studentHostQuizTitle").innerText = quizTitle;
  document.getElementById("gamePlayerName").innerText = playerName;
  
  // Set inisialisasi awal jumlah orang di lobby mandiri (baru ada host sendiri)
  document.getElementById("studentPlayerCount").innerText = "1";
  const list = document.getElementById("studentHostPlayerList");
  list.innerHTML = `<span class="player-tag">${playerName} (Host Anda)</span>`;
});

document.getElementById("btnStartStudentPlay").addEventListener("click", () => {
  socket.emit('startDiscoverGame', currentRoomCode);
});