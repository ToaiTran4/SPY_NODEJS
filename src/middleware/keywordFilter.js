// middleware/keywordFilter.js

function createKeywordFilter(getKeywordForUser) {
  return async function keywordFilterMiddleware(req, res, next) {
    try {
      const userId = req.user?.id || req.user?._id;
      const message = req.body?.message || req.body?.content || '';

      if (!message || !userId) return next();

      const keyword = await getKeywordForUser(userId, req.body?.match_id);

      if (!keyword) return next();

      const normalize = (str) =>
        str.toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/đ/g, 'd')
          .trim();

      const normalizedMessage = normalize(message);
      const normalizedKeyword = normalize(keyword);

      if (normalizedMessage.includes(normalizedKeyword)) {
        return res.status(400).json({
          success: false,
          message: 'Bạn không được nhắc đến từ khóa của mình! Hãy mô tả khéo hơn 😏',
        });
      }

      next();
    } catch (err) {
      console.error('[KeywordFilter] Error:', err.message);
      next();
    }
  };
}

module.exports = { createKeywordFilter };