// @ts-check

import { MetronomeHandler } from "./metronome-handler.js";
import { RecordHandler } from "./record-handler.js";
import { SyncTime } from "./sync-time.js";


export class TapeDeck {
  /** @type {AudioContext} */
  #audioCtx;

  /** @type {MetronomeHandler} */
  #metronome;

  /** @type {RecordHandler} */
  #recorder;

  /**@type {number} */
  #tapePositionS = 0;

  /**
   * 
   * @param {AudioContext} audioCtx 
   * @param {MetronomeHandler} metronome
   * @param {RecordHandler} recorder
   */
  constructor(audioCtx, metronome, recorder) {
    this.#audioCtx = audioCtx;
    this.#metronome = metronome;
    this.#recorder = recorder;
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