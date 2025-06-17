console.log('Quizmaster host script loading.');

let hostStatusDisplay;
let currentQuestionInfoDisplay;
let startQuizBtn;
let endQuizBtn;
let startQuestionBtn;
let pounceStartBtn;
let bounceStartBtn;
let pounceSubmissionsContainer; // For displaying pounce answers
let playerScoresContainer;    // For displaying player scores/leaderboard

document.addEventListener('DOMContentLoaded', () => {
    hostStatusDisplay = document.getElementById('host-status-display');
    currentQuestionInfoDisplay = document.getElementById('current-question-info');
    startQuizBtn = document.getElementById('start-quiz-btn');
    endQuizBtn = document.getElementById('end-quiz-btn');
    startQuestionBtn = document.getElementById('start-question-btn');
    pounceStartBtn = document.getElementById('pounce-start-btn');
    bounceStartBtn = document.getElementById('bounce-start-btn');
    pounceSubmissionsContainer = document.getElementById('pounce-submissions-container');
    playerScoresContainer = document.getElementById('player-scores-container');

    console.log('Quizmaster DOM fully loaded. UI elements selected.');
    updateHostStatus('Quizmaster interface loaded. Connecting to server...');

    if (!socket) {
        console.error("Socket not initialized by the time DOMContentLoaded fired.");
        updateHostStatus("Error: Socket connection not initialized.");
        return;
    }

    startQuizBtn.addEventListener('click', () => {
        console.log('Start Quiz button clicked.');
        socket.emit('start-quiz');
        updateHostStatus('Sent "start-quiz" event.');
    });

    endQuizBtn.addEventListener('click', () => {
        console.log('End Quiz button clicked.');
        socket.emit('end-quiz');
        updateHostStatus('Sent "end-quiz" event.');
    });

    startQuestionBtn.addEventListener('click', () => {
        console.log('Start Question button clicked.');
        socket.emit('start-question');
        updateHostStatus('Sent "start-question" event.');
    });

    pounceStartBtn.addEventListener('click', () => {
        console.log('Pounce Start button clicked.');
        socket.emit('pounce-start');
        updateHostStatus('Sent "pounce-start" event.');
    });

    bounceStartBtn.addEventListener('click', () => {
        console.log('Bounce Start button clicked.');
        socket.emit('bounce-start');
        updateHostStatus('Sent "bounce-start" event.');
    });
});

function updateHostStatus(message) {
    if (hostStatusDisplay) {
        hostStatusDisplay.textContent = message;
    }
    console.log(`Host Status: ${message}`);
}

function updateCurrentQuizmasterInfo(state) {
    let message = "";
    
    if (state.quizStatus === 'not_started') {
        message = "Quiz Status: Not Started";
    } else if (state.quizStatus === 'finished') {
        message = "Quiz Status: Finished";
    } else if (state.quizStatus === 'active') {
        if (state.currentQuestionIndex === -1) {
            message = "Quiz Status: Active - No Question Yet";
        } else {
            message = `Quiz Status: Active - Question ${state.currentQuestionIndex + 1}`;
            if (state.currentPhase) {
                message += ` - Phase: ${state.currentPhase}`;
            }
        }
    }

    if (currentQuestionInfoDisplay) {
        currentQuestionInfoDisplay.textContent = message;
    }
    console.log(`Quizmaster Info Display: ${message}`);

    // Update button states based on quiz status and phase
    if (startQuizBtn && endQuizBtn && startQuestionBtn && pounceStartBtn && bounceStartBtn) {
        if (state.quizStatus === 'not_started') {
            startQuizBtn.disabled = false;
            endQuizBtn.disabled = true;
            startQuestionBtn.disabled = true;
            pounceStartBtn.disabled = true;
            bounceStartBtn.disabled = true;
        } else if (state.quizStatus === 'active') {
            startQuizBtn.disabled = true;
            endQuizBtn.disabled = false;
            startQuestionBtn.disabled = false;
            
            if (state.currentPhase === 'pounce' || state.currentPhase === 'bounce') {
                pounceStartBtn.disabled = true;
                bounceStartBtn.disabled = true;
            } else {
                pounceStartBtn.disabled = false;
                bounceStartBtn.disabled = false;
            }
        } else if (state.quizStatus === 'finished') {
            startQuizBtn.disabled = false; // Allow restarting
            endQuizBtn.disabled = true;
            startQuestionBtn.disabled = true;
            pounceStartBtn.disabled = true;
            bounceStartBtn.disabled = true;
        }
    }
}

const socket = io();

socket.on('connect', () => {
    console.log('Quizmaster connected to server. Socket ID:', socket.id);
    if (document.readyState === "loading") {
        document.addEventListener('DOMContentLoaded', () => updateHostStatus('Connected to server. Ready to control quiz.'));
    } else {
        updateHostStatus('Connected to server. Ready to control quiz.');
    }
});

socket.on('disconnect', (reason) => {
    console.log(`Quizmaster disconnected from server. Reason: ${reason}`);
    if (document.readyState === "loading") {
        document.addEventListener('DOMContentLoaded', () => updateHostStatus(`Disconnected: ${reason}. Check server.`));
    } else {
        updateHostStatus(`Disconnected: ${reason}. Check server.`);
    }
});

