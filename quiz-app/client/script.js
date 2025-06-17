// Ensure this script is loaded after the Socket.IO library,
// typically by including <script src="/socket.io/socket.io.js"></script> before this file in HTML.

console.log('Client script loading.');

const QUIZMASTER_CODE = "QM_SECRET"; // Hardcoded Quizmaster code

// UI elements are selected once the DOM is loaded
let statusDisplay;
let questionDisplay;
let quizmasterCodeInput;
let quizmasterLoginBtn;
let quizmasterErrorDiv;
let playerNameInput;
let quizCodeInput;
let joinQuizBtn;
let playerErrorDiv;
let entrySection;
let quizInterfaceSection;
let playerScoreDisplay; // For displaying player's score

// Pounce UI elements
let pounceButton;
let pounceAnswerSection;
let pounceAnswerInput;
let submitPounceAnswerBtn;
let pounceTimerDisplay;

// Player state
let currentPlayerId = null;
let pounceDecisionTimer = null;
let pounceAnswerTimer = null;

document.addEventListener('DOMContentLoaded', () => {
  // Quizmaster login elements
  quizmasterCodeInput = document.getElementById('quizmaster-code');
  quizmasterLoginBtn = document.getElementById('quizmaster-login-btn');
  quizmasterErrorDiv = document.getElementById('quizmaster-error');

  // Player join elements
  playerNameInput = document.getElementById('player-name');
  quizCodeInput = document.getElementById('quiz-code');
  joinQuizBtn = document.getElementById('join-quiz-btn');
  playerErrorDiv = document.getElementById('player-error');

  // Main sections
  entrySection = document.getElementById('entry-section');
  quizInterfaceSection = document.getElementById('quiz-interface-section');

  // Quiz interface display elements (player view)
  statusDisplay = document.getElementById('status-display');
  questionDisplay = document.getElementById('question-display');
  playerScoreDisplay = document.getElementById('player-score-display');

  // Pounce UI elements
  pounceButton = document.getElementById('pounce-btn');
  pounceAnswerSection = document.getElementById('pounce-answer-section');
  pounceAnswerInput = document.getElementById('pounce-answer-input');
  submitPounceAnswerBtn = document.getElementById('submit-pounce-answer-btn');
  pounceTimerDisplay = document.getElementById('pounce-timer-display');

  console.log('DOM fully loaded and parsed. UI elements selected.');

  // Initial UI state: entry section visible, quiz interface hidden.
  // This is already handled by HTML class 'hidden' on quiz-interface-section.
  // if (entrySection) entrySection.classList.remove('hidden'); // Should be visible by default
  // if (quizInterfaceSection) quizInterfaceSection.classList.add('hidden');


  if (quizmasterLoginBtn) {
    quizmasterLoginBtn.addEventListener('click', () => {
      const enteredCode = quizmasterCodeInput.value.trim();
      if (enteredCode === QUIZMASTER_CODE) {
        if (quizmasterErrorDiv) quizmasterErrorDiv.textContent = '';
        console.log('Quizmaster login successful. Redirecting to /host');
        window.location.href = '/host';
      } else {
        if (quizmasterErrorDiv) quizmasterErrorDiv.textContent = 'Invalid Quizmaster Code.';
        console.log('Quizmaster login failed.');
      }
    });
  } else {
    console.warn('Quizmaster login button not found.');
  }

  if (joinQuizBtn) {
    joinQuizBtn.addEventListener('click', () => {
      // Placeholder for player join logic
      const playerName = playerNameInput.value.trim();
      const quizCode = quizCodeInput.value.trim();
      if (playerErrorDiv) playerErrorDiv.textContent = '';

      if (!playerName) {
        if (playerErrorDiv) playerErrorDiv.textContent = 'Please enter your name.';
        return;
      }

      console.log(`Player ${playerName} attempting to join quiz with code ${quizCode || 'any'}.`);
      // TODO: Implement actual join logic:
      // 1. Emit 'join-quiz' to server with playerName and quizCode.
      // 2. On success from server:
      //    entrySection.classList.add('hidden');
      //    quizInterfaceSection.classList.remove('hidden');
      //    initializePlayerSocket(); // Connect socket or confirm connection
      //    updateStatus(`Joined quiz as ${playerName}. Waiting for question...`);
      // 3. On failure:
      //    playerErrorDiv.textContent = "Failed to join quiz (e.g., invalid code, name taken)";
      // alert(`Player join functionality for ${playerName} (code: ${quizCode}) is not fully implemented yet!`);

      // Connect socket and then emit join-quiz
      if (socket && !socket.connected) {
        socket.once('connect', () => {
          console.log('Socket connected, emitting join-quiz.');
          socket.emit('join-quiz', playerName); // Sending only playerName as per new spec
        });
        initializePlayerSocket(); // This calls socket.connect()
      } else if (socket && socket.connected) {
        console.log('Socket already connected, emitting join-quiz.');
        socket.emit('join-quiz', playerName);
      }
    });
  } else {
    console.warn('Player join button not found.');
  }

  if (pounceButton) {
    pounceButton.addEventListener('click', handlePounceButtonClick);
  }

  if (submitPounceAnswerBtn) {
    submitPounceAnswerBtn.addEventListener('click', handleSubmitPounceAnswer);
  }

  // Initial status update for player view (if it were visible)
  if (statusDisplay && quizInterfaceSection && !quizInterfaceSection.classList.contains('hidden')) {
    updateStatus("Initializing client...");
  }
});

