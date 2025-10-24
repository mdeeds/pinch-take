// @ts-check

const LISTEN_KEYWORD = "monkey";

/**
 * A class that uses the built-in JavaScript SpeechRecognition interface to listen
 * for a keyword and trigger a callback.
 */
export class SpeechToText {
  /**
   * @param {function(string): void} onResultCallback The callback to execute when the keyword is detected.
   * It receives the finalized transcript.
   */
  constructor(onResultCallback) {
    this.onResultCallback = onResultCallback;
    this.isListening = false;
    this.isTranscribing = false;
    this.recognition = null;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.error('Speech Recognition API is not supported in this browser.');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';

    this.recognition.onresult = this.onResult.bind(this);
    this.recognition.onend = this.onEnd.bind(this);
    this.recognition.onerror = this.onError.bind(this);
  }

  /**
   * Starts the speech recognition service.
   */
  start() {
    if (!this.recognition) {
      console.error('Speech recognition is not initialized.');
      return;
    }
    if (this.isListening) {
      console.warn('Speech recognition is already running.');
      return;
    }
    this.isListening = true;
    this.recognition.start();
    console.log('Speech recognition started. Listening...');
  }

  /**
   * Stops the speech recognition service.
   */
  stop() {
    if (!this.recognition || !this.isListening) {
      return;
    }
    this.isListening = false;
    this.recognition.stop();
    console.log('Speech recognition stopped.');
  }

  /**
   * Handles the 'result' event from the SpeechRecognition API.
   * @param {SpeechRecognitionEvent} event
   */
  onResult(event) {
    let finalTranscript = '';
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript;
      }
    }

    const keywordIndex = finalTranscript.toLowerCase().indexOf(LISTEN_KEYWORD);
    if (keywordIndex !== -1) {
      console.log(`Keyword "${LISTEN_KEYWORD}" detected.`);
      this.isTranscribing = true;
      // Remove the keyword and everything before it
      const command = finalTranscript.substring(keywordIndex + LISTEN_KEYWORD.length);
      this.onResultCallback(command.trim());
    }
  }

  /**
   * Handles the 'end' event, restarting recognition if it was not intentionally stopped.
   */
  onEnd() {
    if (this.isListening) {
      this.isTranscribing = false;
      // console.log('Speech recognition service ended, restarting...');
      this.recognition.start();
    }
  }

  onError(event) {
    // It's fine if the user isn't talking right now.  Just ignore that error.
    if (event.error != 'no-speech') {
      console.error('Speech recognition error:', event.error);
    }
  }
}