// @ts-check

import { MetronomeHandler } from "./metronome-handler.js";
import { Mixer } from "./mixer.js";
import { RecordHandler } from "./record-handler.js";
import { Stateful } from "./state.js";

export class TransportEvent {
  /** @type {string} */
  transportAction = 'play';
  /** @type {number} */
  audioCtxTimeS = 0;
  /** @type {number} */
  tapeTimeS = 0;
}

/**
 * @implements {Stateful}
 */
export class TapeDeck {
  /** @type {AudioContext} */
  #audioCtx;

  /** @type {RecordHandler} */
  #recorder;

  /** @type {Mixer} */
  #mixer;

  /** @type {number} */
  #tapeZeroFrame = -1;

  /** @type {number} */
  #armedTrack = -1;

  /** @type {boolean} */
  #isRecording = false;

  /** @type {((event: TransportEvent) => void)[]} */
  #onTransportEventCallbacks = [];

  /** @type {AudioBuffer[]} */
  #trackBuffers = [];

  /** @type {AudioBufferSourceNode[]} */
  #trackNodes = [];

  /** @type {GainNode[]} */
  #trackGains = [];

  static MAX_TRACK_LENGTH_S = 60 * 5; // 5 minutes

  /**
   * 
   * @param {AudioContext} audioCtx 
   * @param {RecordHandler} recorder
   * @param {Mixer} mixer
   */
  constructor(audioCtx, recorder, mixer) {
    this.#audioCtx = audioCtx;
    this.#recorder = recorder;
    this.#mixer = mixer;
    this.#recorder.addSampleCallback(this.#handleSamples.bind(this));
  }

  /**
   * @param {(event: TransportEvent) => void} callback
   */
  onTransportEvent(callback) {
    this.#onTransportEventCallbacks.push(callback);
  }

  //////////////////////
  // TRANSPORT CONTROL
  // All transport (play, record, stop) operations are specified in "tape time".  This is
  // the number of seconds from the beginning of the tape.  Interally, the tape deck will convert
  // this to the audio context time as appropriate.
  //////////////////////

  #disconnect() {
    // Stop and discard all current track nodes. They are one-shot and cannot be restarted.
    for (const node of this.#trackNodes) {
      node.stop();
      node.disconnect();
    }
    this.#trackNodes = [];
  }

  /**
   * 
   * @param {number} tapeTimeS The time on the tape to start playback from.
   * @param {boolean} [recording=false] Whether to start recording on the armed track.
   */
  startPlayback(tapeTimeS, recording = false) {
    const nowTimeS = this.#audioCtx.currentTime;
    const event = new TransportEvent();
    event.transportAction = 'play';
    event.audioCtxTimeS = nowTimeS
    event.tapeTimeS = tapeTimeS;

    const tapeTimeFrames = Math.round(tapeTimeS * this.#audioCtx.sampleRate);
    this.#tapeZeroFrame = Math.round(nowTimeS * this.#audioCtx.sampleRate) - tapeTimeFrames;

    this.#isRecording = recording;
    if (recording) {
      if (this.#armedTrack === -1) {
        console.warn('Recording started but no track is armed.');
      }
    }
    // Start new source nodes for each track.
    this.#disconnect();
    if (this.#trackBuffers.length != this.#trackGains.length) {
      throw new Error("Internal error: #trackBuffers and #trackGains must be the same length.")
    }
    for (let i = 0; i < this.#trackBuffers.length; i++) {
      const sourceNode = this.#audioCtx.createBufferSource();
      sourceNode.buffer = this.#trackBuffers[i];
      sourceNode.connect(this.#trackGains[i]);
      sourceNode.start(nowTimeS, tapeTimeS);
      this.#trackNodes.push(sourceNode);
    }

    for (const callback of this.#onTransportEventCallbacks) {
      callback(event);
    }
  }

  stop() {
    this.#disconnect();
    const nowTimeS = this.#audioCtx.currentTime;
    const tapeTimeS = (Math.round(nowTimeS * this.#audioCtx.sampleRate) - this.#tapeZeroFrame) / this.#audioCtx.sampleRate;
    const event = new TransportEvent();
    event.transportAction = 'stop';
    event.audioCtxTimeS = nowTimeS;
    event.tapeTimeS = tapeTimeS;
    this.#tapeZeroFrame = -1;
    this.#isRecording = false;
    for (const callback of this.#onTransportEventCallbacks) {
      callback(event);
    }
    this.#trackNodes = [];
  }

  /**
   * Arms a track for recording. Creates tracks if they don't exist.
   * @param {number} trackNumber The track to arm.
   */
  arm(trackNumber) {
    while (this.#trackBuffers.length <= trackNumber) {
      this.#addTrack();
    }
    this.#armedTrack = trackNumber;
    console.log(`Track ${trackNumber} armed.`);
  }

  #addTrack() {
    const newTrackIndex = this.#trackBuffers.length;
    const trackLength = this.#audioCtx.sampleRate * TapeDeck.MAX_TRACK_LENGTH_S;
    // 1 = mono track
    const buffer = this.#audioCtx.createBuffer(1, trackLength, this.#audioCtx.sampleRate);
    this.#trackBuffers.push(buffer);
    const gainNode = this.#audioCtx.createGain();
    this.#trackGains.push(gainNode);
    this.#mixer.patch(gainNode, newTrackIndex);
    // Note: We don't create the source node here because they are one-shot and must be created at playback time.
  }

  /**
   * @param {import('./record-handler.js').SampleData} data
   */
  #handleSamples(data) {
    // Only record if a track is armed, we are recording, and the tape is rolling.
    if (this.#armedTrack < 0 || !this.#isRecording || this.#tapeZeroFrame <= 0) {
      return;
    }

    // Calculate the start frame for this sample batch in "tape time"
    const trackStartFrame = data.startFrame - this.#tapeZeroFrame;
    if (trackStartFrame < 0) {
      return; // Don't record samples from before the tape started rolling.
    }
    this.#setBufferData(data.samples, 0, this.#armedTrack, trackStartFrame);
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

  /**
   * @returns {{trackCount: number, armedTrack: number}}
   */
  getJSON() {
    return {
      trackCount: this.#trackBuffers.length,
      armedTrack: this.#armedTrack,
    };
  }
}