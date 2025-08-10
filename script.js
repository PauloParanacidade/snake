/**
 * Snake Game - Versão Refatorada
 * Implementa requestAnimationFrame, softcap de velocidade, preferências e melhor UX
 */

// ===== CONFIGURAÇÃO E CONSTANTES =====
const GAME_CONFIG = {
  GRID_SIZE: 20,
  TILE_COUNT: 20,
  
  // Sistema de velocidade (intervalos em ms)
  SPEED_PRESETS: {
    slow: 500,
    normal: 250,
    fast: 100
  },
  
  // Parâmetros do softcap
  MIN_INTERVAL: 60,
  SOFTCAP_THRESHOLD: 8, // primeiros 8 alimentos
  SPEED_REDUCTION_BEFORE_CAP: 8, // k1 = 8ms por alimento
  SPEED_REDUCTION_AFTER_CAP: 2,  // k2 = 2ms por alimento
  
  // Animação e UX
  SPEED_TWEEN_DURATION: 200, // ms para transição suave
  PARTICLE_COUNT: 8,
  TOUCH_TARGET_SIZE: 56 // px mínimo
};

// ===== ESTADO DO JOGO =====
const gameState = {
  snake: [],
  direction: { x: 1, y: 0 },
  nextDirection: { x: 1, y: 0 },
  food: { x: 10, y: 10 },
  score: 0,
  level: 1,
  currentInterval: 120,
  targetInterval: 120,
  startLength: 3,
  
  // Estados de controle
  isRunning: false,
  isGameOver: false,
  isPaused: false,
  wasRunningBeforeMenu: false,
  
  // Animação
  lastFrameTime: 0,
  accumulator: 0,
  speedTweenStart: 0,
  initialTweenInterval: 0,
  
  // Partículas
  particles: []
};

// ===== SISTEMA DE PREFERÊNCIAS =====
const preferences = {
  initialSpeed: 'slow',
  soundOn: true,
  showGrid: true,
  showParticles: true,
  
  // Carregar do localStorage
  load() {
    const saved = localStorage.getItem('snakePreferences');
    if (saved) {
      Object.assign(this, JSON.parse(saved));
    }
    return this;
  },
  
  // Salvar no localStorage
  save() {
    localStorage.setItem('snakePreferences', JSON.stringify(this));
  },
  
  // Resetar para padrões
  reset() {
    this.initialSpeed = 'slow';
    this.soundOn = true;
    this.showGrid = true;
    this.showParticles = true;
    this.save();
  }
};

// ===== ELEMENTOS DOM =====
const elements = {
  // Canvas
  canvas: document.getElementById('gameCanvas'),
  ctx: null,
  
  // UI Elements
  score: document.getElementById('score'),
  highScore: document.getElementById('highScore'),
  finalScore: document.getElementById('finalScore'),
  gameOver: document.getElementById('gameOver'),
  
  // Buttons
  startBtn: document.getElementById('startBtn'),
  pauseBtn: document.getElementById('pauseBtn'),
  restartBtn: document.getElementById('restartBtn'),
  homeBtn: null, // Será criado
  
  // Modal
  speedModal: document.getElementById('speedModal'),
  confirmSpeedBtn: document.getElementById('confirmSpeedBtn'),
  
  // Indicators (serão criados)
  speedIndicator: null,
  levelIndicator: null
};

// ===== SISTEMA DE PONTUAÇÃO =====
const scoring = {
  current: 0,
  high: parseInt(localStorage.getItem('snakeHighScore') || '0', 10),
  
  update(points) {
    this.current += points;
    elements.score.textContent = this.current.toString();
    
    if (this.current > this.high) {
      this.high = this.current;
      localStorage.setItem('snakeHighScore', this.high.toString());
      elements.highScore.textContent = this.high.toString();
    }
  },
  
  reset() {
    this.current = 0;
    elements.score.textContent = '0';
  },
  
  init() {
    elements.highScore.textContent = this.high.toString();
  }
};

