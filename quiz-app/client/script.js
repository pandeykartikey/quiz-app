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
      alert(`Player join functionality for ${playerName} (code: ${quizCode}) is not fully implemented yet!`);
    });
  } else {
    console.warn('Player join button not found.');
  }

  // Initial status update for player view (if it were visible)
  if (statusDisplay && quizInterfaceSection && !quizInterfaceSection.classList.contains('hidden')) {
    updateStatus("Initializing client...");
  }
});

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

  // Call this function after player successfully joins
  function initializePlayerSocket() {
    if (socket && !socket.connected) {
      socket.connect();
      console.log('Socket.IO connection initiated for player.');
    }
  }

  // Example: To be called after player clicks "Join Quiz" and server confirms
  // For now, let's connect if the quiz interface is shown (e.g. for testing direct access without login)
  // This is a temporary measure for development. Proper flow would be:
  // 1. User fills join form.
  // 2. Clicks "Join".
  // 3. Client emits "join-request" (or similar) to server with details.
  // 4. Server validates, then replies with "join-success" or "join-failed".
  // 5. On "join-success", client calls initializePlayerSocket(), hides entry, shows quiz interface.

  // TEMPORARY: If quiz interface is visible (e.g. no login screen for testing), connect immediately.
  // This assumes that if quiz-interface-section is visible, we are a player.
  // This is NOT the final logic for joining.
  if (quizInterfaceSection && !quizInterfaceSection.classList.contains('hidden')) {
      console.log("Quiz interface is visible on load, attempting to connect socket for player.");
      initializePlayerSocket();
  }
  // The joinQuizBtn event listener above should call initializePlayerSocket()
  // and then hide entrySection and show quizInterfaceSection upon successful join.


  socket.on('connect', () => {
    console.log('Player connected to server via Socket.IO. Socket ID:', socket.id);
    if (document.readyState === "loading") {
        document.addEventListener('DOMContentLoaded', () => updateStatus('Connected. Waiting for quiz...'));
    } else {
        updateStatus('Connected. Waiting for quiz...');
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
    if (!statusDisplay || !questionDisplay) {
      console.warn('quizStateUpdate: UI elements not ready yet for player.');
      document.addEventListener('DOMContentLoaded', () => handleQuizStateUpdate(state));
      return;
    }
    handleQuizStateUpdate(state);
  });

  function handleQuizStateUpdate(state) {
    if (state) {
      updateQuestionInfo(state.currentQuestionIndex, state.currentPhase);
      if (state.currentPhase === 'pounce') {
        updateStatus('Pounce phase!');
      } else if (state.currentPhase === 'bounce') {
        updateStatus('Bounce phase!');
      } else if (state.currentQuestionIndex === -1) {
        updateStatus('Waiting for quiz to start...');
      } else if (state.currentQuestionIndex > -1 && state.currentPhase !== 'pounce' && state.currentPhase !== 'bounce') {
        updateStatus(`Question ${state.currentQuestionIndex + 1} active.`);
      }
    } else {
      console.error('Player received empty state in quizStateUpdate');
    }
  }

  socket.on('new-question', (data) => {
    console.log('Player received new-question event:', data);
    if (!statusDisplay || !questionDisplay) {
      console.warn('new-question: UI elements not ready yet for player.');
      document.addEventListener('DOMContentLoaded', () => handleNewQuestion(data));
      return;
    }
    handleNewQuestion(data);
  });

  function handleNewQuestion(data) {
    if (data && typeof data.currentQuestionIndex !== 'undefined') {
      updateQuestionInfo(data.currentQuestionIndex, data.phase || 'question');
      updateStatus(`Question ${data.currentQuestionIndex + 1} started.`);
    } else {
      console.error('Player received invalid data for new-question:', data);
    }
  }

  socket.on('pounce-started', (data) => {
    console.log('Player received pounce-started event:', data);
    if (!statusDisplay || !questionDisplay) {
      console.warn('pounce-started: UI elements not ready yet for player.');
      document.addEventListener('DOMContentLoaded', () => handlePounceStarted(data));
      return;
    }
    handlePounceStarted(data);
  });

  function handlePounceStarted(data) {
    if (data && data.phase === 'pounce') {
      updateQuestionInfo(null, data.phase); // Update phase display
      updateStatus('Pounce phase has started! Get ready!');
    } else {
      console.error('Player received invalid data for pounce-started:', data);
    }
  }

  socket.on('bounce-started', (data) => {
    console.log('Player received bounce-started event:', data);
    if (!statusDisplay || !questionDisplay) {
      console.warn('bounce-started: UI elements not ready yet for player.');
      document.addEventListener('DOMContentLoaded', () => handleBounceStarted(data));
      return;
    }
    handleBounceStarted(data);
  });

  function handleBounceStarted(data) {
    if (data && data.phase === 'bounce') {
      updateQuestionInfo(null, data.phase); // Update phase display
      updateStatus('Bounce phase has started! Get ready!');
    } else {
      console.error('Player received invalid data for bounce-started:', data);
    }
  }

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
