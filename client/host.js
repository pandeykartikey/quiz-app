// client/host.js - Quizmaster specific client logic (Revised for Adhoc Points)

class QuizmasterClient {
    constructor() {
        this.socket = null;
        this.quizmasterCode = localStorage.getItem('quizmasterCode');
        this.isAuthenticated = false;
        this.currentQuizState = null;
        this.globalPounceOptInTimerInterval = null;

        this.elements = { /* ... existing elements from previous step ... */
            connectionStatusBar: document.getElementById('qm-connection-status-bar'),
            connectionStatusText: document.getElementById('qm-connection-status-text'),
            loginPromptSection: document.getElementById('qm-login-prompt'),
            loginPromptForm: document.getElementById('qm-prompt-form'),
            loginPromptCodeInput: document.getElementById('qm-prompt-code'),
            loginErrorText: document.getElementById('qm-login-error'),
            dashboard: document.getElementById('qm-dashboard'),
            startQuizBtn: document.getElementById('qm-start-quiz-btn'),
            nextQBtn: document.getElementById('qm-next-q-btn'),
            prevQBtn: document.getElementById('qm-prev-q-btn'),
            triggerPounceBtn: document.getElementById('qm-trigger-pounce-btn'),
            triggerBounceBtn: document.getElementById('qm-trigger-bounce-btn'),
            resetQuizBtn: document.getElementById('qm-reset-quiz-btn'),
            quizPhaseDisplay: document.getElementById('qm-quiz-phase'),
            currentQuestionDisplay: document.getElementById('qm-current-question'),
            accessCodeDisplay: document.getElementById('qm-access-code'),
            qrCodeImage: document.getElementById('qm-qr-code-img'),
            joinUrlText: document.getElementById('qm-join-url'),
            playerCountDisplay: document.getElementById('qm-player-count'),
            playerList: document.getElementById('qm-player-list'), // This is where adhoc controls will go
            pounceInfoArea: document.getElementById('qm-pounce-info-area'),
            pounceOptInTimerDisplay: document.getElementById('qm-pounce-opt-in-timer'),
            pounceStatusMessageDisplay: document.getElementById('qm-pounce-status-message'),
            pounceSubmissionsList: document.getElementById('qm-pounce-submissions'),
            bounceInfoArea: document.getElementById('qm-bounce-info-area'),
            currentBouncerNameDisplay: document.getElementById('qm-current-bouncer-name'),
            bounceEligibleList: document.getElementById('qm-bounce-eligible-list'),
        };
        this.init();
    }

    init() { this.connectSocket(); this.setupEventListeners(); this.tryAutoLogin(); }
    connectSocket() {
        this.socket = io({ reconnectionAttempts: 5, reconnectionDelay: 3000, });
        this.socket.on('connect', () => { this.updateConnectionStatus('Connected', 'success'); if (this.isAuthenticated && this.quizmasterCode) { this.socket.emit('quizmasterLogin', { quizmasterCode: this.quizmasterCode }); }});
        this.socket.on('disconnect', (reason) => this.updateConnectionStatus(`Disconnected: ${reason}`, 'error'));
        this.socket.on('connect_error', (err) => this.updateConnectionStatus(`Connection Error: ${err.message}`, 'error'));
        this.setupSocketEventListeners();
    }
    tryAutoLogin() {
        if (this.quizmasterCode) { this.elements.loginPromptCodeInput.value = this.quizmasterCode; this.socket.emit('quizmasterLogin', { quizmasterCode: this.quizmasterCode }); }
        else { this.elements.loginPromptSection.classList.remove('hidden'); }
    }

