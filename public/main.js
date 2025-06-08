// Quiz App - Main Client JavaScript
class QuizApp {
    constructor() {
        this.socket = null;
        this.currentPlayer = null;
        this.currentQuestion = null;
        this.selectedAnswer = null;
        this.isHost = false;
        
        this.init();
    }

    init() {
        this.connectSocket();
        this.setupEventListeners();
        this.checkURLParams();
        this.loadHostControls();
    }

    connectSocket() {
        this.socket = io();
        
        this.socket.on('connect', () => {
            this.updateConnectionStatus('Connected', 'success');
            console.log('Connected to server');
        });

        this.socket.on('disconnect', () => {
            this.updateConnectionStatus('Disconnected', 'error');
            console.log('Disconnected from server');
        });

        this.socket.on('connect_error', (error) => {
            this.updateConnectionStatus('Connection Error', 'error');
            console.error('Connection error:', error);
        });

        // Quiz event listeners
        this.setupSocketListeners();
    }

    setupSocketListeners() {
        // Join events
        this.socket.on('joinSuccess', (data) => {
            this.currentPlayer = data.name;
            this.showWaitingRoom();
            this.hideJoinError();
        });

        this.socket.on('joinError', (data) => {
            this.showJoinError(data.message);
        });

        // Player updates
        this.socket.on('playersUpdate', (data) => {
            this.updatePlayersList(data.players);
            this.updateLeaderboard(data.scores);
        });

        // Quiz flow events
        this.socket.on('quizStarted', (data) => {
            this.startQuiz(data);
        });

        this.socket.on('newQuestion', (data) => {
            this.showNewQuestion(data);
        });

        this.socket.on('answerSubmitted', (data) => {
            this.onAnswerSubmitted();
        });

        this.socket.on('answerProgress', (data) => {
            this.updateAnswerProgress(data);
        });

        this.socket.on('roundResult', (data) => {
            this.showRoundResult(data);
        });

        this.socket.on('quizEnded', (data) => {
            this.showFinalResults(data);
        });

        this.socket.on('quizReset', () => {
            this.resetToJoinScreen();
        });

        // Error handling
        this.socket.on('error', (data) => {
            this.showError(data.message);
        });
    }

