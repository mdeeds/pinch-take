// @ts-check

import { MetronomeHandler } from "./metronome-handler.js";
import { RecordHandler } from "./record-handler.js";

export class TransportEvent {
  /** @type {string} */
  transportAction = 'play';
  /** @type {number} */
  audioCtxTimeS = 0;
  /** @type {number} */
  tapeTimeS = 0;
}

export class TapeDeck {
  /** @type {AudioContext} */
  #audioCtx;

  /** @type {RecordHandler} */
  #recorder;

  /** @type {number} */
  #tapeZeroTime = 0;

  /** @type {((event: TransportEvent) => void)[]} */
  #onTransportEventCallbacks = [];

  /**
   * 
   * @param {AudioContext} audioCtx 
   * @param {RecordHandler} recorder
   */
  constructor(audioCtx, recorder) {
    this.#audioCtx = audioCtx;
    this.#recorder = recorder;
  }

  /**
   * @param {(event: TransportEvent) => void} callback
   */
  onTransportEvent(callback) {
    this.#onTransportEventCallbacks.push(callback);
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

  /**
   * 
   * @param {number} tapeTimeS
   */
  startPlayback(tapeTimeS) {
    const nowTimeS = this.#audioCtx.currentTime;
    const event = new TransportEvent();
    event.transportAction = 'play';
    event.audioCtxTimeS = nowTimeS
    event.tapeTimeS = tapeTimeS;

    this.#tapeZeroTime = nowTimeS - tapeTimeS;

    for (const callback of this.#onTransportEventCallbacks) {
      callback(event);
    }
  }

  stop() {
    const nowTimeS = this.#audioCtx.currentTime;
    const tapeTimeS = nowTimeS - this.#tapeZeroTime;
    const event = new TransportEvent();
    event.transportAction = 'stop';
    event.audioCtxTimeS = nowTimeS;
    event.tapeTimeS = tapeTimeS;
    for (const callback of this.#onTransportEventCallbacks) {
      callback(event);
    }
  }

}