// ===== SISTEMA DE SOM =====
const soundSystem = {
  audioContext: null,
  
  init() {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.log('Web Audio API not supported');
    }
  },
  
  // Gera um tom simples
  playTone(frequency, duration, type = 'sine') {
    if (!preferences.soundOn || !this.audioContext) return;
    
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
  },
  
  // Sons específicos
  eat() { this.playTone(800, 0.1); },
  levelUp() { this.playTone(1200, 0.2); },
  gameOver() { this.playTone(200, 0.5, 'sawtooth'); }
};

// ===== SISTEMA DE VELOCIDADE COM SOFTCAP =====
const speedSystem = {
  // Calcula o intervalo baseado no softcap
  calculateInterval(snakeLength) {
    const initialInterval = GAME_CONFIG.SPEED_PRESETS[preferences.initialSpeed];
    const delta = snakeLength - gameState.startLength;
    
    if (delta <= 0) return initialInterval;
    
    let reduction;
    if (delta <= GAME_CONFIG.SOFTCAP_THRESHOLD) {
      reduction = GAME_CONFIG.SPEED_REDUCTION_BEFORE_CAP * delta;
    } else {
      reduction = GAME_CONFIG.SPEED_REDUCTION_BEFORE_CAP * GAME_CONFIG.SOFTCAP_THRESHOLD +
                  GAME_CONFIG.SPEED_REDUCTION_AFTER_CAP * (delta - GAME_CONFIG.SOFTCAP_THRESHOLD);
    }
    
    const newInterval = initialInterval - reduction;
    return Math.max(GAME_CONFIG.MIN_INTERVAL, newInterval);
  },
  
  // Atualiza velocidade com transição suave
  updateSpeed(newLength) {
    const targetInterval = this.calculateInterval(newLength);
    
    if (targetInterval !== gameState.targetInterval) {
      gameState.initialTweenInterval = gameState.currentInterval;
      gameState.targetInterval = targetInterval;
      gameState.speedTweenStart = performance.now();
      
      // Calcular nível baseado na velocidade
      const speedReduction = GAME_CONFIG.SPEED_PRESETS[preferences.initialSpeed] - targetInterval;
      gameState.level = Math.floor(speedReduction / GAME_CONFIG.SPEED_REDUCTION_BEFORE_CAP) + 1;
      
      this.updateSpeedIndicator();
      
      if (gameState.level > 1 && newLength > gameState.startLength) {
        soundSystem.levelUp();
      }
    }
  },
  
  // Interpola entre velocidades (easeOutCubic)
  tweenSpeed(currentTime) {
    if (gameState.speedTweenStart === 0) return;
    
    const elapsed = currentTime - gameState.speedTweenStart;
    const progress = Math.min(elapsed / GAME_CONFIG.SPEED_TWEEN_DURATION, 1);
    
    // easeOutCubic: 1 - (1-t)³
    const eased = 1 - Math.pow(1 - progress, 3);
    
    gameState.currentInterval = gameState.initialTweenInterval + 
      (gameState.targetInterval - gameState.initialTweenInterval) * eased;
    
    if (progress >= 1) {
      gameState.speedTweenStart = 0;
      gameState.currentInterval = gameState.targetInterval;
    }
  },
  
  // Atualiza indicador visual
  updateSpeedIndicator() {
    if (!elements.speedIndicator) return;
    
    const speedName = preferences.initialSpeed.charAt(0).toUpperCase() + 
                     preferences.initialSpeed.slice(1);
    elements.speedIndicator.textContent = `Velocidade: ${speedName} • Nível: ${gameState.level}`;
  }
};