    setupSocketEventListeners() {
        this.socket.on('quizmasterLoginSuccess', (data) => {
            this.isAuthenticated = true;
            localStorage.setItem('quizmasterCode', this.quizmasterCode || this.elements.loginPromptCodeInput.value);
            this.elements.loginPromptSection.classList.add('hidden');
            this.elements.dashboard.classList.remove('hidden');
            this.elements.loginErrorText.textContent = '';
            if (data.initialState) { this.currentQuizState = data.initialState; this.renderDashboard(data.initialState); }
            this.loadQrCode();
        });
        this.socket.on('loginError', (data) => { /* ... existing ... */
            this.isAuthenticated = false;
            localStorage.removeItem('quizmasterCode');
            this.elements.loginPromptSection.classList.remove('hidden');
            this.elements.dashboard.classList.add('hidden');
            this.elements.loginErrorText.textContent = data.message;
            console.error('Quizmaster login error:', data.message);
        });
        this.socket.on('quizForceReset', (data) => { /* ... existing ... */
            alert('Quiz has been reset.');
            if (this.currentQuizState) {
                this.currentQuizState.quizPhase = 'lobby';
                this.currentQuizState.currentQuestion = null;
                 // Ensure allPlayersDetailed or similar is cleared or reset
                this.currentQuizState.allPlayersDetailed = [];
                this.currentQuizState.players = [];
                this.currentQuizState.leaderboard = [];
                this.currentQuizState.pounceSubmissions = [];
                if (data && data.accessCode) this.currentQuizState.accessCode = data.accessCode;
                this.renderDashboard(this.currentQuizState);
                this.loadQrCode();
            }
        });

        // Main state update handlers
        this.socket.on('quizmasterStateUpdate', (state) => { this.currentQuizState = state; this.renderDashboard(state); });
        this.socket.on('quizStateUpdate', (state) => {  // General updates also refresh QM view
            // Basic merge: quizmasterStateUpdate is source of truth, quizStateUpdate provides player list updates mostly
            let detailedPlayers = this.currentQuizState ? (this.currentQuizState.allPlayersDetailed || this.currentQuizState.players) : [];

            // Create a map of existing detailed players for easier update
            const detailedPlayerMap = new Map(detailedPlayers.map(p => [p.id, p]));

            if (state.players && this.currentQuizState) {
                 // state.players is the simplified list from getPlayers()
                 // Update our detailed list with scores/connection status from simplified list
                 state.players.forEach(simplePlayer => {
                     if(detailedPlayerMap.has(simplePlayer.id)) {
                         const detail = detailedPlayerMap.get(simplePlayer.id);
                         detail.score = simplePlayer.score;
                         detail.connected = simplePlayer.connected;
                         // Copy over any other new fields from simplePlayer that should be on detailed view
                         Object.keys(simplePlayer).forEach(key => {
                            if(!(key in detail)) detail[key] = simplePlayer[key];
                         });

                     } else { // New player seen in simplified list, add a basic entry
                        detailedPlayerMap.set(simplePlayer.id, {...simplePlayer});
                     }
                 });
            }
            // Reconstruct allPlayersDetailed from map if state.players was the primary source of change
            const newAllPlayersDetailed = Array.from(detailedPlayerMap.values());

            this.currentQuizState = {
                ...this.currentQuizState, // Old QM specific details
                ...state, // General state like phase, currentQuestion
                allPlayersDetailed: newAllPlayersDetailed, // Updated player list
                players: newAllPlayersDetailed // Also update 'players' if renderDashboard uses it as fallback
            };
            this.renderDashboard(this.currentQuizState);
        });
         this.socket.on('error', (data) => { // General error handler from server
            console.error('Server error:', data.message);
            alert(`Server error: ${data.message}`); // Simple alert for now
        });
    }
    setupEventListeners() {
        this.elements.loginPromptForm.addEventListener('submit', (e) => { e.preventDefault(); this.quizmasterCode = this.elements.loginPromptCodeInput.value; if (this.quizmasterCode) { this.socket.emit('quizmasterLogin', { quizmasterCode: this.quizmasterCode }); } });
        this.elements.startQuizBtn.addEventListener('click', () => this.socket.emit('startQuiz'));
        this.elements.nextQBtn.addEventListener('click', () => this.socket.emit('nextQuestion'));
        this.elements.prevQBtn.addEventListener('click', () => this.socket.emit('previousQuestion'));
        this.elements.triggerPounceBtn.addEventListener('click', () => this.socket.emit('triggerPouncePhase'));
        this.elements.triggerBounceBtn.addEventListener('click', () => this.socket.emit('triggerBouncePhase'));
        this.elements.resetQuizBtn.addEventListener('click', () => { if (confirm('Sure?')) { this.socket.emit('resetQuiz'); }});

        // Event delegation for adhoc points, as buttons are dynamic
        this.elements.playerList.addEventListener('click', (event) => {
            if (event.target.classList.contains('adhoc-points-btn')) {
                const playerId = event.target.dataset.playerId;
                const inputElement = this.elements.playerList.querySelector(`input[data-player-id="${playerId}"]`);
                if (inputElement) {
                    const pointsDelta = parseInt(inputElement.value, 10);
                    if (!isNaN(pointsDelta)) {
                        this.socket.emit('adjustScore', { playerId, pointsDelta });
                        inputElement.value = ''; // Clear input after submission
                    } else {
                        alert('Please enter a valid number for points adjustment.');
                    }
                }
            }
        });
    }
    async loadQrCode() { /* ... existing ... */
        if (!this.isAuthenticated) return;
        try {
            const response = await fetch('/api/qr-code');
            if (!response.ok) throw new Error(`QR Code API Error: ${response.status}`);
            const data = await response.json();
            this.elements.qrCodeImage.src = data.qrCode;
            this.elements.qrCodeImage.classList.remove('hidden');
            this.elements.joinUrlText.textContent = data.url;
        } catch (error) {
            console.error('Failed to load QR code:', error);
            this.elements.joinUrlText.textContent = 'Error loading QR code.';
        }
    }

