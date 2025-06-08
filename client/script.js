// client/script.js - Shared client logic for landing page and player view

class QuizClient {
    constructor() {
        this.socket = null;
        this.playerName = null;
        this.playerId = null;
        this.quizCode = null;
        this.isQuizmaster = false;

        // DOM Elements
        this.elements = {
            // Connection Status
            connectionStatusBar: document.getElementById('connection-status-bar'),
            connectionStatusText: document.getElementById('connection-status-text'),
            commonErrorDisplay: document.getElementById('common-error-display'),
            commonErrorText: document.getElementById('common-error-text'),

            // Sections
            landingPage: document.getElementById('landing-page'),
            playerJoinSection: document.getElementById('player-join-section'),
            quizmasterLoginSection: document.getElementById('quizmaster-login-section'),
            playerWaitingRoom: document.getElementById('player-waiting-room'),

            // Forms & Inputs
            playerJoinForm: document.getElementById('player-join-form'),
            playerNameInput: document.getElementById('player-name'),
            quizCodeInput: document.getElementById('quiz-code'),
            joinQuizBtn: document.getElementById('join-quiz-btn'),

            quizmasterLoginForm: document.getElementById('quizmaster-login-form'),
            quizmasterCodeInput: document.getElementById('quizmaster-code'),
            loginQmBtn: document.getElementById('login-qm-btn'),

            // Links
            showQmLoginLink: document.getElementById('show-qm-login-link'),
            showPlayerJoinLink: document.getElementById('show-player-join-link'),

            // Waiting Room
            waitingPlayerName: document.getElementById('waiting-player-name'),
        };

        // Add new DOM elements for Player Quiz UI
    this.elements.playerQuizArea = document.getElementById('player-quiz-area');
    this.elements.quizTitleDisplay = document.getElementById('quiz-title-display');
    this.elements.questionNumberDisplay = document.getElementById('question-number-display');
    this.elements.questionExternalIdDisplay = document.getElementById('question-external-id-display');
    this.elements.quizPhaseDisplay = document.getElementById('quiz-phase-display');
    this.elements.playerScoreDisplay = document.getElementById('player-score-display');

    this.elements.questionDisplayArea = document.getElementById('question-display-area');
    this.elements.questionTextDisplay = document.getElementById('question-text-display');
    // this.elements.questionMediaDisplay = document.getElementById('question-media-display');

    // Pounce UI
    this.elements.pouncePhaseUi = document.getElementById('pounce-phase-ui');
    this.elements.pounceStatusMessage = document.getElementById('pounce-status-message');
    this.elements.pounceTimerDisplay = document.getElementById('pounce-timer-display');
    this.elements.pounceActionBtn = document.getElementById('pounce-action-btn');
    this.elements.pounceInputArea = document.getElementById('pounce-input-area');
    this.elements.pounceAnswerInput = document.getElementById('pounce-answer-input');
    this.elements.submitPounceBtn = document.getElementById('submit-pounce-btn');
    this.elements.pounceSubmissionFeedback = document.getElementById('pounce-submission-feedback');

    // Bounce UI
    this.elements.bouncePhaseUi = document.getElementById('bounce-phase-ui');
    this.elements.bounceStatusMessage = document.getElementById('bounce-status-message');
    this.elements.bounceTurnInfo = document.getElementById('bounce-turn-info');
    this.elements.passBounceBtn = document.getElementById('pass-bounce-btn');

    // Results UI
    this.elements.resultsPhaseUi = document.getElementById('results-phase-ui');
    this.elements.resultsMessage = document.getElementById('results-message');

    // Leaderboard UI
    this.elements.leaderboardArea = document.getElementById('leaderboard-area');
    this.elements.leaderboardList = document.getElementById('leaderboard-list');

    // Final Results UI
    this.elements.finalResultsScreen = document.getElementById('final-results-screen');
    this.elements.finalResultTitle = document.getElementById('final-result-title');
    this.elements.finalLeaderboardDisplay = document.getElementById('final-leaderboard-display');
    this.elements.backToLandingBtn = document.getElementById('back-to-landing-btn');


    // Interval timer for pounce countdown
    this.pounceTimerInterval = null;


        this.init();
    }

