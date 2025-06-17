const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path'); // Added for serving client files
const fs = require('fs'); // Added for reading questions.json

const {
  quizState,
  incrementQuestion,
  setPhase,
  getQuizState,
  addPlayer,
  updateScore,
  recordPounceAnswer,
  clearPounceAnswers,
  startQuiz,
  endQuiz,
} = require('./state');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

// Timer management for pounce phase
let pouncePhaseTimer = null;

// Load questions from questions.json
let questions = [];
try {
  const questionsData = fs.readFileSync(path.join(__dirname, 'questions.json'), 'utf8');
  questions = JSON.parse(questionsData);
  console.log(`Loaded ${questions.length} questions from questions.json`);
} catch (error) {
  console.error('Error loading questions.json:', error);
  questions = []; // Fallback to empty array
}

// Helper function to get current question
function getCurrentQuestion() {
  const state = getQuizState();
  if (state.currentQuestionIndex >= 0 && state.currentQuestionIndex < questions.length) {
    return questions[state.currentQuestionIndex];
  }
  return null;
}

// Helper function to build enhanced state with current question
function getEnhancedQuizState() {
  const state = getQuizState();
  const currentQuestion = getCurrentQuestion();
  
  return {
    ...state,
    currentQuestion: currentQuestion ? {
      id: currentQuestion.id,
      question: currentQuestion.question,
      // Don't send the answer to clients for security
    } : null,
    totalQuestions: questions.length
  };
}

// Helper function to clear pounce timer
function clearPounceTimer() {
  if (pouncePhaseTimer) {
    clearTimeout(pouncePhaseTimer);
    pouncePhaseTimer = null;
  }
}

// Helper function to auto-end pounce phase
function autoEndPouncePhase() {
  console.log('Pounce phase auto-ended after timer expiry');
  setPhase('question'); // Reset to question phase
  const updatedState = getEnhancedQuizState();
  io.emit('quizStateUpdate', updatedState);
  io.emit('pounce-phase-ended', { reason: 'timer-expired' });
}

// Serve static files (like script.js, host.js, style.css) from the '../client' directory
app.use(express.static(path.join(__dirname, '../client')));

// Route for the player view
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

// Route for the Quizmaster view
app.get('/host', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/host.html'));
});