    setupEventListeners() {
        // Join form
        const joinForm = document.getElementById('join-form');
        joinForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.joinQuiz();
        });

        // Host controls
        document.getElementById('start-quiz-btn').addEventListener('click', () => {
            this.socket.emit('startQuiz');
        });

        document.getElementById('next-question-btn').addEventListener('click', () => {
            this.socket.emit('nextQuestion');
        });

        document.getElementById('reset-quiz-btn').addEventListener('click', () => {
            if (confirm('Are you sure you want to reset the quiz? All progress will be lost.')) {
                this.socket.emit('resetQuiz');
            }
        });

        // Quiz interactions
        document.getElementById('submit-answer-btn').addEventListener('click', () => {
            this.submitAnswer();
        });

        document.getElementById('play-again-btn').addEventListener('click', () => {
            this.resetToJoinScreen();
        });

        // Auto-uppercase access code input
        const accessCodeInput = document.getElementById('access-code');
        accessCodeInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.toUpperCase();
        });
    }

    checkURLParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        if (code) {
            document.getElementById('access-code').value = code.toUpperCase();
        }
    }

    async loadHostControls() {
        // Check if we should show host controls (if user adds ?host=true)
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('host') === 'true') {
            this.isHost = true;
            this.showHostControls();
            await this.loadQRCode();
        }
    }

    async loadQRCode() {
        try {
            const response = await fetch('/api/qr-code');
            const data = await response.json();
            
            document.getElementById('qr-code').src = data.qrCode;
            document.getElementById('qr-code').classList.remove('hidden');
            document.getElementById('join-url').textContent = data.url;
            
            // Load quiz info for access code
            const quizResponse = await fetch('/api/quiz-info');
            const quizData = await quizResponse.json();
            document.getElementById('display-access-code').textContent = quizData.accessCode;
            
        } catch (error) {
            console.error('Failed to load QR code:', error);
        }
    }

    joinQuiz() {
        const name = document.getElementById('player-name').value.trim();
        const code = document.getElementById('access-code').value.trim().toUpperCase();

        if (!name || !code) {
            this.showJoinError('Please fill in all fields');
            return;
        }

        this.socket.emit('joinQuiz', { name, code });
    }

    startQuiz(questionData) {
        this.currentQuestion = questionData;
        this.showQuizScreen();
        this.displayQuestion(questionData);
        
        if (this.isHost) {
            document.getElementById('next-question-btn').classList.remove('hidden');
        }
    }

    showNewQuestion(questionData) {
        this.currentQuestion = questionData;
        this.selectedAnswer = null;
        this.displayQuestion(questionData);
        this.showQuizScreen();
    }

    displayQuestion(questionData) {
        // Update progress
        const progress = (questionData.questionNumber / questionData.totalQuestions) * 100;
        document.getElementById('progress-bar').style.width = `${progress}%`;
        document.getElementById('question-number').textContent = 
            `Question ${questionData.questionNumber} of ${questionData.totalQuestions}`;

        // Display question
        document.getElementById('question-text').textContent = questionData.text;

        // Handle media if present
        const mediaContainer = document.getElementById('question-media');
        const mediaImage = document.getElementById('question-image');
        
        if (questionData.media) {
            mediaImage.src = questionData.media;
            mediaContainer.classList.remove('hidden');
        } else {
            mediaContainer.classList.add('hidden');
        }

        // Display choices
        this.displayChoices(questionData.choices);
        
        // Reset answer progress
        document.getElementById('answer-progress').textContent = '';
        
        // Enable submit button when choice is selected
        document.getElementById('submit-answer-btn').disabled = true;
    }

    displayChoices(choices) {
        const container = document.getElementById('choices-container');
        container.innerHTML = '';

        choices.forEach((choice, index) => {
            const choiceBtn = document.createElement('button');
            choiceBtn.className = `
                w-full p-4 text-left border-2 border-gray-200 rounded-lg 
                hover:border-blue-500 hover:bg-blue-50 transition-all duration-200
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
            `;
            choiceBtn.innerHTML = `
                <div class="flex items-center space-x-3">
                    <div class="w-8 h-8 rounded-full border-2 border-gray-300 flex items-center justify-center font-semibold">
                        ${String.fromCharCode(65 + index)}
                    </div>
                    <span class="text-gray-900">${choice}</span>
                </div>
            `;
            
            choiceBtn.addEventListener('click', () => {
                this.selectChoice(index, choiceBtn);
            });

            container.appendChild(choiceBtn);
        });
    }

    selectChoice(index, button) {
        // Remove previous selection
        document.querySelectorAll('#choices-container button').forEach(btn => {
            btn.classList.remove('border-blue-500', 'bg-blue-50');
            btn.classList.add('border-gray-200');
        });

        // Highlight selected choice
        button.classList.remove('border-gray-200');
        button.classList.add('border-blue-500', 'bg-blue-50');

        this.selectedAnswer = index;
        document.getElementById('submit-answer-btn').disabled = false;
    }

    submitAnswer() {
        if (this.selectedAnswer === null || !this.currentQuestion) {
            this.showError('Please select an answer');
            return;
        }

        this.socket.emit('submitAnswer', {
            questionId: this.currentQuestion.id,
            choiceIndex: this.selectedAnswer
        });
    }

    onAnswerSubmitted() {
        // Disable all choices and submit button
        document.querySelectorAll('#choices-container button').forEach(btn => {
            btn.disabled = true;
            btn.classList.add('opacity-50', 'cursor-not-allowed');
        });
        
        document.getElementById('submit-answer-btn').disabled = true;
        document.getElementById('submit-answer-btn').textContent = 'Answer Submitted ✅';
    }

    updateAnswerProgress(data) {
        document.getElementById('answer-progress').textContent = 
            `${data.answered}/${data.total} answered`;
    }

    showRoundResult(data) {
        this.showResultsScreen();
        
        const correctChoice = data.correctAnswer;
        const isCorrect = this.selectedAnswer === correctChoice;
        
        // Update result display
        const resultIcon = document.getElementById('result-icon');
        const resultTitle = document.getElementById('result-title');
        const resultExplanation = document.getElementById('result-explanation');
        
        if (isCorrect) {
            resultIcon.className = 'w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4';
            resultIcon.querySelector('span').textContent = '✅';
            resultTitle.textContent = 'Correct!';
            resultTitle.className = 'text-2xl font-bold text-green-600 mb-2';
        } else {
            resultIcon.className = 'w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-4';
            resultIcon.querySelector('span').textContent = '❌';
            resultTitle.textContent = 'Incorrect';
            resultTitle.className = 'text-2xl font-bold text-red-600 mb-2';
        }
        
        if (data.explanation) {
            resultExplanation.textContent = data.explanation;
        }

        // Update leaderboard
        this.updateLeaderboard(data.scores);
    }

    showFinalResults(data) {
        this.showFinalResultsScreen();
        
        // Display final leaderboard
        const container = document.getElementById('final-leaderboard');
        container.innerHTML = '';
        
        data.finalScores.forEach(([name, score], index) => {
            const item = document.createElement('div');
            const isWinner = index === 0;
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🏅';
            
            item.className = `
                flex items-center justify-between p-4 rounded-lg
                ${isWinner ? 'bg-gradient-to-r from-yellow-100 to-orange-100 border-2 border-yellow-400' : 'bg-gray-50'}
            `;
            
            item.innerHTML = `
                <div class="flex items-center space-x-3">
                    <span class="text-2xl">${medal}</span>
                    <div>
                        <div class="font-semibold ${isWinner ? 'text-yellow-800' : 'text-gray-900'}">
                            ${name}
                        </div>
                        <div class="text-sm text-gray-600">
                            ${score} point${score !== 1 ? 's' : ''}
                        </div>
                    </div>
                </div>
                <div class="text-2xl font-bold ${isWinner ? 'text-yellow-600' : 'text-gray-600'}">
                    #${index + 1}
                </div>
            `;
            
            container.appendChild(item);
        });

        // Winner announcement
        if (data.winner) {
            const announcement = document.getElementById('winner-announcement');
            announcement.innerHTML = `
                <div class="bg-gradient-to-r from-yellow-100 to-orange-100 border-2 border-yellow-400 rounded-lg p-6">
                    <h3 class="text-xl font-bold text-yellow-800 mb-2">🎉 Congratulations!</h3>
                    <p class="text-yellow-700">
                        <strong>${data.winner[0]}</strong> wins with ${data.winner[1]} points!
                    </p>
                </div>
            `;
        }
    }

    updatePlayersList(players) {
        const container = document.getElementById('players-list');
        container.innerHTML = '';

        players.forEach(player => {
            const item = document.createElement('div');
            item.className = 'flex items-center space-x-3 p-3 bg-gray-50 rounded-lg';
            item.innerHTML = `
                <div class="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                    <span class="text-white text-sm font-semibold">
                        ${player.name.charAt(0).toUpperCase()}
                    </span>
                </div>
                <span class="font-medium text-gray-900">${player.name}</span>
                <div class="flex-1"></div>
                <div class="w-2 h-2 bg-green-500 rounded-full" title="Online"></div>
            `;
            container.appendChild(item);
        });
    }

    updateLeaderboard(scores) {
        const container = document.getElementById('leaderboard');
        container.innerHTML = '';

        const sortedScores = Object.entries(scores).sort(([,a], [,b]) => b - a);

        sortedScores.forEach(([name, score], index) => {
            const item = document.createElement('div');
            const isCurrentPlayer = name === this.currentPlayer;
            
            item.className = `
                flex items-center justify-between p-3 rounded-lg
                ${isCurrentPlayer ? 'bg-blue-50 border-2 border-blue-200' : 'bg-gray-50'}
            `;
            
            item.innerHTML = `
                <div class="flex items-center space-x-3">
                    <div class="w-6 h-6 rounded-full bg-gray-400 text-white text-xs flex items-center justify-center font-semibold">
                        ${index + 1}
                    </div>
                    <span class="font-medium ${isCurrentPlayer ? 'text-blue-800' : 'text-gray-900'}">
                        ${name} ${isCurrentPlayer ? '(You)' : ''}
                    </span>
                </div>
                <span class="font-bold ${isCurrentPlayer ? 'text-blue-600' : 'text-gray-600'}">
                    ${score}
                </span>
            `;
            
            container.appendChild(item);
        });
    }

    // UI Helper Methods
    hideAllScreens() {
        const screens = [
            'join-screen', 'host-controls', 'waiting-room', 
            'quiz-screen', 'results-screen', 'final-results'
        ];
        screens.forEach(id => {
            document.getElementById(id).classList.add('hidden');
        });
    }

    showJoinScreen() {
        this.hideAllScreens();
        document.getElementById('join-screen').classList.remove('hidden');
    }

    showHostControls() {
        this.hideAllScreens();
        document.getElementById('host-controls').classList.remove('hidden');
    }

    showWaitingRoom() {
        this.hideAllScreens();
        document.getElementById('waiting-room').classList.remove('hidden');
    }

    showQuizScreen() {
        this.hideAllScreens();
        document.getElementById('quiz-screen').classList.remove('hidden');
    }

    showResultsScreen() {
        this.hideAllScreens();
        document.getElementById('results-screen').classList.remove('hidden');
    }

    showFinalResultsScreen() {
        this.hideAllScreens();
        document.getElementById('final-results').classList.remove('hidden');
    }

    updateConnectionStatus(message, type) {
        const statusDiv = document.getElementById('connection-status');
        const statusText = document.getElementById('status-text');
        
        statusText.textContent = message;
        statusDiv.classList.remove('hidden', 'bg-green-100', 'bg-red-100', 'bg-yellow-100');
        
        switch (type) {
            case 'success':
                statusDiv.classList.add('bg-green-100');
                break;
            case 'error':
                statusDiv.classList.add('bg-red-100');
                break;
            case 'warning':
                statusDiv.classList.add('bg-yellow-100');
                break;
        }
        
        // Auto-hide success messages
        if (type === 'success') {
            setTimeout(() => {
                statusDiv.classList.add('hidden');
            }, 3000);
        }
    }

    showJoinError(message) {
        const errorDiv = document.getElementById('join-error');
        const errorText = errorDiv.querySelector('p');
        
        errorText.textContent = message;
        errorDiv.classList.remove('hidden');
    }

    hideJoinError() {
        document.getElementById('join-error').classList.add('hidden');
    }

    showError(message) {
        alert(`Error: ${message}`);
    }

    resetToJoinScreen() {
        this.currentPlayer = null;
        this.currentQuestion = null;
        this.selectedAnswer = null;
        
        // Reset form
        document.getElementById('join-form').reset();
        this.hideJoinError();
        
        // Show join screen
        this.showJoinScreen();
        
        // Reset submit button
        const submitBtn = document.getElementById('submit-answer-btn');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submit Answer ✅';
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new QuizApp();
}); 