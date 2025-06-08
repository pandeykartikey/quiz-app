// client/host.js - Quizmaster specific client logic

class QuizmasterClient {
    constructor() {
        this.socket = null;
        this.quizmasterCode = localStorage.getItem('quizmasterCode'); // Try to get from localStorage
        this.isAuthenticated = false;
        this.currentQuizState = null;

        this.elements = {
            // Connection Status
            connectionStatusBar: document.getElementById('qm-connection-status-bar'),
            connectionStatusText: document.getElementById('qm-connection-status-text'),

            // Login Prompt
            loginPromptSection: document.getElementById('qm-login-prompt'),
            loginPromptForm: document.getElementById('qm-prompt-form'),
            loginPromptCodeInput: document.getElementById('qm-prompt-code'),
            loginErrorText: document.getElementById('qm-login-error'),

            // Dashboard
            dashboard: document.getElementById('qm-dashboard'),

            // Controls
            startQuizBtn: document.getElementById('qm-start-quiz-btn'),
            nextQBtn: document.getElementById('qm-next-q-btn'),
            prevQBtn: document.getElementById('qm-prev-q-btn'),
            triggerPounceBtn: document.getElementById('qm-trigger-pounce-btn'),
            triggerBounceBtn: document.getElementById('qm-trigger-bounce-btn'),
            resetQuizBtn: document.getElementById('qm-reset-quiz-btn'),

            // Info Display
            quizPhaseDisplay: document.getElementById('qm-quiz-phase'),
            currentQuestionDisplay: document.getElementById('qm-current-question'),
            accessCodeDisplay: document.getElementById('qm-access-code'),
            qrCodeImage: document.getElementById('qm-qr-code-img'),
            joinUrlText: document.getElementById('qm-join-url'),

            // Player List
            playerCountDisplay: document.getElementById('qm-player-count'),
            playerList: document.getElementById('qm-player-list'),

            // Pounce Info
            pounceInfoArea: document.getElementById('qm-pounce-info-area'),
            pounceSubmissionsList: document.getElementById('qm-pounce-submissions'),

            // Bounce Info
            bounceInfoArea: document.getElementById('qm-bounce-info-area'),
            currentBouncerNameDisplay: document.getElementById('qm-current-bouncer-name'),
            bounceEligibleList: document.getElementById('qm-bounce-eligible-list'),
        };
        this.init();
    }

    init() {
        this.connectSocket();
        this.setupEventListeners();
        this.tryAutoLogin(); // Attempt to login if code is stored
    }

    connectSocket() {
        this.socket = io({
            reconnectionAttempts: 5,
            reconnectionDelay: 3000,
        });
        this.socket.on('connect', () => {
            this.updateConnectionStatus('Connected', 'success');
            // If authenticated, re-identify. For now, auto-login handles initial.
            // If socket reconnects and was authenticated, may need to re-send QM code.
            if (this.isAuthenticated && this.quizmasterCode) {
                 this.socket.emit('quizmasterLogin', { quizmasterCode: this.quizmasterCode });
            }
        });
        this.socket.on('disconnect', (reason) => this.updateConnectionStatus(`Disconnected: \${reason}`, 'error'));
        this.socket.on('connect_error', (err) => this.updateConnectionStatus(`Connection Error: \${err.message}`, 'error'));

        this.setupSocketEventListeners();
    }

    tryAutoLogin() {
        if (this.quizmasterCode) {
            this.elements.loginPromptCodeInput.value = this.quizmasterCode; // Pre-fill for convenience
            this.socket.emit('quizmasterLogin', { quizmasterCode: this.quizmasterCode });
        } else {
            this.elements.loginPromptSection.classList.remove('hidden');
        }
    }

