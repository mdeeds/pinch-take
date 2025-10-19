/**
 * @class MetronomeProcessor
 * @extends AudioWorkletProcessor
 *
 * This processor implements a sample-accurate metronome.
 * It generates tick sounds based on a 'beatsPerMinute' AudioParam
 * and can produce an accented beat for the start of a measure.
 */
class MetronomeProcessor extends AudioWorkletProcessor {
  // Define the 'beatsPerMinute' parameter.
  static get parameterDescriptors() {
    return [{
      name: 'beatsPerMinute',
      defaultValue: 120,
      minValue: 20,
      maxValue: 240,
      automationRate: 'a-rate'
    }];
  }

  constructor() {
    super();
    this._isPlaying = false;
    this._beatsPerMeasure = 4;
    this._beatCount = 0;
    this._nextTickFrame = 0;
    this._phase = 0;
    this._framesInTick = -1; // -1 means not currently in a tick

    // Duration of the tick sound in seconds.
    this.TICK_DURATION_SEC = 0.05;

    this.port.onmessage = this.handleMessage.bind(this);
  }

  /**
   * Handles 'start' and 'stop' messages from the main thread.
   * @param {MessageEvent} event
   */
  handleMessage(event) {
    const { method, beatsPerMeasure } = event.data;

    if (method === 'start') {
      this._isPlaying = true;
      this._beatsPerMeasure = beatsPerMeasure || 4;
      this._beatCount = 0;
      // Start the first tick on the next processing block.
      this._nextTickFrame = currentFrame;
      console.log(`Metronome started with ${this._beatsPerMeasure} beats per measure.`);
    } else if (method === 'stop') {
      this._isPlaying = false;
      console.log('Metronome stopped.');
    }
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
    const bpmValues = parameters.beatsPerMinute;
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
        const isDownbeat = this._beatCount % this._beatsPerMeasure === 0;
        this._currentTickFrequency = isDownbeat ? 600 : 400;

        // Schedule the next tick.
        // Use the BPM value for the current frame for sample-accurate tempo changes.
        const bpm = bpmValues.length > 1 ? bpmValues[i] : bpmValues[0];
        const secondsPerBeat = 60.0 / bpm;
        const framesPerBeat = secondsPerBeat * sampleRate;
        this._nextTickFrame += framesPerBeat;

        this._beatCount++;
      }

      // If we are currently generating a tick sound.
      if (this._framesInTick >= 0 && this._framesInTick < tickDurationFrames) {
        // Generate the sine wave sample.
        outputChannel[i] = this.getSineSample(this._currentTickFrequency) * 0.5; // Reduce volume
        this._framesInTick++;
      } else {
        // Output silence.
        outputChannel[i] = 0;
        // Reset tick state if it just finished.
        if (this._framesInTick !== -1) {
          this._framesInTick = -1;
        }
      }
    }

    return true;
  }
}

registerProcessor('metronome-processor', MetronomeProcessor);