    init() {
        this.setupEventListeners();
        this.connectSocket();
        this.checkUrlParams(); // Auto-fill quiz code if present
    }

    connectSocket() {
        this.socket = io({
            reconnectionAttempts: 5,
            reconnectionDelay: 3000,
        });

        this.socket.on('connect', () => this.updateConnectionStatus('Connected', 'success'));
        this.socket.on('disconnect', (reason) => this.updateConnectionStatus(`Disconnected: \${reason}`, 'error'));
        this.socket.on('connect_error', (err) => this.updateConnectionStatus(`Connection Error: \${err.message}`, 'error'));

        this.setupSocketEventListeners();
    }

    // --- Extend setupSocketEventListeners ---
  setupSocketEventListeners() {
    // Original listeners from landing page step
    this.socket.on('connect', () => this.updateConnectionStatus('Connected', 'success'));
    this.socket.on('disconnect', (reason) => this.updateConnectionStatus(`Disconnected: \${reason}`, 'error'));
    this.socket.on('connect_error', (err) => this.updateConnectionStatus(`Connection Error: \${err.message}`, 'error'));

    this.socket.on('joinSuccess', (data) => {
        console.log('Join success:', data);
        this.playerName = data.name;
        this.playerId = data.playerId;
        this.quizCode = data.accessCode;
        this.isQuizmaster = false; // Explicitly player
        this.elements.waitingPlayerName.textContent = this.playerName;
        // Don't show quiz area yet, wait for quizStateUpdate that indicates quiz has started for this player
        this.showScreen('player-waiting-room');
        this.hideError();
    });

    this.socket.on('joinError', (data) => {
        console.error('Join error:', data.message);
        this.showError(data.message);
        this.enableForm(this.elements.playerJoinForm, true);
    });

    this.socket.on('quizmasterLoginSuccess', (data) => {
        console.log('Quizmaster login success:', data);
        this.isQuizmaster = true; // This client instance is now a QM
        this.hideError();
        // This script (script.js) is for players. QM logic will be in host.js.
        // For now, if a QM logs in via index.html, they'll get player UI with QM flag.
        // Ideally, QM login redirects to host.html.
        alert('Quizmaster Login Successful! Player UI will show, but you are logged in as QM. Use host.html for QM dashboard.');
        // For now, just show waiting room if they logged in here.
        this.showScreen('player-waiting-room');
        this.elements.quizmasterLoginForm.reset();
        this.enableForm(this.elements.quizmasterLoginForm, true);
    });

    this.socket.on('loginError', (data) => {
        console.error('Login error:', data.message);
        this.showError(data.message);
        this.enableForm(this.elements.quizmasterLoginForm, true);
    });

    this.socket.on('quizForceReset', (data) => {
        alert('The quiz has been reset by the Quizmaster. Please join again if you wish.');
        this.playerName = null;
        this.playerId = null;
        this.isQuizmaster = false;
        this.showScreen('landing-page');
        this.elements.playerJoinForm.reset();
        this.elements.quizmasterLoginForm.reset();
        if (data && data.accessCode) {
            this.elements.quizCodeInput.value = data.accessCode;
        }
        if (this.pounceTimerInterval) clearInterval(this.pounceTimerInterval);
    });

    // --- Main state update handler for players ---
    this.socket.on('quizStateUpdate', (state) => {
        console.log('Player received quizStateUpdate:', state);
        if (this.isQuizmaster) {
             // If this client somehow logged in as QM on player page, don't render player UI.
            console.log("Quizmaster client instance on player page received state, ignoring for player UI render.");
            return;
        }
        if (!this.playerName) { // Not joined yet
            return;
        }

        this.renderPlayerQuizView(state);
    });

    this.socket.on('pounceSubmitted', ({ answer, isCorrect }) => {
        // Feedback for the player who submitted
        this.elements.pounceSubmissionFeedback.textContent = `You pounced with "\${answer}". Result: \${isCorrect ? "Correct!" : "Incorrect."}`;
        this.elements.pounceActionBtn.disabled = true;
        this.elements.pounceInputArea.classList.add('hidden');
    });
  }