    setupSocketEventListeners() {
        this.socket.on('quizmasterLoginSuccess', (data) => {
            this.isAuthenticated = true;
            localStorage.setItem('quizmasterCode', this.quizmasterCode || this.elements.loginPromptCodeInput.value);
            this.elements.loginPromptSection.classList.add('hidden');
            this.elements.dashboard.classList.remove('hidden');
            this.elements.loginErrorText.textContent = '';
            console.log('Quizmaster login successful via host page.', data);
            if (data.initialState) { // Server should send initial state
                this.currentQuizState = data.initialState;
                this.renderDashboard(data.initialState);
            }
            this.loadQrCode(); // Load QR after login
        });

        this.socket.on('loginError', (data) => {
            this.isAuthenticated = false;
            localStorage.removeItem('quizmasterCode');
            this.elements.loginPromptSection.classList.remove('hidden');
            this.elements.dashboard.classList.add('hidden');
            this.elements.loginErrorText.textContent = data.message;
            console.error('Quizmaster login error:', data.message);
        });

        this.socket.on('quizmasterStateUpdate', (state) => {
            console.log('Quizmaster received stateUpdate:', state);
            this.currentQuizState = state;
            this.renderDashboard(state);
        });

        this.socket.on('quizStateUpdate', (state) => { // Also listen to general for player list etc.
            console.log('Quizmaster received general quizStateUpdate:', state);
            // Merge or decide which parts of this state are relevant if not using quizmasterStateUpdate primarily
            this.currentQuizState = state; // Assuming this also contains everything needed
            this.renderDashboard(state);
        });

        this.socket.on('quizForceReset', (data) => {
            alert('Quiz has been reset.');
            // Re-render dashboard, should reflect lobby state
            if (this.currentQuizState) {
                this.currentQuizState.quizPhase = 'lobby';
                this.currentQuizState.currentQuestion = null;
                this.currentQuizState.players = [];
                this.currentQuizState.leaderboard = [];
                this.currentQuizState.pounceSubmissions = [];
                // Access code might change
                if (data && data.accessCode) this.currentQuizState.accessCode = data.accessCode;
                this.renderDashboard(this.currentQuizState);
                this.loadQrCode(); // Reload QR as access code might change
            }
        });
    }

