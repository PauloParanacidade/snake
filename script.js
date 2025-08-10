/**
 * Snake Game - Versão Completa com Todas as Melhorias
 */

// ===== CONFIGURAÇÃO GLOBAL =====
const GAME_CONFIG = {
  GRID_SIZES: {
    small: { tiles: 8, name: 'Pequeno' },
    medium: { tiles: 20, name: 'Médio' },
    large: { tiles: 30, name: 'Grande' }
  },
  BASE_SPEED: 600,
  MIN_SPEED: 80,
  MAX_LEVEL: 20,
  PARTICLE_COUNT: 10
};

// ===== ESTADO DO JOGO =====
const gameState = {
  snake: [],
  direction: { x: 1, y: 0 },
  nextDirection: { x: 1, y: 0 },
  food: { x: 10, y: 10 },
  score: 0,
  currentGridSize: 'large',
  tileCount: 30,
  currentSpeed: GAME_CONFIG.BASE_SPEED,
  currentLevel: 1,
  
  isRunning: false,
  isGameOver: false,
  isPaused: false,
  wasRunningBeforeMenu: false,
  isFromGameOver: false,
  
  lastFrameTime: 0,
  accumulator: 0,
  particles: []
};

// ===== PREFERÊNCIAS E PERSISTÊNCIA =====
const preferences = {
  gridSize: 'large',
  soundOn: true,
  showGrid: true,
  showParticles: true,
  
  load() {
    try {
      const saved = JSON.parse(localStorage.getItem('snakePreferences') || '{}');
      Object.assign(this, saved);
    } catch (e) {
      // Usar valores padrão se houver erro
    }
  },
  
  save() {
    localStorage.setItem('snakePreferences', JSON.stringify({
      gridSize: this.gridSize,
      soundOn: this.soundOn,
      showGrid: this.showGrid,
      showParticles: this.showParticles
    }));
  }
};

// ===== ELEMENTOS DOM =====
const elements = {
  canvas: document.getElementById('gameCanvas'),
  ctx: null,
  
  score: document.getElementById('score'),
  highScore: document.getElementById('highScore'),
  speedLevel: document.getElementById('speedLevel'),
  finalScore: document.getElementById('finalScore'),
  gameOverModal: document.getElementById('gameOverModal'),
  gameOverTitle: document.getElementById('gameOverTitle'),
  recordInfo: document.getElementById('recordInfo'),
  
  pauseBtn: document.getElementById('pauseBtn'),
  restartBtn: document.getElementById('restartBtn'),
  homeBtn: null,
  
  gameModal: document.getElementById('gameModal'),
  confirmBtn: document.getElementById('confirmBtn'),
  newGameBtn: document.getElementById('newGameBtn'),
  
  highScoreSmall: document.getElementById('highScoreSmall'),
  highScoreMedium: document.getElementById('highScoreMedium'),
  highScoreLarge: document.getElementById('highScoreLarge'),
  
  resumeFromOver: document.getElementById('resumeFromOver')
};

// ===== SISTEMA DE PONTUAÇÃO =====
const scoring = {
  current: 0,
  
  getHighScore(gridSize) {
    return parseInt(localStorage.getItem(`snakeHighScore_${gridSize}`) || '0', 10);
  },
  
  setHighScore(gridSize, score) {
    localStorage.setItem(`snakeHighScore_${gridSize}`, score.toString());
  },
  
  update(points) {
    this.current += points;
    elements.score.textContent = this.current.toString();
    
    // Calcular nível baseado na pontuação
    const newLevel = Math.min(GAME_CONFIG.MAX_LEVEL, Math.floor(this.current / 50) + 1);
    if (newLevel !== gameState.currentLevel) {
      gameState.currentLevel = newLevel;
      gameState.currentSpeed = GAME_CONFIG.BASE_SPEED - (newLevel - 1) * ((GAME_CONFIG.BASE_SPEED - GAME_CONFIG.MIN_SPEED) / (GAME_CONFIG.MAX_LEVEL - 1));
      elements.speedLevel.textContent = `${newLevel} de ${GAME_CONFIG.MAX_LEVEL}`;
    }
    
    const currentHigh = this.getHighScore(gameState.currentGridSize);
    if (this.current > currentHigh) {
      this.setHighScore(gameState.currentGridSize, this.current);
      elements.highScore.textContent = this.current.toString();
      this.updateModalHighScores();
      return true; // Novo recorde!
    }
    return false;
  },
  
  reset() {
    this.current = 0;
    gameState.currentLevel = 1;
    gameState.currentSpeed = GAME_CONFIG.BASE_SPEED;
    elements.score.textContent = '0';
    elements.speedLevel.textContent = `1 de ${GAME_CONFIG.MAX_LEVEL}`;
  },
  
  init() {
    elements.highScore.textContent = this.getHighScore(gameState.currentGridSize).toString();
    this.updateModalHighScores();
  },
  
  updateModalHighScores() {
    if (elements.highScoreSmall) elements.highScoreSmall.textContent = this.getHighScore('small');
    if (elements.highScoreMedium) elements.highScoreMedium.textContent = this.getHighScore('medium');
    if (elements.highScoreLarge) elements.highScoreLarge.textContent = this.getHighScore('large');
  }
};

