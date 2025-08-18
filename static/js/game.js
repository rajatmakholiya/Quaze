document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const questionsListEl = document.getElementById('questions-list');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
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
    let mazePath = [];
    let TILE_SIZE = 20;
    let questionScores = [];
    let maxScore = 0;
    
    // --- Player Position & Animation State ---
    let player = {
        pathIndex: 0,
        x: 0, 
        y: 0,
        animationFrameId: null,
        isAnimating: false,
        animationQueue: [] // To hold the sequence of tiles for the current move
    };

    /**
     * Initializes the game by fetching all necessary data.
     */
    async function initializeGame() {
        try {
            const [quizData, mazeData] = await Promise.all([
                fetch('/api/quiz').then(res => res.json()),
                fetch('/api/maze').then(res => res.json())
            ]);

            questions = quizData;

            // Calculate the maximum possible score
            maxScore = questions.reduce((total, question) => {
                if (question.multiple_choice) {
                    return total + question.answers.reduce((sum, answer) => sum + Math.max(0, answer.points), 0);
                } else {
                    return total + Math.max(...question.answers.map(a => a.points));
                }
            }, 0);

            maze = mazeData.grid;
            mazePath = scalePath(mazeData.path, maxScore + 1); // Scale path to the max score
            
            questionScores = Array(questions.length).fill(0);

            setupCanvas();
            displayAllQuestions();
            updatePlayerPosition(true); // `true` for instant setup
            drawGame();

            // --- Event Listeners ---
            nextBtn.addEventListener('click', handleNext);
            prevBtn.addEventListener('click', handlePrevious);
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
    
    function scalePath(originalPath, targetLength) {
        if (!originalPath || originalPath.length < 2) return [];
        const scaled = [];
        for (let i = 0; i < targetLength; i++) {
            const position = (i / (targetLength - 1)) * (originalPath.length - 1);
            const point = originalPath[Math.round(position)];
            if (point) {
                scaled.push({ y: point[0], x: point[1] });
            } else {
                scaled.push({ y: 1, x: 1 });
            }
        }
        return scaled;
    }

    function setupCanvas() {
        const panelWidth = mazePanel.clientWidth;
        const panelHeight = mazePanel.clientHeight;
        const mazeDim = Math.max(maze.length, maze[0].length);
        TILE_SIZE = Math.floor(Math.min(panelWidth, panelHeight) / mazeDim);
        mazeCanvas.width = TILE_SIZE * maze[0].length;
        mazeCanvas.height = TILE_SIZE * maze[0].length;
        updatePlayerPosition(true);
    }

    function displayAllQuestions() {
        questionsListEl.innerHTML = '';
        questions.forEach((question, index) => {
            const item = document.createElement('div');
            item.className = 'question-item';
            item.id = `question-${index}`;
            const inputType = question.multiple_choice ? 'checkbox' : 'radio';
            const answersHtml = question.answers.map(answer => `
                <div><label>
                    <input type="${inputType}" name="answer-${index}" value="${answer.points}" onchange="handleAnswerSelection(${index})">
                    <span>${answer.text}</span>
                </label></div>`).join('');
            item.innerHTML = `<h3>${index + 1}. ${question.question}</h3><div class="answers-container">${answersHtml}</div>`;
            questionsListEl.appendChild(item);
        });
        updateActiveQuestion();
    }

    function updateActiveQuestion() {
        document.querySelectorAll('.question-item').forEach(item => item.classList.remove('active'));
        if (currentQuestionIndex < questions.length) {
            const el = document.getElementById(`question-${currentQuestionIndex}`);
            el.classList.add('active');
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        updateButtonStates();
    }

    window.handleAnswerSelection = (questionIndex) => {
        const questionEl = document.getElementById(`question-${questionIndex}`);
        const selectedInputs = questionEl.querySelectorAll('input:checked');
        let currentPoints = 0;
        selectedInputs.forEach(input => {
            currentPoints += parseInt(input.value);
        });
        questionScores[questionIndex] = currentPoints;
        updatePlayerPosition();
        updateNextButtonState();
    };

    /**
     * Calculates the path difference and initiates the animation.
     */
    function updatePlayerPosition(instant = false) {
        const totalScore = questionScores.reduce((sum, score) => sum + score, 0);
        const newPathIndex = Math.max(0, Math.min(totalScore, mazePath.length - 1));

        if (player.pathIndex === newPathIndex && !instant) return;

        const targetNode = mazePath[newPathIndex];
        if (!targetNode) return;
        
        // Build the path for the animation
        const pathSlice = mazePath.slice(
            Math.min(player.pathIndex, newPathIndex),
            Math.max(player.pathIndex, newPathIndex) + 1
        );

        // If moving backward, reverse the path slice
        if (newPathIndex < player.pathIndex) {
            pathSlice.reverse();
        }

        player.pathIndex = newPathIndex;

        if (instant) {
            player.x = targetNode.x * TILE_SIZE;
            player.y = targetNode.y * TILE_SIZE;
            drawGame();
        } else {
            // Start the new animation
            player.animationQueue = pathSlice;
            if (!player.isAnimating) {
                animateMove();
            }
        }
    }

    /**
     * Animates the player tile-by-tile using the animationQueue.
     */
    function animateMove() {
        if (player.animationFrameId) {
            cancelAnimationFrame(player.animationFrameId);
        }

        // Get the next tile from the queue
        const nextNode = player.animationQueue.shift();
        if (!nextNode) {
            player.isAnimating = false;
            checkWinCondition(); // Check win only when all movement is complete
            return;
        }

        const target = {
            x: nextNode.x * TILE_SIZE,
            y: nextNode.y * TILE_SIZE
        };

        const speed = 0.15; // Animation speed

        function animationStep() {
            const dx = target.x - player.x;
            const dy = target.y - player.y;

            if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
                player.x = target.x;
                player.y = target.y;
                // Start animation for the next tile in the queue
                animateMove();
                return;
            }

            player.x += dx * speed;
            player.y += dy * speed;

            drawGame();
            player.animationFrameId = requestAnimationFrame(animationStep);
        }
        
        player.isAnimating = true;
        animationStep();
    }
    
    function updateNextButtonState() {
        const activeQuestionEl = document.getElementById(`question-${currentQuestionIndex}`);
        if (!activeQuestionEl) return;
        nextBtn.disabled = activeQuestionEl.querySelectorAll('input:checked').length === 0;
    }

    function updateButtonStates() {
        prevBtn.style.visibility = currentQuestionIndex > 0 ? 'visible' : 'hidden';
        nextBtn.textContent = (currentQuestionIndex === questions.length - 1) ? 'Submit' : 'Next';
        updateNextButtonState();
    }

    function drawGame() {
        drawMaze();
        drawPlayer();
    }
    
    function drawMaze() {
        ctx.clearRect(0, 0, mazeCanvas.width, mazeCanvas.height);
        const wallBaseColor = '#3b4b5c';
        const wallHighlightColor = '#4a5b6b';
        const wallShadowColor = '#2f3e4d';

        for (let y = 0; y < maze.length; y++) {
            for (let x = 0; x < maze[y].length; x++) {
                if (maze[y][x] === 1) {
                    const xPos = x * TILE_SIZE;
                    const yPos = y * TILE_SIZE;
                    const bevelSize = TILE_SIZE / 8;
                    ctx.fillStyle = wallBaseColor;
                    ctx.fillRect(xPos, yPos, TILE_SIZE, TILE_SIZE);
                    ctx.fillStyle = wallHighlightColor;
                    ctx.beginPath();
                    ctx.moveTo(xPos, yPos);
                    ctx.lineTo(xPos + TILE_SIZE, yPos);
                    ctx.lineTo(xPos + TILE_SIZE - bevelSize, yPos + bevelSize);
                    ctx.lineTo(xPos + bevelSize, yPos + bevelSize);
                    ctx.closePath();
                    ctx.fill();
                    ctx.beginPath();
                    ctx.moveTo(xPos, yPos);
                    ctx.lineTo(xPos, yPos + TILE_SIZE);
                    ctx.lineTo(xPos + bevelSize, yPos + TILE_SIZE - bevelSize);
                    ctx.lineTo(xPos + bevelSize, yPos + bevelSize);
                    ctx.closePath();
                    ctx.fill();
                    ctx.fillStyle = wallShadowColor;
                    ctx.beginPath();
                    ctx.moveTo(xPos, yPos + TILE_SIZE);
                    ctx.lineTo(xPos + TILE_SIZE, yPos + TILE_SIZE);
                    ctx.lineTo(xPos + TILE_SIZE - bevelSize, yPos + TILE_SIZE - bevelSize);
                    ctx.lineTo(xPos + bevelSize, yPos + TILE_SIZE - bevelSize);
                    ctx.closePath();
                    ctx.fill();
                    ctx.beginPath();
                    ctx.moveTo(xPos + TILE_SIZE, yPos);
                    ctx.lineTo(xPos + TILE_SIZE, yPos + TILE_SIZE);
                    ctx.lineTo(xPos + TILE_SIZE - bevelSize, yPos + TILE_SIZE - bevelSize); // <-- FIX IS HERE
                    ctx.lineTo(xPos + TILE_SIZE - bevelSize, yPos + bevelSize);
                    ctx.closePath();
                    ctx.fill();
                }
            }
        }
        const startPos = { x: 1, y: 1 };
        const endPos = { x: maze[0].length - 2, y: maze.length - 2 };
        ctx.fillStyle = 'rgba(46, 204, 113, 0.7)';
        ctx.fillRect(startPos.x * TILE_SIZE, startPos.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        ctx.fillStyle = 'rgba(231, 76, 60, 0.7)';
        ctx.fillRect(endPos.x * TILE_SIZE, endPos.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }

    function drawPlayer() {
        ctx.fillStyle = 'var(--player-color)';
        ctx.beginPath();
        ctx.arc(
            player.x + TILE_SIZE / 2, 
            player.y + TILE_SIZE / 2, 
            TILE_SIZE / 2.8, 0, 2 * Math.PI
        );
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    function handleNext() {
        if (currentQuestionIndex < questions.length - 1) {
            currentQuestionIndex++;
            updateActiveQuestion();
        } else {
            if (!checkWinCondition()) {
                gameOverModal.classList.add('show');
            }
        }
    }

    function handlePrevious() {
        if (currentQuestionIndex > 0) {
            currentQuestionIndex--;
            updateActiveQuestion();
        }
    }

    function checkWinCondition() {
        if (player.isAnimating) return false;
        
        const totalScore = questionScores.reduce((sum, score) => sum + score, 0);
        if (totalScore >= maxScore) {
            winModal.classList.add('show');
            return true;
        }
        return false;
    }

    initializeGame();
});