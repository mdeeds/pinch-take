// @ts-check

import { GeminiChat } from './gemini-chat.js';
import metronomeTool from './metronome-tool.js';
import { SpeechToText } from './speech-to-text.js';

const chatHistoryElement = document.getElementById('chat-history');
const chatInputElement = /** @type {HTMLInputElement} */ (document.getElementById('chat-input'));
const sendButton = document.getElementById('send-button');
const micButton = document.getElementById('mic-button');

async function main() {
  if (!chatHistoryElement || !chatInputElement || !sendButton || !micButton) {
    throw new Error('Could not find required chat elements in the DOM.');
  }

  let apiKey = '';
  try {
    const response = await fetch('/api.key');
    if (!response.ok) {
      throw new Error(`Failed to fetch API key: ${response.statusText}`);
    }
    apiKey = (await response.text()).trim();
  } catch (error) {
    console.error(error);
    chatHistoryElement.innerHTML = `
      <div class="message model-message">
        Could not load API key from <code>/api.key</code>. Please make sure it exists and is accessible.
      </div>`;
    return;
  }

  if (!apiKey) {
    chatHistoryElement.innerHTML = `
      <div class="message model-message">
        The <code>/api.key</code> file is empty. Please add your Google AI API key to it.
        You can get a key from <a href="https://aistudio.google.com/app/apikey" target="_blank">Google AI Studio</a>.
      </div>`;
    return;
  }

  const geminiChat = new GeminiChat(apiKey, chatHistoryElement);
  geminiChat.addTool(metronomeTool);

  sendButton.addEventListener('click', () => {
    const message = chatInputElement.value;
    geminiChat.sendMessage(message);
    chatInputElement.value = '';
  });

  // --- Speech to Text Integration ---

  const handleSpeechResult = (transcript) => {
    // Append the transcribed command to the input field
    chatInputElement.value += ' ' + transcript.trim();
  };

  const speechToText = new SpeechToText(handleSpeechResult);

  micButton.addEventListener('click', () => {
    speechToText.start();
    micButton.textContent = '👂'; // Change icon to indicate listening
    micButton.style.backgroundColor = '#28a745'; // Green color for active state
  });
}

main();