// ===== SISTEMA DE PARTÍCULAS =====
const particleSystem = {
  create(x, y) {
    if (!preferences.showParticles) return;
    
    for (let i = 0; i < GAME_CONFIG.PARTICLE_COUNT; i++) {
      gameState.particles.push({
        x: x + Math.random() * 20 - 10,
        y: y + Math.random() * 20 - 10,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4,
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
      particle.vx *= 0.98; // resistência do ar
      particle.vy *= 0.98;
      
      return particle.life > 0;
    });
  },
  
  draw() {
    if (!preferences.showParticles) return;
    
    gameState.particles.forEach(particle => {
      const alpha = particle.life;
      elements.ctx.fillStyle = `rgba(255, 100, 100, ${alpha})`;
      elements.ctx.beginPath();
      elements.ctx.arc(particle.x, particle.y, particle.size * particle.life, 0, Math.PI * 2);
      elements.ctx.fill();
    });
  }
};

// ===== SISTEMA DE DESENHO =====
const renderer = {
  // Tamanho dinâmico da célula
  getCellSize() {
    const canvasSize = elements.canvas.getBoundingClientRect().width;
    return canvasSize / GAME_CONFIG.TILE_COUNT;
  },
  
  // Limpa o canvas
  clear() {
    elements.ctx.save();
    elements.ctx.setTransform(1, 0, 0, 1, 0, 0);
    elements.ctx.clearRect(0, 0, elements.canvas.width, elements.canvas.height);
    elements.ctx.restore();
  },
  
  // Desenha a grade
  drawGrid() {
    if (!preferences.showGrid) return;
    
    const cellSize = this.getCellSize();
    elements.ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    elements.ctx.lineWidth = 1;
    
    for (let i = 0; i <= GAME_CONFIG.TILE_COUNT; i++) {
      const pos = i * cellSize + 0.5;
      
      // Linhas verticais
      elements.ctx.beginPath();
      elements.ctx.moveTo(pos, 0);
      elements.ctx.lineTo(pos, elements.canvas.height);
      elements.ctx.stroke();
      
      // Linhas horizontais
      elements.ctx.beginPath();
      elements.ctx.moveTo(0, pos);
      elements.ctx.lineTo(elements.canvas.width, pos);
      elements.ctx.stroke();
    }
  },
  
  // Desenha a cobrinha
  drawSnake() {
    const cellSize = this.getCellSize();
    
    gameState.snake.forEach((segment, index) => {
      const isHead = index === 0;
      const progress = index / (gameState.snake.length - 1 || 1);
      
      // Gradiente de cor: cabeça mais brilhante
      const hue = 140 - progress * 60;
      const saturation = isHead ? 80 : 70;
      const lightness = isHead ? 60 : 50;
      
      elements.ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
      
      const x = segment.x * cellSize;
      const y = segment.y * cellSize;
      const size = cellSize - 1;
      
      // Cantos arredondados para a cabeça
      if (isHead) {
        this.roundedRect(x, y, size, size, 4);
      } else {
        elements.ctx.fillRect(x, y, size, size);
      }
    });
  },
  
  // Desenha a comida
  drawFood() {
    const cellSize = this.getCellSize();
    const x = gameState.food.x * cellSize + cellSize / 2;
    const y = gameState.food.y * cellSize + cellSize / 2;
    const radius = cellSize / 2 - 2;
    
    // Animação de pulsação
    const pulse = Math.sin(Date.now() * 0.005) * 0.1 + 1;
    const animatedRadius = radius * pulse;
    
    elements.ctx.fillStyle = '#ef4444';
    elements.ctx.beginPath();
    elements.ctx.arc(x, y, animatedRadius, 0, Math.PI * 2);
    elements.ctx.fill();
    
    // Brilho interno
    elements.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    elements.ctx.beginPath();
    elements.ctx.arc(x - radius * 0.3, y - radius * 0.3, animatedRadius * 0.4, 0, Math.PI * 2);
    elements.ctx.fill();
  },
  
  // Utilitário para retângulos arredondados
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
  
  // Renderiza tudo
  render() {
    this.clear();
    this.drawGrid();
    this.drawSnake();
    this.drawFood();
    particleSystem.draw();
  }
};

// ===== LÓGICA PRINCIPAL DO JOGO =====
const gameLogic = {
  // Reseta o jogo
  reset() {
    gameState.snake = [
      { x: 8, y: 10 },
      { x: 7, y: 10 },
      { x: 6, y: 10 }
    ];
    gameState.direction = { x: 1, y: 0 };
    gameState.nextDirection = { x: 1, y: 0 };
    gameState.startLength = gameState.snake.length;
    gameState.isGameOver = false;
    gameState.isPaused = false;
    gameState.level = 1;
    gameState.particles = [];
    gameState.speedTweenStart = 0;
    
    // Resetar velocidade
    const initialInterval = GAME_CONFIG.SPEED_PRESETS[preferences.initialSpeed];
    gameState.currentInterval = initialInterval;
    gameState.targetInterval = initialInterval;
    
    this.placeFood();
    scoring.reset();
    speedSystem.updateSpeedIndicator();
  },
  
  // Coloca comida aleatoriamente
  placeFood() {
    let newX, newY;
    do {
      newX = Math.floor(Math.random() * GAME_CONFIG.TILE_COUNT);
      newY = Math.floor(Math.random() * GAME_CONFIG.TILE_COUNT);
    } while (gameState.snake.some(segment => segment.x === newX && segment.y === newY));
    
    gameState.food = { x: newX, y: newY };
  },
  
  // Atualiza lógica do jogo
  update() {
    if (!gameState.isRunning || gameState.isGameOver || gameState.isPaused) return;
    
    // Atualizar direção
    gameState.direction = { ...gameState.nextDirection };
    
    // Calcular próxima posição da cabeça
    const head = gameState.snake[0];
    const newHead = {
      x: (head.x + gameState.direction.x + GAME_CONFIG.TILE_COUNT) % GAME_CONFIG.TILE_COUNT,
      y: (head.y + gameState.direction.y + GAME_CONFIG.TILE_COUNT) % GAME_CONFIG.TILE_COUNT
    };
    
    // Verificar auto-colisão
    if (gameState.snake.some(segment => segment.x === newHead.x && segment.y === newHead.y)) {
      this.gameOver();
      return;
    }
    
    // Adicionar nova cabeça
    gameState.snake.unshift(newHead);
    
    // Verificar se comeu comida
    if (newHead.x === gameState.food.x && newHead.y === gameState.food.y) {
      scoring.update(10);
      soundSystem.eat();
      
      // Criar partículas
      const cellSize = renderer.getCellSize();
      particleSystem.create(
        newHead.x * cellSize + cellSize / 2,
        newHead.y * cellSize + cellSize / 2
      );
      
      this.placeFood();
      speedSystem.updateSpeed(gameState.snake.length);
    } else {
      // Remover cauda se não comeu
      gameState.snake.pop();
    }
    
    // Atualizar partículas
    particleSystem.update();
  },
  
  // Game over
  gameOver() {
    gameState.isRunning = false;
    gameState.isGameOver = true;
    elements.finalScore.textContent = scoring.current.toString();
    elements.gameOver.classList.remove('hidden');
    elements.pauseBtn.classList.add('hidden');
    elements.startBtn.classList.remove('hidden');
    soundSystem.gameOver();
  }
};

// ===== SISTEMA DE CONTROLES =====
const controls = {
  // Mapa de direções
  directionMap: {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 }
  },
  
  // Últimas direções para debounce
  lastDirection: null,
  lastDirectionTime: 0,
  
  // Define nova direção com validação
  setDirection(newDirection) {
    const now = Date.now();
    
    // Debounce: evitar mudanças muito rápidas
    if (now - this.lastDirectionTime < 100) return;
    
    // Evitar reversão direta
    const current = gameState.direction;
    if (gameState.snake.length > 1 &&
        newDirection.x === -current.x && newDirection.y === -current.y) {
      return;
    }
    
    gameState.nextDirection = newDirection;
    this.lastDirection = newDirection;
    this.lastDirectionTime = now;
    
    // Auto-start se não estiver rodando
    if (!gameState.isRunning && !gameState.isGameOver && !this.isModalOpen()) {
      gameControls.start();
    }
  },
  
  // Verifica se modal está aberto
  isModalOpen() {
    return elements.speedModal && !elements.speedModal.classList.contains('hidden');
  },
  
  // Configurar controles de teclado
  setupKeyboard() {
    window.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      
      // Direções
      if (key === 'arrowup' || key === 'w') {
        this.setDirection(this.directionMap.up);
        e.preventDefault();
      } else if (key === 'arrowdown' || key === 's') {
        this.setDirection(this.directionMap.down);
        e.preventDefault();
      } else if (key === 'arrowleft' || key === 'a') {
        this.setDirection(this.directionMap.left);
        e.preventDefault();
      } else if (key === 'arrowright' || key === 'd') {
        this.setDirection(this.directionMap.right);
        e.preventDefault();
      }
      
      // Controles do jogo
      if (key === ' ' || key === 'enter') {
        if (this.isModalOpen()) return;
        
        if (gameState.isRunning) {
          gameControls.pause();
        } else {
          gameControls.start();
        }
        e.preventDefault();
      }
      
      // Escape para voltar ao menu
      if (key === 'escape') {
        gameControls.home();
        e.preventDefault();
      }
    });
  },
  
  // Configurar controles touch
  setupTouch() {
    // Botões direcionais
    document.querySelectorAll('.touch-btn').forEach(btn => {
      const direction = btn.getAttribute('data-direction');
      if (!direction || !this.directionMap[direction]) return;
      
      btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.setDirection(this.directionMap[direction]);
        btn.classList.add('active');
      }, { passive: false });
      
      btn.addEventListener('touchend', (e) => {
        e.preventDefault();
        btn.classList.remove('active');
      }, { passive: false });
      
      // Acessibilidade
      btn.setAttribute('role', 'button');
      btn.setAttribute('aria-label', `Mover ${direction === 'up' ? 'para cima' : 
                                                direction === 'down' ? 'para baixo' :
                                                direction === 'left' ? 'para esquerda' : 'para direita'}`);
    });
    
    // Swipe no canvas
    this.setupSwipe();
  },
  
  // Sistema de swipe
  setupSwipe() {
    let touchStart = null;
    const minDistance = 30;
    const maxTime = 500;
    
    elements.canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      
      touchStart = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        time: Date.now()
      };
    }, { passive: true });
    
    elements.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault(); // Evitar scroll
    }, { passive: false });
    
    elements.canvas.addEventListener('touchend', (e) => {
      if (!touchStart || e.changedTouches.length !== 1) return;
      
      const touchEnd = {
        x: e.changedTouches[0].clientX,
        y: e.changedTouches[0].clientY,
        time: Date.now()
      };
      
      const dx = touchEnd.x - touchStart.x;
      const dy = touchEnd.y - touchStart.y;
      const dt = touchEnd.time - touchStart.time;
      
      if (dt > maxTime) return;
      
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < minDistance) return;
      
      // Determinar direção
      let direction;
      if (Math.abs(dx) > Math.abs(dy)) {
        direction = dx > 0 ? this.directionMap.right : this.directionMap.left;
      } else {
        direction = dy > 0 ? this.directionMap.down : this.directionMap.up;
      }
      
      this.setDirection(direction);
    }, { passive: false });
  }
};

