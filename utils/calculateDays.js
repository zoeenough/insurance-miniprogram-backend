function calculateRemainingDays(startTime, activationTime) {
  const now = new Date();

  if (activationTime) {
    const activationDate = new Date(activationTime);
    const daysSinceActivation = Math.floor((now - activationDate) / (1000 * 60 * 60 * 24));
    const remainingDays = 365 - daysSinceActivation;
    return remainingDays;
  } else if (startTime) {
    const startDate = new Date(startTime);
    const daysSinceStart = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));
    const remainingDays = 450 - daysSinceStart;
    return remainingDays;
  }

  return 0;
}

module.exports = {
  calculateRemainingDays
};
