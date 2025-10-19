// @ts-check

/**
 * A class to handle Text-to-Speech using the browser's built-in capabilities.
 */
export class TextToSpeech {
  /** @type {SpeechSynthesis | null} */
  #synth = null;
  /** @type {SpeechSynthesisVoice | null} */
  #selectedVoice = null;

  constructor() {
    if ('speechSynthesis' in window) {
      this.#synth = window.speechSynthesis;
      // Voices are loaded asynchronously. We need to wait for the 'voiceschanged' event.
      this.#synth.onvoiceschanged = this.loadAndSetVoice.bind(this);
      // Some browsers load voices without firing the event, so we also call it directly.
      this.loadAndSetVoice();
    } else {
      console.error('Text-to-Speech is not supported in this browser.');
    }
  }

  /**
   * Loads available voices, logs them, and sets the desired voice.
   */
  loadAndSetVoice() {
    if (!this.#synth) return;
    const voices = this.#synth.getVoices();
    if (voices.length > 0) {
      console.log('Available speech synthesis voices:', voices);

      const femaleVoice = voices.find(voice => voice.name.toLowerCase().includes('female'));
      if (femaleVoice) {
        this.#selectedVoice = femaleVoice;
        console.log('Female voice selected:', this.#selectedVoice);
      } else {
        console.warn("No voice with 'female' in its name found. Using browser default.");
      }

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
    if (this.#selectedVoice) {
      utterance.voice = this.#selectedVoice;
    }
    utterance.rate = 1.2; // Set playback speed to 150%

    this.#synth.speak(utterance);
  }
}