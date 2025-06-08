// client/script.js - Shared client logic for landing page and player view (Revised for New Pounce Flow)

class QuizClient {
    constructor() {
        this.socket = null;
        this.playerName = null;
        this.playerId = null;
        this.quizCode = null;
        this.isQuizmaster = false;

        // Player specific state for current question/pounce round
        this.playerHasOptedInPounce = false;
        this.playerPouncePersonalAnswerEndTime = null;
        this.playerPouncedThisQuestion = false;


        this.elements = { /* ... keep all existing element refs from previous step ... */
            connectionStatusBar: document.getElementById('connection-status-bar'),
            connectionStatusText: document.getElementById('connection-status-text'),
            commonErrorDisplay: document.getElementById('common-error-display'),
            commonErrorText: document.getElementById('common-error-text'),
            landingPage: document.getElementById('landing-page'),
            playerJoinSection: document.getElementById('player-join-section'),
            quizmasterLoginSection: document.getElementById('quizmaster-login-section'),
            playerWaitingRoom: document.getElementById('player-waiting-room'),
            playerJoinForm: document.getElementById('player-join-form'),
            playerNameInput: document.getElementById('player-name'),
            quizCodeInput: document.getElementById('quiz-code'),
            joinQuizBtn: document.getElementById('join-quiz-btn'),
            quizmasterLoginForm: document.getElementById('quizmaster-login-form'),
            quizmasterCodeInput: document.getElementById('quizmaster-code'),
            loginQmBtn: document.getElementById('login-qm-btn'),
            showQmLoginLink: document.getElementById('show-qm-login-link'),
            showPlayerJoinLink: document.getElementById('show-player-join-link'),
            waitingPlayerName: document.getElementById('waiting-player-name'),
            playerQuizArea: document.getElementById('player-quiz-area'),
            quizTitleDisplay: document.getElementById('quiz-title-display'),
            questionNumberDisplay: document.getElementById('question-number-display'),
            questionExternalIdDisplay: document.getElementById('question-external-id-display'),
            quizPhaseDisplay: document.getElementById('quiz-phase-display'),
            playerScoreDisplay: document.getElementById('player-score-display'),
            questionDisplayArea: document.getElementById('question-display-area'),
            questionTextDisplay: document.getElementById('question-text-display'),
            pouncePhaseUi: document.getElementById('pounce-phase-ui'),
            pounceStatusMessage: document.getElementById('pounce-status-message'),
            pounceTimerDisplay: document.getElementById('pounce-timer-display'),
            pounceActionBtn: document.getElementById('pounce-action-btn'),
            pounceInputArea: document.getElementById('pounce-input-area'),
            pounceAnswerInput: document.getElementById('pounce-answer-input'),
            submitPounceBtn: document.getElementById('submit-pounce-btn'),
            pounceSubmissionFeedback: document.getElementById('pounce-submission-feedback'),
            bouncePhaseUi: document.getElementById('bounce-phase-ui'),
            bounceStatusMessage: document.getElementById('bounce-status-message'),
            bounceTurnInfo: document.getElementById('bounce-turn-info'),
            passBounceBtn: document.getElementById('pass-bounce-btn'),
            resultsPhaseUi: document.getElementById('results-phase-ui'),
            resultsMessage: document.getElementById('results-message'),
            leaderboardArea: document.getElementById('leaderboard-area'),
            leaderboardList: document.getElementById('leaderboard-list'),
            finalResultsScreen: document.getElementById('final-results-screen'),
            finalResultTitle: document.getElementById('final-result-title'),
            finalLeaderboardDisplay: document.getElementById('final-leaderboard-display'),
            backToLandingBtn: document.getElementById('back-to-landing-btn'),
        };

        this.globalPounceOptInTimerInterval = null;
        this.personalPounceAnswerTimerInterval = null;
        this.init();
    }

    init() { /* ... keep existing init ... */
        this.setupEventListeners();
        this.connectSocket();
        this.checkUrlParams();
    }

    connectSocket() { /* ... keep existing connectSocket ... */
        this.socket = io({ reconnectionAttempts: 5, reconnectionDelay: 3000 });
        this.socket.on('connect', () => this.updateConnectionStatus('Connected', 'success'));
        this.socket.on('disconnect', (reason) => this.updateConnectionStatus(`Disconnected: ${reason}`, 'error'));
        this.socket.on('connect_error', (err) => this.updateConnectionStatus(`Connection Error: ${err.message}`, 'error'));
        this.setupSocketEventListeners();
    }