    renderDashboard(state) {
        if (!this.isAuthenticated || !state) { this.elements.dashboard.classList.add('hidden'); this.elements.loginPromptSection.classList.remove('hidden'); return; }
        this.elements.dashboard.classList.remove('hidden');
        this.elements.loginPromptSection.classList.add('hidden');

        this.elements.quizPhaseDisplay.textContent = state.quizPhase?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'N/A';
        this.elements.currentQuestionDisplay.textContent = state.currentQuestion ? `#${state.currentQuestion.questionNumber} (${state.currentQuestion.externalId || 'N/A'})` : 'N/A';
        this.elements.accessCodeDisplay.textContent = state.accessCode || 'N/A';

        const players = state.allPlayersDetailed || state.players || [];
        const nonQmPlayers = players.filter(p => !p.isQuizmaster);
        this.elements.playerCountDisplay.textContent = nonQmPlayers.length;
        this.elements.playerList.innerHTML = '';

        nonQmPlayers.sort((a,b) => b.score - a.score).forEach(player => {
            const item = document.createElement('div');
            item.className = 'p-3 bg-slate-700/50 rounded-md space-y-2';

            const playerInfo = document.createElement('div');
            playerInfo.className = 'flex justify-between items-center';
            let playerPounceStatus = '';
            if (state.quizPhase === 'pounce_opt_in' || state.quizPhase === 'pounce_answering_window_active' || state.quizPhase === 'bounce_pending_evaluation' || state.quizPhase === 'results') {
                if (player.pouncedThisQuestion) {
                    playerPounceStatus = ` <span class="${player.pounceCorrect ? 'text-green-400' : 'text-red-400'}">(Pounced)</span>`;
                } else if (player.hasOptedInPounce) {
                    playerPounceStatus = ' <span class="text-yellow-400">(Opted-In)</span>';
                }
            }
            playerInfo.innerHTML = `
                <span class="font-semibold">${player.name} ${player.connected ? '🟢' : '🔴'}${playerPounceStatus}</span>
                <span class="font-bold text-green-400">${player.score} pts</span>
            `;
            item.appendChild(playerInfo);

            const adhocControls = document.createElement('div');
            adhocControls.className = 'flex items-center space-x-2 mt-1';
            adhocControls.innerHTML = `
                <input type="number" placeholder="±pts" data-player-id="${player.id}"
                       class="w-20 px-2 py-1 text-sm bg-slate-600 border border-slate-500 rounded focus:ring-1 focus:ring-teal-500 text-white">
                <button data-player-id="${player.id}"
                        class="adhoc-points-btn btn bg-teal-500 hover:bg-teal-600 text-xs py-1 px-3">
                    Adjust
                </button>
            `;
            item.appendChild(adhocControls);
            this.elements.playerList.appendChild(item);
        });
        if (this.elements.playerList.children.length === 0) {
             this.elements.playerList.innerHTML = '<p class="text-slate-400">No players connected.</p>';
        }

        if (state.quizPhase === 'question_pending_pounce_trigger' || state.quizPhase === 'pounce_opt_in' || state.quizPhase === 'pounce_answering_window_active' || state.quizPhase === 'bounce_pending_evaluation' || state.quizPhase === 'results') {
            this.elements.pounceInfoArea.classList.remove('hidden');
            this.elements.pounceSubmissionsList.innerHTML = '';

            if (state.quizPhase === 'pounce_opt_in') {
                this.elements.pounceStatusMessageDisplay.textContent = "Pounce Opt-In Window ACTIVE.";
                this.startGlobalPounceOptInTimer(state.pounceOptInEndTime);
            } else if (state.quizPhase === 'pounce_answering_window_active') {
                this.elements.pounceStatusMessageDisplay.textContent = "Pounce Opt-In Closed. Players are answering.";
                this.elements.pounceOptInTimerDisplay.textContent = "Opt-In Closed";
                if(this.globalPounceOptInTimerInterval) clearInterval(this.globalPounceOptInTimerInterval);
            } else if (state.quizPhase === 'bounce_pending_evaluation' || state.quizPhase === 'results') {
                this.elements.pounceStatusMessageDisplay.textContent = "Pounce Phase OVER.";
                this.elements.pounceOptInTimerDisplay.textContent = "";
                if(this.globalPounceOptInTimerInterval) clearInterval(this.globalPounceOptInTimerInterval);
            } else {
                 this.elements.pounceStatusMessageDisplay.textContent = "Ready to trigger pounce for this question.";
                 this.elements.pounceOptInTimerDisplay.textContent = "";
                 if(this.globalPounceOptInTimerInterval) clearInterval(this.globalPounceOptInTimerInterval);
            }

            const submissions = state.pounceSubmissions || [];
            if (submissions.length > 0) {
                submissions.forEach(sub => {
                    const item = document.createElement('div');
                    item.className = `p-2 rounded-md text-sm ${sub.isCorrect ? 'bg-green-600/30' : 'bg-red-600/30'}`;
                    item.innerHTML = `<span class="font-semibold">${sub.name}:</span> "${sub.answer}" (${sub.isCorrect ? 'Correct ✅' : 'Incorrect ❌'})`;
                    this.elements.pounceSubmissionsList.appendChild(item);
                });
            } else {
                this.elements.pounceSubmissionsList.innerHTML = '<p class="text-slate-400">No pounce submissions yet.</p>';
            }
        } else {
            this.elements.pounceInfoArea.classList.add('hidden');
            if(this.globalPounceOptInTimerInterval) clearInterval(this.globalPounceOptInTimerInterval);
            this.elements.pounceOptInTimerDisplay.textContent = "";
            this.elements.pounceStatusMessageDisplay.textContent = "";
        }

        if (state.quizPhase === 'bounce') {
            this.elements.bounceInfoArea.classList.remove('hidden');
            const currentBouncerId = state.bounceTurnPlayerId;
            const bouncerDetails = currentBouncerId ? players.find(p => p.id === currentBouncerId) : null;
            this.elements.currentBouncerNameDisplay.textContent = bouncerDetails ? bouncerDetails.name : 'N/A';

            this.elements.bounceEligibleList.innerHTML = '';
            const bounceOrder = state.bounceOrder || [];
            bounceOrder.forEach(playerId => {
                const player = players.find(p => p.id === playerId);
                if (player && player.isEligibleForBounce) {
                    const item = document.createElement('div');
                    item.className = `p-2 rounded-md flex justify-between items-center ${player.id === currentBouncerId ? 'bg-yellow-600/30' : 'bg-slate-700/50'}`;
                    item.innerHTML = `<span>${player.name}</span>`;

                    if (player.id === currentBouncerId) {
                        const controlsDiv = document.createElement('div');
                        controlsDiv.className = 'space-x-2';
                        const correctBtn = document.createElement('button');
                        correctBtn.className = 'btn btn-success text-xs py-1 px-2';
                        correctBtn.textContent = 'Correct';
                        correctBtn.onclick = () => this.socket.emit('markBounceCorrect', { playerId: player.id });

                        const wrongBtn = document.createElement('button');
                        wrongBtn.className = 'btn btn-danger text-xs py-1 px-2';
                        wrongBtn.textContent = 'Wrong';
                        wrongBtn.onclick = () => this.socket.emit('markBounceWrong', { playerId: player.id });

                        controlsDiv.appendChild(correctBtn);
                        controlsDiv.appendChild(wrongBtn);
                        item.appendChild(controlsDiv);
                    }
                    this.elements.bounceEligibleList.appendChild(item);
                }
            });
             if (this.elements.bounceEligibleList.children.length === 0) {
                 this.elements.bounceEligibleList.innerHTML = '<p class="text-slate-400">No one currently eligible/up for bounce.</p>';
             }
        }
        else { this.elements.bounceInfoArea.classList.add('hidden'); }

        this.elements.startQuizBtn.disabled = !(state.quizPhase === 'lobby' || state.quizPhase === 'final_results');
        const questionActive = state.currentQuestion && state.questions && state.questions.length > 0;
        this.elements.nextQBtn.disabled = !questionActive || state.quizPhase === 'final_results' || state.quizPhase === 'pounce_opt_in' || state.quizPhase === 'pounce_answering_window_active';
        this.elements.prevQBtn.disabled = !questionActive || state.quizPhase === 'final_results' || state.quizPhase === 'pounce_opt_in' || state.quizPhase === 'pounce_answering_window_active';

        this.elements.triggerPounceBtn.disabled = state.quizPhase !== 'question_pending_pounce_trigger';
        this.elements.triggerBounceBtn.disabled = state.quizPhase !== 'bounce_pending_evaluation' && state.quizPhase !== 'pounce_answering_window_active';
    }

