// @ts-check

import { FileData } from "./gemini-file-manager.js";
import { GeminiFileManager } from "./gemini-file-manager.js";
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

export class TrackInfo {
  /** @type {number} */
  trackNumber = -1;
  /** @type {string} */
  name = "";
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

  /** @type {GeminiFileManager} */
  #fileManager;

  /** @type {number} */
  #tapeZeroFrame = -1;

  /** @type {number} */
  #punchInFrame = -1;
  /** @type {number} */
  #punchOutFrame = -1;

  /** @type {number} */
  #armedTrack = -1;

  /** @type {((event: TransportEvent) => void)[]} */
  #onTransportEventCallbacks = [];

  /** @type {(() => void)[]} */
  #resolveStops = [];

  /** @type {AudioBuffer[]} */
  #trackBuffers = [];

  /** @type {AudioBufferSourceNode[]} */
  #trackNodes = [];

  /** @type {TrackInfo[]} */
  #trackInfos = [];

  /** @type {GainNode[]} */
  #trackGains = [];

  static MAX_TRACK_LENGTH_S = 60 * 5; // 5 minutes

  /**
   * 
   * @param {AudioContext} audioCtx 
   * @param {RecordHandler} recorder
   * @param {Mixer} mixer
   * @param {GeminiFileManager} fileManager
   */
  constructor(audioCtx, recorder, mixer, fileManager) {
    this.#audioCtx = audioCtx;
    this.#recorder = recorder;
    this.#mixer = mixer;
    this.#fileManager = fileManager;
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
   * @param {number} startTimeS The time on the tape to start playback from.
   * @param {number} stopTimeS The time on the tape to stop playback. If -1, plays to the end.
   * @param {{punchInS?: number, punchOutS?: number}} [punchOptions]
   */
  startPlayback(startTimeS, stopTimeS = -1, { punchInS, punchOutS } = {}) {
    const nowTimeS = this.#audioCtx.currentTime;
    const event = new TransportEvent();
    event.transportAction = 'play';
    event.audioCtxTimeS = nowTimeS
    event.tapeTimeS = startTimeS;

    this.#punchInFrame = punchInS !== undefined ? Math.round(punchInS * this.#audioCtx.sampleRate) : -1;
    this.#punchOutFrame = punchOutS !== undefined ? Math.round(punchOutS * this.#audioCtx.sampleRate) : -1;

    const tapeTimeFrames = Math.round(startTimeS * this.#audioCtx.sampleRate);
    this.#tapeZeroFrame = Math.round(nowTimeS * this.#audioCtx.sampleRate) - tapeTimeFrames;

    if (this.#punchInFrame !== -1 && this.#armedTrack === -1) {
      console.warn('Punch-in time set but no track is armed.');
    }
    // Start new source nodes for each track.
    this.#disconnect();
    if (this.#trackBuffers.length != this.#trackGains.length) {
      throw new Error("Internal error: #trackBuffers and #trackGains must be the same length.")
    }
    for (let i = 0; i < this.#trackBuffers.length; i++) {
      const durationS = stopTimeS >= 0 ? stopTimeS - startTimeS : undefined;
      const sourceNode = this.#audioCtx.createBufferSource();
      sourceNode.buffer = this.#trackBuffers[i];
      sourceNode.connect(this.#trackGains[i]);
      sourceNode.start(nowTimeS, startTimeS, durationS);
      if (i === 0 && stopTimeS >= 0) {
        sourceNode.onended = () => {
          // Only resolve if the transport is still considered playing.
          // If stop() was called, tapeZeroFrame would be -1.
          if (this.#tapeZeroFrame !== -1) {
            this.stop();
          }
        };
      }
      this.#trackNodes.push(sourceNode);
    }

    for (const callback of this.#onTransportEventCallbacks) {
      callback(event);
    }
  }

  /**
   * Returns a promise that resolves when playback stops, either by calling stop()
   * or by reaching the end of the playback range.
   */
  async waitForEnd() {
    return new Promise((resolve) => {
      this.#resolveStops.push(resolve);
    });
  }

  /**
   * Extracts a slice of audio from a track, uploads it as a WAV file, and returns the file data.
   * @param {number} trackNumber The track to get the slice from.
   * @param {number} startTimeS The start time of the slice in seconds.
   * @param {number} stopTimeS The end time of the slice in seconds.
   * @returns {Promise<FileData>} A promise that resolves with the uploaded file's data.
   */
  async getTrackSlice(trackNumber, startTimeS, stopTimeS) {
    if (trackNumber < 0 || trackNumber >= this.#trackBuffers.length) {
      throw new Error(`Invalid track number: ${trackNumber}`);
    }
    const trackBuffer = this.#trackBuffers[trackNumber];

    const startFrame = Math.round(startTimeS * this.#audioCtx.sampleRate);
    const stopFrame = Math.round(stopTimeS * this.#audioCtx.sampleRate);
    const sliceLength = stopFrame - startFrame;

    if (sliceLength <= 0) {
      throw new Error('Stop time must be after start time.');
    }

    const audioSlice = trackBuffer.getChannelData(0).subarray(startFrame, stopFrame);
    const displayName = `Track ${trackNumber} (${startTimeS.toFixed(2)}s-${stopTimeS.toFixed(2)}s)`;
    return this.#fileManager.uploadWav(audioSlice, this.#audioCtx.sampleRate, displayName);
  }

  /**
   * Extracts a slice of audio from a track and returns it as a fileData object for Gemini.
   * @param {number} trackNumber The track to get the slice from.
   * @param {number} startTimeS The start time of the slice in seconds.
   * @param {number} stopTimeS The end time of the slice in seconds.
   * @returns {Promise<{mimeType: string, data: string}>} A promise that resolves with the file data object.
   */
  async getTrackSliceAsFileData(trackNumber, startTimeS, stopTimeS) {
    if (trackNumber < 0 || trackNumber >= this.#trackBuffers.length) {
      throw new Error(`Invalid track number: ${trackNumber}`);
    }
    const trackBuffer = this.#trackBuffers[trackNumber];
    const startFrame = Math.round(startTimeS * this.#audioCtx.sampleRate);
    const stopFrame = Math.round(stopTimeS * this.#audioCtx.sampleRate);

    if (stopFrame - startFrame <= 0) {
      throw new Error('Stop time must be after start time.');
    }

    const audioSlice = trackBuffer.getChannelData(0).subarray(startFrame, stopFrame);
    return this.#fileManager.encodeWavAsFileData(audioSlice, this.#audioCtx.sampleRate);
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
    this.#punchInFrame = -1;
    this.#punchOutFrame = -1;
    for (const callback of this.#onTransportEventCallbacks) {
      callback(event);
    }
    this.#resolveWaitingStops();
  }

  #resolveWaitingStops() {
    for (const resolve of this.#resolveStops) {
      resolve();
    }
    this.#resolveStops = [];
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

  /**
   * 
   * @param {number} trackNumber 
   * @param {string} name 
   */
  setTrackName(trackNumber, name) {
    if (trackNumber < 0 || trackNumber >= this.#trackInfos.length) {
      throw new Error(`Invalid track number: ${trackNumber}`);
    }
    this.#trackInfos[trackNumber].name = name;
  }

  /**
   * 
   * @param {number} trackNumber 
   */
  getTrackName(trackNumber) {
    if (trackNumber < 0 || trackNumber >= this.#trackInfos.length) {
      throw new Error(`Invalid track number: ${trackNumber}`);
    }
    return this.#trackInfos[trackNumber].name;
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
    this.#trackInfos.push({ trackNumber: newTrackIndex, name: '' });

    // Note: We don't create the source node here because they are one-shot and must be created at playback time.
  }

  /**
   * @param {import('./record-handler.js').SampleData} data
   */
  #handleSamples(data) {
    // Only record if a track is armed, the tape is rolling, and we have a punch-in time.
    if (this.#armedTrack < 0 || this.#tapeZeroFrame <= 0 || this.#punchInFrame < 0) {
      return;
    }

    // Calculate the start frame for this sample batch in "tape time"
    const trackStartFrame = data.startFrame - this.#tapeZeroFrame;
    const trackEndFrame = trackStartFrame + data.samples.length;

    // Don't record samples from before the punch-in point or after the punch-out point.
    if (trackEndFrame < this.#punchInFrame) {
      return;
    }
    if (this.#punchOutFrame >= 0 && trackStartFrame > this.#punchOutFrame) {
      return;
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
   * @returns {{trackCount: number, armedTrack: number, trackInfo: TrackInfo[]}}
   */
  getJSON() {
    return {
      trackCount: this.#trackBuffers.length,
      armedTrack: this.#armedTrack,
      trackInfo: this.#trackInfos,
    };
  }
}