    setupSocketEventListeners() {
        // ... keep existing listeners like joinSuccess, joinError, quizmasterLoginSuccess, loginError ...
        this.socket.on('joinSuccess', (data) => { /* ... existing ... */
            console.log('Join success:', data); this.playerName = data.name; this.playerId = data.playerId;
            this.quizCode = data.accessCode; this.isQuizmaster = false;
            this.elements.waitingPlayerName.textContent = this.playerName;
            this.showScreen('player-waiting-room'); this.hideError();
        });
        this.socket.on('joinError', (data) => { /* ... existing ... */
            console.error('Join error:', data.message); this.showError(data.message);
            this.enableForm(this.elements.playerJoinForm, true);
        });
        this.socket.on('quizmasterLoginSuccess', (data) => { /* ... existing ... */
            console.log('QM login success:', data); this.isQuizmaster = true; this.hideError();
            alert('QM Login Successful on player page. Use host.html for QM dashboard.');
            this.showScreen('player-waiting-room');
            this.elements.quizmasterLoginForm.reset(); this.enableForm(this.elements.quizmasterLoginForm, true);
        });
        this.socket.on('loginError', (data) => { /* ... existing ... */
            console.error('Login error:', data.message); this.showError(data.message);
            this.enableForm(this.elements.quizmasterLoginForm, true);
        });

        this.socket.on('quizForceReset', (data) => {
            alert('The quiz has been reset. Please join again.');
            this.playerName = null; this.playerId = null; this.isQuizmaster = false;
            this.playerHasOptedInPounce = false; this.playerPouncePersonalAnswerEndTime = null; this.playerPouncedThisQuestion = false;
            this.showScreen('landing-page');
            this.elements.playerJoinForm.reset(); this.elements.quizmasterLoginForm.reset();
            if (data && data.accessCode) this.elements.quizCodeInput.value = data.accessCode;
            if (this.globalPounceOptInTimerInterval) clearInterval(this.globalPounceOptInTimerInterval);
            if (this.personalPounceAnswerTimerInterval) clearInterval(this.personalPounceAnswerTimerInterval);
        });

        this.socket.on('quizStateUpdate', (state) => {
            if (this.isQuizmaster || !this.playerName) return;
            // Update local player pounce state from the received global state
            const myStateFromServer = state.players.find(p => p.id === this.playerId);
            if (myStateFromServer) {
                this.playerHasOptedInPounce = myStateFromServer.hasOptedInPounce;
                this.playerPouncePersonalAnswerEndTime = myStateFromServer.pouncePersonalAnswerEndTime;
                this.playerPouncedThisQuestion = myStateFromServer.pouncedThisQuestion;
            }
            this.renderPlayerQuizView(state);
        });

        // New listener for pounce opt-in result
        this.socket.on('pounceOptInResult', (result) => {
            if (result.success) {
                this.playerHasOptedInPounce = true; // Mark self as opted-in
                this.playerPouncePersonalAnswerEndTime = result.personalAnswerEndTime;
                this.elements.pounceStatusMessage.textContent = "You've opted in! Prepare your answer.";
                this.elements.pounceActionBtn.classList.add('hidden'); // Hide "Pounce" button
                this.elements.pounceInputArea.classList.remove('hidden'); // Show answer input
                this.elements.pounceAnswerInput.focus();
                this.startPersonalAnswerTimer(); // Start the 20s personal answer timer
            } else {
                this.elements.pounceStatusMessage.textContent = result.message || "Could not opt-in for pounce.";
                this.elements.pounceActionBtn.disabled = true; // Disable if opt-in failed (e.g. window closed)
            }
        });

        // Renamed from 'pounceSubmitted' to 'pounceSubmissionResult' for clarity
        this.socket.on('pounceSubmissionResult', (result) => {
            if (result.success) {
                this.playerPouncedThisQuestion = true; // Mark self as submitted
                this.elements.pounceSubmissionFeedback.textContent = `Pounce submitted! Your score is now ${result.score}.`;
                this.elements.pounceInputArea.classList.add('hidden'); // Hide input area
                this.elements.pounceStatusMessage.textContent = "Pounce answer recorded.";
                if (this.personalPounceAnswerTimerInterval) clearInterval(this.personalPounceAnswerTimerInterval);
                this.elements.pounceTimerDisplay.textContent = ""; // Clear personal timer display
            } else {
                this.elements.pounceSubmissionFeedback.textContent = result.message || "Pounce submission failed.";
                // Keep input area open if error was not related to time up, allow retry if applicable by server rules
            }
             this.elements.submitPounceBtn.disabled = false; // Re-enable in case of error for retry, or disable if success
             this.elements.pounceAnswerInput.disabled = false;
             if(result.success) {
                this.elements.submitPounceBtn.disabled = true;
                this.elements.pounceAnswerInput.disabled = true;
             }
        });
    }

