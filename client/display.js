// client/display.js - Logic for the projector/TV display view

class QuizDisplayClient {
    constructor() {
        this.socket = null;
        this.pounceTimerInterval = null;

        this.elements = {
            connectionStatus: document.getElementById('display-connection-status'),

            lobbyView: document.getElementById('display-lobby-view'),
            lobbyTitle: document.getElementById('display-lobby-title'),
            accessCodeDisplay: document.getElementById('display-access-code'),
            qrCodeImage: document.getElementById('display-qr-code-img'),
            joinUrlText: document.getElementById('display-join-url'),

            questionView: document.getElementById('display-question-view'),
            questionNumberDisplay: document.getElementById('display-question-number'),
            questionExternalIdDisplay: document.getElementById('display-question-external-id').querySelector('span'),
            questionTextDisplay: document.getElementById('display-question-text'),
            phaseInfoDisplay: document.getElementById('display-phase-info'),
            pounceTimerDisplay: document.getElementById('display-pounce-timer'),
            bounceTurnInfoDisplay: document.getElementById('display-bounce-turn-info'),

            leaderboardView: document.getElementById('display-leaderboard-view'),
            leaderboardTitle: document.getElementById('display-leaderboard-title'),
            leaderboardList: document.getElementById('display-leaderboard-list'),
            leaderboardWaitingMsg: document.getElementById('display-leaderboard-waiting-msg'),

            finalResultsView: document.getElementById('display-final-results-view'),
            finalLeaderboardList: document.getElementById('display-final-leaderboard-list'),
        };
        this.init();
    }

    init() {
        this.connectSocket();
        this.loadQrCodeForDisplay(); // Attempt to load QR initially for lobby
    }

    connectSocket() {
        this.socket = io({
            reconnectionAttempts: 5,
            reconnectionDelay: 3000,
        });

        this.socket.on('connect', () => this.updateConnectionStatus('Connected', 'success'));
        this.socket.on('disconnect', (reason) => this.updateConnectionStatus(`Disconnected: ${reason}`, 'error'));
        this.socket.on('connect_error', (err) => this.updateConnectionStatus(`Connection Error: ${err.message}`, 'error'));

        this.setupSocketEventListeners();
    }

    setupSocketEventListeners() {
        // This client primarily listens to 'quizStateUpdate'
        this.socket.on('quizStateUpdate', (state) => {
            console.log('Display received quizStateUpdate:', state);
            this.renderDisplayView(state);
        });

        this.socket.on('quizForceReset', (data) => {
            alert('Quiz is resetting.'); // Optional alert
            // Essentially re-render as lobby
             this.renderDisplayView({
                quizPhase: 'lobby',
                quizTitle: 'Quiz Resetting...', // Temporary title
                accessCode: data.accessCode || '----',
                leaderboard: []
            });
            this.loadQrCodeForDisplay(data.accessCode);
        });
    }

    async loadQrCodeForDisplay(accessCodeFromReset = null) {
        try {
            // If accessCodeFromReset is provided, the API might not have updated state yet.
            // The /api/qr-code endpoint itself should use the current server state access code.
            const response = await fetch('/api/qr-code');
            if (!response.ok) throw new Error(`QR Code API Error: ${response.status}`);
            const data = await response.json();
            this.elements.qrCodeImage.src = data.qrCode;
            this.elements.qrCodeImage.classList.remove('hidden');
            this.elements.joinUrlText.textContent = data.url;

            // If access code from reset is different, it implies server state might update soon
            // For now, we rely on the API giving the current code.
            if (accessCodeFromReset && this.elements.accessCodeDisplay) {
                 this.elements.accessCodeDisplay.textContent = accessCodeFromReset;
            }

        } catch (error) {
            console.error('Failed to load QR code for display:', error);
            if (this.elements.joinUrlText) this.elements.joinUrlText.textContent = 'Error loading QR code.';
        }
    }

