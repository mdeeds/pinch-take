// @ts-check

import { GeminiChat } from './gemini-chat.js';
import { ChatUI } from './chat-ui.js';
import { SpeechToText } from './speech-to-text.js';
import { TextToSpeech } from './text-to-speech.js';
import { MetronomeTool } from './metronome-tool.js';
import { SectionTool, SongTool } from './song-tool.js';
import { SongContext } from './song-context.js';
import { TapeDeck } from './tape-deck.js';
import { MetronomeHandler } from './metronome-handler.js';
import { TapeDeckTool } from './tape-deck-tool.js';
import { RecordHandler } from './record-handler.js';
import { BeatVU } from './beat-vu.js';
import { Mixer } from './mixer.js';
import { MixerTool } from './mixer-tool.js';

const chatHistoryElement = document.getElementById('chat-history');
const chatInputElement = /** @type {HTMLInputElement} */ (document.getElementById('chat-input'));
const sendButton = document.getElementById('send-button');
const micButton = document.getElementById('mic-button');

/**
 * 
 * @param {AudioContext} audioCtx 
 */
async function getDefaultAudioInput(audioCtx) {
  const constraints = {
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
  };

  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    console.log('Acquired audio stream with constraints:', constraints.audio);
    return audioCtx.createMediaStreamSource(stream);
  } catch (err) {
    throw new Error(`Error getting audio input: ${err.message}`);
  }
}

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

  const chatUI = new ChatUI(chatHistoryElement);
  const textToSpeech = new TextToSpeech();

  const handleModelMessage = (message) => {
    chatUI.displayMessage(message, 'model-message');
    textToSpeech.speak(message);
  };

  const geminiChat = new GeminiChat(apiKey, handleModelMessage);
  const songContext = new SongContext();
  const songTool = new SongTool(songContext);
  geminiChat.addTool(songTool);
  const sectionTool = new SectionTool(songContext);
  geminiChat.addTool(sectionTool);


  /**
   * Handles sending the user's message from the input field.
   */
  const handleSendMessage = () => {
    const message = chatInputElement.value.trim();
    if (!message) return; // Don't send empty messages

    chatUI.displayMessage(message, 'user-message');
    geminiChat.sendMessage(message).catch(console.error);
    chatInputElement.value = '';
  };

  sendButton.addEventListener('click', handleSendMessage);

  chatInputElement.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault(); // Prevents adding a new line in the input
      handleSendMessage();
    }
  });

  // --- Speech to Text Integration ---

  /**
   * 
   * @param {string} transcript 
   */
  const handleSpeechResult = (transcript) => {
    // Append the transcribed command to the input field
    chatInputElement.value += ' ' + transcript.trim();
  };

  const speechToText = new SpeechToText(handleSpeechResult);

  micButton.addEventListener('click', async () => {
    speechToText.start();
    micButton.textContent = '👂'; // Change icon to indicate listening
    micButton.style.backgroundColor = '#28a745'; // Green color for active state

    try {
      const audioCtx = new AudioContext();

      const source = await getDefaultAudioInput(audioCtx);

      const recorder = await RecordHandler.create(audioCtx);
      recorder.connectInput(source);

      const mixer = new Mixer(audioCtx);
      const mixerTool = new MixerTool(mixer);
      geminiChat.addTool(mixerTool);

      const tapeDeck = new TapeDeck(audioCtx, recorder, mixer);
      const tapeDeckTool = new TapeDeckTool(tapeDeck);
      geminiChat.addTool(tapeDeckTool);

      const vu = new BeatVU(audioCtx, document.body, recorder, songContext, tapeDeck);

      const metronomeHandler = await MetronomeHandler.create(
        audioCtx, songContext, tapeDeck);
      const metronomeTool = new MetronomeTool(metronomeHandler);
      geminiChat.addTool(metronomeTool);


      tapeDeck.setOutput(audioCtx.destination);
      console.log('TapeDeck initialized and connected to default I/O.');
    } catch (err) {
      console.error('Failed to initialize audio components:', err);
    }
  });
}

main();