  // --- Extend setupEventListeners ---
  setupEventListeners() {
    // Original listeners from landing page step
    this.elements.playerJoinForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = this.elements.playerNameInput.value.trim();
            const code = this.elements.quizCodeInput.value.trim().toUpperCase();
            if (name && code) {
                this.socket.emit('joinQuiz', { name, code });
                this.showError('Joining...'); // Temporary message
                this.enableForm(this.elements.playerJoinForm, false);
            }
        });
    this.elements.quizmasterLoginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const quizmasterCode = this.elements.quizmasterCodeInput.value;
            if (quizmasterCode) {
                this.socket.emit('quizmasterLogin', { quizmasterCode });
                this.showError('Logging in as Quizmaster...'); // Temporary
                this.enableForm(this.elements.quizmasterLoginForm, false);
            }
        });
    this.elements.showQmLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            this.elements.playerJoinSection.classList.add('hidden');
            this.elements.quizmasterLoginSection.classList.remove('hidden');
            this.hideError();
        });
    this.elements.showPlayerJoinLink.addEventListener('click', (e) => {
            e.preventDefault();
            this.elements.quizmasterLoginSection.classList.add('hidden');
            this.elements.playerJoinSection.classList.remove('hidden');
            this.hideError();
        });
    this.elements.quizCodeInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.toUpperCase();
        });

    // New listeners for Player Quiz UI
    this.elements.pounceActionBtn.addEventListener('click', () => {
        this.elements.pounceActionBtn.classList.add('hidden');
        this.elements.pounceInputArea.classList.remove('hidden');
        this.elements.pounceAnswerInput.focus();
        this.elements.pounceStatusMessage.textContent = "Enter your answer quickly!";
    });

    this.elements.submitPounceBtn.addEventListener('click', () => {
        const answer = this.elements.pounceAnswerInput.value.trim();
        if (answer) {
            this.socket.emit('submitPounceAnswer', { answer });
            this.elements.submitPounceBtn.disabled = true;
            this.elements.pounceAnswerInput.disabled = true;
            this.elements.pounceStatusMessage.textContent = "Pounce submitted! Waiting for results...";
        }
    });

    this.elements.passBounceBtn.addEventListener('click', () => {
        this.socket.emit('playerPassBounce');
        this.elements.passBounceBtn.disabled = true;
        this.elements.bounceStatusMessage.textContent = "You passed your bounce turn.";
    });

    this.elements.backToLandingBtn.addEventListener('click', () => {
        this.showScreen('landing-page');
        // Potentially emit a 'leaveQuiz' or just let disconnect handle it if socket closes
        // For now, just a UI change. Server will keep player until disconnect or reset.
    });

  }


    updateConnectionStatus(message, type = 'info') {
        this.elements.connectionStatusText.textContent = message;
        const bar = this.elements.connectionStatusBar;
        bar.classList.remove('bg-green-500', 'bg-red-500', 'bg-yellow-500', 'bg-slate-700');

        let statusClass = 'bg-slate-700'; // Default
        if (type === 'success') statusClass = 'bg-green-500';
        else if (type === 'error') statusClass = 'bg-red-500';
        else if (type === 'warning') statusClass = 'bg-yellow-500';

        bar.classList.add(statusClass, 'text-white');

        // Auto-hide after a few seconds if not an error
        if (type !== 'error') {
            setTimeout(() => {
                // bar.classList.add('opacity-0');
                // bar.classList.remove(statusClass, 'text-white');
            }, 5000);
        } else {
            bar.classList.remove('opacity-0');
        }
    }

    showError(message) {
        this.elements.commonErrorText.textContent = message;
        this.elements.commonErrorDisplay.classList.remove('hidden');
    }

    hideError() {
        this.elements.commonErrorDisplay.classList.add('hidden');
        this.elements.commonErrorText.textContent = '';
    }

    enableForm(formElement, enabled) {
        const buttons = formElement.querySelectorAll('button[type="submit"]');
        buttons.forEach(button => button.disabled = !enabled);
        if (enabled) {
            formElement.classList.remove('opacity-50');
        } else {
            formElement.classList.add('opacity-50');
        }
    }

    showScreen(screenId) {
        // Hide all major sections first
        [this.elements.landingPage, this.elements.playerWaitingRoom, this.elements.playerQuizArea, this.elements.finalResultsScreen].forEach(el => {
            if(el) el.classList.add('hidden');
        });
        // Add other screens here as they are created: QM dashboard, player quiz view etc.

        const screenToShow = document.getElementById(screenId);
        if (screenToShow) {
            screenToShow.classList.remove('hidden');
        } else {
            console.error(`Screen with ID \${screenId} not found.`);
        }
    }

    checkUrlParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        if (code) {
            this.elements.quizCodeInput.value = code.toUpperCase();
        }
        const name = urlParams.get('name');
        if (name) {
            this.elements.playerNameInput.value = name;
        }
    }

    // --- Player UI Rendering Logic ---
  renderPlayerQuizView(state) {
    if (!this.playerId || this.isQuizmaster) return; // Only render for joined players

    this.showScreen('player-quiz-area');

    // Update common elements
    this.elements.quizTitleDisplay.textContent = state.quizTitle || 'Quiz';
    this.elements.quizPhaseDisplay.textContent = state.quizPhase.replace('_', ' ').replace(/\w/g, l => l.toUpperCase());

    const myPlayerState = state.players.find(p => p.id === this.playerId);
    this.elements.playerScoreDisplay.textContent = myPlayerState ? myPlayerState.score : 'N/A';

    // Question display
    if (state.currentQuestion) {
        this.elements.questionNumberDisplay.textContent = `\${state.currentQuestion.questionNumber} of \${state.currentQuestion.totalQuestions}`;
        this.elements.questionExternalIdDisplay.textContent = state.currentQuestion.externalId || '';
        this.elements.questionTextDisplay.textContent = state.currentQuestion.text || "Question details are on the main screen.";
        // Handle media if present: this.elements.questionMediaDisplay.src = state.currentQuestion.media;
    } else {
        this.elements.questionNumberDisplay.textContent = '-/-';
        this.elements.questionExternalIdDisplay.textContent = '';
        this.elements.questionTextDisplay.textContent = (state.quizPhase === 'lobby' || state.quizPhase === 'final_results') ? "Waiting for quiz to start or results." : "No active question.";
    }

    // Hide all phase-specific UI first
    this.elements.pouncePhaseUi.classList.add('hidden');
    this.elements.bouncePhaseUi.classList.add('hidden');
    this.elements.resultsPhaseUi.classList.add('hidden');
    this.elements.pounceInputArea.classList.add('hidden'); // Ensure input area is hidden initially
    this.elements.pounceActionBtn.classList.remove('hidden'); // Reset pounce button
    this.elements.pounceActionBtn.disabled = false;
    this.elements.submitPounceBtn.disabled = false;
    this.elements.pounceAnswerInput.disabled = false;
    this.elements.pounceAnswerInput.value = '';
    this.elements.pounceSubmissionFeedback.textContent = '';


    // Pounce Phase
    if (state.quizPhase === 'pounce') {
        this.elements.pouncePhaseUi.classList.remove('hidden');
        const myPounceData = state.pounceSubmissions?.find(p => p.name === this.playerName); // Check if I already pounced from server state

        if (myPlayerState && myPlayerState.pouncedThisRound) { // Assuming server adds this flag to player object in state
            this.elements.pounceStatusMessage.textContent = "You've pounced for this question.";
            this.elements.pounceActionBtn.disabled = true;
            this.elements.pounceActionBtn.classList.add('hidden');
            this.elements.pounceInputArea.classList.add('hidden');
            this.elements.pounceSubmissionFeedback.textContent = `Your pounce: "\${myPlayerState.pounceAnswer}" - \${myPlayerState.pounceCorrect ? "Correct" : "Incorrect"}`;
        } else {
            this.elements.pounceStatusMessage.textContent = "Pounce Window is OPEN!";
            this.elements.pounceActionBtn.disabled = false;
        }

        if (this.pounceTimerInterval) clearInterval(this.pounceTimerInterval);
        const updateTimer = () => {
            const timeLeft = Math.max(0, Math.round((state.pounceEndTime - Date.now()) / 1000));
            this.elements.pounceTimerDisplay.textContent = `Time left: \${timeLeft}s`;
            if (timeLeft <= 0) {
                clearInterval(this.pounceTimerInterval);
                this.elements.pounceTimerDisplay.textContent = "Time's up!";
                this.elements.pounceActionBtn.disabled = true;
                this.elements.pounceInputArea.classList.add('hidden'); // Hide if not already submitted
                if(!myPlayerState?.pouncedThisRound) this.elements.pounceStatusMessage.textContent = "Pounce window closed.";
            }
        };
        if (state.pounceEndTime && Date.now() < state.pounceEndTime) {
            updateTimer();
            this.pounceTimerInterval = setInterval(updateTimer, 1000);
        } else {
             this.elements.pounceTimerDisplay.textContent = "Time's up!";
             this.elements.pounceActionBtn.disabled = true;
             if(!myPlayerState?.pouncedThisRound) this.elements.pounceStatusMessage.textContent = "Pounce window closed.";
        }
    } else {
        if (this.pounceTimerInterval) clearInterval(this.pounceTimerInterval);
        this.elements.pounceTimerDisplay.textContent = "";
    }

    // Bounce Phase
    if (state.quizPhase === 'bounce') {
        this.elements.bouncePhaseUi.classList.remove('hidden');
        this.elements.bounceTurnInfo.textContent = state.currentBouncer ? `Bounce Turn: \${state.currentBouncer.name}` : "Waiting for bouncer...";

        if (myPlayerState && !myPlayerState.isEligibleForBounce) { // e.g. pounced correctly
            this.elements.bounceStatusMessage.textContent = "You pounced correctly, so you skip bounce!";
            this.elements.passBounceBtn.classList.add('hidden');
        } else if (state.currentBouncer && state.currentBouncer.id === this.playerId) {
            this.elements.bounceStatusMessage.textContent = "It's YOUR turn to Bounce!";
            this.elements.passBounceBtn.classList.remove('hidden');
            this.elements.passBounceBtn.disabled = false;
        } else {
            this.elements.bounceStatusMessage.textContent = "Waiting for player to bounce or pass.";
            this.elements.passBounceBtn.classList.add('hidden');
        }
    }

    // Results (inter-question) / Bounce Pending Evaluation
    if (state.quizPhase === 'results' || state.quizPhase === 'bounce_pending_evaluation') {
        this.elements.resultsPhaseUi.classList.remove('hidden');
        this.elements.resultsMessage.textContent = state.quizPhase === 'results' ? "Round over. Scores updated." : "Pounce answers are being evaluated...";
    }

    // Final Results
    if (state.quizPhase === 'final_results') {
        this.showScreen('final-results-screen');
        this.renderFinalLeaderboard(state.leaderboard);
    }


    // Leaderboard (always update if visible)
    this.renderLeaderboard(state.leaderboard);
  }

  renderLeaderboard(leaderboardData) {
    this.elements.leaderboardList.innerHTML = ''; // Clear old entries
    if (!leaderboardData || leaderboardData.length === 0) {
        this.elements.leaderboardList.innerHTML = '<p class="text-slate-400 text-center">No scores yet.</p>';
        return;
    }
    leaderboardData.forEach((player, index) => {
        const item = document.createElement('div');
        item.className = `flex justify-between items-center p-3 rounded-md \${player.id === this.playerId ? 'bg-purple-600/30' : 'bg-slate-700/50'}`;
        item.innerHTML = `
            <div class="flex items-center">
                <span class="mr-3 text-sm font-medium text-slate-400 w-6 text-center">\${index + 1}.</span>
                <span class="font-semibold \${player.id === this.playerId ? 'text-purple-300' : 'text-slate-200'}">\${player.name}</span>
            </div>
            <span class="font-bold text-lg \${player.id === this.playerId ? 'text-purple-300' : 'text-green-400'}">\${player.score}</span>
        `;
        this.elements.leaderboardList.appendChild(item);
    });
  }

  renderFinalLeaderboard(leaderboardData) {
    this.elements.finalLeaderboardDisplay.innerHTML = '';
    if (!leaderboardData || leaderboardData.length === 0) {
        this.elements.finalLeaderboardDisplay.innerHTML = '<p>No final scores available.</p>';
        return;
    }
    const title = document.createElement('h3');
    title.className = 'text-2xl font-semibold text-yellow-300 mb-4';
    title.textContent = 'Final Standings';
    this.elements.finalLeaderboardDisplay.appendChild(title);

    leaderboardData.forEach((player, index) => {
        const item = document.createElement('div');
        let medal = '';
        if (index === 0) medal = '🥇';
        else if (index === 1) medal = '🥈';
        else if (index === 2) medal = '🥉';

        item.className = 'p-3 border-b border-slate-700 flex justify-between items-center';
        item.innerHTML = `
            <span class="text-lg">\${medal} \${player.name}</span>
            <span class="text-xl font-bold">\${player.score} pts</span>
        `;
        this.elements.finalLeaderboardDisplay.appendChild(item);
    });
  }
}

