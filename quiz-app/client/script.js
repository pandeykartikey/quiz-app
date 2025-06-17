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
      const playerName = playerNameInput.value.trim();
      const quizCode = quizCodeInput.value.trim();
      if (playerErrorDiv) playerErrorDiv.textContent = '';

      if (!playerName) {
        if (playerErrorDiv) playerErrorDiv.textContent = 'Please enter your name.';
        return;
      }

      console.log(`Player ${playerName} attempting to join quiz with code ${quizCode || 'any'}.`);

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

  console.log('Player clicked pounce button');
  
  pounceButton.disabled = true;
  pounceButton.textContent = "Pounced!";
  clearPounceTimers(); // Clear the initial pounce decision timer

  // Show the answer input section
  pounceAnswerSection.classList.remove('hidden');
  if(pounceAnswerInput) {
    pounceAnswerInput.focus();
    pounceAnswerInput.value = ''; // Clear any previous input
  }
  if(pounceTimerDisplay) pounceTimerDisplay.textContent = "Time to answer: 15s";

  let answerTimeRemaining = 15; // 15 seconds for answering
  pounceAnswerTimer = setInterval(() => {
    answerTimeRemaining--;
    if(pounceTimerDisplay) pounceTimerDisplay.textContent = `Time to answer: ${answerTimeRemaining}s`;
    if (answerTimeRemaining <= 0) {
      clearPounceTimers();
      if(pounceTimerDisplay) pounceTimerDisplay.textContent = "Time's up!";
      pounceAnswerSection.classList.add('hidden');
      pounceButton.classList.add('hidden'); // Hide the pounce button completely
      updateStatus('Pounce answer time expired');
    }
  }, 1000);
}

function handleSubmitPounceAnswer() {
  if (!pounceAnswerInput || !pounceAnswerSection) return;

  const answer = pounceAnswerInput.value.trim();
  if (!answer) {
    updateStatus('Please enter an answer before submitting');
    return;
  }

  console.log('Submitting pounce answer:', answer);
  socket.emit('submit-pounce-answer', { answer });
  pounceAnswerInput.value = ''; // Clear input
  pounceAnswerSection.classList.add('hidden');
  clearPounceTimers();
  if(pounceTimerDisplay) pounceTimerDisplay.textContent = "Answer submitted!";
  pounceButton.classList.add('hidden'); // Hide pounce button after submission
  updateStatus('Pounce answer submitted, waiting for evaluation...');
}

function updateStatus(message) {
  if (statusDisplay) {
    statusDisplay.textContent = message;
  }
  console.log(`Status Update: ${message}`);
}

function updateQuestionInfo(state) {
  let message = "";
  
  if (state.quizStatus === 'not_started') {
    message = "Quiz hasn't started yet...";
  } else if (state.quizStatus === 'finished') {
    message = "Quiz has finished!";
  } else if (state.quizStatus === 'active') {
    if (state.currentQuestionIndex === -1) {
      message = "Quiz is active - waiting for first question...";
    } else {
      const questionNumber = state.currentQuestionIndex + 1;
      const totalQuestions = state.totalQuestions || '?';
      
      if (state.currentQuestion && state.currentQuestion.question) {
        message = `Question ${questionNumber}/${totalQuestions}: ${state.currentQuestion.question}`;
      } else {
        message = `Question ${questionNumber}/${totalQuestions}`;
      }
      
      if (state.currentPhase) {
        message += ` - ${state.currentPhase.charAt(0).toUpperCase() + state.currentPhase.slice(1)} Phase`;
      }
    }
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

    updateQuestionInfo(state);

    // Update score display
    if (playerScoreDisplay && state.players && currentPlayerId && state.players[currentPlayerId]) {
      playerScoreDisplay.textContent = `Score: ${state.players[currentPlayerId].score}`;
    } else if (playerScoreDisplay) {
      playerScoreDisplay.textContent = "Score: 0";
    }

    // Get pounce section container
    const pounceSection = document.getElementById('pounce-section');

    // Pounce UI logic
    clearPounceTimers(); // Clear any existing pounce timers

    if (state.quizStatus === 'active' && state.currentPhase === 'pounce') {
      updateStatus('Pounce phase! Click "Pounce" to answer.');
      
      // Show the entire pounce section
      if (pounceSection) pounceSection.classList.remove('hidden');
      
      if (pounceButton) {
        pounceButton.classList.remove('hidden');
        pounceButton.disabled = false;
        pounceButton.textContent = 'Pounce!'; // Reset button text
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
      // Hide the entire pounce section
      if (pounceSection) pounceSection.classList.add('hidden');
      if (pounceButton) pounceButton.classList.add('hidden');
      if (pounceAnswerSection) pounceAnswerSection.classList.add('hidden');
      if (pounceTimerDisplay) pounceTimerDisplay.classList.add('hidden');

      // General status updates based on quiz status and phase
      if (state.quizStatus === 'not_started') {
        updateStatus('Waiting for quiz to start...');
      } else if (state.quizStatus === 'finished') {
        updateStatus('Quiz has finished! Final scores displayed above.');
      } else if (state.quizStatus === 'active') {
        if (state.currentQuestionIndex === -1) {
          updateStatus('Quiz is active. Waiting for first question...');
        } else if (state.currentPhase === 'bounce') {
          updateStatus('Bounce phase!');
        } else if (state.currentPhase === 'answer') {
          updateStatus('Answer reveal phase.');
        } else if (state.currentPhase === 'question' || !state.currentPhase) {
          updateStatus(`Question ${state.currentQuestionIndex + 1} is active.`);
        }
      }
    }
  }

  socket.on('pounce-submission-ack', ({ success, message }) => {
    if (success) {
      updateStatus('Pounce answer submitted successfully!');
    } else {
      updateStatus(`Failed to submit pounce answer: ${message || 'Unknown error'}`);
    }
  });

  socket.on('question-started', (questionData) => {
    console.log('New question started:', questionData);
    if (questionData.question) {
      // Update question display with the new question
      if (questionDisplay) {
        const questionNumber = questionData.questionNumber || '?';
        const totalQuestions = questionData.totalQuestions || '?';
        questionDisplay.textContent = `Question ${questionNumber}/${totalQuestions}: ${questionData.question}`;
      }
    }
  });

  socket.on('pounce-answer-evaluated', ({ isCorrect, pointsAwarded, newScore }) => {
    if (isCorrect) {
      updateStatus(`Correct! You earned ${pointsAwarded} points. New score: ${newScore}`);
    } else {
      updateStatus(`Incorrect. You lost ${Math.abs(pointsAwarded)} points. New score: ${newScore}`);
    }
    
    // Update score display immediately
    if (playerScoreDisplay) {
      playerScoreDisplay.textContent = `Score: ${newScore}`;
    }
  });

  socket.on('pounce-phase-ended', ({ reason }) => {
    console.log('Pounce phase ended:', reason);
    clearPounceTimers();
    
    // Hide all pounce UI elements
    if (pounceButton) {
      pounceButton.classList.add('hidden');
      pounceButton.disabled = true;
    }
    if (pounceAnswerSection) pounceAnswerSection.classList.add('hidden');
    if (pounceTimerDisplay) {
      pounceTimerDisplay.classList.add('hidden');
      pounceTimerDisplay.textContent = '';
    }
    
    if (reason === 'timer-expired') {
      updateStatus('Pounce phase ended - time expired');
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
