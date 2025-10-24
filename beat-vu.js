// @ts-check

import { RecordHandler } from "./record-handler.js";
import { SongContext } from "./song-context.js";
import { TapeDeck, TransportEvent } from "./tape-deck.js";
/** @typedef {import('./record-handler.js').SampleData} SampleData */

export class BeatVU {
  /** @type {AudioContext} */
  #audioCtx;
  /** @type {HTMLElement} */
  #container;
  /** @type {HTMLCanvasElement} */
  #canvas;
  /** @type {CanvasRenderingContext2D} */
  #ctx;
  /** @type {RecordHandler} */
  #recordHandler;
  /** @type {SongContext} */
  #songContext;
  /** @type {TapeDeck} */
  #tapeDeck;

  #bpm = 120;
  #beatsPerMeasure = 4;
  #totalDurationS = 2.0;

  /** @type {number | null} */
  #tapeZeroTimeS = null;

  /**
   * @param {AudioContext} audioCtx
   * @param {HTMLElement} container
   * @param {RecordHandler} recordHandler
   * @param {SongContext} songContext
   * @param {TapeDeck} tapeDeck
   */
  constructor(audioCtx, container, recordHandler, songContext, tapeDeck) {
    this.#audioCtx = audioCtx;
    this.#container = container;
    this.#recordHandler = recordHandler;
    this.#songContext = songContext;

    this.#canvas = document.createElement('canvas');
    this.#canvas.width = 1024;
    this.#canvas.height = 100;
    this.#canvas.tabIndex = 0; // Make canvas focusable
    this.#container.appendChild(this.#canvas);
    const ctx = this.#canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      throw new Error('Failed to get 2D context from canvas.');
    }
    this.#ctx = ctx;
    this.#ctx.fillStyle = '#000';
    this.#ctx.fillRect(0, 0, this.#canvas.width, this.#canvas.height);
    this.setTiming({
      bpm: this.#songContext.tempo,
      beatsPerMeasure: this.#songContext.beatsPerMeasure
    });

    this.#songContext.onSongTimeChanged(() => this.setTiming({
      bpm: this.#songContext.tempo,
      beatsPerMeasure: this.#songContext.beatsPerMeasure
    }));

    this.#recordHandler.addSampleCallback(this.#handleSamples.bind(this));
    this.#animate();

    this.#tapeDeck = tapeDeck;
    this.#tapeDeck.onTransportEvent(this.#handleTransportEvent.bind(this));
    document.addEventListener('keydown', this.#handleKeyDown.bind(this));
  }

  /**
   * @param {{bpm?: number, beatsPerMeasure?: number}} timing
   */
  setTiming({ bpm, beatsPerMeasure }) {
    this.#bpm = bpm ?? this.#bpm;
    this.#beatsPerMeasure = beatsPerMeasure ?? this.#beatsPerMeasure;
    this.#totalDurationS = this.#beatsPerMeasure * 60 / this.#bpm;
  }

  /**
   * Converts a linear amplitude value (0-1) to a Y-coordinate on the canvas.
   * @param {number} value The linear amplitude (e.g., RMS or peak).
   * @returns {number} The corresponding Y-coordinate.
   */
  #valueToY(value) {
    // Convert linear value to dB, using a small floor to avoid log(0).
    const db = 20 * Math.log10(value || 0.00001);
    // Map dB to canvas y-coordinate. -60dB at bottom, 0dB at top.
    const dbRange = 60;
    // Ensure the y-coordinate is within the canvas bounds.
    return Math.max(0, (1 - (db + dbRange) / dbRange)) * (this.#canvas.height - 3);
  }

  /**
   * @param {SampleData} data
   */
  #handleSamples({ startTimeS, samples, rms, peak, maxPeakIndex }) {
    if (!this.#tapeZeroTimeS) {
      return;
    }
    // @ts-ignore - #audioCtx is private but we need it here.
    const sampleRate = this.#audioCtx.sampleRate;

    // --- 1. Draw the RMS rectangle ---
    const rmsY = this.#valueToY(rms);
    const timeOnCanvasS = (startTimeS - this.#tapeZeroTimeS) % this.#totalDurationS;
    const rmsX = (timeOnCanvasS / this.#totalDurationS) * this.#canvas.width;
    const durationS = samples.length / sampleRate;
    const rectWidth = (durationS / this.#totalDurationS) * this.#canvas.width;

    this.#ctx.fillStyle = 'rgba(0, 255, 0, 0.75)';
    this.#ctx.fillRect(rmsX, rmsY, rectWidth, 20);

    // --- 2. Draw the peak dot ---
    const peakY = this.#valueToY(peak);
    const peakTimeS = startTimeS + (maxPeakIndex / sampleRate);
    const peakTimeOnCanvasS = peakTimeS % this.#totalDurationS;
    const peakX = (peakTimeOnCanvasS / this.#totalDurationS) * this.#canvas.width;
    this.#ctx.fillStyle = 'rgba(128, 255, 0, 0.75)';
    this.#ctx.fillRect(peakX, peakY, 1, 3); // Center the 3x3 dot on the peak's x-position
  }

  /**
   * @param {TransportEvent} event
   */
  #handleTransportEvent(event) {
    if (event.transportAction === 'play') {
      // Calculate the audio context time that corresponds to the very beginning of the tape (time 0).
      this.#tapeZeroTimeS = event.audioCtxTimeS - event.tapeTimeS;
    } else if (event.transportAction === 'stop') {
      this.#tapeZeroTimeS = null;
    }
  }

  #animate() {
    // Get the current image data
    const imageData = this.#ctx.getImageData(0, 0, this.#canvas.width, this.#canvas.height);
    const data = imageData.data;

    // Loop through each pixel and fade it
    for (let i = 0; i < data.length; i += 4) {
      // Fade to black
      // Since this is a Uint8ClampedArray, we don't need to check if the value
      // is > 0 before subtracting; it will automatically clamp at 0.
      data[i + 0] -= 1; // Red
      data[i + 1] -= 1; // Green
      data[i + 2] -= 1; // Blue
    }

    // Put the modified image data back onto the canvas
    this.#ctx.putImageData(imageData, 0, 0);

    // Draw beat and measure lines
    if (this.#tapeZeroTimeS !== null) {
      // Draw static beat and measure lines, since the canvas represents one measure.
      for (let i = 0; i < this.#beatsPerMeasure; i++) {
        const x = (i / this.#beatsPerMeasure) * this.#canvas.width;

        const isMeasureLine = (i === 0);
        this.#ctx.fillStyle = isMeasureLine ? '#fff' : '#333';
        this.#ctx.fillRect(x, 0, 1, this.#canvas.height);
      }
    }
    // Request the next frame
    requestAnimationFrame(this.#animate.bind(this));
  }

  /**
   * @param {KeyboardEvent} event
   */
  #handleKeyDown(event) {
    // Only adjust latency if shift is held down.
    if (!event.shiftKey) {
      return;
    }

    let latencyChangeMs = 0;
    switch (event.key) {
      case 'ArrowLeft':
        latencyChangeMs = -1;
        break;
      case 'ArrowRight':
        latencyChangeMs = 1;
        break;
      case 'ArrowDown':
        latencyChangeMs = -10;
        break;
      case 'ArrowUp':
        latencyChangeMs = 10;
        break;
      default:
        return; // Do nothing for other keys
    }

    event.preventDefault(); // Prevent scrolling, etc.

    const currentLatencyS = this.#recordHandler.getLatencyCompensation();
    const newLatencyS = currentLatencyS + (latencyChangeMs / 1000);
    this.#recordHandler.setLatencyCompensation(newLatencyS);
  }
}