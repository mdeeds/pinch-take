// @ts-check

/**
 * @typedef {Object} SampleData
 * @property {Float32Array} samples
 * @property {number} startTime
 * @property {any} id
 */

/**
 * @typedef {(data: SampleData) => void} SampleCallback
 */

export class RecordHandler {
  /** @type {AudioWorkletNode | null} */
  #recorderNode = null;
  /** @type {AudioContext} */
  #audioCtx;
  /** @type {SampleCallback | null} */
  onSamples = null;

  /**
   * @param {AudioContext} audioCtx
   */
  constructor(audioCtx) {
    this.#audioCtx = audioCtx;
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
    console.log('RecordProcessor worklet node created.');
    return handler;
  }

  /**
   * @param {MessageEvent} event
   */
  #handleMessage(event) {
    if (event.data.type === 'sample' && this.onSamples) {
      this.onSamples(event.data);
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
   * @param {{id: any, in: number, out: number}} args
   */
  punch(args) {
    if (!this.#recorderNode) {
      throw new Error('RecordProcessor node not initialized.');
    }
    this.#recorderNode.port.postMessage({ method: 'punch', ...args });
  }

  stop() {
    if (!this.#recorderNode) {
      throw new Error('RecordProcessor node not initialized.');
    }
    this.#recorderNode.port.postMessage({ method: 'stop' });
  }
}