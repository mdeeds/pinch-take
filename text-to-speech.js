// @ts-check

/**
 * A class to handle Text-to-Speech using the browser's built-in capabilities.
 */
export class TextToSpeech {
  /** @type {SpeechSynthesis | null} */
  #synth = null;

  constructor() {
    if ('speechSynthesis' in window) {
      this.#synth = window.speechSynthesis;
      // Voices are loaded asynchronously. We need to wait for the 'voiceschanged' event.
      this.#synth.onvoiceschanged = this.logAvailableVoices.bind(this);
      // Some browsers load voices without firing the event, so we also call it directly.
      this.logAvailableVoices();
    } else {
      console.error('Text-to-Speech is not supported in this browser.');
    }
  }

  /**
   * Logs the available speech synthesis voices to the console.
   */
  logAvailableVoices() {
    if (!this.#synth) return;
    const voices = this.#synth.getVoices();
    if (voices.length > 0) {
      console.log('Available speech synthesis voices:', voices);
      // We only need to log this once, so we can remove the event listener.
      this.#synth.onvoiceschanged = null;
    }
  }

  /**
   * Speaks the given text using the browser's TTS engine.
   * @param {string} text The text to speak.
   */
  speak(text) {
    if (!this.#synth) {
      console.warn('Speech synthesis not available, cannot speak.');
      return;
    }

    if (this.#synth.speaking) {
      this.#synth.cancel(); // Stop any currently speaking utterance before starting a new one.
    }

    const utterance = new SpeechSynthesisUtterance(text);
    this.#synth.speak(utterance);
  }
}