// ===== SISTEMA DE SOM =====
const soundSystem = {
  audioContext: null,
  
  init() {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn('Web Audio API não suportada');
    }
  },
  
  playTone(frequency, duration, type = 'sine') {
    if (!preferences.soundOn || !this.audioContext) return;
    
    try {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
      oscillator.type = type;
      
      gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
      
      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + duration);
    } catch (e) {
      // Ignorar erros de áudio
    }
  },
  
  eat() { this.playTone(800, 0.1); },
  gameOver() { this.playTone(200, 0.5, 'sawtooth'); },
  record() { this.playTone(1000, 0.3); this.playTone(1200, 0.3); }
};

// ===== SISTEMA DE PARTÍCULAS =====
const particleSystem = {
  create(x, y) {
    if (!preferences.showParticles) return;
    
    for (let i = 0; i < GAME_CONFIG.PARTICLE_COUNT; i++) {
      gameState.particles.push({
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8,
        life: 1.0,
        decay: 0.02,
        size: Math.random() * 4 + 2
      });
    }
  },
  
  update() {
    gameState.particles = gameState.particles.filter(particle => {
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.life -= particle.decay;
      particle.vx *= 0.98;
      particle.vy *= 0.98;
      
      return particle.life > 0;
    });
  },
  
  draw() {
    if (!preferences.showParticles) return;
    
    gameState.particles.forEach(particle => {
      const alpha = particle.life;
      elements.ctx.fillStyle = `rgba(255, 150, 50, ${alpha})`;
      elements.ctx.beginPath();
      elements.ctx.arc(particle.x, particle.y, particle.size * particle.life, 0, Math.PI * 2);
      elements.ctx.fill();
    });
  }
};

// ===== SISTEMA DE CORES ARCO-ÍRIS (mudança a cada 5 blocos) =====
const colorSystem = {
  rainbowColors: [
    { h: 140, s: 80, l: 50 }, // Verde
    { h: 180, s: 80, l: 50 }, // Ciano
    { h: 240, s: 80, l: 50 }, // Azul
    { h: 280, s: 80, l: 50 }, // Roxo
    { h: 320, s: 80, l: 50 }, // Magenta
    { h: 0, s: 80, l: 50 },   // Vermelho
    { h: 40, s: 80, l: 50 },  // Laranja
    { h: 60, s: 80, l: 50 }   // Amarelo
  ],
  
  getSegmentColor(index) {
    const segmentPerColor = 5; // Mudança a cada 5 blocos
    const colorIndex = Math.floor(index / segmentPerColor) % this.rainbowColors.length;
    const toneIndex = index % segmentPerColor;
    
    const baseColor = this.rainbowColors[colorIndex];
    const nextColor = this.rainbowColors[(colorIndex + 1) % this.rainbowColors.length];
    
    const progress = toneIndex / segmentPerColor;
    const h = baseColor.h + (nextColor.h - baseColor.h) * progress;
    const s = baseColor.s;
    const l = Math.max(30, baseColor.l - toneIndex * 3);
    
    return `hsl(${h}, ${s}%, ${l}%)`;
  }
};