    renderDisplayView(state) {
        // Hide all views first
        this.elements.lobbyView.classList.add('hidden');
        this.elements.questionView.classList.add('hidden');
        this.elements.leaderboardView.classList.add('hidden');
        this.elements.finalResultsView.classList.add('hidden');

        // Clear dynamic content areas
        this.elements.pounceTimerDisplay.textContent = '';
        this.elements.bounceTurnInfoDisplay.textContent = '';
        if (this.pounceTimerInterval) clearInterval(this.pounceTimerInterval);

        this.elements.lobbyTitle.textContent = state.quizTitle || "Welcome to the Quiz!";
        this.elements.accessCodeDisplay.textContent = state.accessCode || "----";

        switch (state.quizPhase) {
            case 'lobby':
                this.elements.lobbyView.classList.remove('hidden');
                // QR code might need reload if access code changed, handled by quizForceReset or initial load
                break;

            case 'pounce':
            case 'bounce_pending_evaluation':
            case 'bounce':
                this.elements.questionView.classList.remove('hidden');
                if (state.currentQuestion) {
                    this.elements.questionNumberDisplay.textContent = state.currentQuestion.questionNumber;
                    this.elements.questionExternalIdDisplay.textContent = state.currentQuestion.externalId || 'N/A';
                    this.elements.questionTextDisplay.textContent = state.currentQuestion.text || "Question on Main Screen";
                } else {
                    this.elements.questionTextDisplay.textContent = "Waiting for question...";
                }

                if (state.quizPhase === 'pounce') {
                    this.elements.phaseInfoDisplay.textContent = "POUNCE!";
                    this.elements.phaseInfoDisplay.className = "text-5xl md:text-7xl font-bold text-orange-400";
                    if (state.pounceEndTime && Date.now() < state.pounceEndTime) {
                        const updateTimer = () => {
                            const timeLeft = Math.max(0, Math.round((state.pounceEndTime - Date.now()) / 1000));
                            this.elements.pounceTimerDisplay.textContent = `${timeLeft}s`;
                            if (timeLeft <= 0) {
                                clearInterval(this.pounceTimerInterval);
                                this.elements.pounceTimerDisplay.textContent = "Time's Up!";
                            }
                        };
                        updateTimer();
                        this.pounceTimerInterval = setInterval(updateTimer, 1000);
                    } else {
                        this.elements.pounceTimerDisplay.textContent = "Time's Up!";
                    }
                } else if (state.quizPhase === 'bounce_pending_evaluation') {
                    this.elements.phaseInfoDisplay.textContent = "Evaluating Pounce...";
                    this.elements.phaseInfoDisplay.className = "text-4xl md:text-6xl font-bold text-yellow-400";
                } else { // bounce phase
                    this.elements.phaseInfoDisplay.textContent = "BOUNCE!";
                    this.elements.phaseInfoDisplay.className = "text-5xl md:text-7xl font-bold text-cyan-400";
                    const bouncer = state.currentBouncer; // Expect {id, name}
                    if (bouncer && bouncer.name) {
                        this.elements.bounceTurnInfoDisplay.textContent = `${bouncer.name}'s Turn`;
                    } else {
                        this.elements.bounceTurnInfoDisplay.textContent = "Waiting for bouncer...";
                    }
                }
                break;

            case 'results':
                this.elements.leaderboardView.classList.remove('hidden');
                this.elements.leaderboardTitle.textContent = "Current Scores";
                this.renderLeaderboardList(state.leaderboard, this.elements.leaderboardList);
                this.elements.leaderboardWaitingMsg.textContent = "Waiting for next question...";
                break;

            case 'final_results':
                this.elements.finalResultsView.classList.remove('hidden');
                this.renderLeaderboardList(state.leaderboard, this.elements.finalLeaderboardList, true);
                break;

            default:
                this.elements.lobbyView.classList.remove('hidden'); // Fallback to lobby
                console.warn(`Unknown quiz phase for display: ${state.quizPhase}`);
        }
    }

    renderLeaderboardList(leaderboardData, listElement, isFinal = false) {
        listElement.innerHTML = ''; // Clear old entries
        if (!leaderboardData || leaderboardData.length === 0) {
            listElement.innerHTML = '<p class="text-slate-400 text-center text-2xl">No scores yet.</p>';
            return;
        }
        leaderboardData.slice(0, isFinal ? 10 : 5).forEach((player, index) => { // Show top 5 for live, top 10 for final
            const item = document.createElement('div');
            item.className = 'leaderboard-item animate-fade-in-slow';

            let medal = '';
            if (isFinal) {
                if (index === 0) medal = '🥇 ';
                else if (index === 1) medal = '🥈 ';
                else if (index === 2) medal = '🥉 ';
            }

            item.innerHTML = `
                <span class="font-semibold ${isFinal && index < 3 ? 'text-yellow-300' : 'text-slate-100'}">${medal}${index + 1}. ${player.name}</span>
                <span class="font-bold ${isFinal && index < 3 ? 'text-yellow-300' : 'text-green-400'}">${player.score} pts</span>
            `;
            listElement.appendChild(item);
        });
    }

    updateConnectionStatus(message, type = 'info') {
        if (!this.elements.connectionStatus) return;
        this.elements.connectionStatus.textContent = message;
        this.elements.connectionStatus.classList.remove('bg-green-500/70', 'bg-red-500/70', 'text-white');

        if (type === 'success') this.elements.connectionStatus.classList.add('bg-green-500/70', 'text-white');
        else if (type === 'error') this.elements.connectionStatus.classList.add('bg-red-500/70', 'text-white');
        else this.elements.connectionStatus.textContent = ''; // Hide if just info
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.quizDisplayApp = new QuizDisplayClient();
});
