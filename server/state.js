// server/state.js (Revised for new Pounce Flow)

const generateAccessCode = () => {
  return Math.random().toString(36).substr(2, 6).toUpperCase();
};

const initialPlayerState = {
  id: null,
  name: null,
  score: 0,
  socketId: null,
  connected: false,
  isQuizmaster: false,

  // Pounce related per-player state
  pouncedThisQuestion: false,       // Has this player submitted a pounce answer for the current question?
  pounceAnswer: null,
  pounceCorrect: null,
  hasOptedInPounce: false,          // Has player clicked "Pounce" in the opt-in window?
  pouncePersonalAnswerEndTime: null, // When this specific player's 20s window to answer ends

  isEligibleForBounce: true,
};

const initialQuizState = {
  quizTitle: 'Real-Time Quiz',
  accessCode: generateAccessCode(),
  currentQuestionIndex: -1,
  // Phases: lobby, question_pending_pounce_trigger, pounce_opt_in, pounce_answering_window_active, bounce_pending_evaluation, bounce, results, final_results
  quizPhase: 'lobby',
  players: {},
  questions: [],

  // Pounce related global state
  pounceOptInEndTime: null,         // When the 10s window for ANY player to opt-in ends
  // pounceAnswerSubmissionEndTime: null, // Global answer window end (alternative simpler model) - REMOVED for personal timers

  bounceTurnPlayerId: null,
  bounceOrder: [],
  currentQuestionExternalId: null,
};

const deepCopy = (obj) => JSON.parse(JSON.stringify(obj));
let quizState = deepCopy(initialQuizState);

