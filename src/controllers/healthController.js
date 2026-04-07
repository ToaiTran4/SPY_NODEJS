const getHealth = (req, res) => {
  res.json({
    status: 'ok',
    service: 'spy-game-backend-nodejs',
    time: new Date()
  });
};

module.exports = {
  getHealth
};
