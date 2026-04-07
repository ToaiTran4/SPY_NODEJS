const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

async function getAiDescription(keyword, round) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const prompt = `Bạn đang chơi trò chơi miêu tả từ khóa. Từ khóa của bạn là: "${keyword}", đừng để bị lộ. 
 Hãy mô tả từ khóa này trong 2-3 từ ngắn gọn, tự nhiên một cách trực tiếp. Vd:"nó to to á".Ko được dẫn dắt lại dài dòng`;

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
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (err) {
    console.error('[AI] Error:', err.message);
    return 'AI không thể trả lời lúc này.';
  }
}

module.exports = { getAiDescription, askAi };
