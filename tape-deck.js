// @ts-check

export class TapeDeck {
  /** @type {AudioContext} */
  #audioCtx;
  /** @type {AudioWorkletNode | null} */
  #recorderNode = null;

  constructor(audioCtx) {
    this.#audioCtx = audioCtx;
    this.#audioCtx.audioWorklet.addModule('record-worker.js').then(() => {
      this.#recorderNode = new AudioWorkletNode(this.#audioCtx, 'record-processor');
      console.log('RecordProcessor worklet node created.');
      // You can connect the node or set up message listeners here if needed.
    }).catch(err => {
      console.error('Failed to load or instantiate record-worker:', err);
    });
  }

  /**
   * 
   * @param {AudioNode} input 
   */
  setInput(input) {

  }

  /**
   * 
   * @param {AudioNode} output 
   */
  setOutput(output) {

  }

}