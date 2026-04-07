const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

async function getAiDescription(keyword, round) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const prompt = `Bạn đang chơi trò chơi Spy Game. Từ khóa của bạn là: "${keyword}". 
Đây là vòng ${round}. Hãy mô tả từ khóa này trong 1-2 câu ngắn gọn, 
tự nhiên, không được nói thẳng từ khóa. Chỉ trả lời phần mô tả, không thêm gì khác.`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    return text || 'Đây là một thứ gì đó rất thú vị.';
  } catch (err) {
    console.error('[AI] Error:', err.message);
    return 'Đây là một thứ gì đó rất thú vị.';
  }
}

async function askAi(prompt) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (err) {
    console.error('[AI] Error:', err.message);
    return 'AI không thể trả lời lúc này.';
  }
}

module.exports = { getAiDescription, askAi };