io.on('connection', (socket) => {
  console.log(`New client connected: ${socket.id}`);

  // Send current quiz state to newly connected client
  socket.emit('quizStateUpdate', getEnhancedQuizState());

  socket.on('join-quiz', (playerName) => {
    addPlayer(socket.id, playerName);
    const updatedState = getEnhancedQuizState();
    socket.emit('join-success', { playerId: socket.id, quizState: updatedState });
    io.emit('quizStateUpdate', updatedState);
    console.log(`Player ${playerName} (ID: ${socket.id}) joined the quiz.`);
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
    // Future enhancement: remove player from quizState.players if they disconnect
    // delete quizState.players[socket.id];
    // io.emit('quizStateUpdate', getEnhancedQuizState()); // Notify others
  });

  // Quizmaster action handlers
  socket.on('start-quiz', () => {
    clearPounceTimer(); // Clear any existing timers
    startQuiz();
    const updatedState = getEnhancedQuizState();
    console.log('Quizmaster started the quiz.');
    io.emit('quizStateUpdate', updatedState);
  });

  socket.on('end-quiz', () => {
    clearPounceTimer(); // Clear any existing timers
    endQuiz();
    const updatedState = getEnhancedQuizState();
    console.log('Quizmaster ended the quiz.');
    io.emit('quizStateUpdate', updatedState);
  });

  socket.on('start-question', () => {
    const currentState = getQuizState();
    if (currentState.quizStatus !== 'active') {
      console.log('Cannot start question: Quiz is not active');
      return;
    }
    
    // Check if there are more questions available
    if (currentState.currentQuestionIndex + 1 >= questions.length) {
      console.log('Cannot start question: No more questions available');
      // Could automatically end the quiz here
      clearPounceTimer(); // Clear any existing timers
      endQuiz();
      const updatedState = getEnhancedQuizState();
      console.log('Quiz ended automatically - no more questions');
      io.emit('quizStateUpdate', updatedState);
      return;
    }
    
    clearPounceTimer(); // Clear any existing timers when starting new question
    incrementQuestion();
    clearPounceAnswers(); // Clear pounce answers for the new question
    const updatedState = getEnhancedQuizState();
    const currentQuestion = getCurrentQuestion();
    
    console.log(`Quizmaster started question ${updatedState.currentQuestionIndex + 1}: ${currentQuestion ? currentQuestion.question : 'Unknown'}`);
    io.emit('quizStateUpdate', updatedState);
    
    // Send question content specifically to quizmaster for their reference
    // This includes the answer for the quizmaster's use
    io.emit('question-started', {
      questionNumber: updatedState.currentQuestionIndex + 1,
      question: currentQuestion ? currentQuestion.question : null,
      answer: currentQuestion ? currentQuestion.answer : null, // Only for quizmaster
      totalQuestions: questions.length
    });
  });

  socket.on('pounce-start', () => {
    const currentState = getQuizState();
    if (currentState.quizStatus !== 'active') {
      console.log('Cannot start pounce: Quiz is not active');
      return;
    }
    
    if (currentState.currentQuestionIndex === -1) {
      console.log('Cannot start pounce: No question is currently active');
      return;
    }
    
    // Clear any existing pounce timer
    clearPounceTimer();
    
    setPhase('pounce');
    const updatedState = getEnhancedQuizState();
    console.log('Quizmaster initiated pounce phase.');
    io.emit('quizStateUpdate', updatedState);
    
    // Start server-side timer for pounce phase (25 seconds total: 10s to pounce + 15s to answer)
    pouncePhaseTimer = setTimeout(() => {
      autoEndPouncePhase();
    }, 25000); // 25 seconds
    
    console.log('Pounce phase timer started - will auto-end in 25 seconds');
  });

  socket.on('bounce-start', () => {
    const currentState = getQuizState();
    if (currentState.quizStatus !== 'active') {
      console.log('Cannot start bounce: Quiz is not active');
      return;
    }
    
    if (currentState.currentQuestionIndex === -1) {
      console.log('Cannot start bounce: No question is currently active');
      return;
    }
    
    // Clear any existing pounce timer when switching to bounce
    clearPounceTimer();
    
    setPhase('bounce');
    const updatedState = getEnhancedQuizState();
    console.log('Quizmaster initiated bounce phase.');
    io.emit('quizStateUpdate', updatedState);
  });

  // Player action handlers
  socket.on('submit-pounce-answer', ({ answer }) => {
    const currentState = getQuizState();
    if (currentState.quizStatus !== 'active' || currentState.currentPhase !== 'pounce') {
      console.log(`Pounce answer submission rejected: Quiz status is ${currentState.quizStatus}, phase is ${currentState.currentPhase}`);
      socket.emit('pounce-submission-ack', { success: false, message: 'Pounce phase not active' });
      return;
    }

    // Check if player already submitted an answer for this question
    const playerId = socket.id;
    if (currentState.pounceAnswers[playerId]) {
      console.log(`Pounce answer submission rejected: Player ${playerId} already submitted an answer`);
      socket.emit('pounce-submission-ack', { success: false, message: 'You have already submitted an answer for this question' });
      return;
    }

    recordPounceAnswer(playerId, answer);
    const player = getEnhancedQuizState().players[playerId];
    const playerName = player ? player.name : 'Unknown Player';

    console.log(`Player ${playerName} (ID: ${playerId}) submitted pounce answer: ${answer}`);

    // Notify quizmaster (and potentially other players or just the quizmaster UI)
    io.emit('pounce-answer-received', {
      playerId: playerId,
      playerName: playerName,
      answer: answer,
    });

    // Acknowledge receipt to the player
    socket.emit('pounce-submission-ack', { success: true });
  });

  // Quizmaster evaluating pounce answers
  socket.on('evaluate-pounce-answer', ({ playerId, isCorrect }) => {
    const points = isCorrect ? 10 : -10;
    updateScore(playerId, points);
    const updatedState = getEnhancedQuizState();
    const player = updatedState.players[playerId];
    
    io.emit('quizStateUpdate', updatedState);
    console.log(`Pounce answer for ${playerId} (${player ? player.name : 'Unknown'}) evaluated as ${isCorrect ? 'correct' : 'incorrect'}. Score updated to ${player ? player.score : 'Unknown'}.`);

    // Notify the specific player about their evaluation
    io.to(playerId).emit('pounce-answer-evaluated', { 
      isCorrect, 
      pointsAwarded: points,
      newScore: player ? player.score : 0 
    });
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Basic error handling for the server
server.on('error', (error) => {
  console.error('Server error:', error);
});

module.exports = { app, server, io }; // Export for potential testing or extension
