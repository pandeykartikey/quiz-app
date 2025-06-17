const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path'); // Added for serving client files

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
  socket.emit('quizStateUpdate', getQuizState());

  socket.on('join-quiz', (playerName) => {
    addPlayer(socket.id, playerName);
    const updatedState = getQuizState();
    socket.emit('join-success', { playerId: socket.id, quizState: updatedState });
    io.emit('quizStateUpdate', updatedState);
    console.log(`Player ${playerName} (ID: ${socket.id}) joined the quiz.`);
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
    // Future enhancement: remove player from quizState.players if they disconnect
    // delete quizState.players[socket.id];
    // io.emit('quizStateUpdate', getQuizState()); // Notify others
  });

  // Quizmaster action handlers
  socket.on('start-quiz', () => {
    startQuiz();
    const updatedState = getQuizState();
    console.log('Quizmaster started the quiz.');
    io.emit('quizStateUpdate', updatedState);
  });

  socket.on('end-quiz', () => {
    endQuiz();
    const updatedState = getQuizState();
    console.log('Quizmaster ended the quiz.');
    io.emit('quizStateUpdate', updatedState);
  });

  socket.on('start-question', () => {
    const currentState = getQuizState();
    if (currentState.quizStatus !== 'active') {
      console.log('Cannot start question: Quiz is not active');
      return;
    }
    
    incrementQuestion();
    clearPounceAnswers(); // Clear pounce answers for the new question
    const updatedState = getQuizState();
    console.log(`Quizmaster started question ${updatedState.currentQuestionIndex + 1}`);
    io.emit('quizStateUpdate', updatedState);
  });

  socket.on('pounce-start', () => {
    const currentState = getQuizState();
    if (currentState.quizStatus !== 'active') {
      console.log('Cannot start pounce: Quiz is not active');
      return;
    }
    
    setPhase('pounce');
    const updatedState = getQuizState();
    console.log('Quizmaster initiated pounce phase.');
    io.emit('quizStateUpdate', updatedState);
  });

  socket.on('bounce-start', () => {
    const currentState = getQuizState();
    if (currentState.quizStatus !== 'active') {
      console.log('Cannot start bounce: Quiz is not active');
      return;
    }
    
    setPhase('bounce');
    const updatedState = getQuizState();
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

    const playerId = socket.id;
    recordPounceAnswer(playerId, answer);
    const player = getQuizState().players[playerId];
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
    const updatedState = getQuizState();
    io.emit('quizStateUpdate', updatedState);
    console.log(`Pounce answer for ${playerId} evaluated as ${isCorrect ? 'correct' : 'incorrect'}. Score updated.`);

    // Optionally, notify the specific player and quizmaster
    // io.to(playerId).emit('pounce-answer-evaluated', { isCorrect, score: updatedState.players[playerId]?.score });
    // socket.emit('pounce-evaluation-ack', { playerId, status: 'evaluated' }); // Ack to quizmaster
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