// ===== CONTROLES DO JOGO =====
const gameControls = {
  start() {
    if (gameState.isRunning || controls.isModalOpen()) return;
    
    if (gameState.isGameOver) {
      elements.gameOver.classList.add('hidden');
      gameLogic.reset();
    }
    
    gameState.isRunning = true;
    gameState.isPaused = false;
    elements.startBtn.classList.add('hidden');
    elements.pauseBtn.classList.remove('hidden');
    elements.pauseBtn.textContent = 'Pausar';
    elements.pauseBtn.setAttribute('aria-label', 'Pausar jogo');
    
    if (elements.homeBtn) {
      elements.homeBtn.classList.remove('hidden');
    }
  },
  
  pause() {
    if (!gameState.isRunning) return;
    
    gameState.isPaused = !gameState.isPaused;
    
    if (gameState.isPaused) {
      elements.pauseBtn.textContent = 'Retomar';
      elements.pauseBtn.setAttribute('aria-label', 'Retomar jogo');
    } else {
      elements.pauseBtn.textContent = 'Pausar';
      elements.pauseBtn.setAttribute('aria-label', 'Pausar jogo');
    }
  },
  
  restart() {
    gameLogic.reset();
    this.start();
  },
  
  home() {
    // Se o jogo estava rodando, marcar para retomar depois do menu
    gameState.wasRunningBeforeMenu = gameState.isRunning && !gameState.isGameOver;
    
    // Pausar logicamente durante o menu
    if (gameState.wasRunningBeforeMenu) {
      gameState.isPaused = true;
      // manter isRunning true para indicar que é uma sessão ativa pausada
    } else {
      gameState.isRunning = false;
      gameState.isPaused = false;
    }
    
    // Atualizar UI de botões: esconder Start, mostrar Pause e Menu
    elements.startBtn.classList.add('hidden');
    elements.pauseBtn.classList.remove('hidden');
    elements.pauseBtn.textContent = 'Retomar';
    elements.pauseBtn.setAttribute('aria-label', 'Retomar jogo');
    if (elements.homeBtn) elements.homeBtn.classList.remove('hidden');
    
    // Ocultar Game Over se visível
    elements.gameOver.classList.add('hidden');
    
    // Mostrar modal com texto apropriado
    modalSystem.show();
  }
};

