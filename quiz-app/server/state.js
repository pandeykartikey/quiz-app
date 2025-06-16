const quizState = {
  currentQuestionIndex: -1,
  currentPhase: null, // Possible phases: 'question', 'answer', 'finished'
  // More state properties will be added later (e.g., scores, questions)
};

function incrementQuestion() {
  quizState.currentQuestionIndex++;
  // Potentially add logic here to check if quiz is over
}

function setPhase(phase) {
  quizState.currentPhase = phase;
}

// Function to get the current state (optional, but can be useful)
function getQuizState() {
  return { ...quizState }; // Return a copy to prevent direct modification
}

module.exports = {
  quizState,
  incrementQuestion,
  setPhase,
  getQuizState,
};
