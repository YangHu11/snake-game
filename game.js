(function () {
    'use strict';

    // ---------- DOM ----------
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const scoreSpan = document.getElementById('scoreDisplay');
    const restartBtn = document.getElementById('restartButton');
    const muteBtn = document.getElementById('muteButton');

    // =====================================================
    // 音效 + 背景音乐模块（Web Audio API 合成，无需音频文件）
    // =====================================================
    const Sound = (function () {
        let audioCtx = null;
        let muted = false;

        // BGM 相关状态
        let bgmTimer = null;         // 主循环调度器
        let bgmPlaying = false;      // BGM 是否在播放
        let bgmStep = 0;             // 当前播放到第几个音符
        let bgmTempo = 220;          // 每个音符间隔(ms)，越小越快
        let bgmGain = null;          // BGM 总音量节点
        let bgmVolume = 0.05;        // BGM 基础音量（比音效低，不喧宾夺主）

        // 延迟创建 AudioContext
        function getCtx() {
            if (!audioCtx) {
                const AC = window.AudioContext || window.webkitAudioContext;
                if (!AC) return null;
                audioCtx = new AC();
            }
            if (audioCtx.state === 'suspended') {
                audioCtx.resume();
            }
            return audioCtx;
        }

        // ---------- 单个音符（音效用）----------
        function playTone(freqStart, freqEnd, duration, type = 'square', volume = 0.08) {
            if (muted) return;
            const c = getCtx();
            if (!c) return;

            const osc = c.createOscillator();
            const gain = c.createGain();

            osc.type = type;
            osc.frequency.setValueAtTime(freqStart, c.currentTime);
            if (freqEnd && freqEnd !== freqStart) {
                osc.frequency.exponentialRampToValueAtTime(
                    Math.max(freqEnd, 1),
                    c.currentTime + duration
                );
            }

            gain.gain.setValueAtTime(volume, c.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);

            osc.connect(gain);
            gain.connect(c.destination);

            osc.start();
            osc.stop(c.currentTime + duration);
        }

        // 播放一串音符（胜利音效用）
        function playSequence(notes) {
            if (muted) return;
            const c = getCtx();
            if (!c) return;

            let t = c.currentTime;
            notes.forEach(n => {
                const osc = c.createOscillator();
                const gain = c.createGain();
                osc.type = n.type || 'square';
                osc.frequency.setValueAtTime(n.freq, t);

                gain.gain.setValueAtTime(0.0001, t);
                gain.gain.exponentialRampToValueAtTime(n.volume || 0.1, t + 0.01);
                gain.gain.exponentialRampToValueAtTime(0.0001, t + n.duration);

                osc.connect(gain);
                gain.connect(c.destination);
                osc.start(t);
                osc.stop(t + n.duration);
                t += n.duration;
            });
        }

        // =====================================================
        // 【新增】BGM：一段简单循环旋律（C 大调 8-bit 风格）
        // 主旋律数组，每个元素 = 一个音符的频率，0 表示休止
        // =====================================================
        const MELODY = [
            523.25, 659.25, 783.99, 659.25,   // C5 E5 G5 E5
            698.46, 880.00, 1046.50, 880.00,  // F5 A5 C6 A5
            783.99, 987.77, 1174.66, 987.77,  // G5 B5 D6 B5
            1046.50, 783.99, 659.25, 523.25   // C6 G5 E5 C5
        ];
        // 贝斯：每 4 个主音配一个低音
        const BASS = [261.63, 349.23, 392.00, 523.25];

        // 播放一个 BGM 音符（不经过 muted 判断，由 bgmGain 统一控制）
        function playBgmNote(freq, duration, type, volume) {
            const c = getCtx();
            if (!c || !bgmGain) return;

            const osc = c.createOscillator();
            const gain = c.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, c.currentTime);

            // 圆润包络：快速起音 + 缓释，避免爆音
            gain.gain.setValueAtTime(0.0001, c.currentTime);
            gain.gain.exponentialRampToValueAtTime(volume, c.currentTime + 0.015);
            gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + duration);

            osc.connect(gain);
            gain.connect(bgmGain);

            osc.start();
            osc.stop(c.currentTime + duration);
        }

        // BGM 主调度：递归 setTimeout 而不是 setInterval，方便动态改速度
        function bgmSchedule() {
            if (!bgmPlaying) return;

            const noteDuration = bgmTempo / 1000 * 0.9; // 留一点空隙
            const note = MELODY[bgmStep % MELODY.length];

            // 主旋律
            if (note > 0) {
                playBgmNote(note, noteDuration, 'square', 0.07);
            }
            // 每 4 个主音加一个贝斯
            if (bgmStep % 4 === 0) {
                const bassNote = BASS[(bgmStep / 4) % BASS.length];
                playBgmNote(bassNote, noteDuration * 3.5, 'triangle', 0.10);
            }

            bgmStep++;

            // 用 setTimeout 递归，每次读取最新的 bgmTempo
            bgmTimer = setTimeout(bgmSchedule, bgmTempo);
        }

        return {
            // ---------- 音效（和之前一致）----------
            eat()      { playTone(880, 1320, 0.12, 'square', 0.09); },
            gameOver() { playTone(440, 110, 0.5, 'sawtooth', 0.12); },
            win() {
                playSequence([
                    { freq: 523.25, duration: 0.15, type: 'square', volume: 0.10 },
                    { freq: 659.25, duration: 0.15, type: 'square', volume: 0.10 },
                    { freq: 783.99, duration: 0.30, type: 'square', volume: 0.12 }
                ]);
            },
            pause()  { playTone(600, 600, 0.06, 'square', 0.07); },
            resume() { playTone(800, 800, 0.06, 'square', 0.07); },
            turn()   { playTone(1200, 1200, 0.02, 'square', 0.025); },

            // =====================================================
            // 【新增】BGM 控制接口
            // =====================================================
            startBgm() {
                if (muted) return;
                const c = getCtx();
                if (!c) return;
                if (bgmPlaying) return;   // 已在播放，不重复

                // 创建 BGM 总音量节点（挂到 destination）
                if (!bgmGain) {
                    bgmGain = c.createGain();
                    bgmGain.gain.value = bgmVolume;
                    bgmGain.connect(c.destination);
                }

                bgmPlaying = true;
                bgmStep = 0;
                bgmSchedule();
            },

            stopBgm() {
                bgmPlaying = false;
                if (bgmTimer) {
                    clearTimeout(bgmTimer);
                    bgmTimer = null;
                }
            },

            // 静音切换时，同时控制 BGM 总音量
            setBgmVolume(v) {
                bgmVolume = v;
                if (bgmGain) {
                    bgmGain.gain.value = muted ? 0 : v;
                }
            },

            // 分数升高时加快 BGM（每 5 分调一次）
            setBgmTempo(ms) {
                bgmTempo = ms;
            },

            // ---------- 静音控制 ----------
            toggleMute() {
                muted = !muted;
                if (bgmGain) {
                    // 静音时把 BGM 总音量拉到 0；取消静音恢复
                    bgmGain.gain.value = muted ? 0 : bgmVolume;
                }
                // 如果取消静音且 BGM 应该播放，就补启动
                if (!muted && bgmPlaying && !bgmTimer) {
                    bgmSchedule();
                }
                return muted;
            },
            isMuted() { return muted; },
            unlock()  { getCtx(); }
        };
    })();

    // ---------- 游戏配置 ----------
    const GRID_SIZE = 20;
    const CELL_SIZE = canvas.width / GRID_SIZE;
    const BASE_SPEED = 130;

    // ---------- 状态 ----------
    let snake = [];
    let food = { x: 8, y: 8 };
    let direction = { dx: 1, dy: 0 };
    let nextDirection = { dx: 1, dy: 0 };
    let score = 0;
    let gameOver = false;
    let winFlag = false;
    let paused = false;
    let gameInterval = null;

    // 圆角矩形兼容
    if (!CanvasRenderingContext2D.prototype.roundRect) {
        CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
            if (w < 2 * r) r = w / 2;
            if (h < 2 * r) r = h / 2;
            this.moveTo(x + r, y);
            this.lineTo(x + w - r, y);
            this.quadraticCurveTo(x + w, y, x + w, y + r);
            this.lineTo(x + w, y + h - r);
            this.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
            this.lineTo(x + r, y + h);
            this.quadraticCurveTo(x, y + h, x, y + h - r);
            this.lineTo(x, y + r);
            this.quadraticCurveTo(x, y, x + r, y);
            return this;
        };
    }

    // ---------- 初始化 ----------
    function initGame() {
        if (gameInterval) {
            clearInterval(gameInterval);
            gameInterval = null;
        }

        // 【改动】重置时停掉旧 BGM，稍后重新启动
        Sound.stopBgm();

        snake = [
            { x: 9, y: 10 },
            { x: 8, y: 10 },
            { x: 7, y: 10 }
        ];
        direction = { dx: 1, dy: 0 };
        nextDirection = { dx: 1, dy: 0 };
        score = 0;
        gameOver = false;
        winFlag = false;
        paused = false;
        updateScore();

        // 【改动】BGM 速度重置到基础值
        Sound.setBgmTempo(220);

        generateFood();
        startGameLoop();
        drawGame();

        // 【改动】启动 BGM
        Sound.startBgm();
    }

    function startGameLoop() {
        if (gameInterval) clearInterval(gameInterval);
        gameInterval = setInterval(() => {
            if (!paused && !gameOver) {
                gameTick();
            }
        }, BASE_SPEED);
    }

    function generateFood() {
        if (snake.length >= GRID_SIZE * GRID_SIZE) {
            winFlag = true;
            gameOver = true;
            return;
        }

        const snakeSet = new Set(snake.map(s => `${s.x},${s.y}`));
        const freeCells = [];

        for (let y = 0; y < GRID_SIZE; y++) {
            for (let x = 0; x < GRID_SIZE; x++) {
                if (!snakeSet.has(`${x},${y}`)) {
                    freeCells.push({ x, y });
                }
            }
        }

        if (freeCells.length === 0) {
            winFlag = true;
            gameOver = true;
            return;
        }

        const rand = Math.floor(Math.random() * freeCells.length);
        food = freeCells[rand];
    }

    function updateScore() {
        scoreSpan.textContent = score;
    }

    // ---------- 游戏逻辑 ----------
    function gameTick() {
        if (gameOver) return;

        applyDirection();

        const head = snake[0];
        const newHead = {
            x: head.x + direction.dx,
            y: head.y + direction.dy
        };

        const isEating = (newHead.x === food.x && newHead.y === food.y);
        const newSnake = [newHead, ...snake];
        if (!isEating) newSnake.pop();

        if (checkCollision(newHead, newSnake)) {
            gameOver = true;
            // 【改动】结束时停止 BGM 并播放结束音
            Sound.stopBgm();
            Sound.gameOver();
            drawGame();
            return;
        }

        snake = newSnake;

        if (isEating) {
            score++;
            updateScore();
            Sound.eat();

            // 【改动】每吃到 5 个食物，BGM 提速一次（有紧张感）
            if (score % 5 === 0 && score > 0) {
                // 从 220ms 逐步降到最低 130ms
                const newTempo = Math.max(130, 220 - (score / 5) * 15);
                Sound.setBgmTempo(newTempo);
            }

            generateFood();
            if (gameOver && winFlag) {
                // 【改动】胜利时停止 BGM，播放胜利音
                Sound.stopBgm();
                Sound.win();
            }
        }

        drawGame();
    }

    function applyDirection() {
        if (direction.dx === -nextDirection.dx && direction.dy === -nextDirection.dy) {
            return;
        }
        direction = { dx: nextDirection.dx, dy: nextDirection.dy };
    }

    function checkCollision(newHead, newSnake) {
        if (newHead.x < 0 || newHead.x >= GRID_SIZE ||
            newHead.y < 0 || newHead.y >= GRID_SIZE) {
            return true;
        }
        for (let i = 1; i < newSnake.length; i++) {
            if (newSnake[i].x === newHead.x && newSnake[i].y === newHead.y) {
                return true;
            }
        }
        return false;
    }

    // ---------- 绘制 ----------
    function drawGame() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.strokeStyle = '#1a2f3c';
        ctx.lineWidth = 0.6;
        for (let i = 0; i <= GRID_SIZE; i++) {
            const pos = i * CELL_SIZE;
            ctx.beginPath();
            ctx.moveTo(pos, 0);
            ctx.lineTo(pos, canvas.height);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, pos);
            ctx.lineTo(canvas.width, pos);
            ctx.stroke();
        }

        ctx.shadowColor = '#ff5e5e';
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#ff3a3a';
        const foodX = food.x * CELL_SIZE + CELL_SIZE / 2;
        const foodY = food.y * CELL_SIZE + CELL_SIZE / 2;
        ctx.beginPath();
        ctx.arc(foodX, foodY, CELL_SIZE * 0.38, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ff8a8a';
        ctx.beginPath();
        ctx.arc(foodX - 2, foodY - 2, CELL_SIZE * 0.12, 0, Math.PI * 2);
        ctx.fill();

        for (let i = 0; i < snake.length; i++) {
            const seg = snake[i];
            const x = seg.x * CELL_SIZE;
            const y = seg.y * CELL_SIZE;
            const radius = (CELL_SIZE / 2) - (i === 0 ? 1 : 2);

            if (i === 0) {
                ctx.fillStyle = '#6fda6f';
                ctx.shadowBlur = 12;
                ctx.shadowColor = '#6fda6f';
            } else {
                const intensity = 0.7 - (i / snake.length) * 0.3;
                const g = Math.floor(150 + 60 * intensity);
                const r = 40 + i * 3;
                const b = 70;
                ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
                ctx.shadowBlur = 6;
                ctx.shadowColor = '#4caf7a';
            }

            ctx.beginPath();
            ctx.roundRect(x + 2, y + 2, CELL_SIZE - 4, CELL_SIZE - 4, radius);
            ctx.fill();

            if (i === 0) drawEyes(x, y);
        }

        ctx.shadowBlur = 0;

        if (gameOver) {
            drawOverlay(
                winFlag ? '🎉 胜利!' : '💀 游戏结束',
                winFlag ? '#b9f2b9' : '#f9c9c9',
                winFlag ? '#4caf50' : '#ff5e5e'
            );
        } else if (paused) {
            drawOverlay('⏸ 暂停', '#d4eaf0', '#2e6b7c');
        }
    }

    function drawEyes(x, y) {
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffffff';
        const eyeOffset = CELL_SIZE * 0.28;
        const eyeSize = CELL_SIZE * 0.14;
        const positions = [];

        if (direction.dx === 1) {
            positions.push({ ex: x + CELL_SIZE - eyeOffset, ey: y + eyeOffset });
            positions.push({ ex: x + CELL_SIZE - eyeOffset, ey: y + CELL_SIZE - eyeOffset });
        } else if (direction.dx === -1) {
            positions.push({ ex: x + eyeOffset, ey: y + eyeOffset });
            positions.push({ ex: x + eyeOffset, ey: y + CELL_SIZE - eyeOffset });
        } else if (direction.dy === -1) {
            positions.push({ ex: x + eyeOffset, ey: y + eyeOffset });
            positions.push({ ex: x + CELL_SIZE - eyeOffset, ey: y + eyeOffset });
        } else {
            positions.push({ ex: x + eyeOffset, ey: y + CELL_SIZE - eyeOffset });
            positions.push({ ex: x + CELL_SIZE - eyeOffset, ey: y + CELL_SIZE - eyeOffset });
        }

        positions.forEach(p => {
            ctx.beginPath();
            ctx.arc(p.ex, p.ey, eyeSize, 0, Math.PI * 2);
            ctx.fill();
        });

        ctx.fillStyle = '#0a0a0a';
        positions.forEach(p => {
            ctx.beginPath();
            ctx.arc(p.ex - 1, p.ey - 1, eyeSize * 0.5, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    function drawOverlay(text, textColor, shadowColor) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.font = 'bold 26px system-ui, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = textColor;
        ctx.shadowColor = shadowColor;
        ctx.shadowBlur = 16;
        ctx.fillText(text, canvas.width / 2, canvas.height / 2);
        ctx.shadowBlur = 0;
    }

    // ---------- 键盘 ----------
    function handleKeydown(e) {
        const key = e.key;

        Sound.unlock();

        if (key.startsWith('Arrow') || key === ' ' || key === 'Spacebar') {
            e.preventDefault();
        }

        if (!gameOver) {
            switch (key) {
                case 'ArrowUp':
                    if (direction.dy !== 1) Sound.turn();
                    nextDirection = { dx: 0, dy: -1 };
                    break;
                case 'ArrowDown':
                    if (direction.dy !== -1) Sound.turn();
                    nextDirection = { dx: 0, dy: 1 };
                    break;
                case 'ArrowLeft':
                    if (direction.dx !== 1) Sound.turn();
                    nextDirection = { dx: -1, dy: 0 };
                    break;
                case 'ArrowRight':
                    if (direction.dx !== -1) Sound.turn();
                    nextDirection = { dx: 1, dy: 0 };
                    break;
            }
        }

        if ((key === ' ' || key === 'Spacebar') && !gameOver) {
            paused = !paused;
            if (paused) {
                // 【改动】暂停时暂停 BGM 并播放暂停音
                Sound.stopBgm();
                Sound.pause();
            } else {
                Sound.resume();
                // 【改动】继续时重新启动 BGM
                Sound.startBgm();
            }
            drawGame();
        }

        if (key === 'r' || key === 'R') {
            initGame();
        }

        if (key === 'm' || key === 'M') {
            const nowMuted = Sound.toggleMute();
            muteBtn.textContent = nowMuted ? '🔇' : '🔊';
        }
    }

    window.addEventListener('keydown', handleKeydown);
    window.addEventListener('keyup', (e) => {
        if (e.key.startsWith('Arrow') || e.key === ' ' || e.key === 'Spacebar') {
            e.preventDefault();
        }
    });

    // ---------- 按钮 ----------
    restartBtn.addEventListener('click', () => {
        Sound.unlock();
        initGame();
    });

    muteBtn.addEventListener('click', () => {
        Sound.unlock();
        const nowMuted = Sound.toggleMute();
        muteBtn.textContent = nowMuted ? '🔇' : '🔊';
    });

    // ---------- 启动 ----------
    initGame();
})();