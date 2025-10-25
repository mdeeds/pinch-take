// @ts-check

/**
 * @class MetronomeProcessor
 * @extends AudioWorkletProcessor
 *
 * This processor implements a sample-accurate metronome.
 * It generates tick sounds based on a 'beatsPerMinute' AudioParam
 * and can produce an accented beat for the start of a measure.
 */
class MetronomeProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._isPlaying = false;
    this._beatsPerMeasure = 4;
    this._beatCount = 0;
    this._nextTickFrame = 0;
    this._phase = 0;
    this._framesInTick = -1; // -1 means not currently in a tick
    this._bpm = 120;

    // Duration of the tick sound in seconds.
    this.TICK_DURATION_SEC = 0.05;

    this.port.onmessage = this.handleMessage.bind(this);
  }

  /**
   * Handles 'start' and 'stop' messages from the main thread.
   * @param {MessageEvent} event
   */
  handleMessage(event) {
    const { method, detail } = event.data;
    // console.log(`Metronome received message:`, event.data)

    switch (method) {
      case 'start':
        this._start(detail);
        break;
      case 'set':
        this._bpm = detail.tempo || this._bpm;
        this._beatsPerMeasure = detail.beatsPerMeasure || this._beatsPerMeasure;
        break;
      case 'stop':
        this._isPlaying = false;
        break;
      default:
        console.error(`Unknown message method: ${method}`);
    }
  }

  /**
   * Starts the metronome with a downbeat at the specified audioContextTimeS
   * @param {{audioContextTimeS?: number}} detail
   */
  _start(detail) {
    const { audioContextTimeS } = detail;
    this._isPlaying = true;
    this._beatsPerMeasure = this._beatsPerMeasure || 4;
    if (audioContextTimeS !== undefined) {
      const startFrame = Math.floor(audioContextTimeS * sampleRate);
      const secondsPerBeat = 60.0 / this._bpm;
      const framesPerBeat = secondsPerBeat * sampleRate;

      if (currentFrame > startFrame) {
        const framesSinceStart = currentFrame - startFrame;
        const beatsSinceStart = Math.floor(framesSinceStart / framesPerBeat);
        this._beatCount = beatsSinceStart % this._beatsPerMeasure;
        this._nextTickFrame = startFrame + ((beatsSinceStart + 1) * framesPerBeat);
      } else {
        this._beatCount = 0;
        this._nextTickFrame = startFrame;
      }
    } else {
      this._beatCount = 0;
      this._nextTickFrame = currentFrame; // Start immediately if no time is given
    }
    // console.log(`Metronome started. Beat count: ${this._beatCount}, Next tick: ${this._nextTickFrame}`);
  }

  /**
   * Generates a single sample for a sine wave oscillator.
   * @param {number} frequency The frequency of the sine wave.
   * @returns {number} The sample value between -1.0 and 1.0.
   */
  getSineSample(frequency) {
    const sample = Math.sin(this._phase);
    this._phase += 2 * Math.PI * frequency / sampleRate;
    // Wrap phase to avoid floating point issues.
    if (this._phase > 2 * Math.PI) {
      this._phase -= 2 * Math.PI;
    }
    return sample;
  }

  /**
   * The main processing function, called for each block of 128 audio frames.
   * @param {Float32Array[][]} inputs - The input buffers (not used).
   * @param {Float32Array[][]} outputs - The output buffers to fill.
   * @param {Record<string, Float32Array>} parameters - The AudioParam values.
   * @returns {boolean} `true` to keep the processor alive.
   */
  process(inputs, outputs, parameters) {
    const outputChannel = outputs[0][0];
    const tickDurationFrames = this.TICK_DURATION_SEC * sampleRate;

    for (let i = 0; i < outputChannel.length; ++i) {
      const frame = currentFrame + i;

      // If not playing, output silence.
      if (!this._isPlaying) {
        outputChannel[i] = 0;
        continue;
      }

      // Check if it's time for the next tick.
      if (frame >= this._nextTickFrame) {
        // Start a new tick.
        this._framesInTick = 0;
        this._phase = 0;

        // Determine the frequency for this beat.
        const isDownbeat = this._beatCount === 0;
        this._currentTickFrequency = isDownbeat ? 600 : 400;

        // Schedule the next tick.
        const secondsPerBeat = 60.0 / this._bpm;
        const framesPerBeat = secondsPerBeat * sampleRate;
        this._nextTickFrame += framesPerBeat;

        this._beatCount++;
        if (this._beatCount >= this._beatsPerMeasure) {
          this._beatCount = 0;
        }
      }

      // If we are currently generating a tick sound.
      if (this._framesInTick >= 0 && this._framesInTick < tickDurationFrames) {
        // Generate the sine wave sample.
        outputChannel[i] = this.getSineSample(this._currentTickFrequency) * 0.5; // Reduce volume
        this._framesInTick++;
      } else {
        // Output silence.
        outputChannel[i] = 0;
        // Reset tick state.
        this._framesInTick = -1;
      }
    }

    // Copy the mono metronome signal from the first channel of the first output
    // to all other channels of all outputs.
    for (let outputIndex = 0; outputIndex < outputs.length; outputIndex++) {
      const output = outputs[outputIndex];
      for (let channelIndex = 0; channelIndex < output.length; channelIndex++) {
        if (outputIndex === 0 && channelIndex === 0) continue;
        output[channelIndex].set(outputChannel);
      }
    }

    return true;
  }
}

registerProcessor('metronome-processor', MetronomeProcessor);