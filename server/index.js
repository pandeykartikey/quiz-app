const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');
// const cors = require('cors'); // Already handled by socket.io cors and express static doesn't usually need it for same origin.
const { networkInterfaces } = require('os');

const stateManager = require('./state');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;
const QUIZMASTER_CODE = 'QM_SECRET';

app.use(express.json());

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '..', 'dist', 'client')));
  console.log('Serving static files from dist/client');
} else {
  app.use(express.static(path.join(__dirname, '..', 'client')));
  console.log('Serving static files from client');
}

try {
  const questionsFilePath = path.join(__dirname, 'questions.json');
  const questionsData = JSON.parse(fs.readFileSync(questionsFilePath, 'utf8'));
  stateManager.loadQuestions(questionsData.questions || []);
  stateManager.setQuizTitle(questionsData.title || 'Quiz Title Loaded'); // Use setQuizTitle
  console.log(`Quiz "\${stateManager.getState().quizTitle}" loaded with \${stateManager.getState().questions.length} questions.`);
} catch (error) {
  console.error('Failed to load questions.json:', error.message);
  stateManager.loadQuestions([]);
  stateManager.setQuizTitle('Default Quiz Title');
}

function getLocalIP() {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

app.get('/api/quiz-info', (req, res) => {
  const currentState = stateManager.getState();
  res.json({
    title: currentState.quizTitle,
    accessCode: currentState.accessCode,
    quizPhase: currentState.quizPhase,
    currentQuestion: stateManager.getCurrentQuestion(),
  });
});

app.get('/api/qr-code', async (req, res) => {
  try {
    const localIP = getLocalIP();
    const accessCode = stateManager.getState().accessCode;
    const url = `http://\${localIP}:\${PORT}/?code=\${accessCode}`;
    const qrCode = await QRCode.toDataURL(url);
    res.json({ qrCode, url });
  } catch (error) {
    console.error('QR code generation error:', error);
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

io.on('connection', (socket) => {
  console.log(`Client connected: \${socket.id}`);

  const broadcastFullStateToAll = () => {
    const currentState = stateManager.getState();
    const playersForBroadcast = stateManager.getPlayers(); // Already filters out QM
    const leaderboard = stateManager.getLeaderboard(); // Already filters out QM
    const currentQuestion = stateManager.getCurrentQuestion();

    const commonPayload = {
      quizTitle: currentState.quizTitle,
      accessCode: currentState.accessCode,
      quizPhase: currentState.quizPhase,
      players: playersForBroadcast, // List of active players (name, score)
      leaderboard: leaderboard,
      currentQuestion: currentQuestion,
      pounceEndTime: currentState.pounceEndTime,
      bounceTurnPlayerName: currentState.bounceTurnPlayerId ? currentState.players[currentState.bounceTurnPlayerId]?.name : null,
      // For display view, to show who is currently bouncing
      currentBouncer: currentState.bounceTurnPlayerId ? {
          id: currentState.bounceTurnPlayerId,
          name: currentState.players[currentState.bounceTurnPlayerId]?.name
      } : null,
    };
    io.to('quiz_room').emit('quizStateUpdate', commonPayload);
    // console.log('Broadcasted quizStateUpdate to quiz_room');
  };

  const broadcastStateToQuizmaster = (targetSocketId) => {
    const qmPlayer = stateManager.getQuizmaster();
    const qmSocketId = targetSocketId || (qmPlayer ? qmPlayer.socketId : null);

    if (qmSocketId) {
        const currentState = stateManager.getState(); // Full state
        io.to(qmSocketId).emit('quizmasterStateUpdate', {
            ...currentState, // Send the whole state object
            // Add any specific QM views if needed, e.g., full player objects with socket IDs
            allPlayersDetailed: Object.values(currentState.players),
            pounceSubmissions: stateManager.getPounceSubmissions(),
        });
        // console.log(`Broadcasted quizmasterStateUpdate to \${qmSocketId}`);
    }
  };

  socket.on('joinQuiz', ({ name, code }) => {
    if (code !== stateManager.getState().accessCode) {
      return socket.emit('joinError', { message: 'Invalid access code.' });
    }
    if (!name || name.trim().length === 0) {
      return socket.emit('joinError', { message: 'Name is required.' });
    }

    const addedPlayer = stateManager.addPlayer(socket.id, name.trim(), false); // false for isQm
    if (!addedPlayer) {
        return socket.emit('joinError', { message: 'Name already taken.' });
    }

    socket.join('quiz_room');
    socket.emit('joinSuccess', {
      name: addedPlayer.name,
      playerId: addedPlayer.id,
      accessCode: stateManager.getState().accessCode,
    });
    console.log(`Player \${addedPlayer.name} (\${socket.id}) joined.`);
    broadcastFullStateToAll();
    broadcastStateToQuizmaster(); // QM might want to see new player join
  });

  socket.on('quizmasterLogin', ({ quizmasterCode }) => {
    if (quizmasterCode !== QUIZMASTER_CODE) {
      return socket.emit('loginError', { message: 'Invalid Quizmaster code.' });
    }

    // stateManager.addPlayer will handle removing old QM if any
    stateManager.addPlayer(socket.id, 'Quizmaster', true); // true for isQm
    // Or use assignQuizmasterRole if addPlayer doesn't fully cover replacement logic
    // stateManager.assignQuizmasterRole(socket.id);

    socket.join('quiz_room');
    socket.join('quizmaster_room');
    socket.emit('quizmasterLoginSuccess', { message: 'Quizmaster login successful.' });
    console.log(`Quizmaster (\${socket.id}) logged in.`);
    broadcastFullStateToAll();
    broadcastStateToQuizmaster(socket.id); // Send full state to just this QM
  });

  socket.on('startQuiz', () => {
    const player = stateManager.getState().players[socket.id];
    if (!player || !player.isQuizmaster) return socket.emit('error', { message: 'Unauthorized' });

    stateManager.startQuiz(); // Questions already loaded
    stateManager.setQuizPhase('lobby');
    console.log('Quiz set to lobby by Quizmaster. Waiting for Next Question.');
    broadcastFullStateToAll();
    broadcastStateToQuizmaster(socket.id);
  });

  socket.on('nextQuestion', ({ externalSlideId } = {}) => {
    const player = stateManager.getState().players[socket.id];
    if (!player || !player.isQuizmaster) return socket.emit('error', { message: 'Unauthorized' });

    const question = stateManager.nextQuestion(externalSlideId);
    if (question) {
      console.log(`QM moved to next Q: \${stateManager.getState().currentQuestionIndex + 1}`);
      // Pounce phase automatically starts via nextQuestion's call to setQuizPhase('pounce')
      // Set timer for pounce phase end
       setTimeout(() => {
        if (stateManager.getState().quizPhase === 'pounce' && stateManager.getState().currentQuestionIndex === (stateManager.getState().questions.indexOf(question))) {
            stateManager.setQuizPhase('bounce_pending_evaluation');
            console.log('Pounce phase auto-ended for Q:', stateManager.getState().currentQuestionIndex + 1);
            broadcastFullStateToAll();
            broadcastStateToQuizmaster();
        }
      }, stateManager.getState().pounceEndTime - Date.now() + 200); // Small buffer
    }
    broadcastFullStateToAll();
    broadcastStateToQuizmaster(socket.id);
  });

  socket.on('previousQuestion', ({ externalSlideId } = {}) => {
    const player = stateManager.getState().players[socket.id];
    if (!player || !player.isQuizmaster) return socket.emit('error', { message: 'Unauthorized' });

    const question = stateManager.previousQuestion(externalSlideId);
     if (question) {
      console.log(`QM moved to prev Q: \${stateManager.getState().currentQuestionIndex + 1}`);
       setTimeout(() => {
        if (stateManager.getState().quizPhase === 'pounce' && stateManager.getState().currentQuestionIndex === (stateManager.getState().questions.indexOf(question))) {
            stateManager.setQuizPhase('bounce_pending_evaluation');
            console.log('Pounce phase auto-ended for Q:', stateManager.getState().currentQuestionIndex + 1);
            broadcastFullStateToAll();
            broadcastStateToQuizmaster();
        }
      }, stateManager.getState().pounceEndTime - Date.now() + 200);
    }
    broadcastFullStateToAll();
    broadcastStateToQuizmaster(socket.id);
  });

  // triggerPouncePhase might be less needed if next/prev question auto-starts it.
  // Kept for manual override or restarting pounce on same question.
  socket.on('triggerPouncePhase', () => {
    const player = stateManager.getState().players[socket.id];
    if (!player || !player.isQuizmaster) return socket.emit('error', { message: 'Unauthorized' });
    if (stateManager.getState().currentQuestionIndex === -1) {
        return socket.emit('error', { message: 'No question active.'});
    }
    stateManager.setQuizPhase('pounce'); // Resets pounce states for players
    console.log('Pounce phase re-triggered by QM.');
    broadcastFullStateToAll();
    broadcastStateToQuizmaster(socket.id);

    setTimeout(() => {
        const currentPounceEndTime = stateManager.getState().pounceEndTime;
        // Check if still in pounce for this specific pounce window
        if (stateManager.getState().quizPhase === 'pounce' && Date.now() >= currentPounceEndTime) {
            stateManager.setQuizPhase('bounce_pending_evaluation');
            console.log('Pounce phase (re-triggered) auto-ended.');
            broadcastFullStateToAll();
            broadcastStateToQuizmaster();
        }
    }, (stateManager.getState().pounceEndTime - Date.now() > 0 ? stateManager.getState().pounceEndTime - Date.now() : 0) + 200);
  });

  socket.on('triggerBouncePhase', () => {
    const player = stateManager.getState().players[socket.id];
    if (!player || !player.isQuizmaster) return socket.emit('error', { message: 'Unauthorized' });

    stateManager.prepareBounceOrder();
    if (stateManager.getState().bounceOrder.length > 0) {
        stateManager.setQuizPhase('bounce');
        console.log('Bounce phase triggered by QM.');
    } else {
        stateManager.setQuizPhase('results');
        console.log('No eligible players for bounce. Moving to results for this question.');
    }
    broadcastFullStateToAll();
    broadcastStateToQuizmaster(socket.id);
  });

  socket.on('markBounceCorrect', ({ playerId }) => {
    const qm = stateManager.getState().players[socket.id];
    if (!qm || !qm.isQuizmaster) return socket.emit('error', { message: 'Unauthorized' });

    const targetPlayerId = playerId || stateManager.getState().bounceTurnPlayerId;
    if (!targetPlayerId) return socket.emit('error', {message: 'No active bouncer.'});

    stateManager.markBounceAnswer(targetPlayerId, true);
    const nextBouncer = stateManager.advanceBounceTurn();
    if (!nextBouncer) {
        stateManager.setQuizPhase('results');
        console.log('Bounce round ended (correct). Moving to results.');
    }
    broadcastFullStateToAll();
    broadcastStateToQuizmaster(socket.id);
  });

  socket.on('markBounceWrong', ({ playerId }) => {
    const qm = stateManager.getState().players[socket.id];
    if (!qm || !qm.isQuizmaster) return socket.emit('error', { message: 'Unauthorized' });

    const targetPlayerId = playerId || stateManager.getState().bounceTurnPlayerId;
    if (!targetPlayerId) return socket.emit('error', {message: 'No active bouncer.'});

    stateManager.markBounceAnswer(targetPlayerId, false);
    const nextBouncer = stateManager.advanceBounceTurn();
    if (!nextBouncer) {
        stateManager.setQuizPhase('results');
        console.log('Bounce round ended (wrong). Moving to results.');
    }
    broadcastFullStateToAll();
    broadcastStateToQuizmaster(socket.id);
  });

  socket.on('submitPounceAnswer', ({ answer }) => {
    const player = stateManager.getState().players[socket.id];
    const currentQuestionData = stateManager.getState().questions[stateManager.getState().currentQuestionIndex];

    if (!player || player.isQuizmaster) return socket.emit('error', { message: 'Not a valid player.' });
    if (stateManager.getState().quizPhase !== 'pounce') return socket.emit('error', { message: 'Not in pounce phase.' });
    if (player.pounced) return socket.emit('error', { message: 'Already pounced.' });
    if (Date.now() > stateManager.getState().pounceEndTime) return socket.emit('error', { message: 'Pounce time over.' });
    if (!currentQuestionData || typeof currentQuestionData.pounceCorrectAnswer === 'undefined') {
        return socket.emit('error', {message: 'Internal error: Question data missing.'});
    }

    const isCorrect = (answer || '').trim().toLowerCase() === (currentQuestionData.pounceCorrectAnswer || '').trim().toLowerCase();
    stateManager.recordPounceAnswer(socket.id, answer, isCorrect);

    socket.emit('pounceSubmitted', { answerDesu: answer, isCorrect });
    broadcastFullStateToAll();
    broadcastStateToQuizmaster();
  });

  socket.on('playerPassBounce', () => {
    const player = stateManager.getState().players[socket.id];
    if (!player || player.isQuizmaster) return socket.emit('error', { message: 'Not a valid player.' });
    if (stateManager.getState().quizPhase !== 'bounce' || stateManager.getState().bounceTurnPlayerId !== socket.id) {
      return socket.emit('error', { message: 'Not your turn or not in bounce phase.' });
    }

    stateManager.playerPassBounce(socket.id);
    const nextBouncer = stateManager.advanceBounceTurn();
    if (!nextBouncer) {
        stateManager.setQuizPhase('results');
        console.log('Bounce round ended (pass). Moving to results.');
    }
    broadcastFullStateToAll();
    broadcastStateToQuizmaster();
  });

  socket.on('resetQuiz', () => {
    const player = stateManager.getState().players[socket.id];
    if (!player || !player.isQuizmaster) return socket.emit('error', { message: 'Unauthorized' });

    stateManager.resetState();
    try {
        const questionsFilePath = path.join(__dirname, 'questions.json');
        const questionsData = JSON.parse(fs.readFileSync(questionsFilePath, 'utf8'));
        stateManager.loadQuestions(questionsData.questions || []);
        stateManager.setQuizTitle(questionsData.title || 'Quiz Title Reset');
    } catch (e) { console.error("Error reloading questions on reset:", e); }

    console.log('Quiz reset by Quizmaster.');
    io.to('quiz_room').emit('quizForceReset', { accessCode: stateManager.getState().accessCode });
    // broadcastFullStateToAll(); // quizForceReset should lead clients to re-evaluate
    // broadcastStateToQuizmaster(socket.id);
  });

  socket.on('disconnect', () => {
    const player = stateManager.getState().players[socket.id];
    if (player) {
      console.log(`Client \${player.name} (\${socket.id}) disconnected.`);
      stateManager.updatePlayerConnectionStatus(socket.id, false);
      if (player.isQuizmaster) {
          console.log("Quizmaster disconnected. The role is now available.");
          // No need to explicitly remove QM here, new QM login will replace.
      }
    } else {
      console.log(`Client (\${socket.id}) disconnected - was not registered.`);
    }
    broadcastFullStateToAll();
    broadcastStateToQuizmaster();
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const localIP = getLocalIP();
  console.log('=================================');
  console.log('🎯 Quiz Server (PRD v2) is running!');
  console.log(`📱 Local access: http://localhost:\${PORT}`);
  console.log(`🌐 Network access: http://\${localIP}:\${PORT}`);
  console.log(`🔑 QM Code: \${QUIZMASTER_CODE}`);
  console.log(`🔑 Access code: \${stateManager.getState().accessCode}\`);
  console.log('=================================');
});

module.exports = server;