    setupEventListeners() {
        this.elements.loginPromptForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.quizmasterCode = this.elements.loginPromptCodeInput.value;
            if (this.quizmasterCode) {
                this.socket.emit('quizmasterLogin', { quizmasterCode: this.quizmasterCode });
            }
        });

        this.elements.startQuizBtn.addEventListener('click', () => this.socket.emit('startQuiz'));
        this.elements.nextQBtn.addEventListener('click', () => this.socket.emit('nextQuestion' /*, { externalSlideId: 'someID'} */));
        this.elements.prevQBtn.addEventListener('click', () => this.socket.emit('previousQuestion'));
        this.elements.triggerPounceBtn.addEventListener('click', () => this.socket.emit('triggerPouncePhase'));
        this.elements.triggerBounceBtn.addEventListener('click', () => this.socket.emit('triggerBouncePhase'));
        this.elements.resetQuizBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to reset the entire quiz? This will clear all player scores and progress.')) {
                this.socket.emit('resetQuiz');
            }
        });
    }

    async loadQrCode() {
        if (!this.isAuthenticated) return;
        try {
            const response = await fetch('/api/qr-code'); // This API needs to use current access code from state
            if (!response.ok) throw new Error(`QR Code API Error: \${response.status}`);
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
        if (!this.isAuthenticated || !state) {
            this.elements.dashboard.classList.add('hidden');
            this.elements.loginPromptSection.classList.remove('hidden');
            return;
        }
        this.elements.dashboard.classList.remove('hidden');
        this.elements.loginPromptSection.classList.add('hidden');

        this.elements.quizPhaseDisplay.textContent = state.quizPhase?.replace('_', ' ').replace(/\w/g, l => l.toUpperCase()) || 'N/A';
        this.elements.currentQuestionDisplay.textContent = state.currentQuestion ? `#\${state.currentQuestion.questionNumber} (\${state.currentQuestion.externalId || 'N/A'})` : 'N/A';
        this.elements.accessCodeDisplay.textContent = state.accessCode || 'N/A';

        // Player List & Scores
        const players = state.allPlayersDetailed || state.playersList || state.players || []; // Use the most detailed list available
        this.elements.playerCountDisplay.textContent = players.filter(p => !p.isQuizmaster).length;
        this.elements.playerList.innerHTML = '';
        if (players.length > 0) {
            players.filter(p => !p.isQuizmaster).sort((a,b) => b.score - a.score).forEach(player => {
                const item = document.createElement('div');
                item.className = 'p-2 bg-slate-700/50 rounded-md flex justify-between items-center';
                item.innerHTML = `
                    <span>\${player.name} \${player.connected ? '🟢' : '🔴'}</span>
                    <span class="font-bold text-green-400">\${player.score} pts</span>
                `;
                this.elements.playerList.appendChild(item);
            });
        } else {
            this.elements.playerList.innerHTML = '<p class="text-slate-400">No players connected.</p>';
        }

        // Pounce Submissions
        if (state.quizPhase === 'bounce_pending_evaluation' || state.quizPhase === 'bounce' || state.quizPhase === 'results') {
            this.elements.pounceInfoArea.classList.remove('hidden');
            this.elements.pounceSubmissionsList.innerHTML = '';
            const submissions = state.pounceSubmissions || [];
            if (submissions.length > 0) {
                submissions.forEach(sub => {
                    const item = document.createElement('div');
                    item.className = `p-2 rounded-md \${sub.isCorrect ? 'bg-green-600/30' : 'bg-red-600/30'}`;
                    item.innerHTML = `
                        <span class="font-semibold">\${sub.name}:</span> "\${sub.answer}"
                        (\${sub.isCorrect ? 'Correct ✅' : 'Incorrect ❌'})
                    `;
                    this.elements.pounceSubmissionsList.appendChild(item);
                });
            } else {
                this.elements.pounceSubmissionsList.innerHTML = '<p class="text-slate-400">No pounce submissions for this question.</p>';
            }
        } else {
            this.elements.pounceInfoArea.classList.add('hidden');
        }

        // Bounce Management
        if (state.quizPhase === 'bounce') {
            this.elements.bounceInfoArea.classList.remove('hidden');
            const currentBouncerId = state.bounceTurnPlayerId;
            const bouncerDetails = currentBouncerId ? players.find(p => p.id === currentBouncerId) : null;
            this.elements.currentBouncerNameDisplay.textContent = bouncerDetails ? bouncerDetails.name : 'N/A';

            this.elements.bounceEligibleList.innerHTML = '';
            const bounceOrder = state.bounceOrder || []; // Array of socketIds
            bounceOrder.forEach(playerId => {
                const player = players.find(p => p.id === playerId);
                if (player && player.isEligibleForBounce) { // Check eligibility from detailed player state if available
                    const item = document.createElement('div');
                    item.className = `p-2 rounded-md flex justify-between items-center \${player.id === currentBouncerId ? 'bg-yellow-600/30' : 'bg-slate-700/50'}`;
                    item.innerHTML = `<span>\${player.name}</span>`;

                    if (player.id === currentBouncerId) {
                        const controlsDiv = document.createElement('div');
                        controlsDiv.className = 'space-x-2';
                        const correctBtn = document.createElement('button');
                        correctBtn.className = 'px-2 py-1 text-xs bg-green-500 hover:bg-green-600 text-white rounded';
                        correctBtn.textContent = 'Correct';
                        correctBtn.onclick = () => this.socket.emit('markBounceCorrect', { playerId: player.id });

                        const wrongBtn = document.createElement('button');
                        wrongBtn.className = 'px-2 py-1 text-xs bg-red-500 hover:bg-red-600 text-white rounded';
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

        } else {
            this.elements.bounceInfoArea.classList.add('hidden');
        }

        // Button states based on phase
        this.elements.startQuizBtn.disabled = !(state.quizPhase === 'lobby' || state.quizPhase === 'final_results');
        this.elements.nextQBtn.disabled = state.quizPhase === 'final_results' || state.questions?.length === 0;
        this.elements.prevQBtn.disabled = state.quizPhase === 'final_results' || state.questions?.length === 0;
        this.elements.triggerPounceBtn.disabled = state.quizPhase === 'lobby' || state.quizPhase === 'final_results' || !state.currentQuestion;
        this.elements.triggerBounceBtn.disabled = state.quizPhase !== 'bounce_pending_evaluation' && state.quizPhase !== 'pounce'; // Enable after pounce
    }

    updateConnectionStatus(message, type = 'info') {
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
}

document.addEventListener('DOMContentLoaded', () => {
    window.quizmasterApp = new QuizmasterClient();
});
