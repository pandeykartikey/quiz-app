console.log('Quizmaster host script loading.');

let hostStatusDisplay;
let currentQuestionInfoDisplay;
let startQuestionBtn;
let pounceStartBtn;
let bounceStartBtn;
let pounceSubmissionsContainer; // For displaying pounce answers
let playerScoresContainer;    // For displaying player scores/leaderboard

document.addEventListener('DOMContentLoaded', () => {
    hostStatusDisplay = document.getElementById('host-status-display');
    currentQuestionInfoDisplay = document.getElementById('current-question-info');
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

    startQuestionBtn.addEventListener('click', () => {
        console.log('Start Question button clicked.');
        socket.emit('start-question');
        updateHostStatus('Sent "start-question" event.');
        // Disable button temporarily to prevent double clicks?
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

function updateCurrentQuizmasterInfo(questionIndex, phase) {
    let message = "";
    if (questionIndex === -1 || typeof questionIndex === 'undefined') {
        message = "Question: Not Started";
    } else {
        message = `Question: ${questionIndex + 1}`;
    }
    message += ` - Phase: ${phase || 'N/A'}`;

    if (currentQuestionInfoDisplay) {
        currentQuestionInfoDisplay.textContent = message;
    }
    console.log(`Quizmaster Info Display: ${message}`);

    // Potentially enable/disable buttons based on phase
    if (pounceStartBtn && bounceStartBtn && startQuestionBtn) {
        if (phase === 'pounce' || phase === 'bounce') {
            pounceStartBtn.disabled = true;
            bounceStartBtn.disabled = true;
            // startQuestionBtn.disabled = true; // Or allow to end current question phase?
        } else { // Default 'question' phase or null
            pounceStartBtn.disabled = false;
            bounceStartBtn.disabled = false;
            // startQuestionBtn.disabled = false;
        }
    }
}


const socket = io();

socket.on('connect', () => {
    console.log('Quizmaster connected to server. Socket ID:', socket.id);
    // Ensure DOM is loaded before trying to update
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

// Listen for state updates to update Quizmaster's own view
socket.on('quizStateUpdate', (state) => {
    console.log('Quizmaster received quizStateUpdate:', state);
    if (!hostStatusDisplay) { // Check if DOM is ready
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

    updateCurrentQuizmasterInfo(state.currentQuestionIndex, state.currentPhase);
    updateHostStatus(`State updated: Q=${state.currentQuestionIndex !== undefined ? state.currentQuestionIndex + 1 : 'N/A'}, Phase=${state.currentPhase}`);

    // Display Player Scores
    if (playerScoresContainer && state.players) {
        playerScoresContainer.innerHTML = '<h3>Player Scores:</h3>';
        const playersArray = Object.values(state.players);
        if (playersArray.length === 0) {
            playerScoresContainer.innerHTML += '<p>No players have joined yet.</p>';
        } else {
            const ul = document.createElement('ul');
            playersArray.sort((a, b) => b.score - a.score); // Sort by score descending
            playersArray.forEach(player => {
                const li = document.createElement('li');
                li.textContent = `${player.name}: ${player.score}`;
                ul.appendChild(li);
            });
            playerScoresContainer.appendChild(ul);
        }
    }

    // Clear pounce submissions if the phase is no longer 'pounce' or if pounceAnswers is empty
    // (e.g., new question started, or pounce phase ended by QM)
    if (pounceSubmissionsContainer && (state.currentPhase !== 'pounce' || Object.keys(state.pounceAnswers || {}).length === 0)) {
        pounceSubmissionsContainer.innerHTML = '<h3>Pounce Submissions:</h3><p>No pounce answers yet for this question, or pounce phase not active.</p>';
    }
    // If it IS the pounce phase, we expect 'pounce-answer-received' to populate it,
    // or if pounceAnswers were already there on a QM refresh, they could be populated here.
    // For simplicity, we'll primarily rely on 'pounce-answer-received' for live updates.
    // However, if state.pounceAnswers is populated and phase is pounce, could render them here.
    // This might be useful if QM refreshes during pounce.
    if (pounceSubmissionsContainer && state.currentPhase === 'pounce' && state.pounceAnswers) {
        // If container is empty (or just has the placeholder), and there are answers in state
        if (pounceSubmissionsContainer.children.length <= 1 && Object.keys(state.pounceAnswers).length > 0) {
             pounceSubmissionsContainer.innerHTML = '<h3>Pounce Submissions:</h3>'; // Clear placeholder
             for (const playerId in state.pounceAnswers) {
                const player = state.players[playerId];
                const answer = state.pounceAnswers[playerId];
                if (player && answer) {
                    // Re-use display logic, ensure buttons are re-created if needed or handled.
                    // This part could be complex if answers were already evaluated.
                    // For now, we assume pounceAnswers in state are those not yet evaluated or QM needs to see them.
                    // Simplified: just show them, evaluation state might need more robust handling for refresh.
                    // displayPounceAnswer(playerId, player.name, answer, false); // false for 'alreadyEvaluated'
                }
             }
        }
    }
}

// Removed old specific handlers: handleNewQuestionForHost, handlePounceStartedForHost, handleBounceStartedForHost
// Their logic is now intended to be covered by handleQuizStateUpdateForHost

socket.on('pounce-answer-received', ({ playerId, playerName, answer }) => {
    if (!pounceSubmissionsContainer) {
        console.error("Pounce submissions container not found!");
        return;
    }
    // If it's the first pounce answer, clear the placeholder message
    if (pounceSubmissionsContainer.querySelector('p')) {
        pounceSubmissionsContainer.innerHTML = '<h3>Pounce Submissions:</h3>';
    }

    displayPounceAnswer(playerId, playerName, answer);
});

function displayPounceAnswer(playerId, playerName, answer, alreadyEvaluated = false) {
    const answerDiv = document.createElement('div');
    answerDiv.classList.add('pounce-submission');
    answerDiv.dataset.playerId = playerId; // Keep track of which player this div is for

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
        // Disable buttons after click
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
        // Disable buttons after click
        e.target.disabled = true;
        const correctBtn = e.target.parentElement.querySelector('.correct-btn');
        if (correctBtn) correctBtn.disabled = true;
    };

    answerDiv.appendChild(correctButton);
    answerDiv.appendChild(incorrectButton);
    pounceSubmissionsContainer.appendChild(answerDiv);
}


// Error handling for socket connection
socket.on('connect_error', (error) => {
    console.error('Quizmaster connection error:', error);
    if (document.readyState === "loading") {
        document.addEventListener('DOMContentLoaded', () => updateHostStatus(`Connection Error: ${error.message}`));
    } else {
        updateHostStatus(`Connection Error: ${error.message}`);
    }
});

console.log('Quizmaster host script loaded.');
