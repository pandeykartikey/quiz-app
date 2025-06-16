// Ensure this script is loaded after the Socket.IO library,
// typically by including <script src="/socket.io/socket.io.js"></script> before this file in HTML.

console.log('Client script loading.');

// UI elements are selected once the DOM is loaded
let statusDisplay;
let questionDisplay;

document.addEventListener('DOMContentLoaded', () => {
  statusDisplay = document.getElementById('status-display');
  questionDisplay = document.getElementById('question-display');
  console.log('DOM fully loaded and parsed. UI elements selected.');
  // Initial status update after DOM is ready
  if (statusDisplay && !statusDisplay.textContent) {
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
  // A null questionIndex can be passed if we only want to update phase status
  if (questionIndex !== null && typeof questionIndex !== 'undefined') {
    if (questionIndex === -1) {
      message = "Waiting for quiz to start...";
    } else {
      message = `Question ${questionIndex + 1}`; // Assuming 0-indexed from server
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

// Ensure socket connection and event listeners are set up after DOM is ready,
// or ensure that these functions are defined before the socket attempts to use them.
// The current structure is okay because socket events will only fire after 'connect',
// and 'connect' itself might fire before DOMContentLoaded.
// However, UI updates within these event handlers need `statusDisplay` and `questionDisplay` to be available.

// It's safer to initialize socket and its listeners within DOMContentLoaded,
// or ensure all UI update functions check for element existence.
// The current approach of global selection and then use in functions is fine,
// as long as script.js is loaded at the end of <body>.

try {
  const socket = io(); // Connects to the server host by default

  socket.on('connect', () => {
    console.log('Connected to server via Socket.IO. Socket ID:', socket.id);
    // Ensure DOM is loaded before trying to update
    if (document.readyState === "loading") {
        document.addEventListener('DOMContentLoaded', () => updateStatus('Connected to server. Waiting for quiz to start...'));
    } else {
        updateStatus('Connected to server. Waiting for quiz to start...');
    }
  });

  socket.on('disconnect', (reason) => {
    console.log(`Disconnected from server. Reason: ${reason}`);
    // Ensure DOM is loaded
    if (document.readyState === "loading") {
        document.addEventListener('DOMContentLoaded', () => updateStatus('Disconnected from server.'));
    } else {
        updateStatus('Disconnected from server.');
    }
  });

  // Listener for initial state and subsequent broad state updates
  socket.on('quizStateUpdate', (state) => {
    console.log('Received quizStateUpdate:', state);
    if (!statusDisplay || !questionDisplay) {
      console.warn('quizStateUpdate: UI elements not ready yet.');
      document.addEventListener('DOMContentLoaded', () => handleQuizStateUpdate(state));
      return;
    }
    handleQuizStateUpdate(state);
  });

  function handleQuizStateUpdate(state) {
    if (state) {
      updateQuestionInfo(state.currentQuestionIndex, state.currentPhase);
      if (state.currentPhase === 'pounce') {
        updateStatus('Pounce phase has started!');
      } else if (state.currentPhase === 'bounce') {
        updateStatus('Bounce phase has started!');
      } else if (state.currentQuestionIndex === -1) {
        updateStatus('Waiting for quiz to start...');
      } else if (state.currentQuestionIndex > -1) {
        updateStatus(`Question ${state.currentQuestionIndex + 1} is active.`);
      }
    } else {
      console.error('Received empty state in quizStateUpdate');
    }
  }

  // Listener for when a new question is started by the Quizmaster
  socket.on('new-question', (data) => {
    console.log('Received new-question event:', data);
    if (!statusDisplay || !questionDisplay) {
      console.warn('new-question: UI elements not ready yet.');
      document.addEventListener('DOMContentLoaded', () => handleNewQuestion(data));
      return;
    }
    handleNewQuestion(data);
  });

  function handleNewQuestion(data) {
    if (data && typeof data.currentQuestionIndex !== 'undefined') {
      updateQuestionInfo(data.currentQuestionIndex, data.phase || 'question');
      updateStatus(`Question ${data.currentQuestionIndex + 1} has started.`);
    } else {
      console.error('Invalid data received for new-question:', data);
    }
  }

  // Listener for when the pounce phase starts
  socket.on('pounce-started', (data) => {
    console.log('Received pounce-started event:', data);
    if (!statusDisplay || !questionDisplay) {
      console.warn('pounce-started: UI elements not ready yet.');
      document.addEventListener('DOMContentLoaded', () => handlePounceStarted(data));
      return;
    }
    handlePounceStarted(data);
  });

  function handlePounceStarted(data) {
    if (data && data.phase === 'pounce') {
      updateQuestionInfo(null, data.phase);
      updateStatus('Pounce phase has started! Get ready to buzz!');
    } else {
      console.error('Invalid data received for pounce-started:', data);
    }
  }

  // Listener for when the bounce phase starts
  socket.on('bounce-started', (data) => {
    console.log('Received bounce-started event:', data);
    if (!statusDisplay || !questionDisplay) {
      console.warn('bounce-started: UI elements not ready yet.');
      document.addEventListener('DOMContentLoaded', () => handleBounceStarted(data));
      return;
    }
    handleBounceStarted(data);
  });

  function handleBounceStarted(data) {
    if (data && data.phase === 'bounce') {
      updateQuestionInfo(null, data.phase);
      updateStatus('Bounce phase has started! Get ready for the bounce!');
    } else {
      console.error('Invalid data received for bounce-started:', data);
    }
  }

  // Example: Emitting an event (e.g., player action) - to be used later
  // function sendPlayerAction(action, payload) {
  //   socket.emit(action, payload);
  //   console.log(`Sent action: ${action}`, payload);
  // }
  // setTimeout(() => sendPlayerAction('player-buzz', { questionId: 1 }), 5000); // Example

} catch (error) {
  console.error("Socket.IO connection error:", error);
  updateStatus("Failed to connect to the server. Please ensure the server is running and accessible.");
}

console.log('Client script loaded and event listeners should be active if connected.');
