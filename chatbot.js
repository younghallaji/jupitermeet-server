const OpenAI = require("openai");

const fetchSettings = require('./setting');

const conversations = {};
const lastRequestTime = {};
const userQuota = {};

let setting;
let openai;
let completion;

(async () => {
  setting = await fetchSettings();

  openai = new OpenAI({
    baseURL: setting.aiChatbotApiUrl,
    apiKey: setting.aiChatbotApiKey,
  });
})();

async function getChatBotResponse(socketId, message) {
  const now = Date.now();

  //make sure there is a gap before user sends another message
  if (lastRequestTime[socketId] && now - lastRequestTime[socketId] < setting.aiChatbotSeconds * 1000) {
    return 'Please wait before sending another message.';
  }

  if (!userQuota[socketId]) {
    userQuota[socketId] = 0;
  }

  //make sure to check the message limit
  if (userQuota[socketId] >= setting.aiChatbotMessageLimit) {
    return 'You have reached your meeting limit for chat requests.';
  }

  userQuota[socketId]++;

  lastRequestTime[socketId] = now;

  if (!conversations[socketId]) {
    conversations[socketId] = [];
  }

  //keep the conversation length under control
  if (conversations[socketId].length >= setting.aiChatbotMaxConversationLength * 2) {
    conversations[socketId].splice(0, 2);
  }

  //add user message to conversation history
  conversations[socketId].push({ role: 'user', content: message });

  try {
    completion = await openai.chat.completions.create({
      messages: conversations[socketId],
      model: setting.aiChatbotModel,
    });
  } catch (e) {
    return e.message || 'Error occurred while processing your request.';
  }

  const reply = completion.choices[0].message.content;
  conversations[socketId].push({ role: 'assistant', content: reply });

  return reply;
}

// remove socketId from the conversations arrays
const removeUserId = function (socketId) {
  delete conversations[socketId];
  delete lastRequestTime[socketId];
  delete userQuota[socketId];
}

module.exports = { getChatBotResponse, removeUserId };

