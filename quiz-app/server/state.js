const quizState = {
  currentQuestionIndex: -1,
  currentPhase: null, // Possible phases: 'question', 'pounce', 'bounce', 'answer'
  quizStatus: 'not_started', // Possible statuses: 'not_started', 'active', 'finished'
  players: {},
  pounceAnswers: {},
  // More state properties will be added later (e.g., scores, questions)
};

function addPlayer(playerId, playerName) {
  if (quizState.players[playerId]) {
    console.log(`Player with ID ${playerId} already exists.`);
  } else {
    quizState.players[playerId] = {
      id: playerId,
      name: playerName,
      score: 0,
    };
  }
}

function updateScore(playerId, points) {
  if (quizState.players[playerId]) {
    quizState.players[playerId].score += points;
  } else {
    console.log(`Player with ID ${playerId} not found.`);
  }
}

function recordPounceAnswer(playerId, answer) {
  quizState.pounceAnswers[playerId] = answer;
}

function clearPounceAnswers() {
  quizState.pounceAnswers = {};
}

function incrementQuestion() {
  quizState.currentQuestionIndex++;
  quizState.currentPhase = 'question'; // Reset phase when starting a new question
  // Potentially add logic here to check if quiz is over
}

function setPhase(phase) {
  quizState.currentPhase = phase;
}

function startQuiz() {
  quizState.quizStatus = 'active';
  quizState.currentQuestionIndex = -1; // Reset to -1, will be incremented when first question starts
  quizState.currentPhase = null;
  quizState.pounceAnswers = {};
  // Don't reset players and scores - they should persist
  console.log('Quiz started successfully');
}

function endQuiz() {
  quizState.quizStatus = 'finished';
  quizState.currentPhase = 'finished';
  quizState.pounceAnswers = {};
  console.log('Quiz ended successfully');
}

function resetQuiz() {
  quizState.currentQuestionIndex = -1;
  quizState.currentPhase = null;
  quizState.quizStatus = 'not_started';
  quizState.players = {};
  quizState.pounceAnswers = {};
  console.log('Quiz reset successfully');
}

// Function to get the current state (optional, but can be useful)
function getQuizState() {
  return {
    ...quizState,
    players: { ...quizState.players },
    pounceAnswers: { ...quizState.pounceAnswers },
  }; // Return a copy to prevent direct modification
}

module.exports = {
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
  resetQuiz,
};
