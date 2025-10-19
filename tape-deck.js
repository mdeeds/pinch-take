// @ts-check



export class TapeDeck {
  /** @type {AudioContext} */
  #audioCtx;
  /** @type {AudioWorkletNode | null} */
  #recorderNode = null;
  /** @type {AudioWorkletNode | null} */
  #metronomeNode = null;

  /**
   * 
   * @param {AudioContext} audioCtx 
   */
  constructor(audioCtx) {
    this.#audioCtx = audioCtx;
    this.#audioCtx.audioWorklet.addModule('record-worker.js').then(() => {
      this.#recorderNode = new AudioWorkletNode(this.#audioCtx, 'record-processor');
      console.log('RecordProcessor worklet node created.');
      // You can connect the node or set up message listeners here if needed.
    }).catch(err => {
      console.error('Failed to load or instantiate record-worker:', err);
    });

    this.#audioCtx.audioWorklet.addModule('metronome-worker.js').then(() => {
      this.#metronomeNode = new AudioWorkletNode(this.#audioCtx, 'metronome-processor');
      console.log('MetronomeProcessor worklet node created.');
    }).catch(err => {
      console.error('Failed to load or instantiate metronome-worker:', err);
    });
  }

  /**
   * 
   * @param {AudioNode} input 
   */
  setInput(input) {
    if (!this.#recorderNode) {
      throw new Error('RecordProcessor node not initialized.');
    }
    input.connect(this.#recorderNode);
  }

  /**
   * 
   * @param {AudioNode} output 
   */
  setOutput(output) {
    if (!this.#metronomeNode) {
      throw new Error('MetronomeProcessor node not initialized.');
    }
    this.#metronomeNode.connect(output);
  }

}