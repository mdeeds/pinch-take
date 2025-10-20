/**
 * @class LevelProcessor
 * @extends AudioWorkletProcessor
 *
 * This processor processes a single audio input and keeps track of the maximum
 * absolute sample value (peak) and the root mean square (RMS) of the samples.
 */
class LevelProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._sumOfSquares = 0.0;
    this._sampleCount = 0;
    this._maxPeak = 0.0;

    this.port.onmessage = this.handleMessage.bind(this);
  }

  /**
   * Resets the accumulated level values.
   */
  reset() {
    this._sumOfSquares = 0.0;
    this._sampleCount = 0;
    this._maxPeak = 0.0;
  }

  /**
   * Handles messages from the main thread.
   * 'query': Sends the current peak and RMS values back to the main thread and resets them.
   * 'reset': Resets the values without sending them.
   * @param {MessageEvent} event
   */
  handleMessage(event) {
    const { method } = event.data;

    if (method === 'query') {
      const rms = this._sampleCount > 0 ? Math.sqrt(this._sumOfSquares / this._sampleCount) : 0.0;

      this.port.postMessage({
        type: 'level',
        peak: this._maxPeak,
        rms: rms,
      });

      this.reset();
    } else if (method === 'reset') {
      this.reset();
    }
  }

  /**
   * The main processing function. It's called for each block of 128 audio frames.
   * @param {Float32Array[][]} inputs - Array of inputs, each with an array of channels.
   * @returns {boolean} - `true` to keep the processor alive.
   */
  process(inputs) {
    const inputChannel = inputs[0]?.[0];

    // If there's no input, do nothing.
    if (!inputChannel) {
      return true;
    }

    for (let i = 0; i < inputChannel.length; i++) {
      const sample = inputChannel[i];
      const absSample = Math.abs(sample);

      // Update sum of squares for RMS calculation
      this._sumOfSquares += sample * sample;

      // Update max peak
      if (absSample > this._maxPeak) {
        this._maxPeak = absSample;
      }
    }

    this._sampleCount += inputChannel.length;

    // Keep the processor alive.
    return true;
  }
}

registerProcessor('level-processor', LevelProcessor);