socket.on('quizStateUpdate', (state) => {
    console.log('Quizmaster received quizStateUpdate:', state);
    if (!hostStatusDisplay) {
        document.addEventListener('DOMContentLoaded', () => handleQuizStateUpdateForHost(state));
        return;
    }
    handleQuizStateUpdateForHost(state);
});

function handleQuizStateUpdateForHost(state) {
    if (!state) {
        console.error("Received empty state in handleQuizStateUpdateForHost");
        return;
    }

    updateCurrentQuizmasterInfo(state);
    updateHostStatus(`State updated: Status=${state.quizStatus}, Q=${state.currentQuestionIndex !== undefined ? state.currentQuestionIndex + 1 : 'N/A'}, Phase=${state.currentPhase || 'None'}`);

    // Display Player Scores
    if (playerScoresContainer && state.players) {
        playerScoresContainer.innerHTML = '<h3>Player Scores:</h3>';
        const playersArray = Object.values(state.players);
        if (playersArray.length === 0) {
            playerScoresContainer.innerHTML += '<p>No players have joined yet.</p>';
        } else {
            const ul = document.createElement('ul');
            playersArray.sort((a, b) => b.score - a.score);
            playersArray.forEach(player => {
                const li = document.createElement('li');
                li.textContent = `${player.name}: ${player.score}`;
                ul.appendChild(li);
            });
            playerScoresContainer.appendChild(ul);
        }
    }

    // Handle pounce submissions display
    if (pounceSubmissionsContainer && (state.currentPhase !== 'pounce' || Object.keys(state.pounceAnswers || {}).length === 0)) {
        pounceSubmissionsContainer.innerHTML = '<h3>Pounce Submissions:</h3><p>No pounce answers yet for this question, or pounce phase not active.</p>';
    }
    
    if (pounceSubmissionsContainer && state.currentPhase === 'pounce' && state.pounceAnswers) {
        if (pounceSubmissionsContainer.children.length <= 1 && Object.keys(state.pounceAnswers).length > 0) {
             pounceSubmissionsContainer.innerHTML = '<h3>Pounce Submissions:</h3>';
             for (const playerId in state.pounceAnswers) {
                const player = state.players[playerId];
                const answer = state.pounceAnswers[playerId];
                if (player && answer) {
                    displayPounceAnswer(playerId, player.name, answer, false);
                }
             }
        }
    }
}

socket.on('pounce-answer-received', ({ playerId, playerName, answer }) => {
    if (!pounceSubmissionsContainer) {
        console.error("Pounce submissions container not found!");
        return;
    }
    if (pounceSubmissionsContainer.querySelector('p')) {
        pounceSubmissionsContainer.innerHTML = '<h3>Pounce Submissions:</h3>';
    }

    displayPounceAnswer(playerId, playerName, answer);
});

function displayPounceAnswer(playerId, playerName, answer, alreadyEvaluated = false) {
    const answerDiv = document.createElement('div');
    answerDiv.classList.add('pounce-submission');
    answerDiv.dataset.playerId = playerId;

    const answerText = document.createElement('p');
    answerText.innerHTML = `<strong>${playerName}</strong>: ${answer}`;
    answerDiv.appendChild(answerText);

    const correctButton = document.createElement('button');
    correctButton.textContent = 'Correct';
    correctButton.dataset.playerId = playerId;
    correctButton.classList.add('correct-btn');
    correctButton.disabled = alreadyEvaluated;
    correctButton.onclick = (e) => {
        socket.emit('evaluate-pounce-answer', { playerId: e.target.dataset.playerId, isCorrect: true });
        e.target.disabled = true;
        const incorrectBtn = e.target.parentElement.querySelector('.incorrect-btn');
        if (incorrectBtn) incorrectBtn.disabled = true;
    };

    const incorrectButton = document.createElement('button');
    incorrectButton.textContent = 'Incorrect';
    incorrectButton.dataset.playerId = playerId;
    incorrectButton.classList.add('incorrect-btn');
    incorrectButton.disabled = alreadyEvaluated;
    incorrectButton.onclick = (e) => {
        socket.emit('evaluate-pounce-answer', { playerId: e.target.dataset.playerId, isCorrect: false });
        e.target.disabled = true;
        const correctBtn = e.target.parentElement.querySelector('.correct-btn');
        if (correctBtn) correctBtn.disabled = true;
    };

    answerDiv.appendChild(correctButton);
    answerDiv.appendChild(incorrectButton);
    pounceSubmissionsContainer.appendChild(answerDiv);
}

socket.on('connect_error', (error) => {
    console.error('Quizmaster connection error:', error);
    if (document.readyState === "loading") {
        document.addEventListener('DOMContentLoaded', () => updateHostStatus(`Connection Error: ${error.message}`));
    } else {
        updateHostStatus(`Connection Error: ${error.message}`);
    }
});

console.log('Quizmaster host script loaded.');
