import { SongContext } from "./song-context.js";
import { Stateful } from "./stateful.js";
import { State } from "./state.js";
import { TapeDeck, TransportEvent } from "./tape-deck.js";

/**
 * @implements {Stateful}
 */
export class MetronomeHandler {
  /** @type {AudioWorkletNode | null} */
  #metronomeNode = null;
  /** @type {AudioContext} */
  #audioCtx;

  state = new State({
    onWhenRecording: true, onWhenPlaying: true, level: 0.5
  }, null);

  /** @type {SongContext} */
  #songContext;

  /**
   * @param {AudioContext} audioCtx
   * @param {SongContext} songContext
   * @param {TapeDeck} tapeDeck
   */
  constructor(audioCtx, songContext, tapeDeck) {
    this.#audioCtx = audioCtx;
    this.#songContext = songContext;
    tapeDeck?.onTransportEvent(this.#handleTransportEvent.bind(this));
  }

  /**
   * 
   * @param {AudioContext} audioCtx 
   * @param {SongContext} songContext
   * @param {TapeDeck} tapeDeck
   */
  static async create(audioCtx, songContext, tapeDeck) {
    if (!songContext) {
      throw new Error('SongContext is required.');
    }
    const metronome = new MetronomeHandler(audioCtx, songContext, tapeDeck);
    await metronome.#audioCtx.audioWorklet.addModule('metronome-worker.js');
    metronome.#metronomeNode = new AudioWorkletNode(metronome.#audioCtx, 'metronome-processor');
    metronome.connect(audioCtx.destination);
    songContext.onSongTimeChanged(metronome.updateTempo.bind(metronome));
    metronome.state.addFieldCallback('level', () => metronome.updateTempo());
    return metronome;
  }

  /**
   * @param {TransportEvent} event
   */
  #handleTransportEvent(event) {
    if (event.transportAction === 'play') {
      this.start(event.audioCtxTimeS);
    } else if (event.transportAction === 'stop') {
      this.stop();
    }
  }


  /**
   * @param {AudioNode} output
   */
  connect(output) {
    if (!this.#metronomeNode) {
      throw new Error('MetronomeProcessor node not initialized.');
    }
    this.#metronomeNode.connect(output);
  }

  updateTempo() {
    const detail = {
      tempo: this.#songContext.tempo,
      beatsPerMeasure: this.#songContext.beatsPerMeasure,
      level: this.state.getNumber('level'),
    };
    console.log(JSON.stringify(detail));
    this.#metronomeNode.port.postMessage({
      method: 'set',
      detail
    });
  }

  /**
   * @param {number} audioContextTimeS
   */
  start(audioContextTimeS) {
    if (!this.#metronomeNode) {
      throw new Error('MetronomeProcessor node not initialized.');
    }
    if (!audioContextTimeS) {
      audioContextTimeS = this.#audioCtx.currentTime;
    }
    this.#metronomeNode.port.postMessage({
      method: 'set',
      detail: {
        tempo: this.#songContext.tempo,
        beatsPerMeasure: this.#songContext.beatsPerMeasure,
        level: this.state.getNumber('level'),
      }
    });
    this.#metronomeNode.port.postMessage({ method: 'start', detail: { audioContextTimeS } });
  }

  stop() {
    if (!this.#metronomeNode) {
      throw new Error('MetronomeProcessor node not initialized.');
    }
    this.#metronomeNode.port.postMessage({ method: 'stop' });
  }

  /**
   * @returns {Object}
   */
  getJSON() {
    return this.state.getJSON();
  }

}