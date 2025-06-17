const quizState = {
  currentQuestionIndex: -1,
  currentPhase: null, // Possible phases: 'question', 'answer', 'finished'
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
  // Potentially add logic here to check if quiz is over
}

function setPhase(phase) {
  quizState.currentPhase = phase;
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
};
