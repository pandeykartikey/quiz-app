const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path'); // Added for serving client files

const { quizState, incrementQuestion, setPhase, getQuizState } = require('./state');

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

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });

  // Quizmaster action handlers
  socket.on('start-question', () => {
    incrementQuestion();
    // Assuming questions are loaded elsewhere and incrementQuestion updates index correctly
    // We might also want to reset phase here, e.g., setPhase('question_active');
    // For now, just incrementing and sending new index.
    const updatedState = getQuizState();
    console.log(`Quizmaster started new question: ${updatedState.currentQuestionIndex}`);
    io.emit('new-question', { currentQuestionIndex: updatedState.currentQuestionIndex, phase: updatedState.currentPhase });
    // It's often better to send the whole state:
    // io.emit('quizStateUpdate', updatedState);
  });

  socket.on('pounce-start', () => {
    setPhase('pounce');
    const updatedState = getQuizState();
    console.log('Quizmaster initiated pounce phase.');
    io.emit('pounce-started', { phase: updatedState.currentPhase });
    // Or send the whole state:
    // io.emit('quizStateUpdate', updatedState);
  });

  socket.on('bounce-start', () => {
    setPhase('bounce');
    const updatedState = getQuizState();
    console.log('Quizmaster initiated bounce phase.');
    io.emit('bounce-started', { phase: updatedState.currentPhase });
    // Or send the whole state:
    // io.emit('quizStateUpdate', updatedState);
  });

  // Placeholder for player action handlers (e.g., submitting answers)
  // socket.on('submitAnswer', (answer) => {
  //   console.log(`Player ${socket.id} submitted answer: ${answer}`);
  //   // Logic to handle player answers
  // });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Basic error handling for the server
server.on('error', (error) => {
  console.error('Server error:', error);
});

module.exports = { app, server, io }; // Export for potential testing or extension