// ===== SISTEMA DE UI =====
const uiSystem = {
  // Criar elementos adicionais da UI
  createElements() {
    // Botão Home/Voltar
    elements.homeBtn = document.createElement('button');
    elements.homeBtn.textContent = 'Menu';
    elements.homeBtn.className = 'restart-btn hidden';
    elements.homeBtn.setAttribute('aria-label', 'Voltar ao menu inicial');
    elements.homeBtn.addEventListener('click', gameControls.home);
    
    // Adicionar ao grupo de botões (se existir)
    const buttonGroup = document.querySelector('.button-group');
    if (buttonGroup) {
      buttonGroup.appendChild(elements.homeBtn);
    }
    
    // Indicadores de velocidade e nível
    elements.speedIndicator = document.createElement('div');
    elements.speedIndicator.className = 'speed-indicator';
    const speedName = preferences.initialSpeed.charAt(0).toUpperCase() + preferences.initialSpeed.slice(1);
    elements.speedIndicator.textContent = `Velocidade: ${speedName} • Nível: 1`;
    
    const gameInfo = document.querySelector('.game-info');
    if (gameInfo) {
      gameInfo.appendChild(elements.speedIndicator);
    }
  },
  
  // Melhorar acessibilidade
  improveAccessibility() {
    // Adicionar ARIA labels
    elements.startBtn.setAttribute('aria-label', 'Iniciar jogo');
    elements.pauseBtn.setAttribute('aria-label', 'Pausar jogo');
    elements.restartBtn.setAttribute('aria-label', 'Reiniciar jogo');
    elements.canvas.setAttribute('role', 'game');
    elements.canvas.setAttribute('aria-label', 'Área do jogo Snake');
    
    // Melhorar modal
    elements.speedModal.setAttribute('role', 'dialog');
    elements.speedModal.setAttribute('aria-modal', 'true');
    elements.speedModal.setAttribute('aria-labelledby', 'modal-title');
    
    // Adicionar ID ao título do modal
    const modalTitle = elements.speedModal.querySelector('h2');
    if (modalTitle) {
      modalTitle.id = 'modal-title';
    }
    
    // Focus trap no modal
    this.setupFocusTrap();
  },
  
  // Sistema de focus trap para modal
  setupFocusTrap() {
    const modal = elements.speedModal;
    const focusableElements = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    if (focusableElements.length === 0) return;
    
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    
    modal.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      
      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement.focus();
          e.preventDefault();
        }
      }
    });
  },
  
  // Responsividade do canvas
  setupResponsiveCanvas() {
    const resizeCanvas = () => {
      const container = elements.canvas.parentElement;
      const size = Math.min(container.clientWidth, 520);
      const dpr = window.devicePixelRatio || 1;
      
      elements.canvas.style.width = size + 'px';
      elements.canvas.style.height = size + 'px';
      elements.canvas.width = Math.floor(size * dpr);
      elements.canvas.height = Math.floor(size * dpr);
      elements.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      
      renderer.render();
    };
    
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
  }
};

