
export class MetronomeSettings {
  /** @type {number} */
  tempo;
  /** @type {number} */
  beatsPerMeasure;
  /** @type {boolean} */
  onWhenRecording;
  /** @type {boolean} */
  onWhenPlaying;

  /**
   * @param {{tempo: number, beatsPerMeasure: number, onWhenRecording: boolean, onWhenPlaying: boolean}} args
   */
  constructor(args) {
    this.tempo = args.tempo;
    this.beatsPerMeasure = args.beatsPerMeasure;
    this.onWhenRecording = args.onWhenRecording;
    this.onWhenPlaying = args.onWhenPlaying;
  }

}

export class MetronomeHandler {
  /** @type {AudioWorkletNode | null} */
  #metronomeNode = null;
  /** @type {AudioContext} */
  #audioCtx;

  #settings = new MetronomeSettings({
    tempo: 120, beatsPerMeasure: 4, onWhenRecording: true, onWhenPlaying: true
  });

  /**
   * @param {AudioContext} audioCtx
   */
  constructor(audioCtx) {
    this.#audioCtx = audioCtx;
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
   * @returns 
   */
  static async create(audioCtx) {
    const metronome = new MetronomeHandler(audioCtx);
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

  updateSettings(newSettings) {
    Object.assign(this.#settings, newSettings);
    this.#metronomeNode.port.postMessage({ method: 'set', detail: this.#settings });
  }

  getSettings() {
    return { ...this.#settings };
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
    this.#metronomeNode.port.postMessage({ method: 'set', detail: this.#settings });
    this.#metronomeNode.port.postMessage({ method: 'start', detail: position });
  }

  stop() {
    if (!this.#metronomeNode) {
      throw new Error('MetronomeProcessor node not initialized.');
    }
    this.#metronomeNode.port.postMessage({ method: 'stop' });
  }

}