    setupEventListeners() {
        // ... keep existing form listeners and nav links ...
        this.elements.playerJoinForm.addEventListener('submit', (e) => { e.preventDefault(); /* ... */
            const name = this.elements.playerNameInput.value.trim(); const code = this.elements.quizCodeInput.value.trim().toUpperCase();
            if (name && code) { this.socket.emit('joinQuiz', { name, code }); this.showError('Joining...'); this.enableForm(this.elements.playerJoinForm, false); }
        });
        this.elements.quizmasterLoginForm.addEventListener('submit', (e) => { e.preventDefault(); /* ... */
            const qmCode = this.elements.quizmasterCodeInput.value;
            if (qmCode) { this.socket.emit('quizmasterLogin', { quizmasterCode: qmCode }); this.showError('Logging in...'); this.enableForm(this.elements.quizmasterLoginForm, false); }
        });
        this.elements.showQmLoginLink.addEventListener('click', (e) => { /* ... */ });
        this.elements.showPlayerJoinLink.addEventListener('click', (e) => { /* ... */ });
        this.elements.quizCodeInput.addEventListener('input', (e) => { /* ... */ });


        // Updated Pounce Button Listener
        this.elements.pounceActionBtn.addEventListener('click', () => {
            // Now emits 'playerOptInPounce' instead of showing input directly
            this.socket.emit('playerOptInPounce');
            this.elements.pounceActionBtn.disabled = true; // Disable to prevent multiple clicks
            this.elements.pounceStatusMessage.textContent = "Attempting to opt-in...";
        });

        this.elements.submitPounceBtn.addEventListener('click', () => {
            const answer = this.elements.pounceAnswerInput.value.trim();
            if (answer) {
                this.socket.emit('submitPounceAnswer', { answer });
                this.elements.submitPounceBtn.disabled = true;
                this.elements.pounceAnswerInput.disabled = true;
                this.elements.pounceStatusMessage.textContent = "Submitting pounce answer...";
            }
        });

        this.elements.passBounceBtn.addEventListener('click', () => { /* ... existing ... */
            this.socket.emit('playerPassBounce'); this.elements.passBounceBtn.disabled = true;
            this.elements.bounceStatusMessage.textContent = "You passed your bounce turn.";
        });
        this.elements.backToLandingBtn.addEventListener('click', () => { /* ... existing ... */ });
    }

    startGlobalOptInTimer(endTime) {
        if (this.globalPounceOptInTimerInterval) clearInterval(this.globalPounceOptInTimerInterval);
        const update = () => {
            const timeLeft = Math.max(0, Math.round((endTime - Date.now()) / 1000));
            this.elements.pounceTimerDisplay.textContent = `Opt-in Time: ${timeLeft}s`;
            if (timeLeft <= 0) {
                clearInterval(this.globalPounceOptInTimerInterval);
                this.elements.pounceTimerDisplay.textContent = "Opt-in Closed";
                this.elements.pounceActionBtn.disabled = true; // Disable if not already opted in
            }
        };
        if (endTime && Date.now() < endTime) {
            update();
            this.globalPounceOptInTimerInterval = setInterval(update, 1000);
        } else {
            this.elements.pounceTimerDisplay.textContent = "Opt-in Closed";
            this.elements.pounceActionBtn.disabled = true;
        }
    }