// ===== SISTEMA DE DESENHO =====
const renderer = {
  getCellSize() {
    return elements.canvas.width / gameState.tileCount;
  },
  
  clear() {
    elements.ctx.clearRect(0, 0, elements.canvas.width, elements.canvas.height);
  },
  
  drawGrid() {
    if (!preferences.showGrid) return;
    
    const cellSize = this.getCellSize();
    elements.ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    elements.ctx.lineWidth = 1;
    
    // Desenhar linhas verticais e horizontais corretamente
    for (let i = 0; i <= gameState.tileCount; i++) {
      const pos = Math.round(i * cellSize) + 0.5; // +0.5 para linhas nítidas
      
      // Linhas verticais
      elements.ctx.beginPath();
      elements.ctx.moveTo(pos, 0);
      elements.ctx.lineTo(pos, gameState.tileCount * cellSize);
      elements.ctx.stroke();
      
      // Linhas horizontais
      elements.ctx.beginPath();
      elements.ctx.moveTo(0, pos);
      elements.ctx.lineTo(gameState.tileCount * cellSize, pos);
      elements.ctx.stroke();
    }
  },
  
  drawSnake() {
    const cellSize = this.getCellSize();
    
    gameState.snake.forEach((segment, index) => {
      const isHead = index === 0;
      
      if (isHead) {
        elements.ctx.fillStyle = 'hsl(140, 90%, 60%)';
      } else {
        elements.ctx.fillStyle = colorSystem.getSegmentColor(index - 1);
      }
      
      const x = Math.round(segment.x * cellSize);
      const y = Math.round(segment.y * cellSize);
      const size = Math.round(cellSize * 0.9);
      const margin = Math.round(cellSize * 0.05);
      
      if (isHead) {
        this.drawSnakeHead(x + margin, y + margin, size);
      } else {
        this.roundedRect(x + margin, y + margin, size, size, 3);
      }
    });
  },
  
  drawSnakeHead(x, y, size) {
    const centerX = x + size / 2;
    const centerY = y + size / 2;
    const dir = gameState.direction;
    
    // Corpo da cabeça
    this.roundedRect(x, y, size, size, size * 0.2);
    
    // Olhos
    elements.ctx.fillStyle = 'white';
    const eyeSize = size * 0.12;
    const eyeOffset = size * 0.25;
    
    let eye1X, eye1Y, eye2X, eye2Y;
    
    if (Math.abs(dir.x) > Math.abs(dir.y)) { // Movimento horizontal
      eye1X = centerX - eyeOffset;
      eye1Y = centerY - eyeOffset;
      eye2X = centerX + eyeOffset;
      eye2Y = centerY - eyeOffset;
    } else { // Movimento vertical
      eye1X = centerX - eyeOffset;
      eye1Y = centerY - eyeOffset;
      eye2X = centerX + eyeOffset;
      eye2Y = centerY - eyeOffset;
    }
    
    // Desenhar olhos
    elements.ctx.beginPath();
    elements.ctx.arc(eye1X, eye1Y, eyeSize, 0, Math.PI * 2);
    elements.ctx.fill();
    elements.ctx.beginPath();
    elements.ctx.arc(eye2X, eye2Y, eyeSize, 0, Math.PI * 2);
    elements.ctx.fill();
    
    // Pupilas
    elements.ctx.fillStyle = 'black';
    const pupilSize = eyeSize * 0.6;
    elements.ctx.beginPath();
    elements.ctx.arc(eye1X, eye1Y, pupilSize, 0, Math.PI * 2);
    elements.ctx.fill();
    elements.ctx.beginPath();
    elements.ctx.arc(eye2X, eye2Y, pupilSize, 0, Math.PI * 2);
    elements.ctx.fill();
    
    // Língua bifurcada
    elements.ctx.strokeStyle = '#ff4444';
    elements.ctx.lineWidth = 2;
    elements.ctx.lineCap = 'round';
    
    let tongueStartX, tongueStartY, tongueEndX, tongueEndY;
    
    if (dir.x > 0) { // Direita
      tongueStartX = centerX + size * 0.3;
      tongueStartY = centerY;
      tongueEndX = tongueStartX + size * 0.2;
      tongueEndY = centerY;
    } else if (dir.x < 0) { // Esquerda
      tongueStartX = centerX - size * 0.3;
      tongueStartY = centerY;
      tongueEndX = tongueStartX - size * 0.2;
      tongueEndY = centerY;
    } else if (dir.y > 0) { // Baixo
      tongueStartX = centerX;
      tongueStartY = centerY + size * 0.3;
      tongueEndX = centerX;
      tongueEndY = tongueStartY + size * 0.2;
    } else { // Cima
      tongueStartX = centerX;
      tongueStartY = centerY - size * 0.3;
      tongueEndX = centerX;
      tongueEndY = tongueStartY - size * 0.2;
    }
    
    // Desenhar língua
    elements.ctx.beginPath();
    elements.ctx.moveTo(tongueStartX, tongueStartY);
    elements.ctx.lineTo(tongueEndX, tongueEndY);
    elements.ctx.stroke();
    
    // Bifurcação da língua
    const forkSize = size * 0.08;
    elements.ctx.beginPath();
    if (Math.abs(dir.x) > Math.abs(dir.y)) { // Horizontal
      elements.ctx.moveTo(tongueEndX, tongueEndY);
      elements.ctx.lineTo(tongueEndX + (dir.x > 0 ? -forkSize : forkSize), tongueEndY - forkSize);
      elements.ctx.moveTo(tongueEndX, tongueEndY);
      elements.ctx.lineTo(tongueEndX + (dir.x > 0 ? -forkSize : forkSize), tongueEndY + forkSize);
    } else { // Vertical
      elements.ctx.moveTo(tongueEndX, tongueEndY);
      elements.ctx.lineTo(tongueEndX - forkSize, tongueEndY + (dir.y > 0 ? -forkSize : forkSize));
      elements.ctx.moveTo(tongueEndX, tongueEndY);
      elements.ctx.lineTo(tongueEndX + forkSize, tongueEndY + (dir.y > 0 ? -forkSize : forkSize));
    }
    elements.ctx.stroke();
  },
  
  drawFood() {
    const cellSize = this.getCellSize();
    const x = Math.round(gameState.food.x * cellSize + cellSize / 2);
    const y = Math.round(gameState.food.y * cellSize + cellSize / 2);
    const radius = cellSize / 2 - 3;
    
    // Animação de pulsação
    const pulse = Math.sin(Date.now() * 0.005) * 0.1 + 1;
    const animatedRadius = radius * pulse;
    
    elements.ctx.fillStyle = '#ef4444';
    elements.ctx.beginPath();
    elements.ctx.arc(x, y, animatedRadius, 0, Math.PI * 2);
    elements.ctx.fill();
    
    // Brilho
    elements.ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    elements.ctx.beginPath();
    elements.ctx.arc(x - radius * 0.3, y - radius * 0.3, animatedRadius * 0.4, 0, Math.PI * 2);
    elements.ctx.fill();
  },
  
  roundedRect(x, y, width, height, radius) {
    elements.ctx.beginPath();
    elements.ctx.moveTo(x + radius, y);
    elements.ctx.lineTo(x + width - radius, y);
    elements.ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    elements.ctx.lineTo(x + width, y + height - radius);
    elements.ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    elements.ctx.lineTo(x + radius, y + height);
    elements.ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    elements.ctx.lineTo(x, y + radius);
    elements.ctx.quadraticCurveTo(x, y, x + radius, y);
    elements.ctx.closePath();
    elements.ctx.fill();
  },
  
  render() {
    this.clear();
    this.drawGrid();
    this.drawSnake();
    this.drawFood();
    particleSystem.draw();
  }
};

