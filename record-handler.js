// @ts-check

/**
 * @typedef {Object} SampleData
 * @property {'samples'} type
 * @property {Float32Array} samples
 * @property {number} rms
 * @property {number} peak
 * @property {number} maxPeakIndex
 * @property {number} startFrame
 * @property {number} startTimeS
 */

/**
 * @typedef {(data: SampleData) => void} SampleCallback
 */

export class RecordHandler {
  /** @type {AudioWorkletNode | null} */
  #recorderNode = null;
  /** @type {AudioContext} */
  #audioCtx;
  /** @type {SampleCallback[]} */
  onSamples = [];

  static LOCAL_STOARGE_LATENCY_COMPENSATION_KEY = "record-handler-latency-compensation";

  /** @type {number} */
  #latencyCompensationFrames = 0;

  /**
   * @param {AudioContext} audioCtx
   */
  constructor(audioCtx) {
    this.#audioCtx = audioCtx;
    this.onSamples = [];
  }

  /**
   * Asynchronously creates and initializes a RecordHandler.
   * @param {AudioContext} audioCtx
   * @returns {Promise<RecordHandler>}
   */
  static async create(audioCtx) {
    const handler = new RecordHandler(audioCtx);
    await audioCtx.audioWorklet.addModule('record-worker.js');
    handler.#recorderNode = new AudioWorkletNode(audioCtx, 'record-processor');
    handler.#recorderNode.port.onmessage = handler.#handleMessage.bind(handler);
    const storedCompensation = localStorage.getItem(RecordHandler.LOCAL_STOARGE_LATENCY_COMPENSATION_KEY);
    if (storedCompensation) {
      console.log('Loaded compensation: ', storedCompensation);
      handler.setLatencyCompensation(parseFloat(storedCompensation));
    }
    console.log('RecordProcessor worklet node created.');
    return handler;
  }

  /**
   * @param {MessageEvent} event
   */
  #handleMessage(event) {
    if (event.data.type === 'samples') {
      // Apply latency compensation
      const data = event.data;
      data.startFrame -= this.#latencyCompensationFrames;
      data.startTimeS -= this.#latencyCompensationFrames / this.#audioCtx.sampleRate;

      for (const callback of this.onSamples) {
        callback(event.data);
      }
    }
  }

  /**
   * Connects an audio source to the recorder input.
   * @param {AudioNode} input
   */
  connectInput(input) {
    if (!this.#recorderNode) {
      throw new Error('RecordProcessor node not initialized.');
    }
    input.connect(this.#recorderNode);
  }

  /**
   * Sets the latency compensation for recorded audio.
   * @param {number} seconds - The latency to compensate for, in seconds.
   * A positive value means the recorded audio is arriving late and its timestamp should be adjusted backwards.
   */
  setLatencyCompensation(seconds) {
    this.#latencyCompensationFrames = Math.round(seconds * this.#audioCtx.sampleRate);
    localStorage.setItem(RecordHandler.LOCAL_STOARGE_LATENCY_COMPENSATION_KEY, seconds.toString());
  }

  /**
   * Gets the current latency compensation in seconds.
   * @returns {number}
   */
  getLatencyCompensation() {
    return this.#latencyCompensationFrames / this.#audioCtx.sampleRate;
  }

  /**
   * Adds a callback function to be invoked when new audio samples are received.
   * @param {SampleCallback} callback
   */
  addSampleCallback(callback) {
    this.onSamples.push(callback);
  }
}