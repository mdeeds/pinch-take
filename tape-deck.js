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

  /** @type {AudioBuffer[]} */
  #trackBuffers = [];

  /** @type {AudioBufferSourceNode[]} */
  #trackNodes = [];

  static MAX_TRACK_LENGTH_S = 60 * 5; // 5 minutes

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

  #addTrack() {
    const trackLength = this.#audioCtx.sampleRate * TapeDeck.MAX_TRACK_LENGTH_S;
    // 1 = mono track
    const buffer = this.#audioCtx.createBuffer(1, trackLength, this.#audioCtx.sampleRate);
    this.#trackBuffers.push(buffer);
    const source = this.#audioCtx.createBufferSource();
    source.buffer = buffer;
    source.loop = false;
    this.#trackNodes.push(source);
  }

  /**
   * Copies audio samples into a specific track buffer.
   * @param {Float32Array} inputAudioSamples The audio samples to copy.
   * @param {number} inputStartFrame The starting sample index within `inputAudioSamples` to copy from.
   * @param {number} trackNumber The index of the track to write to.
   * @param {number} trackStartFrame The starting sample index within the track buffer to write to.
   */
  #setBufferData(inputAudioSamples, inputStartFrame, trackNumber, trackStartFrame) {
    if (trackNumber < 0 || trackNumber >= this.#trackBuffers.length) {
      throw new Error(`Invalid track number: ${trackNumber}`);
    }
    const trackBuffer = this.#trackBuffers[trackNumber];
    const trackChannelData = trackBuffer.getChannelData(0); // Assuming mono tracks
    const samplesToCopy = inputAudioSamples.subarray(inputStartFrame);
    trackChannelData.set(samplesToCopy, trackStartFrame);
  }
}