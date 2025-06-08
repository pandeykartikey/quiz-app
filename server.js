const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');
const cors = require('cors');
const { networkInterfaces } = require('os');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Load quiz data
let quizData = {};
try {
  quizData = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'quiz.json'), 'utf8'));
} catch (error) {
  console.log('Quiz data not found, using default questions');
  quizData = {
    title: "Sample Quiz",
    questions: []
  };
}

// Quiz state management
const quizState = {
  currentQuestion: 0,
  players: {},
  scores: {},
  answers: {},
  isActive: false,
  accessCode: generateAccessCode()
};

function generateAccessCode() {
  return Math.random().toString(36).substr(2, 6).toUpperCase();
}

function getLocalIP() {
  const nets = networkInterfaces();
  const results = {};

  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        if (!results[name]) {
          results[name] = [];
        }
        results[name].push(net.address);
      }
    }
  }
  
  // Return the first non-internal IPv4 address
  for (const name of Object.keys(results)) {
    if (results[name].length > 0) {
      return results[name][0];
    }
  }
  
  return 'localhost';
}

// Routes
app.get('/api/quiz-info', (req, res) => {
  res.json({
    title: quizData.title,
    totalQuestions: quizData.questions.length,
    accessCode: quizState.accessCode,
    isActive: quizState.isActive
  });
});

app.get('/api/qr-code', async (req, res) => {
  try {
    const localIP = getLocalIP();
    const url = `http://${localIP}:${PORT}?code=${quizState.accessCode}`;
    const qrCode = await QRCode.toDataURL(url);
    res.json({ qrCode, url });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Handle player joining
  socket.on('joinQuiz', (data) => {
    const { name, code } = data;
    
    if (code !== quizState.accessCode) {
      socket.emit('joinError', { message: 'Invalid access code' });
      return;
    }

    if (!name || name.trim().length === 0) {
      socket.emit('joinError', { message: 'Name is required' });
      return;
    }

    // Check for duplicate names
    const existingPlayer = Object.values(quizState.players).find(p => p.name === name.trim());
    if (existingPlayer) {
      socket.emit('joinError', { message: 'Name already taken' });
      return;
    }

    // Add player
    quizState.players[socket.id] = {
      name: name.trim(),
      socketId: socket.id,
      connected: true
    };
    quizState.scores[name.trim()] = 0;

    socket.join('quiz-room');
    
    socket.emit('joinSuccess', { 
      name: name.trim(), 
      isActive: quizState.isActive,
      currentQuestion: quizState.currentQuestion 
    });
    
    // Broadcast updated player list
    io.to('quiz-room').emit('playersUpdate', {
      players: Object.values(quizState.players),
      scores: quizState.scores
    });

    console.log(`Player ${name} joined the quiz`);
  });

  // Handle quiz start (host only)
  socket.on('startQuiz', () => {
    if (quizData.questions.length === 0) {
      socket.emit('error', { message: 'No questions available' });
      return;
    }

    quizState.isActive = true;
    quizState.currentQuestion = 0;
    quizState.answers = {};

    const question = quizData.questions[0];
    const questionData = {
      id: question.id,
      text: question.text,
      choices: question.choices,
      media: question.media,
      questionNumber: 1,
      totalQuestions: quizData.questions.length
    };

    io.to('quiz-room').emit('quizStarted', questionData);
    console.log('Quiz started');
  });

  // Handle answer submission
  socket.on('submitAnswer', (data) => {
    const { questionId, choiceIndex } = data;
    const player = quizState.players[socket.id];
    
    if (!player) {
      socket.emit('error', { message: 'Player not found' });
      return;
    }

    if (!quizState.isActive) {
      socket.emit('error', { message: 'Quiz is not active' });
      return;
    }

    const currentQuestion = quizData.questions[quizState.currentQuestion];
    if (!currentQuestion || currentQuestion.id !== questionId) {
      socket.emit('error', { message: 'Invalid question' });
      return;
    }

    // Record answer
    if (!quizState.answers[questionId]) {
      quizState.answers[questionId] = {};
    }
    
    quizState.answers[questionId][socket.id] = {
      playerName: player.name,
      choiceIndex: choiceIndex,
      timestamp: Date.now()
    };

    socket.emit('answerSubmitted', { questionId, choiceIndex });
    
    // Check if all players have answered
    const totalPlayers = Object.keys(quizState.players).length;
    const answeredCount = Object.keys(quizState.answers[questionId] || {}).length;
    
    io.to('quiz-room').emit('answerProgress', {
      answered: answeredCount,
      total: totalPlayers
    });

    console.log(`Answer submitted by ${player.name}: ${choiceIndex}`);
  });

  // Handle next question (host only)
  socket.on('nextQuestion', () => {
    const currentQuestion = quizData.questions[quizState.currentQuestion];
    if (!currentQuestion) return;

    // Calculate scores for current question
    const questionAnswers = quizState.answers[currentQuestion.id] || {};
    Object.entries(questionAnswers).forEach(([socketId, answer]) => {
      if (answer.choiceIndex === currentQuestion.correctChoice) {
        quizState.scores[answer.playerName] += 1;
      }
    });

    // Send round results
    io.to('quiz-room').emit('roundResult', {
      questionId: currentQuestion.id,
      correctAnswer: currentQuestion.correctChoice,
      explanation: currentQuestion.explanation,
      scores: quizState.scores,
      playerAnswers: questionAnswers
    });

    // Move to next question or end quiz
    setTimeout(() => {
      quizState.currentQuestion++;
      
      if (quizState.currentQuestion >= quizData.questions.length) {
        // End quiz
        quizState.isActive = false;
        const sortedScores = Object.entries(quizState.scores)
          .sort(([,a], [,b]) => b - a);
        
        io.to('quiz-room').emit('quizEnded', {
          finalScores: sortedScores,
          winner: sortedScores[0]
        });
        
        console.log('Quiz ended');
      } else {
        // Next question
        const nextQuestion = quizData.questions[quizState.currentQuestion];
        const questionData = {
          id: nextQuestion.id,
          text: nextQuestion.text,
          choices: nextQuestion.choices,
          media: nextQuestion.media,
          questionNumber: quizState.currentQuestion + 1,
          totalQuestions: quizData.questions.length
        };
        
        io.to('quiz-room').emit('newQuestion', questionData);
      }
    }, 3000); // 3 second delay before next question
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    const player = quizState.players[socket.id];
    if (player) {
      console.log(`Player ${player.name} disconnected`);
      delete quizState.players[socket.id];
      
      io.to('quiz-room').emit('playersUpdate', {
        players: Object.values(quizState.players),
        scores: quizState.scores
      });
    }
  });

  // Handle reset quiz (host only)
  socket.on('resetQuiz', () => {
    quizState.currentQuestion = 0;
    quizState.players = {};
    quizState.scores = {};
    quizState.answers = {};
    quizState.isActive = false;
    quizState.accessCode = generateAccessCode();
    
    io.to('quiz-room').emit('quizReset');
    console.log('Quiz reset');
  });
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
  const localIP = getLocalIP();
  console.log('=================================');
  console.log('🎯 Quiz Server is running!');
  console.log(`📱 Local access: http://localhost:${PORT}`);
  console.log(`🌐 Network access: http://${localIP}:${PORT}`);
  console.log(`🔑 Access code: ${quizState.accessCode}`);
  console.log('=================================');
});

module.exports = server; 