function clearPounceTimers() {
  if (pounceDecisionTimer) {
    clearTimeout(pounceDecisionTimer);
    pounceDecisionTimer = null;
  }
  if (pounceAnswerTimer) {
    clearTimeout(pounceAnswerTimer);
    pounceAnswerTimer = null;
  }
}

function handlePounceButtonClick() {
  if (!pounceButton || !pounceAnswerSection || !pounceTimerDisplay) return;

  pounceButton.disabled = true;
  pounceButton.classList.add('hidden'); // Or change text: pounceButton.textContent = "Pounced!";
  clearPounceTimers(); // Clear the initial pounce decision timer

  pounceAnswerSection.classList.remove('hidden');
  if(pounceAnswerInput) pounceAnswerInput.focus();
  if(pounceTimerDisplay) pounceTimerDisplay.textContent = "Time to answer: 15s"; // Example

  let answerTimeRemaining = 15; // 15 seconds for answering
  pounceAnswerTimer = setInterval(() => {
    answerTimeRemaining--;
    if(pounceTimerDisplay) pounceTimerDisplay.textContent = `Time to answer: ${answerTimeRemaining}s`;
    if (answerTimeRemaining <= 0) {
      clearPounceTimers();
      if(pounceTimerDisplay) pounceTimerDisplay.textContent = "Time's up!";
      pounceAnswerSection.classList.add('hidden');
      if(pounceButton && !pounceButton.classList.contains('hidden')) { // If pounce button was re-shown by mistake
          pounceButton.classList.add('hidden');
      }
    }
  }, 1000);
}

function handleSubmitPounceAnswer() {
  if (!pounceAnswerInput || !pounceAnswerSection) return;

  const answer = pounceAnswerInput.value.trim();
  if (answer) {
    socket.emit('submit-pounce-answer', { answer });
    pounceAnswerInput.value = ''; // Clear input
  }
  pounceAnswerSection.classList.add('hidden');
  clearPounceTimers();
  if(pounceTimerDisplay) pounceTimerDisplay.textContent = ""; // Clear timer display
  if(pounceButton && !pounceButton.classList.contains('hidden')) { // Hide pounce button if it wasn't already
      pounceButton.classList.add('hidden');
  }
}


function updateStatus(message) {
  if (statusDisplay) {
    statusDisplay.textContent = message;
  }
  console.log(`Status Update: ${message}`);
}

function updateQuestionInfo(questionIndex, phase) {
  let message = "";
  if (questionIndex !== null && typeof questionIndex !== 'undefined') {
    if (questionIndex === -1) {
      message = "Waiting for quiz to start...";
    } else {
      message = `Question ${questionIndex + 1}`;
    }
  }
  if (phase) {
    message += `${message ? ' - ' : ''}Phase: ${phase}`;
  }
  if (questionDisplay) {
    questionDisplay.textContent = message;
  }
  console.log(`Question Info: ${message}`);
}