const stateManager = {
  getState: () => deepCopy(quizState),

  resetState: () => {
    quizState = deepCopy(initialQuizState);
    quizState.accessCode = generateAccessCode();
    console.log('Quiz state has been reset. New access code:', quizState.accessCode);
  },

  loadQuestions: (questionsData) => {
    quizState.questions = questionsData;
    console.log(`${questionsData.length} questions loaded into state.`);
  },

  setQuizTitle: (title) => { quizState.quizTitle = title; },

  addPlayer: (newSocketId, name, isQm = false) => {
    if (isQm) {
      const existingQm = Object.values(quizState.players).find(p => p.isQuizmaster && p.socketId !== newSocketId);
      if (existingQm) {
        console.log(`Replacing existing quizmaster ${existingQm.name} (${existingQm.socketId}) with new QM on ${newSocketId}`);
        delete quizState.players[existingQm.socketId];
      }
      quizState.players[newSocketId] = { ...initialPlayerState, id: newSocketId, name: 'Quizmaster', socketId: newSocketId, connected: true, isQuizmaster: true };
      console.log(`Quizmaster (${newSocketId}) added/updated.`);
      return quizState.players[newSocketId];
    }

    // Handle regular players and rejoin
    const existingPlayerByName = Object.values(quizState.players).find(p => p.name === name && !p.isQuizmaster);

    if (existingPlayerByName) {
      if (existingPlayerByName.connected && existingPlayerByName.socketId !== newSocketId) {
        console.warn(`Player name "${name}" is already in use by an active player (${existingPlayerByName.socketId}).`);
        return null; // Name taken by an active player
      }
      if (!existingPlayerByName.connected) {
        // This is a rejoin attempt for a disconnected player
        console.log(`Player "${name}" (${existingPlayerByName.socketId}) is rejoining with new socket ID ${newSocketId}.`);
        const oldSocketId = existingPlayerByName.socketId;
        const rejoiningPlayerData = { ...existingPlayerByName }; // Copy their data

        rejoiningPlayerData.socketId = newSocketId; // Update to new socket ID
        rejoiningPlayerData.id = newSocketId; // Update player ID to new socket ID for consistency
        rejoiningPlayerData.connected = true;

        delete quizState.players[oldSocketId]; // Remove old entry
        quizState.players[newSocketId] = rejoiningPlayerData; // Add new entry with updated socket ID
        console.log(`Player "${name}" reconnected successfully.`);
        return quizState.players[newSocketId];
      }
      // If existingPlayerByName.connected is true AND existingPlayerByName.socketId === newSocketId
      // This means the same socket is trying to add player again, should not happen if client logic is correct.
      // Or, it could be a refresh on client side that triggers join again. If so, just return the player.
      if (existingPlayerByName.connected && existingPlayerByName.socketId === newSocketId) {
        console.log(`Player "${name}" (${newSocketId}) trying to join again with same socket. Returning existing player.`)
        return existingPlayerByName;
      }
    }

    // No existing player with this name, or it was a stale entry that got cleared.
    // Create a new player entry.
    console.log(`Adding new player "${name}" with socket ID ${newSocketId}.`);
    quizState.players[newSocketId] = { ...initialPlayerState, id: newSocketId, name, socketId: newSocketId, connected: true, isQuizmaster: false };
    return quizState.players[newSocketId];
  },

  removePlayer: (socketId) => { /* ... (keep existing logic) ... */
    if (quizState.players[socketId]) {
      console.log(`Player ${quizState.players[socketId].name} (ID: ${socketId}) removed.`);
      delete quizState.players[socketId];
      if (quizState.bounceTurnPlayerId === socketId) quizState.bounceTurnPlayerId = null;
      quizState.bounceOrder = quizState.bounceOrder.filter(id => id !== socketId);
    }
  },

  updatePlayerConnectionStatus: (socketId, isConnected) => { /* ... (keep existing logic) ... */
    if (quizState.players[socketId]) {
      quizState.players[socketId].connected = isConnected;
      if (!isConnected && quizState.players[socketId].isQuizmaster) console.log("Quizmaster disconnected.");
    }
  },

  setQuizPhase: (phase) => {
    console.log(`Quiz phase changing from ${quizState.quizPhase} to: ${phase}`);
    quizState.quizPhase = phase;

    // Reset states based on new phase
    if (phase === 'question_pending_pounce_trigger' || phase === 'lobby' || phase === 'results' || phase === 'final_results') {
      quizState.pounceOptInEndTime = null;
      Object.values(quizState.players).forEach(player => {
        player.pouncedThisQuestion = false;
        player.pounceAnswer = null;
        player.pounceCorrect = null;
        player.hasOptedInPounce = false;
        player.pouncePersonalAnswerEndTime = null;
        if (phase !== 'results') { // Keep eligibility if just showing results, reset for new question cycle
            player.isEligibleForBounce = true;
        }
      });
    }
    if (phase === 'lobby') {
        quizState.currentQuestionIndex = -1;
        quizState.currentQuestionExternalId = null;
    }
    if (phase === 'results' || phase === 'final_results') {
        quizState.bounceTurnPlayerId = null;
        quizState.bounceOrder = [];
    }
    // Specific phase setup will be handled by QM actions (e.g., triggerPouncePhase)
  },

  startQuiz: () => { /* ... (keep existing logic for resetting scores etc.) ... */
    quizState.currentQuestionIndex = -1;
    Object.values(quizState.players).forEach(player => {
      if (!player.isQuizmaster) {
        player.score = 0; // Full reset of score
        // Other per-question states reset by setQuizPhase when new question starts
      }
    });
    // Initial phase after starting quiz, before first question is selected by QM
    stateManager.setQuizPhase('lobby');
    console.log('Quiz started (state aspect), player scores reset.');
  },

  // Called by QM action: nextQuestion / previousQuestion
  setCurrentQuestion: (questionIndex, externalId) => {
    quizState.currentQuestionIndex = questionIndex;
    quizState.currentQuestionExternalId = externalId || `Q${questionIndex + 1}`;
    // This phase indicates a question is active, but pounce not yet triggered by QM
    stateManager.setQuizPhase('question_pending_pounce_trigger');
    console.log(`Current question set to ${questionIndex + 1}. Phase: question_pending_pounce_trigger`);
    return quizState.questions[questionIndex];
  },

  // Called by QM action: triggerPouncePhase
  initiatePounceOptInPhase: () => {
    if (quizState.currentQuestionIndex === -1) return false; // No active question
    stateManager.setQuizPhase('pounce_opt_in');
    quizState.pounceOptInEndTime = Date.now() + 10000; // 10 seconds to opt-in
    console.log(`Pounce opt-in phase started. Ends at: ${new Date(quizState.pounceOptInEndTime).toLocaleTimeString()}`);
    return true;
  },

  // Called by Player action: playerOptInPounce
  recordPlayerPounceOptIn: (socketId) => {
    const player = quizState.players[socketId];
    if (!player || player.isQuizmaster || quizState.quizPhase !== 'pounce_opt_in' || player.hasOptedInPounce) {
      return { success: false, message: 'Cannot opt-in pounce at this time or already opted in.' };
    }
    if (Date.now() >= quizState.pounceOptInEndTime) {
      return { success: false, message: 'Pounce opt-in window closed.' };
    }
    player.hasOptedInPounce = true;
    player.pouncePersonalAnswerEndTime = Date.now() + 20000; // Player gets 20s from their opt-in time
    console.log(`Player ${player.name} opted-in for pounce. Answer deadline: ${new Date(player.pouncePersonalAnswerEndTime).toLocaleTimeString()}`);
    return { success: true, personalAnswerEndTime: player.pouncePersonalAnswerEndTime };
  },

  // Called by Player action: submitPounceAnswer
  recordPounceAnswer: (socketId, answer, isCorrect) => {
    const player = quizState.players[socketId];
     // Check if player opted in, if it's their answer window, and if they haven't already submitted
    if (!player || player.isQuizmaster || !player.hasOptedInPounce || player.pouncedThisQuestion) {
      return { success: false, message: 'Cannot submit pounce answer now or already submitted.'};
    }
    if (Date.now() >= player.pouncePersonalAnswerEndTime) {
      return { success: false, message: 'Your time to submit pounce answer is over.'};
    }

    player.pouncedThisQuestion = true; // Mark that they've submitted for this question
    player.pounceAnswer = answer;
    player.pounceCorrect = isCorrect;

    if (isCorrect) player.score += 20;
    else player.score -= 10;

    console.log(`Player ${player.name} pounced (${isCorrect ? 'Correct' : 'Incorrect'}). Score: ${player.score}`);
    return { success: true, score: player.score };
  },

  // New function to check if all pounce activity is concluded for the current question
  // This would be called by a timer on server, or after QM triggers bounce
  checkAndFinalizePouncePhase: () => {
    if (quizState.quizPhase !== 'pounce_opt_in' && quizState.quizPhase !== 'pounce_answering_window_active') {
      // Not in a pounce phase where this check is relevant
      // console.log("Not in active pounce phase to finalize.");
      return false; // No change in phase
    }

    const currentTime = Date.now();
    // Check if opt-in window is over
    if (currentTime < quizState.pounceOptInEndTime) {
      // console.log("Pounce opt-in window still open.");
      return false; // Opt-in window still open
    }

    // Opt-in window is over. Check if any players who opted-in still have time to answer.
    const activePouncers = Object.values(quizState.players).filter(p => p.hasOptedInPounce && !p.pouncedThisQuestion && currentTime < p.pouncePersonalAnswerEndTime);

    if (activePouncers.length > 0) {
      // console.log(`${activePouncers.length} players still have time to submit their pounce answers.`);
      // If opt-in is over, but players are answering, we can call this 'pounce_answering_window_active'
      if(quizState.quizPhase !== 'pounce_answering_window_active') {
           // This state transition is mostly for server logic; client might not need such fine-grained phase if pounce UI just depends on personal timers
          stateManager.setQuizPhase('pounce_answering_window_active');
      }
      return false; // Still waiting for answers
    }

    // All opt-in players have submitted or their time is up.
    console.log('All pounce activity concluded for this question.');
    stateManager.setQuizPhase('bounce_pending_evaluation'); // Or whatever phase follows pounce completion
    return true; // Phase changed
  },

  prepareBounceOrder: () => { /* ... (keep existing rotated logic) ... */
    const connectedEligiblePlayers = Object.values(quizState.players)
      .filter(p => p.connected && p.isEligibleForBounce && !p.isQuizmaster && !p.pounceCorrect) // Ensure correct pouncers are not eligible
      .sort((a, b) => a.id.localeCompare(b.id));

    if (connectedEligiblePlayers.length === 0) {
      quizState.bounceOrder = [];
      quizState.bounceTurnPlayerId = null;
      return;
    }
    const questionNumForOrder = quizState.currentQuestionIndex;
    let startIndex = 0;
    if (questionNumForOrder >=0) startIndex = questionNumForOrder % connectedEligiblePlayers.length;

    quizState.bounceOrder = [
      ...connectedEligiblePlayers.slice(startIndex),
      ...connectedEligiblePlayers.slice(0, startIndex)
    ].map(p => p.socketId);

    if (quizState.bounceOrder.length > 0) quizState.bounceTurnPlayerId = quizState.bounceOrder[0];
    else quizState.bounceTurnPlayerId = null;
  },

  advanceBounceTurn: () => { /* ... (keep existing logic) ... */
    if (quizState.bounceOrder.length === 0 || !quizState.bounceTurnPlayerId) {
      quizState.bounceTurnPlayerId = null; return null;
    }
    const currentIndex = quizState.bounceOrder.indexOf(quizState.bounceTurnPlayerId);
    if (currentIndex === -1 || currentIndex >= quizState.bounceOrder.length - 1) {
      quizState.bounceTurnPlayerId = null; return null;
    }
    quizState.bounceTurnPlayerId = quizState.bounceOrder[currentIndex + 1];
    return quizState.players[quizState.bounceTurnPlayerId];
  },

  markBounceAnswer: (socketId, isCorrect) => { /* ... (keep existing logic, ensure player.pounceCorrect makes them ineligible) ... */
    const player = quizState.players[socketId];
    if (player && socketId === quizState.bounceTurnPlayerId && quizState.quizPhase === 'bounce' && !player.isQuizmaster) {
      if (isCorrect) player.score += 10;
      player.isEligibleForBounce = false; // Player answered, no longer eligible for this question's bounce
    }
  },

  playerPassBounce: (socketId) => { /* ... (keep existing logic) ... */
    const player = quizState.players[socketId];
     if (player && socketId === quizState.bounceTurnPlayerId && quizState.quizPhase === 'bounce' && !player.isQuizmaster) {
      player.isEligibleForBounce = false; // Player passed, no longer eligible
    }
  },

  // GETTERS (ensure they reflect new player state properties if needed by clients)
  getPlayers: () => Object.values(quizState.players).filter(p => !p.isQuizmaster).map(p => ({
      id: p.id, name: p.name, score: p.score, connected: p.connected,
      // Pounce related status for client UI:
      hasOptedInPounce: p.hasOptedInPounce,
      pouncedThisQuestion: p.pouncedThisQuestion,
      pounceCorrect: p.pounceCorrect,
      pouncePersonalAnswerEndTime: p.pouncePersonalAnswerEndTime,
      isEligibleForBounce: p.isEligibleForBounce
  })),
  getQuizmaster: () => Object.values(quizState.players).find(p => p.isQuizmaster),
  getScores: () => Object.values(quizState.players).filter(p => !p.isQuizmaster).reduce((acc, p) => { acc[p.name] = p.score; return acc; }, {}),
  getLeaderboard: () => Object.values(quizState.players).filter(p => !p.isQuizmaster).map(p => ({ name: p.name, score: p.score, id: p.id })).sort((a, b) => b.score - a.score),
  getCurrentQuestion: () => {
    if (quizState.currentQuestionIndex >= 0 && quizState.currentQuestionIndex < quizState.questions.length) {
      // Only send metadata to clients. Full question text is on external presentation.
      const { id } = quizState.questions[quizState.currentQuestionIndex]; // Keep id for reference if needed
      return {
        id,
        questionNumber: quizState.currentQuestionIndex + 1,
        totalQuestions: quizState.questions.length,
        externalId: quizState.currentQuestionExternalId,
        // text: "Refer to main presentation for question content", // Optionally send a placeholder
        // media: null // Explicitly nullify media if it was part of it
      };
    }
    return null;
  },
  getPounceSubmissions: () => Object.values(quizState.players).filter(p => p.pouncedThisQuestion && !p.isQuizmaster).map(p => ({ name: p.name, answer: p.pounceAnswer, isCorrect: p.pounceCorrect })),

  // Adhoc points adjustment
  adjustPlayerScore: (playerId, pointsDelta) => {
    const player = Object.values(quizState.players).find(p => p.id === playerId && !p.isQuizmaster);
    if (player) {
        player.score += pointsDelta;
        console.log(`Adjusted score for ${player.name} by ${pointsDelta}. New score: ${player.score}`);
        return { success: true, newScore: player.score };
    }
    return { success: false, message: "Player not found or is Quizmaster." };
  }
};
module.exports = stateManager;