// ===== LÓGICA DO JOGO =====
const gameLogic = {
  reset() {
    gameState.currentGridSize = preferences.gridSize;
    gameState.tileCount = GAME_CONFIG.GRID_SIZES[gameState.currentGridSize].tiles;
    
    const center = Math.floor(gameState.tileCount / 2);
    gameState.snake = [
      { x: center, y: center },
      { x: center - 1, y: center },
      { x: center - 2, y: center }
    ];
    
    gameState.direction = { x: 1, y: 0 };
    gameState.nextDirection = { x: 1, y: 0 };
    gameState.isGameOver = false;
    gameState.isPaused = false;
    gameState.particles = [];
    
    this.placeFood();
    scoring.reset();
    scoring.init();
    this.setupCanvas();
  },
  
  setupCanvas() {
    const container = elements.canvas.parentElement;
    const maxSize = Math.min(container.clientWidth - 24, 520);
    const dpr = window.devicePixelRatio || 1;
    
    elements.canvas.style.width = maxSize + 'px';
    elements.canvas.style.height = maxSize + 'px';
    elements.canvas.width = Math.floor(maxSize * dpr);
    elements.canvas.height = Math.floor(maxSize * dpr);
    elements.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    
    renderer.render();
  },
  
  placeFood() {
    let newX, newY;
    do {
      newX = Math.floor(Math.random() * gameState.tileCount);
      newY = Math.floor(Math.random() * gameState.tileCount);
    } while (gameState.snake.some(segment => segment.x === newX && segment.y === newY));
    
    gameState.food = { x: newX, y: newY };
  },
  
  update() {
    if (!gameState.isRunning || gameState.isGameOver || gameState.isPaused) return;
    
    gameState.direction = { ...gameState.nextDirection };
    
    const head = gameState.snake[0];
    const newHead = {
      x: (head.x + gameState.direction.x + gameState.tileCount) % gameState.tileCount,
      y: (head.y + gameState.direction.y + gameState.tileCount) % gameState.tileCount
    };
    
    // Verificar auto-colisão
    if (gameState.snake.some(segment => segment.x === newHead.x && segment.y === newHead.y)) {
      this.gameOver();
      return;
    }
    
    gameState.snake.unshift(newHead);
    
    // Verificar se comeu comida
    if (newHead.x === gameState.food.x && newHead.y === gameState.food.y) {
      const isNewRecord = scoring.update(10);
      soundSystem.eat();
      
      if (isNewRecord) {
        soundSystem.record();
      }
      
      // Criar partículas
      const cellSize = renderer.getCellSize();
      particleSystem.create(
        newHead.x * cellSize + cellSize / 2,
        newHead.y * cellSize + cellSize / 2
      );
      
      this.placeFood();
    } else {
      gameState.snake.pop();
    }
    
    particleSystem.update();
  },
  
  gameOver() {
    gameState.isRunning = false;
    gameState.isGameOver = true;
    gameState.isFromGameOver = true;
    
    // Verificar recorde
    const currentHigh = scoring.getHighScore(gameState.currentGridSize);
    const isNewRecord = scoring.current > currentHigh;
    elements.finalScore.textContent = scoring.current.toString();
    
    if (isNewRecord) {
      scoring.setHighScore(gameState.currentGridSize, scoring.current);
      elements.highScore.textContent = scoring.current.toString();
      // Título com celebração, centralizado
      elements.gameOverTitle.innerHTML = '🎉 NOVO RECORDE! 🎉<br>Game Over';
      elements.gameOverTitle.style.color = '#ffd700';
      elements.gameOverTitle.style.textShadow = '0 0 10px rgba(255, 215, 0, 0.5)';
      elements.gameOverTitle.classList.add('record-title');
      // Info de recorde com pulso
      elements.recordInfo.innerHTML = `
        <div class="record-celebration">
          Você superou o recorde anterior de <strong>${currentHigh}</strong> pontos!
        </div>`;
      soundSystem.record();
    } else {
      // Resetar estilos
      elements.gameOverTitle.textContent = 'Game Over';
      elements.gameOverTitle.style.color = '';
      elements.gameOverTitle.style.textShadow = '';
      elements.gameOverTitle.classList.remove('record-title');
      elements.recordInfo.innerHTML = `
        <div>
          Seu melhor: <strong>${currentHigh}</strong>
        </div>`;
      soundSystem.gameOver();
    }

    elements.gameOverModal.classList.remove('hidden');
    elements.pauseBtn.classList.add('hidden');
    if (elements.homeBtn) elements.homeBtn.classList.add('hidden');
    
    // Removido som duplicado de game over (já tratado acima)
  }
};

