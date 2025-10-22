// @ts-check

import { MetronomeHandler } from "./metronome-handler.js";
import { SyncTime } from "./sync-time.js";


export class TapeDeck {
  /** @type {AudioContext} */
  #audioCtx;
  /** @type {AudioWorkletNode | null} */
  #recorderNode = null;

  /** @type {MetronomeHandler} */
  #metronome;

  /**@type {number} */
  #tapePositionS = 0;

  /**
   * 
   * @param {AudioContext} audioCtx 
   * @param {MetronomeHandler} metronome
   */
  constructor(audioCtx, metronome) {
    this.#metronome = metronome;
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
  }

  //////////////////////
  // TRANSPORT CONTROL
  // All transport (play, record, stop) operations are specified in "tape time".  This is
  // the number of seconds from the beginning of the tape.  Interally, the tape deck will convert
  // this to the audio context time as appropriate.
  //////////////////////

  // setPunchInOut(punchInS, punchOutS) {
  // }

  /**
   * 
   * @param {SyncTime} position 
   */
  startPlayback(position) {
    this.#metronome.start(position);
  }

  stop() {
    this.#metronome.stop();
  }

}