// ===== SISTEMA DE MODAL =====
const modalSystem = {
  setup() {
    elements.confirmSpeedBtn.addEventListener('click', () => {
      const selectedSpeed = document.querySelector('input[name="speed"]:checked')?.value || 'normal';
      
      // Sempre persistir preferência, independente de retomar ou novo jogo
      preferences.initialSpeed = selectedSpeed;
      preferences.save();
      
      if (gameState.wasRunningBeforeMenu && gameState.isRunning && gameState.isPaused && !gameState.isGameOver) {
        // Caso de Retomar: não alterar a velocidade/intervalos atuais
        elements.speedModal.classList.add('hidden');
        gameState.isPaused = false;
        gameState.wasRunningBeforeMenu = false;
        
        // Atualizar botões para estado em execução
        elements.pauseBtn.classList.remove('hidden');
        elements.pauseBtn.textContent = 'Pausar';
        elements.pauseBtn.setAttribute('aria-label', 'Pausar jogo');
        if (elements.homeBtn) elements.homeBtn.classList.remove('hidden');
        elements.startBtn.classList.add('hidden');
        
        return;
      }
      
      // Caso de nova sessão (inicial ou após game over): preparar velocidade inicial
      const initialInterval = GAME_CONFIG.SPEED_PRESETS[selectedSpeed];
      gameState.currentInterval = initialInterval;
      gameState.targetInterval = initialInterval;
      
      // Fechar modal e focar botão Start
      elements.speedModal.classList.add('hidden');
      elements.startBtn.focus();
      
      speedSystem.updateSpeedIndicator();
    });
    
    // Configurar seleção de velocidade baseada nas preferências
    this.updateSpeedSelection();
  },
  
  updateSpeedSelection() {
    const speedRadio = document.querySelector(`input[name="speed"][value="${preferences.initialSpeed}"]`);
    if (speedRadio) {
      speedRadio.checked = true;
    }
  },
  
  show() {
    // Definir texto do botão conforme contexto (retomar ou começar)
    if (gameState.wasRunningBeforeMenu && !gameState.isGameOver) {
      elements.confirmSpeedBtn.textContent = 'Retomar';
    } else {
      elements.confirmSpeedBtn.textContent = 'Começar';
    }
    
    elements.speedModal.classList.remove('hidden');
    this.updateSpeedSelection();
    
    const firstInput = elements.speedModal.querySelector('input[type="radio"]:checked') ||
                      elements.speedModal.querySelector('input[type="radio"]');
    if (firstInput) firstInput.focus();
  }
};

