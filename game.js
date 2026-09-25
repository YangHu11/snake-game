(function () {
    'use strict';

    // ---------- DOM 引用 ----------
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const scoreSpan = document.getElementById('scoreDisplay');
    const restartBtn = document.getElementById('restartButton');

    // ---------- 游戏配置 ----------
    const GRID_SIZE = 20;                        // 20 x 20 格子
    const CELL_SIZE = canvas.width / GRID_SIZE;  // 每格 20px
    const BASE_SPEED = 130;                      // 移动间隔(毫秒)

    // ---------- 游戏状态 ----------
    let snake = [];
    let food = { x: 8, y: 8 };
    let direction = { dx: 1, dy: 0 };
    let nextDirection = { dx: 1, dy: 0 };
    let score = 0;
    let gameOver = false;
    let winFlag = false;
    let paused = false;
    let gameInterval = null;

    // ---------- 工具：圆角矩形 (兼容) ----------
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

    // ---------- 初始化 / 重置 ----------
    function initGame() {
        if (gameInterval) {
            clearInterval(gameInterval);
            gameInterval = null;
        }

        // 蛇：初始长度3，水平放置，头在右
        snake = [
            { x: 9, y: 10 },  // 头部（索引 0）
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

        generateFood();
        startGameLoop();
        drawGame();
    }

    function startGameLoop() {
        if (gameInterval) clearInterval(gameInterval);
        gameInterval = setInterval(() => {
            if (!paused && !gameOver) {
                gameTick();
            }
        }, BASE_SPEED);
    }

    // ---------- 生成食物（避开蛇身）----------
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

    // ---------- 每帧逻辑 ----------
    function gameTick() {
        if (gameOver) return;

        applyDirection();

        const head = snake[0];
        const newHead = {
            x: head.x + direction.dx,
            y: head.y + direction.dy
        };

        const isEating = (newHead.x === food.x && newHead.y === food.y);

        // 组装新蛇
        const newSnake = [newHead, ...snake];
        if (!isEating) newSnake.pop();

        // 碰撞检测
        if (checkCollision(newHead, newSnake)) {
            gameOver = true;
            drawGame();
            return;
        }

        snake = newSnake;

        if (isEating) {
            score++;
            updateScore();
            generateFood();
        }

        drawGame();
    }

    // 禁止反向；应用 pending 方向
    function applyDirection() {
        if (direction.dx === -nextDirection.dx && direction.dy === -nextDirection.dy) {
            return;
        }
        direction = { dx: nextDirection.dx, dy: nextDirection.dy };
    }

    // 边界 + 自碰检测
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

        // 网格线
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

        // 食物
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

        // 蛇
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

            // 眼睛（仅头部）
            if (i === 0) drawEyes(x, y);
        }

        ctx.shadowBlur = 0;

        // 覆盖层：结束 / 暂停
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

        // 根据方向确定眼睛位置
        const positions = [];
        if (direction.dx === 1) {           // 向右
            positions.push({ ex: x + CELL_SIZE - eyeOffset, ey: y + eyeOffset });
            positions.push({ ex: x + CELL_SIZE - eyeOffset, ey: y + CELL_SIZE - eyeOffset });
        } else if (direction.dx === -1) {   // 向左
            positions.push({ ex: x + eyeOffset, ey: y + eyeOffset });
            positions.push({ ex: x + eyeOffset, ey: y + CELL_SIZE - eyeOffset });
        } else if (direction.dy === -1) {   // 向上
            positions.push({ ex: x + eyeOffset, ey: y + eyeOffset });
            positions.push({ ex: x + CELL_SIZE - eyeOffset, ey: y + eyeOffset });
        } else {                             // 向下
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

    // ---------- 键盘控制 ----------
    function handleKeydown(e) {
        const key = e.key;

        if (key.startsWith('Arrow') || key === ' ' || key === 'Spacebar') {
            e.preventDefault();
        }

        if (!gameOver) {
            switch (key) {
                case 'ArrowUp':    nextDirection = { dx: 0, dy: -1 }; break;
                case 'ArrowDown':  nextDirection = { dx: 0, dy: 1 };  break;
                case 'ArrowLeft':  nextDirection = { dx: -1, dy: 0 }; break;
                case 'ArrowRight': nextDirection = { dx: 1, dy: 0 };  break;
            }
        }

        if ((key === ' ' || key === 'Spacebar') && !gameOver) {
            paused = !paused;
            drawGame();
        }

        if (key === 'r' || key === 'R') {
            initGame();
        }
    }

    window.addEventListener('keydown', handleKeydown);
    window.addEventListener('keyup', (e) => {
        if (e.key.startsWith('Arrow') || e.key === ' ' || e.key === 'Spacebar') {
            e.preventDefault();
        }
    });

    // ---------- 按钮 ----------
    restartBtn.addEventListener('click', initGame);

    // ---------- 启动 ----------
    initGame();
})();