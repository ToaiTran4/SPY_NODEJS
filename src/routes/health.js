const router = require('express').Router();
router.get('/', (req, res) => res.json({ status: 'ok', service: 'spy-game-backend-nodejs', time: new Date() }));
module.exports = router;
