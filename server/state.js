// server/state.js

const generateAccessCode = () => {
  return Math.random().toString(36).substr(2, 6).toUpperCase();
};

const initialPlayerState = {
  id: null,
  name: null,
  score: 0,
  socketId: null,
  connected: false,
  isQuizmaster: false, // Added isQuizmaster flag
  pounced: false,
  pounceAnswer: null,
  pounceCorrect: null,
  isEligibleForBounce: true,
};

const initialQuizState = {
  quizTitle: 'Real-Time Quiz',
  accessCode: generateAccessCode(),
  currentQuestionIndex: -1,
  quizPhase: 'lobby',
  players: {},
  questions: [],
  pounceEndTime: null,
  bounceTurnPlayerId: null,
  bounceOrder: [],
  currentQuestionExternalId: null,
};

const deepCopy = (obj) => JSON.parse(JSON.stringify(obj));

let quizState = deepCopy(initialQuizState);

const stateManager = {
  getState: () => deepCopy(quizState),

  resetState: () => {
    const oldAccessCode = quizState.accessCode;
    quizState = deepCopy(initialQuizState);
    // Preserve questions if they were loaded, or allow re-load
    // For now, resetState makes a fully fresh state, questions should be reloaded by server.js
    quizState.accessCode = generateAccessCode();
    console.log('Quiz state has been reset. New access code:', quizState.accessCode);
  },

  loadQuestions: (questionsData) => {
    quizState.questions = questionsData;
    console.log(`\${questionsData.length} questions loaded into state.`);
  },

  setQuizTitle: (title) => {
    quizState.quizTitle = title;
    console.log(`Quiz title set to: \${title}`);
  },

  addPlayer: (socketId, name, isQm = false) => { // Added isQm parameter
    if (quizState.players[socketId]) {
      // If player reconnects, update socketId and connection status if needed
      // For now, let's assume new socketId means new player, or old one is stale
      console.warn(`Player with socketId \${socketId} already exists. Overwriting for now.`);
    }
    // Check for duplicate names (excluding QM trying to log in again with same "Quizmaster" name)
    if (!isQm && Object.values(quizState.players).find(p => p.name === name && !p.isQuizmaster)) {
      console.warn(`Player with name \${name} already exists.`);
      return null;
    }

    // If a quizmaster is being added, remove any existing quizmaster
    if (isQm) {
        const existingQm = Object.values(quizState.players).find(p => p.isQuizmaster && p.socketId !== socketId);
        if (existingQm) {
            console.log(`Removing existing quizmaster \${existingQm.name} (\${existingQm.socketId})`);
            delete quizState.players[existingQm.socketId];
        }
    }

    quizState.players[socketId] = {
      ...initialPlayerState,
      id: socketId,
      name,
      socketId,
      connected: true,
      isQuizmaster: isQm, // Set isQuizmaster status
    };
    console.log(`Player \${name} (ID: \${socketId}, QM: \${isQm}) added.`);
    return quizState.players[socketId];
  },

  assignQuizmasterRole: (socketId) => { // Specific function to assign QM role
    if (quizState.players[socketId]) {
      // Demote any other quizmaster
      Object.values(quizState.players).forEach(p => {
        if (p.isQuizmaster && p.socketId !== socketId) {
          p.isQuizmaster = false;
          console.log(`Demoted existing quizmaster: \${p.name}`);
        }
      });
      quizState.players[socketId].isQuizmaster = true;
      quizState.players[socketId].name = 'Quizmaster'; // Standardize QM name
      console.log(`Player \${quizState.players[socketId].name} (\${socketId}) assigned Quizmaster role.`);
    } else {
      console.warn(`Cannot assign Quizmaster role: Player \${socketId} not found.`);
    }
  },

  removePlayer: (socketId) => {
    if (quizState.players[socketId]) {
      console.log(`Player \${quizState.players[socketId].name} (ID: \${socketId}) removed.`);
      delete quizState.players[socketId];
      if (quizState.bounceTurnPlayerId === socketId) {
        quizState.bounceTurnPlayerId = null;
      }
      quizState.bounceOrder = quizState.bounceOrder.filter(id => id !== socketId);
    }
  },

  updatePlayerConnectionStatus: (socketId, isConnected) => {
    if (quizState.players[socketId]) {
      quizState.players[socketId].connected = isConnected;
      console.log(`Player \${quizState.players[socketId].name} connection status: \${isConnected}`);
      if (!isConnected && quizState.players[socketId].isQuizmaster) {
        // Handle QM disconnect if necessary (e.g. allow another QM to log in)
        // For now, they just become disconnected. Re-login would replace them.
        console.log("Quizmaster disconnected.");
      }
    }
  },

  setQuizPhase: (phase) => {
    quizState.quizPhase = phase;
    console.log(`Quiz phase set to: \${phase}`);
    if (phase === 'pounce') {
      quizState.pounceEndTime = Date.now() + 10000; // 10 seconds for pounce
      Object.values(quizState.players).forEach(player => {
        if (!player.isQuizmaster) { // Don't reset QM's pounce state
            player.pounced = false;
            player.pounceAnswer = null;
            player.pounceCorrect = null;
            player.isEligibleForBounce = true;
        }
      });
    }
    if (phase === 'lobby') {
        quizState.currentQuestionIndex = -1;
        quizState.currentQuestionExternalId = null;
    }
    if (phase === 'results' || phase === 'final_results') {
        quizState.pounceEndTime = null;
        quizState.bounceTurnPlayerId = null;
        quizState.bounceOrder = [];
    }
  },

  startQuiz: (questions) => {
    // stateManager.loadQuestions(questions); // Questions should already be loaded
    quizState.currentQuestionIndex = -1;
    Object.values(quizState.players).forEach(player => {
      if (!player.isQuizmaster) {
        player.score = 0;
        player.pounced = false;
        player.pounceAnswer = null;
        player.pounceCorrect = null;
        player.isEligibleForBounce = true;
      }
    });
    console.log('Quiz started (state aspect), player scores reset.');
  },

  nextQuestion: (externalId) => {
    if (quizState.currentQuestionIndex < quizState.questions.length - 1) {
      quizState.currentQuestionIndex++;
      quizState.currentQuestionExternalId = externalId || `Q\${quizState.currentQuestionIndex + 1}`;
      stateManager.setQuizPhase('pounce');
      console.log(`Moved to question \${quizState.currentQuestionIndex + 1} (External ID: \${quizState.currentQuestionExternalId})`);
      return quizState.questions[quizState.currentQuestionIndex];
    } else {
      stateManager.setQuizPhase('final_results');
      console.log('No more questions. Quiz ended.');
      return null;
    }
  },

  previousQuestion: (externalId) => {
    if (quizState.currentQuestionIndex > 0) {
      quizState.currentQuestionIndex--;
    } else if (quizState.questions.length > 0) {
      quizState.currentQuestionIndex = 0;
    } else {
      console.log('No questions to navigate.');
      return null;
    }
    quizState.currentQuestionExternalId = externalId || `Q\${quizState.currentQuestionIndex + 1}`;
    stateManager.setQuizPhase('pounce');
    console.log(`Moved to question \${quizState.currentQuestionIndex + 1} (External ID: \${quizState.currentQuestionExternalId})`);
    return quizState.questions[quizState.currentQuestionIndex];
  },

  recordPounceAnswer: (socketId, answer, isCorrect) => {
    if (quizState.players[socketId] && quizState.quizPhase === 'pounce' && !quizState.players[socketId].pounced && !quizState.players[socketId].isQuizmaster) {
      const player = quizState.players[socketId];
      player.pounced = true;
      player.pounceAnswer = answer;
      player.pounceCorrect = isCorrect;

      if (isCorrect) {
        player.score += 20;
        player.isEligibleForBounce = false;
        console.log(`Player \${player.name} pounced correctly. Score: \${player.score}`);
      } else {
        player.score -= 10;
        console.log(`Player \${player.name} pounced incorrectly. Score: \${player.score}`);
      }
    }
  },

  prepareBounceOrder: () => {
    const connectedEligiblePlayers = Object.values(quizState.players)
      .filter(p => p.connected && p.isEligibleForBounce && !p.isQuizmaster)
      .sort((a, b) => a.id.localeCompare(b.id)); // Sort by ID for consistent ordering

    if (connectedEligiblePlayers.length === 0) {
      quizState.bounceOrder = [];
      quizState.bounceTurnPlayerId = null;
      console.log('No players eligible for bounce.');
      return;
    }

    // Determine starting index based on currentQuestionIndex
    // currentQuestionIndex is 0-based.
    const questionNumForOrder = quizState.currentQuestionIndex; // Can be -1 if no question active
    let startIndex = 0;
    if (questionNumForOrder >=0 && connectedEligiblePlayers.length > 0) {
        startIndex = questionNumForOrder % connectedEligiblePlayers.length;
    }

    // Create the rotated bounce order
    const rotatedOrder = [
      ...connectedEligiblePlayers.slice(startIndex),
      ...connectedEligiblePlayers.slice(0, startIndex)
    ];

    quizState.bounceOrder = rotatedOrder.map(p => p.socketId);

    if (quizState.bounceOrder.length > 0) {
      quizState.bounceTurnPlayerId = quizState.bounceOrder[0];
      console.log('Bounce order prepared (rotated):', quizState.bounceOrder.map(id => quizState.players[id].name));
      console.log('Bounce turn starts with:', quizState.players[quizState.bounceTurnPlayerId].name);
    } else {
      // This case should be covered by the initial check, but as a safeguard:
      quizState.bounceTurnPlayerId = null;
      console.log('No players eligible for bounce after rotation attempt.');
    }
  },

  getCurrentPlayerForBounce: () => {
    if (quizState.bounceTurnPlayerId && quizState.players[quizState.bounceTurnPlayerId]) {
      return quizState.players[quizState.bounceTurnPlayerId];
    }
    return null;
  },

  advanceBounceTurn: () => {
    if (quizState.bounceOrder.length === 0 || !quizState.bounceTurnPlayerId) {
      quizState.bounceTurnPlayerId = null;
      return null;
    }
    const currentIndex = quizState.bounceOrder.indexOf(quizState.bounceTurnPlayerId);
    if (currentIndex === -1 || currentIndex >= quizState.bounceOrder.length - 1) {
      quizState.bounceTurnPlayerId = null;
      console.log('Bounce round finished.');
      return null;
    }
    quizState.bounceTurnPlayerId = quizState.bounceOrder[currentIndex + 1];
    console.log('Bounce turn advanced to:', quizState.players[quizState.bounceTurnPlayerId].name);
    return quizState.players[quizState.bounceTurnPlayerId];
  },

  markBounceAnswer: (socketId, isCorrect) => {
    if (quizState.players[socketId] && socketId === quizState.bounceTurnPlayerId && quizState.quizPhase === 'bounce' && !quizState.players[socketId].isQuizmaster) {
      const player = quizState.players[socketId];
      if (isCorrect) {
        player.score += 10;
        console.log(`Player \${player.name} bounced correctly. Score: \${player.score}`);
      } else {
        console.log(`Player \${player.name} bounced incorrectly.`);
      }
      player.isEligibleForBounce = false;
    }
  },

  playerPassBounce: (socketId) => {
    if (quizState.players[socketId] && socketId === quizState.bounceTurnPlayerId && quizState.quizPhase === 'bounce' && !quizState.players[socketId].isQuizmaster) {
      const player = quizState.players[socketId];
      console.log(`Player \${player.name} passed bounce.`);
      player.isEligibleForBounce = false;
    }
  },

  getPlayers: () => Object.values(quizState.players).filter(p => !p.isQuizmaster).map(p => ({ id: p.id, name: p.name, score: p.score, connected: p.connected, isQuizmaster: p.isQuizmaster, pounced: p.pounced, pounceAnswer: p.pounceAnswer, pounceCorrect: p.pounceCorrect, isEligibleForBounce: p.isEligibleForBounce })),
  getQuizmaster: () => Object.values(quizState.players).find(p => p.isQuizmaster),
  getScores: () => Object.values(quizState.players).filter(p => !p.isQuizmaster).reduce((acc, player) => {
    acc[player.name] = player.score;
    return acc;
  }, {}),
  getLeaderboard: () => Object.values(quizState.players)
    .filter(p => !p.isQuizmaster)
    .map(p => ({ name: p.name, score: p.score }))
    .sort((a, b) => b.score - a.score),

  getCurrentQuestion: () => {
    if (quizState.currentQuestionIndex >= 0 && quizState.currentQuestionIndex < quizState.questions.length) {
      const { text, choices, media, id } = quizState.questions[quizState.currentQuestionIndex]; // Choices might not be used per PRD
      return {
        id, text, media, // No choices sent as per PRD (slides are external)
        questionNumber: quizState.currentQuestionIndex + 1,
        totalQuestions: quizState.questions.length,
        externalId: quizState.currentQuestionExternalId
      };
    }
    return null;
  },

  getPounceSubmissions: () => {
    if (quizState.currentQuestionIndex === -1) return {};
    return Object.values(quizState.players)
      .filter(p => p.pounced && !p.isQuizmaster)
      .map(p => ({ name: p.name, answer: p.pounceAnswer, isCorrect: p.pounceCorrect }));
  },
};

module.exports = stateManager;
console.log('server/state.js loaded (updated version)');
