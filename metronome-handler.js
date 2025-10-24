import { SongContext } from "./song-context.js";
import { TapeDeck, TransportEvent } from "./tape-deck.js";
import { SyncTime } from "./sync-time.js";

export class MetronomeSettings {
  /** @type {boolean} */
  onWhenRecording;
  /** @type {boolean} */
  onWhenPlaying;

  /**
   * @param {{onWhenRecording: boolean, onWhenPlaying: boolean}} args
   */
  constructor(args) {
    this.onWhenRecording = args.onWhenRecording;
    this.onWhenPlaying = args.onWhenPlaying;
  }

}

export class MetronomeHandler {
  /** @type {AudioWorkletNode | null} */
  #metronomeNode = null;
  /** @type {AudioContext} */
  #audioCtx;

  settings = new MetronomeSettings({
    onWhenRecording: true, onWhenPlaying: true
  });

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
    this.#audioCtx.audioWorklet.addModule('metronome-worker.js').then(() => {
      this.#metronomeNode = new AudioWorkletNode(this.#audioCtx, 'metronome-processor');
      console.log('MetronomeProcessor worklet node created.');
    }).catch(err => {
      console.error('Failed to load or instantiate metronome-worker:', err);
    });
    if (tapeDeck) {
      tapeDeck.onTransportEvent(this.#handleTransportEvent.bind(this));
    }
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
    console.log('MetronomeProcessor worklet node created.');
    songContext.onSongTimeChanged(metronome.updateTempo.bind(metronome));
    return metronome;
  }

  /**
   * @param {TransportEvent} event
   */
  #handleTransportEvent(event) {
    if (event.transportAction === 'play') {
      const position = new SyncTime();
      position.audioCtxTimeS = event.audioCtxTimeS;
      position.tapeTimeS = event.tapeTimeS;
      this.start(position);
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
    this.#metronomeNode.port.postMessage({
      method: 'set',
      detail: {
        tempo: this.#songContext.tempo,
        beatsPerMeasure: this.#songContext.beatsPerMeasure,
      }
    });
  }

  /**
   * @param {SyncTime} position
   */
  start(position) {
    if (!this.#metronomeNode) {
      throw new Error('MetronomeProcessor node not initialized.');
    }
    if (!position.audioCtxTimeS) {
      position.audioCtxTimeS = this.#audioCtx.currentTime;
    }
    this.#metronomeNode.port.postMessage({
      method: 'set',
      detail: {
        tempo: this.#songContext.tempo,
        beatsPerMeasure: this.#songContext.beatsPerMeasure,
      }
    });
    this.#metronomeNode.port.postMessage({ method: 'start', detail: position });
  }

  stop() {
    if (!this.#metronomeNode) {
      throw new Error('MetronomeProcessor node not initialized.');
    }
    this.#metronomeNode.port.postMessage({ method: 'stop' });
  }

}