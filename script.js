// Game configuration
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const gridSize = 20; // size of each grid cell
const tileCount = canvas.width / gridSize; // number of tiles per row/column

let snake = [];
let snakeDir = { x: 1, y: 0 }; // initial direction to the right
let nextDir = { x: 1, y: 0 };
let food = { x: 10, y: 10 };
let score = 0;
let highScore = parseInt(localStorage.getItem('snakeHighScore') || '0', 10);
let speed = 120; // ms per frame
let gameInterval = null;
let isRunning = false;
let isGameOver = false;

const scoreEl = document.getElementById('score');
const highScoreEl = document.getElementById('highScore');
const finalScoreEl = document.getElementById('finalScore');
const gameOverEl = document.getElementById('gameOver');
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const restartBtn = document.getElementById('restartBtn');

highScoreEl.textContent = highScore.toString();

function resetGame() {
  snake = [
    { x: 8, y: 10 },
    { x: 7, y: 10 },
    { x: 6, y: 10 },
  ];
  snakeDir = { x: 1, y: 0 };
  nextDir = { x: 1, y: 0 };
  placeFood();
  score = 0;
  speed = 120;
  isGameOver = false;
  updateScore(0);
}

function updateScore(delta) {
  score += delta;
  scoreEl.textContent = score.toString();
  if (score > highScore) {
    highScore = score;
    localStorage.setItem('snakeHighScore', String(highScore));
    highScoreEl.textContent = String(highScore);
  }
}

function placeFood() {
  // Place food randomly not on the snake
  let newX, newY;
  do {
    newX = Math.floor(Math.random() * tileCount);
    newY = Math.floor(Math.random() * tileCount);
  } while (snake.some((seg) => seg.x === newX && seg.y === newY));
  food = { x: newX, y: newY };
}

function startGame() {
  if (isRunning) return;
  if (isGameOver) {
    gameOverEl.classList.add('hidden');
    resetGame();
  }
  isRunning = true;
  gameInterval = setInterval(gameLoop, speed);
  pauseBtn.classList.remove('hidden');
  startBtn.classList.add('hidden');
}

function pauseGame() {
  if (!isRunning) return;
  clearInterval(gameInterval);
  isRunning = false;
  pauseBtn.classList.add('hidden');
  startBtn.classList.remove('hidden');
}

function gameOver() {
  clearInterval(gameInterval);
  isRunning = false;
  isGameOver = true;
  finalScoreEl.textContent = score.toString();
  gameOverEl.classList.remove('hidden');
  pauseBtn.classList.add('hidden');
  startBtn.classList.remove('hidden');
}

function gameLoop() {
  // Update direction exactly once per tick
  snakeDir = nextDir;

  // Compute next head position with wrapping
  let nextX = snake[0].x + snakeDir.x;
  let nextY = snake[0].y + snakeDir.y;

  // Wrap around edges for a modern twist
  nextX = (nextX + tileCount) % tileCount;
  nextY = (nextY + tileCount) % tileCount;

  const newHead = { x: nextX, y: nextY };

  // Check self-collision
  if (snake.some((seg) => seg.x === newHead.x && seg.y === newHead.y)) {
    gameOver();
    return;
  }

  // Add new head
  snake.unshift(newHead);

  // Check food collision
  if (newHead.x === food.x && newHead.y === food.y) {
    updateScore(10);
    placeFood();
    // Increase speed slightly (cap minimum interval)
    speed = Math.max(60, speed - 3);
    clearInterval(gameInterval);
    gameInterval = setInterval(gameLoop, speed);
  } else {
    // Remove tail if no food eaten
    snake.pop();
  }

  draw();
}

function drawGrid() {
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  for (let i = 0; i < tileCount; i++) {
    // vertical
    ctx.beginPath();
    ctx.moveTo(i * gridSize + 0.5, 0);
    ctx.lineTo(i * gridSize + 0.5, canvas.height);
    ctx.stroke();
    // horizontal
    ctx.beginPath();
    ctx.moveTo(0, i * gridSize + 0.5);
    ctx.lineTo(canvas.width, i * gridSize + 0.5);
    ctx.stroke();
  }
}

function drawSnake() {
  for (let i = 0; i < snake.length; i++) {
    const seg = snake[i];
    const t = i / (snake.length - 1 || 1);
    const hue = 140 - t * 60; // gradient green -> teal
    ctx.fillStyle = `hsl(${hue}, 70%, 50%)`;
    ctx.fillRect(seg.x * gridSize, seg.y * gridSize, gridSize - 1, gridSize - 1);
  }
}

function drawFood() {
  ctx.fillStyle = '#ef4444';
  const radius = gridSize / 2 - 2;
  const cx = food.x * gridSize + gridSize / 2;
  const cy = food.y * gridSize + gridSize / 2;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
}

function clearCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function draw() {
  clearCanvas();
  drawGrid();
  drawSnake();
  drawFood();
}

// Input handling
window.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  let dir = null;
  if (key === 'arrowup' || key === 'w') dir = { x: 0, y: -1 };
  else if (key === 'arrowdown' || key === 's') dir = { x: 0, y: 1 };
  else if (key === 'arrowleft' || key === 'a') dir = { x: -1, y: 0 };
  else if (key === 'arrowright' || key === 'd') dir = { x: 1, y: 0 };

  if (dir) {
    // Prevent reversing directly
    if (snake.length > 1 && dir.x === -snakeDir.x && dir.y === -snakeDir.y) return;
    nextDir = dir;
  }

  if (key === ' ' || key === 'enter') {
    if (isRunning) pauseGame();
    else startGame();
  }
});

// Button events
startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', () => {
  resetGame();
  startGame();
});
pauseBtn.addEventListener('click', pauseGame);

// Initialize
resetGame();
draw();