// ===== SISTEMA DE CONTROLES =====
const controls = {
  directionMap: {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 }
  },
  
  lastDirectionTime: 0,
  
  setDirection(newDirection) {
    if (this.isModalOpen()) return;
    if (!gameState.isRunning || gameState.isGameOver || gameState.isPaused) return;
    
    const now = Date.now();
    if (now - this.lastDirectionTime < 50) return;
    
    const current = gameState.direction;
    const opposite = { x: -current.x, y: -current.y };
    
    if (newDirection.x === opposite.x && newDirection.y === opposite.y) return;
    
    gameState.nextDirection = newDirection;
    this.lastDirectionTime = now;
  },
  
  isModalOpen() {
    return (elements.gameModal && !elements.gameModal.classList.contains('hidden')) ||
           (elements.gameOverModal && !elements.gameOverModal.classList.contains('hidden'));
  },
  
  setupKeyboard() {
    document.addEventListener('keydown', (e) => {
      if (this.isModalOpen()) return;
      
      switch (e.code) {
        case 'ArrowUp':
        case 'KeyW':
          e.preventDefault();
          this.setDirection(this.directionMap.up);
          break;
        case 'ArrowDown':
        case 'KeyS':
          e.preventDefault();
          this.setDirection(this.directionMap.down);
          break;
        case 'ArrowLeft':
        case 'KeyA':
          e.preventDefault();
          this.setDirection(this.directionMap.left);
          break;
        case 'ArrowRight':
        case 'KeyD':
          e.preventDefault();
          this.setDirection(this.directionMap.right);
          break;
        case 'Space':
          e.preventDefault();
          if (gameState.isRunning && !gameState.isGameOver) {
            gameControls.pause();
          } else if (!gameState.isGameOver) {
            gameControls.start();
          }
          break;
        case 'Escape':
          e.preventDefault();
          if (gameState.isRunning) gameControls.home();
          break;
      }
    });
  },
  
  setupTouch() {
    this.setupSwipe();
  },
  
  setupSwipe() {
    let touchStartX = 0;
    let touchStartY = 0;
    const minSwipeDistance = 30;
    
    elements.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
    });
    
    elements.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
    });
    
    elements.canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      if (this.isModalOpen()) return;
      
      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchStartX;
      const deltaY = touch.clientY - touchStartY;
      
      if (Math.abs(deltaX) < minSwipeDistance && Math.abs(deltaY) < minSwipeDistance) {
        return;
      }
      
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        this.setDirection(deltaX > 0 ? this.directionMap.right : this.directionMap.left);
      } else {
        this.setDirection(deltaY > 0 ? this.directionMap.down : this.directionMap.up);
      }
    });
  }
};