    startPersonalAnswerTimer() {
        if (this.personalPounceAnswerTimerInterval) clearInterval(this.personalPounceAnswerTimerInterval);
        const endTime = this.playerPouncePersonalAnswerEndTime;
        const update = () => {
            const timeLeft = Math.max(0, Math.round((endTime - Date.now()) / 1000));
            // Update a different timer display or prepend to existing one
            this.elements.pounceTimerDisplay.textContent = `Your Answer Time: ${timeLeft}s`;
            if (timeLeft <= 0) {
                clearInterval(this.personalPounceAnswerTimerInterval);
                this.elements.pounceTimerDisplay.textContent = "Your Answer Time Over";
                this.elements.submitPounceBtn.disabled = true;
                this.elements.pounceAnswerInput.disabled = true;
                this.elements.pounceInputArea.classList.add('hidden');
                this.elements.pounceStatusMessage.textContent = "Time to submit your pounce answer has expired.";
            }
        };
        if (endTime && Date.now() < endTime) {
            update();
            this.personalPounceAnswerTimerInterval = setInterval(update, 1000);
        } else {
             this.elements.pounceTimerDisplay.textContent = "Your Answer Time Over";
             this.elements.submitPounceBtn.disabled = true;
             this.elements.pounceAnswerInput.disabled = true;
        }
    }

