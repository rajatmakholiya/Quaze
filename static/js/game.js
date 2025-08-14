document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const questionsListEl = document.getElementById('questions-list');
    const submitBtn = document.getElementById('submit-btn');
    const mazeCanvas = document.getElementById('maze-canvas');
    const mazePanel = document.querySelector('.maze-panel');
    const winModal = document.getElementById('win-modal');
    const gameOverModal = document.getElementById('game-over-modal');
    const playAgainBtn = document.getElementById('play-again-btn');
    const playAgainGameOverBtn = document.getElementById('play-again-game-over-btn');
    const ctx = mazeCanvas.getContext('2d');

    // --- Game State ---
    let currentQuestionIndex = 0;
    let questions = [];
    let maze = [];
    let playerPos = { x: 1, y: 1 };
    let TILE_SIZE = 20;

    /**
     * Initializes the game by fetching quiz and maze data,
     * setting up the canvas, and displaying the questions.
     */
    async function initializeGame() {
        try {
            const [quizData, mazeData] = await Promise.all([
                fetch('/api/quiz').then(res => res.json()),
                fetch('/api/maze').then(res => res.json())
            ]);

            questions = quizData;
            maze = mazeData;

            setupCanvas();
            displayAllQuestions();
            drawGame();

            // --- Event Listeners ---
            submitBtn.addEventListener('click', handleSubmit);
            playAgainBtn.addEventListener('click', () => window.location.reload());
            playAgainGameOverBtn.addEventListener('click', () => window.location.reload());
            window.addEventListener('resize', () => {
                 setupCanvas();
                 drawGame();
            });
        } catch (error) {
            console.error("Error initializing game:", error);
            alert("Failed to load game data. Please try refreshing the page.");
        }
    }

    /**
     * Sets up the maze canvas dimensions based on the maze size and panel width.
     */
    function setupCanvas() {
        const panelWidth = mazePanel.clientWidth;
        const panelHeight = mazePanel.clientHeight;
        const mazeDim = Math.max(maze.length, maze[0].length);
        TILE_SIZE = Math.floor(Math.min(panelWidth, panelHeight) / mazeDim);

        mazeCanvas.width = TILE_SIZE * maze[0].length;
        mazeCanvas.height = TILE_SIZE * maze.length;
    }

    /**
     * Displays all the quiz questions in the questions list.
     */
    function displayAllQuestions() {
        questionsListEl.innerHTML = '';
        questions.forEach((question, index) => {
            const item = document.createElement('div');
            item.className = 'question-item';
            item.id = `question-${index}`;

            const inputType = question.multiple_choice ? 'checkbox' : 'radio';
            const answersHtml = question.answers.map(answer => `
                <div>
                    <label>
                        <input type="${inputType}" name="answer-${index}" value="${answer.points}">
                        <span>${answer.text}</span>
                    </label>
                </div>
            `).join('');

            item.innerHTML = `
                <h3>${index + 1}. ${question.question}</h3>
                <div class="answers-container">${answersHtml}</div>
            `;
            questionsListEl.appendChild(item);
        });
        updateActiveQuestion();
    }

    /**
     * Updates the currently active question in the UI.
     */
    function updateActiveQuestion() {
        document.querySelectorAll('.question-item').forEach(item => item.classList.remove('active'));

        if (currentQuestionIndex < questions.length) {
            const currentQuestionEl = document.getElementById(`question-${currentQuestionIndex}`);
            currentQuestionEl.classList.add('active');
            currentQuestionEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            submitBtn.disabled = false;
        } else {
            submitBtn.disabled = true;
            submitBtn.textContent = "Quiz Complete!";
            // If the quiz is complete, check if the player has won or lost.
            if (!checkWinCondition()) {
                gameOverModal.classList.add('show');
            }
        }
    }

    /**
     * Draws the maze and the player.
     */
    function drawGame() {
        drawMaze();
        drawPlayer();
    }

    /**
     * Draws the maze on the canvas.
     */
    function drawMaze() {
        ctx.clearRect(0, 0, mazeCanvas.width, mazeCanvas.height);

        ctx.fillStyle = '#333';
        for (let y = 0; y < maze.length; y++) {
            for (let x = 0; x < maze[y].length; x++) {
                if (maze[y][x] === 1) {
                    ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                }
            }
        }

        // --- Start and End Points ---
        const startPos = { x: 1, y: 1 };
        const endPos = { x: maze[0].length - 2, y: maze.length - 2 };

        ctx.fillStyle = 'rgba(0, 255, 127, 0.5)';
        ctx.fillRect(startPos.x * TILE_SIZE, startPos.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);

        ctx.fillStyle = 'rgba(255, 69, 0, 0.6)';
        ctx.fillRect(endPos.x * TILE_SIZE, endPos.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }

    /**
     * Draws the player on the canvas.
     */
    function drawPlayer() {
        ctx.fillStyle = 'var(--primary-color)';
        ctx.beginPath();
        ctx.arc(
            playerPos.x * TILE_SIZE + TILE_SIZE / 2,
            playerPos.y * TILE_SIZE + TILE_SIZE / 2,
            TILE_SIZE / 3,
            0, 2 * Math.PI
        );
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    /**
     * Handles the submission of an answer.
     */
    function handleSubmit() {
        const activeQuestionEl = document.getElementById(`question-${currentQuestionIndex}`);
        const selectedAnswers = activeQuestionEl.querySelectorAll('input:checked');

        if (selectedAnswers.length === 0) return;

        let totalPoints = 0;
        selectedAnswers.forEach(input => {
            totalPoints += parseInt(input.value);
        });

        movePlayer(totalPoints);

        currentQuestionIndex++;
        updateActiveQuestion();
    }

    /**
     * Moves the player a certain number of steps through the maze.
     * @param {number} steps - The number of steps to move the player.
     */
    function movePlayer(steps) {
        for (let i = 0; i < steps; i++) {
            const possibleMoves = [];
            if (playerPos.y > 0 && maze[playerPos.y - 1][playerPos.x] === 0) possibleMoves.push({ x: 0, y: -1 });
            if (playerPos.y < maze.length - 1 && maze[playerPos.y + 1][playerPos.x] === 0) possibleMoves.push({ x: 0, y: 1 });
            if (playerPos.x > 0 && maze[playerPos.y][playerPos.x - 1] === 0) possibleMoves.push({ x: -1, y: 0 });
            if (playerPos.x < maze[0].length - 1 && maze[playerPos.y][playerPos.x + 1] === 0) possibleMoves.push({ x: 1, y: 0 });

            if (possibleMoves.length > 0) {
                const move = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
                playerPos.x += move.x;
                playerPos.y += move.y;
            }
        }

        drawGame();
        checkWinCondition();
    }

    /**
     * Checks if the player has reached the end of the maze.
     * @returns {boolean} - True if the player has won, false otherwise.
     */
    function checkWinCondition() {
        const endX = maze[0].length - 2;
        const endY = maze.length - 2;
        if (playerPos.x === endX && playerPos.y === endY) {
            winModal.classList.add('show');
            return true;
        }
        return false;
    }

    initializeGame();
});