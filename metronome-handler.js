import { SongContext } from "./song-context.js";

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
   */
  constructor(audioCtx, songContext) {
    this.#audioCtx = audioCtx;
    this.#songContext = songContext;
    this.#audioCtx.audioWorklet.addModule('metronome-worker.js').then(() => {
      this.#metronomeNode = new AudioWorkletNode(this.#audioCtx, 'metronome-processor');
      console.log('MetronomeProcessor worklet node created.');
    }).catch(err => {
      console.error('Failed to load or instantiate metronome-worker:', err);
    });
  }

  /**
   * 
   * @param {AudioContext} audioCtx 
   * @param {SongContext} songContext
   * @returns 
   */
  static async create(audioCtx, songContext) {
    if (!songContext) {
      throw new Error('SongContext is required.');
    }
    const metronome = new MetronomeHandler(audioCtx, songContext);
    await metronome.#audioCtx.audioWorklet.addModule('metronome-worker.js');
    metronome.#metronomeNode = new AudioWorkletNode(metronome.#audioCtx, 'metronome-processor');
    metronome.connect(audioCtx.destination);
    console.log('MetronomeProcessor worklet node created.');
    return metronome;
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

  updateTempo(newSettings) {
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