    renderPlayerQuizView(state) {
        if (!this.playerId || this.isQuizmaster) return;
        this.showScreen('player-quiz-area');

        // Update common elements (score, title, question display etc. - keep existing)
        this.elements.quizTitleDisplay.textContent = state.quizTitle || 'Quiz';
        this.elements.quizPhaseDisplay.textContent = state.quizPhase.replace(/_/g, ' ').replace(/\w/g, l => l.toUpperCase());
        const myServerState = state.players.find(p => p.id === this.playerId);
        if (myServerState) {
            this.elements.playerScoreDisplay.textContent = myServerState.score;
            // Update local flags based on server state for rendering decisions
            this.playerHasOptedInPounce = myServerState.hasOptedInPounce;
            this.playerPouncePersonalAnswerEndTime = myServerState.pouncePersonalAnswerEndTime;
            this.playerPouncedThisQuestion = myServerState.pouncedThisQuestion;
        } else {
            this.elements.playerScoreDisplay.textContent = 'N/A'; // Player not found in state update?
        }

        if (state.currentQuestion) { /* ... existing question display ... */ }
        else { /* ... existing no active question display ... */ }

        // Hide all phase-specific UI & reset buttons/inputs
        this.elements.pouncePhaseUi.classList.add('hidden');
        this.elements.bouncePhaseUi.classList.add('hidden');
        this.elements.resultsPhaseUi.classList.add('hidden');
        this.elements.pounceActionBtn.classList.remove('hidden'); // Default show pounce button
        this.elements.pounceActionBtn.disabled = true; // Default disable
        this.elements.pounceInputArea.classList.add('hidden');
        this.elements.pounceAnswerInput.value = '';
        this.elements.pounceAnswerInput.disabled = false;
        this.elements.submitPounceBtn.disabled = false;
        this.elements.pounceSubmissionFeedback.textContent = '';
        if (this.globalPounceOptInTimerInterval) clearInterval(this.globalPounceOptInTimerInterval);
        if (this.personalPounceAnswerTimerInterval) clearInterval(this.personalPounceAnswerTimerInterval);
        this.elements.pounceTimerDisplay.textContent = "";


        switch (state.quizPhase) {
            case 'question_pending_pounce_trigger':
                this.elements.pounceStatusMessage.textContent = "Waiting for Quizmaster to enable pounce.";
                this.elements.pouncePhaseUi.classList.remove('hidden'); // Show area, but button disabled
                break;

            case 'pounce_opt_in':
                this.elements.pouncePhaseUi.classList.remove('hidden');
                this.startGlobalOptInTimer(state.pounceOptInEndTime);

                if (this.playerHasOptedInPounce) { // Already opted-in
                    this.elements.pounceActionBtn.classList.add('hidden');
                    this.elements.pounceInputArea.classList.remove('hidden');
                    this.elements.pounceStatusMessage.textContent = "You've opted in! Enter your answer.";
                    // Personal timer should have been started by 'pounceOptInResult'
                    // Or, if page reloaded, and state shows opted-in, start personal timer here
                    if (!this.personalPounceAnswerTimerInterval && this.playerPouncePersonalAnswerEndTime && Date.now() < this.playerPouncePersonalAnswerEndTime) {
                        this.startPersonalAnswerTimer();
                    }
                } else if (this.playerPouncedThisQuestion) { // Already submitted answer
                    this.elements.pounceActionBtn.classList.add('hidden');
                    this.elements.pounceInputArea.classList.add('hidden');
                    this.elements.pounceStatusMessage.textContent = "Your pounce answer is submitted.";
                } else { // Not opted-in, not submitted
                    this.elements.pounceStatusMessage.textContent = "Pounce Opt-in Window OPEN!";
                    this.elements.pounceActionBtn.disabled = (Date.now() >= state.pounceOptInEndTime);
                }
                break;

            case 'pounce_answering_window_active': // Global opt-in over, some might be answering
                this.elements.pouncePhaseUi.classList.remove('hidden');
                this.elements.pounceTimerDisplay.textContent = "Opt-in Closed"; // Global timer
                this.elements.pounceActionBtn.classList.add('hidden'); // Can't opt-in anymore

                if (this.playerHasOptedInPounce && !this.playerPouncedThisQuestion) {
                    this.elements.pounceInputArea.classList.remove('hidden');
                    this.elements.pounceStatusMessage.textContent = "Enter your pounce answer.";
                    // Personal timer should be running or started if page reloaded
                     if (!this.personalPounceAnswerTimerInterval && this.playerPouncePersonalAnswerEndTime && Date.now() < this.playerPouncePersonalAnswerEndTime) {
                        this.startPersonalAnswerTimer();
                    } else if (!this.playerPouncePersonalAnswerEndTime || Date.now() >= this.playerPouncePersonalAnswerEndTime) {
                        // If timer somehow not started but end time passed
                        this.elements.pounceStatusMessage.textContent = "Your time to answer pounce is over.";
                        this.elements.pounceInputArea.classList.add('hidden');
                    }
                } else if (this.playerPouncedThisQuestion) {
                    this.elements.pounceStatusMessage.textContent = "Your pounce answer is submitted.";
                    this.elements.pounceInputArea.classList.add('hidden');
                } else {
                    this.elements.pounceStatusMessage.textContent = "Pounce window is closed.";
                }
                break;

            case 'bounce_pending_evaluation':
            case 'results':
                // ... (existing logic for these phases) ...
                this.elements.resultsPhaseUi.classList.remove('hidden');
                this.elements.resultsMessage.textContent = state.quizPhase === 'results' ? "Round over. Scores updated." : "Pounce answers are being evaluated...";
                break;
            case 'bounce':
                // ... (existing logic for bounce phase) ...
                 this.elements.bouncePhaseUi.classList.remove('hidden');
                this.elements.bounceTurnInfo.textContent = state.currentBouncer ? `Bounce Turn: ${state.currentBouncer.name}` : "Waiting for bouncer...";
                if (myServerState && !myServerState.isEligibleForBounce) {
                    this.elements.bounceStatusMessage.textContent = "Not eligible for bounce this round.";
                    this.elements.passBounceBtn.classList.add('hidden');
                } else if (state.currentBouncer && state.currentBouncer.id === this.playerId) {
                    this.elements.bounceStatusMessage.textContent = "It's YOUR turn to Bounce!";
                    this.elements.passBounceBtn.classList.remove('hidden'); this.elements.passBounceBtn.disabled = false;
                } else {
                    this.elements.bounceStatusMessage.textContent = "Waiting for another player to bounce or pass.";
                    this.elements.passBounceBtn.classList.add('hidden');
                }
                break;
            case 'final_results':
                // ... (existing logic for final_results) ...
                break;
        }
        this.renderLeaderboard(state.leaderboard);
    }

    // ... keep other helper methods: renderLeaderboard, renderFinalLeaderboard, updateConnectionStatus, showError, hideError, enableForm, showScreen, checkUrlParams ...
    // Make sure these are inside the class if they were not before.
    // (The provided snippet for QuizClient class structure seems to include them correctly)
    updateConnectionStatus(message, type = 'info') { /* ... */ }
    showError(message) { /* ... */ }
    hideError() { /* ... */ }
    enableForm(formElement, enabled) { /* ... */ }
    showScreen(screenId) { /* ... */ }
    checkUrlParams() { /* ... */ }
    renderLeaderboard(leaderboardData) { /* ... */ }
    renderFinalLeaderboard(leaderboardData) { /* ... */ }

} // End of QuizClient class

document.addEventListener('DOMContentLoaded', () => {
    window.quizApp = new QuizClient();
    // Remove the manual re-attachment of listeners from previous step, constructor handles it.
});