// ===== CONTROLES DO JOGO =====
const gameControls = {
  start() {
    if (controls.isModalOpen()) return;
    
    gameState.isRunning = true;
    gameState.isPaused = false;
    gameState.isGameOver = false;
    gameState.isFromGameOver = false;
    
    elements.pauseBtn.classList.remove('hidden');
    elements.pauseBtn.textContent = 'Pausar';
    if (elements.homeBtn) elements.homeBtn.classList.remove('hidden');
  },
  
  pause() {
    if (!gameState.isRunning || gameState.isGameOver) return;
    
    gameState.isPaused = !gameState.isPaused;
    elements.pauseBtn.textContent = gameState.isPaused ? 'Continuar' : 'Pausar';
  },
  
  restart() {
    if (confirm('Tem certeza? Tudo será perdido.')) {
      gameLogic.reset();
      this.start();
    }
  },
  
  home() {
    gameState.isPaused = true;
    gameState.wasRunningBeforeMenu = gameState.isRunning && !gameState.isGameOver;
    modalSystem.show();
  },
  
  newGame() {
    if (gameState.wasRunningBeforeMenu && !confirm('Tem certeza? Tudo será perdido.')) {
      return;
    }
    gameState.wasRunningBeforeMenu = false;
    gameState.isFromGameOver = false;
    gameLogic.reset();
    modalSystem.show();
  }
};

// ===== SISTEMA DE UI =====
const uiSystem = {
  createElements() {
    // Botão Home (Menu)
    if (!elements.homeBtn) {
      elements.homeBtn = document.createElement('button');
      elements.homeBtn.textContent = 'Menu';
      elements.homeBtn.className = 'game-btn secondary';
      elements.homeBtn.addEventListener('click', gameControls.home);
      
      const controls = document.querySelector('.game-controls');
      if (controls && elements.pauseBtn) {
        controls.insertBefore(elements.homeBtn, elements.pauseBtn.nextSibling);
      }
    }
  },
  
  setupResponsiveCanvas() {
    const resizeCanvas = () => {
      if (gameState.isRunning) {
        gameLogic.setupCanvas();
      }
    };
    
    window.addEventListener('resize', resizeCanvas);
    gameLogic.setupCanvas();
  }
};