// ===== LOOP PRINCIPAL COM REQUESTANIMATIONFRAME =====
let animationId = null;

function gameLoop(currentTime) {
  animationId = requestAnimationFrame(gameLoop);
  
  // Calcular delta time
  const deltaTime = currentTime - gameState.lastFrameTime;
  gameState.lastFrameTime = currentTime;
  
  // Tween de velocidade
  speedSystem.tweenSpeed(currentTime);
  
  // Acumular tempo para ticks do jogo
  gameState.accumulator += deltaTime;
  
  // Executar ticks baseado no intervalo atual
  while (gameState.accumulator >= gameState.currentInterval) {
    gameLogic.update();
    gameState.accumulator -= gameState.currentInterval;
  }
  
  // Sempre renderizar
  renderer.render();
}

// ===== INICIALIZAÇÃO =====
function init() {
  // Configurar elementos DOM
  elements.ctx = elements.canvas.getContext('2d');
  
  // Carregar preferências
  preferences.load();
  
  // Inicializar sistemas
  soundSystem.init();
  scoring.init();
  
  // Configurar UI
  uiSystem.createElements();
  uiSystem.improveAccessibility();
  uiSystem.setupResponsiveCanvas();
  
  // Configurar controles
  controls.setupKeyboard();
  controls.setupTouch();
  
  // Configurar modal
  modalSystem.setup();
  
  // Configurar botões
  elements.startBtn.addEventListener('click', gameControls.start);
  elements.pauseBtn.addEventListener('click', gameControls.pause);
  elements.restartBtn.addEventListener('click', gameControls.restart);
  
  // Estado inicial
  gameLogic.reset();
  speedSystem.updateSpeedIndicator();
  
  // Mostrar modal inicial
  modalSystem.show();
  
  // Iniciar loop
  gameState.lastFrameTime = performance.now();
  gameLoop(gameState.lastFrameTime);
}

// ===== INICIAR QUANDO DOM ESTIVER PRONTO =====
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}