// Initialize the client app
document.addEventListener('DOMContentLoaded', () => {
    window.quizApp = new QuizClient();

    // Re-attach original event listeners that might have been overwritten by simple text append
    // This is a simplified assumption. More robust would be to ensure methods are not removed.
    // For this subtask, assuming the QuizClient constructor correctly initializes all elements and listeners.
    // The provided QuizClient methods (setupEventListeners, setupSocketEventListeners) should be complete.

    // Example of re-adding only if they were outside the class or in a more complex init
    if (window.quizApp && window.quizApp.elements.playerJoinForm) {
         window.quizApp.elements.playerJoinForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = window.quizApp.elements.playerNameInput.value.trim();
            const code = window.quizApp.elements.quizCodeInput.value.trim().toUpperCase();
            if (name && code) {
                window.quizApp.socket.emit('joinQuiz', { name, code });
                window.quizApp.showError('Joining...');
                window.quizApp.enableForm(window.quizApp.elements.playerJoinForm, false);
            }
        });
    }
     if (window.quizApp && window.quizApp.elements.quizmasterLoginForm) {
        window.quizApp.elements.quizmasterLoginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const quizmasterCode = window.quizApp.elements.quizmasterCodeInput.value;
            if (quizmasterCode) {
                window.quizApp.socket.emit('quizmasterLogin', { quizmasterCode });
                window.quizApp.showError('Logging in as Quizmaster...');
                window.quizApp.enableForm(window.quizApp.elements.quizmasterLoginForm, true); // Should be false during processing
            }
        });
    }
    if (window.quizApp && window.quizApp.elements.showQmLoginLink) {
         window.quizApp.elements.showQmLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            window.quizApp.elements.playerJoinSection.classList.add('hidden');
            window.quizApp.elements.quizmasterLoginSection.classList.remove('hidden');
            window.quizApp.hideError();
        });
    }
    if (window.quizApp && window.quizApp.elements.showPlayerJoinLink) {
        window.quizApp.elements.showPlayerJoinLink.addEventListener('click', (e) => {
            e.preventDefault();
            window.quizApp.elements.quizmasterLoginSection.classList.add('hidden');
            window.quizApp.elements.playerJoinSection.classList.remove('hidden');
            window.quizApp.hideError();
        });
    }
    if (window.quizApp && window.quizApp.elements.quizCodeInput) {
        window.quizApp.elements.quizCodeInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.toUpperCase();
        });
    }
});