// ===== SISTEMA DE MODAL =====
const modalSystem = {
  setup() {
    elements.confirmBtn.addEventListener('click', () => {
      this.handleConfirm();
    });
    
    elements.newGameBtn.addEventListener('click', () => {
      gameControls.newGame();
    });
    
    this.updateGridSelection();
    scoring.updateModalHighScores();
  },
  
  handleConfirm() {
    // Ler preferências
    const selectedGrid = document.querySelector('input[name="gridSize"]:checked')?.value || 'large';
    const showGrid = document.querySelector('input[name="showGrid"]').checked;
    const soundOn = document.querySelector('input[name="soundOn"]').checked;
    const showParticles = document.querySelector('input[name="showParticles"]').checked;
    
    preferences.gridSize = selectedGrid;
    preferences.showGrid = showGrid;
    preferences.soundOn = soundOn;
    preferences.showParticles = showParticles;
    preferences.save();
    
    elements.gameModal.classList.add('hidden');
    
    if (gameState.wasRunningBeforeMenu && gameState.isRunning && !gameState.isGameOver) {
      gameState.isPaused = false;
      gameState.wasRunningBeforeMenu = false;
      
      elements.pauseBtn.classList.remove('hidden');
      elements.pauseBtn.textContent = 'Pausar';
      if (elements.homeBtn) elements.homeBtn.classList.remove('hidden');
    } else {
      gameLogic.reset();
      gameControls.start();
    }
  },
  
  setupPreferences() {
    document.querySelector('input[name="showGrid"]').checked = preferences.showGrid;
    document.querySelector('input[name="soundOn"]').checked = preferences.soundOn;
    document.querySelector('input[name="showParticles"]').checked = preferences.showParticles;
  },
  
  updateGridSelection() {
    const gridRadio = document.querySelector(`input[name="gridSize"][value="${preferences.gridSize}"]`);
    if (gridRadio) {
      gridRadio.checked = true;
    }
    
    const gridInputs = document.querySelectorAll('input[name="gridSize"]');
    const isResuming = gameState.wasRunningBeforeMenu && !gameState.isGameOver;
    
    gridInputs.forEach(input => {
      input.disabled = isResuming;
      input.parentElement.style.opacity = isResuming ? '0.5' : '1';
    });
  },
  
  show() {
    const isResuming = gameState.wasRunningBeforeMenu && !gameState.isGameOver;
    const isFromGameOver = gameState.isFromGameOver;
    
    elements.confirmBtn.textContent = isResuming ? 'Retomar' : 'Começar';
    elements.newGameBtn.style.display = (isResuming && !isFromGameOver) ? 'block' : 'none';
    
    // Atualizar título do modal
    const modalTitle = elements.gameModal.querySelector('#modal-title');
    const subtitle = elements.gameModal.querySelector('.subtitle');
    if (modalTitle) {
      if (isResuming && !isFromGameOver) {
        modalTitle.textContent = 'Snake';
        if (subtitle) subtitle.textContent = 'Criado por Paulinho';
      } else {
        modalTitle.textContent = 'Bem-vindo(a) ao Snake!';
        if (subtitle) subtitle.textContent = 'Criado por Paulinho';
      }
    }
    
    this.updateGridSelection();
    this.setupPreferences();
    scoring.updateModalHighScores();
    
    elements.gameModal.classList.remove('hidden');
    
    const firstInput = elements.gameModal.querySelector('input[type="radio"]:checked') ||
                      elements.gameModal.querySelector('input[type="radio"]');
    if (firstInput && !firstInput.disabled) firstInput.focus();
  }
};

// ===== LOOP PRINCIPAL =====
let animationId = null;

function gameLoop(currentTime) {
  animationId = requestAnimationFrame(gameLoop);
  
  const deltaTime = currentTime - gameState.lastFrameTime;
  gameState.lastFrameTime = currentTime;
  
  gameState.accumulator += deltaTime;
  
  while (gameState.accumulator >= gameState.currentSpeed) {
    gameLogic.update();
    gameState.accumulator -= gameState.currentSpeed;
  }
  
  renderer.render();
}

// ===== INICIALIZAÇÃO =====
function init() {
  elements.ctx = elements.canvas.getContext('2d');
  
  preferences.load();
  soundSystem.init();
  scoring.init();
  
  uiSystem.createElements();
  uiSystem.setupResponsiveCanvas();
  
  controls.setupKeyboard();
  controls.setupTouch();
  
  modalSystem.setup();
  
  // Event listeners
  elements.pauseBtn.addEventListener('click', gameControls.pause);
  elements.restartBtn.addEventListener('click', gameControls.restart);
  
  gameLogic.reset();
  modalSystem.show();
  
  gameState.lastFrameTime = performance.now();
  gameLoop(gameState.lastFrameTime);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}