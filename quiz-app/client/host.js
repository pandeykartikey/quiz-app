console.log('Quizmaster host script loading.');

let hostStatusDisplay;
let currentQuestionInfoDisplay;
let startQuestionBtn;
let pounceStartBtn;
let bounceStartBtn;

document.addEventListener('DOMContentLoaded', () => {
    hostStatusDisplay = document.getElementById('host-status-display');
    currentQuestionInfoDisplay = document.getElementById('current-question-info');
    startQuestionBtn = document.getElementById('start-question-btn');
    pounceStartBtn = document.getElementById('pounce-start-btn');
    bounceStartBtn = document.getElementById('bounce-start-btn');

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
    if (state) {
        updateCurrentQuizmasterInfo(state.currentQuestionIndex, state.currentPhase);
        // Add more specific UI updates for the host if needed, e.g., button states
        updateHostStatus(`State updated: Q=${state.currentQuestionIndex + 1}, Phase=${state.currentPhase}`);
    }
}

socket.on('new-question', (data) => {
    console.log('Quizmaster received new-question broadcast:', data);
    if (!hostStatusDisplay) { // Check if DOM is ready
        document.addEventListener('DOMContentLoaded', () => handleNewQuestionForHost(data));
        return;
    }
    handleNewQuestionForHost(data);
});

function handleNewQuestionForHost(data){
     if (data && typeof data.currentQuestionIndex !== 'undefined') {
        updateCurrentQuizmasterInfo(data.currentQuestionIndex, data.phase || 'question');
        updateHostStatus(`New question (Q ${data.currentQuestionIndex + 1}) started. Phase: ${data.phase || 'question'}.`);
    }
}

socket.on('pounce-started', (data) => {
    console.log('Quizmaster received pounce-started broadcast:', data);
     if (!hostStatusDisplay) { // Check if DOM is ready
        document.addEventListener('DOMContentLoaded', () => handlePounceStartedForHost(data));
        return;
    }
    handlePounceStartedForHost(data);
});

function handlePounceStartedForHost(data){
    if (data && data.phase === 'pounce') {
        updateCurrentQuizmasterInfo(null, 'pounce'); // Question index doesn't change here, just phase
        updateHostStatus('Pounce phase has been initiated.');
    }
}

socket.on('bounce-started', (data) => {
    console.log('Quizmaster received bounce-started broadcast:', data);
    if (!hostStatusDisplay) { // Check if DOM is ready
        document.addEventListener('DOMContentLoaded', () => handleBounceStartedForHost(data));
        return;
    }
    handleBounceStartedForHost(data);
});

function handleBounceStartedForHost(data){
     if (data && data.phase === 'bounce') {
        updateCurrentQuizmasterInfo(null, 'bounce'); // Question index doesn't change, just phase
        updateHostStatus('Bounce phase has been initiated.');
    }
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