// Socket.IO connection - currently connects on page load.
// This might be deferred until after player successfully joins.
let socket;
try {
  socket = io({ autoConnect: false }); // Prevent auto-connection
  console.log('Socket.IO client initialized but not auto-connecting.');

  // Call this function after player clicks "Join Quiz"
  function initializePlayerSocket() {
    if (socket && !socket.connected) {
      socket.connect(); // Manually connect
      console.log('Socket.IO connection initiated for player.');
    }
  }

  socket.on('connect', () => {
    console.log('Player connected to server via Socket.IO. Socket ID:', socket.id);
    // Note: 'join-quiz' is emitted after connection in the joinQuizBtn listener
    if (document.readyState === "loading") {
        document.addEventListener('DOMContentLoaded', () => updateStatus('Connected. Ready to join...'));
    } else {
        updateStatus('Connected. Ready to join...');
    }
  });

  socket.on('join-success', (data) => {
    console.log('Successfully joined quiz:', data);
    currentPlayerId = data.playerId;
    if (entrySection) entrySection.classList.add('hidden');
    if (quizInterfaceSection) quizInterfaceSection.classList.remove('hidden');
    handleQuizStateUpdate(data.quizState); // Initial state update
  });

  socket.on('join-failed', (message) => {
    console.error('Failed to join quiz:', message);
    if (playerErrorDiv) playerErrorDiv.textContent = message;
    // Ensure socket is disconnected if join fails and we initiated a connect
    if (socket && socket.connected) {
        socket.disconnect();
    }
  });

  socket.on('disconnect', (reason) => {
    console.log(`Player disconnected from server. Reason: ${reason}`);
    if (document.readyState === "loading") {
        document.addEventListener('DOMContentLoaded', () => updateStatus('Disconnected.'));
    } else {
        updateStatus('Disconnected.');
    }
  });

  socket.on('quizStateUpdate', (state) => {
    console.log('Player received quizStateUpdate:', state);
    // DOM elements might not be ready if this is the first state update after join-success
    // Deferring with a microtask or ensuring DOMContentLoaded has run for all queried elements.
    if (!statusDisplay || !questionDisplay || !pounceButton || !pounceAnswerSection || !pounceTimerDisplay || !playerScoreDisplay) {
      console.warn('quizStateUpdate: UI elements not fully ready. Retrying once DOM is loaded.');
      document.addEventListener('DOMContentLoaded', () => handleQuizStateUpdate(state));
      return;
    }
    handleQuizStateUpdate(state);
  });

  function handleQuizStateUpdate(state) {
    if (!state) {
      console.error('Player received empty state in quizStateUpdate');
      return;
    }

    updateQuestionInfo(state.currentQuestionIndex, state.currentPhase);

    // Update score display
    if (playerScoreDisplay && state.players && currentPlayerId && state.players[currentPlayerId]) {
      playerScoreDisplay.textContent = `Score: ${state.players[currentPlayerId].score}`;
    } else if (playerScoreDisplay) {
      playerScoreDisplay.textContent = "Score: N/A";
    }

    // Pounce UI logic
    clearPounceTimers(); // Clear any existing pounce timers

    if (state.currentPhase === 'pounce') {
      updateStatus('Pounce phase! Click "Pounce" to answer.');
      if (pounceButton) {
        pounceButton.classList.remove('hidden');
        pounceButton.disabled = false;
      }
      if (pounceAnswerSection) pounceAnswerSection.classList.add('hidden'); // Hide answer input initially
      if (pounceTimerDisplay) {
        pounceTimerDisplay.classList.remove('hidden');
        pounceTimerDisplay.textContent = "Pounce open for: 10s"; // Example
      }

      let pounceTimeRemaining = 10; // 10 seconds to click "Pounce"
      pounceDecisionTimer = setInterval(() => {
        pounceTimeRemaining--;
        if(pounceTimerDisplay) pounceTimerDisplay.textContent = `Pounce open for: ${pounceTimeRemaining}s`;
        if (pounceTimeRemaining <= 0) {
          clearPounceTimers();
          if(pounceTimerDisplay) pounceTimerDisplay.textContent = "Pounce closed.";
          if(pounceButton) {
            pounceButton.classList.add('hidden');
            pounceButton.disabled = true;
          }
        }
      }, 1000);

    } else { // Not pounce phase
      if (pounceButton) pounceButton.classList.add('hidden');
      if (pounceAnswerSection) pounceAnswerSection.classList.add('hidden');
      if (pounceTimerDisplay) pounceTimerDisplay.classList.add('hidden');

      // General status updates based on phase
      if (state.currentQuestionIndex === -1) {
        updateStatus('Waiting for quiz to start...');
      } else if (state.currentPhase === 'bounce') {
        updateStatus('Bounce phase!');
      } else if (state.currentPhase === 'answer') {
         updateStatus('Answer reveal phase.');
      } else if (state.currentPhase === 'question' || !state.currentPhase ) { // question or undefined phase after question start
        updateStatus(`Question ${state.currentQuestionIndex + 1} active.`);
      } else if (state.currentPhase === 'finished') {
        updateStatus('Quiz has finished!');
      }
    }
  }

  // Remove specific handlers if quizStateUpdate covers them fully
  // socket.on('new-question', ...) - Covered by quizStateUpdate
  // socket.on('pounce-started', ...) - Covered by quizStateUpdate
  // socket.on('bounce-started', ...) - Covered by quizStateUpdate

  socket.on('pounce-submission-ack', ({ success }) => {
    if (success) {
      updateStatus('Pounce answer submitted successfully!');
      // Optionally, provide more visual feedback
    } else {
      updateStatus('Failed to submit pounce answer.');
      // Optionally, allow retry or show error
    }
  });


} catch (error) {
  console.error("Player Socket.IO connection error:", error);
  // This updateStatus might not work if DOM is not ready or statusDisplay is null
  if (statusDisplay) {
    updateStatus("Failed to connect to the quiz server.");
  } else {
    document.addEventListener('DOMContentLoaded', () => {
        statusDisplay = document.getElementById('status-display'); // Try to get it again
        if(statusDisplay) updateStatus("Failed to connect to the quiz server.");
    });
  }
}

console.log('Client script loaded. Event listeners for login/join configured.');