    startGlobalPounceOptInTimer(endTime) { /* ... existing ... */
        if (this.globalPounceOptInTimerInterval) clearInterval(this.globalPounceOptInTimerInterval);
        const update = () => {
            const timeLeft = Math.max(0, Math.round((endTime - Date.now()) / 1000));
            this.elements.pounceOptInTimerDisplay.textContent = `Pounce Opt-In Ends In: ${timeLeft}s`;
            if (timeLeft <= 0) {
                clearInterval(this.globalPounceOptInTimerInterval);
                this.elements.pounceOptInTimerDisplay.textContent = "Pounce Opt-In Window Closed.";
            }
        };
        if (endTime && Date.now() < endTime) {
            update();
            this.globalPounceOptInTimerInterval = setInterval(update, 1000);
        } else {
            this.elements.pounceOptInTimerDisplay.textContent = "Pounce Opt-In Window Closed.";
        }
    }
    updateConnectionStatus(message, type = 'info') { /* ... existing ... */
         if (!this.elements.connectionStatusText) return;
        this.elements.connectionStatusText.textContent = message;
        const bar = this.elements.connectionStatusBar;
        bar.classList.remove('bg-green-500/50', 'bg-red-500/50', 'bg-yellow-500/50', 'bg-slate-700/50');
        bar.classList.remove('text-green-300', 'text-red-300', 'text-yellow-300', 'text-slate-300');
        let statusClass = 'bg-slate-700/50 text-slate-300';
        if (type === 'success') statusClass = 'bg-green-500/50 text-green-300';
        else if (type === 'error') statusClass = 'bg-red-500/50 text-red-300';
        else if (type === 'warning') statusClass = 'bg-yellow-500/50 text-yellow-300';
        bar.classList.add(...statusClass.split(' '));
    }
} // End of QuizmasterClient class

document.addEventListener('DOMContentLoaded', () => {
    window.quizmasterApp = new QuizmasterClient();
});
