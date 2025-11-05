/**
 * @class RecordProcessor
 * @extends AudioWorkletProcessor
 */
class RecordProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 128 * 4; // 4 render quantums
    this.buffer = new Float32Array(this.bufferSize);
    this.framesCollected = 0;
    this.batchStartFrame = 0;
    this.batchStartTime = 0;
    this.tmpBuffer = new Float32Array(128);
  }

  /**
   * The main processing function. It's called for each block of 128 audio frames.
   * @param {Float32Array[][]} inputs - Array of inputs, each with an array of channels.
   * @returns {boolean} - `true` to keep the processor alive.
   */
  process(inputs) {
    const inputChannel = inputs[0]?.[0];

    if (!inputChannel) {
      return true;
    }

    // Sum everything down to Mono
    this.tmpBuffer.set(inputChannel);
    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];
      for (let j = 0; j < input.length; j++) {
        const channel = input[j];
        if (i !== 0 || j !== 0) {
          for (let k = 0; k < channel.length; ++k) {
            this.tmpBuffer[k] += channel[k];
          }
        }
      }
    }

    if (this.framesCollected === 0) {
      // This is the first quantum in a new batch, so store the start time.
      this.batchStartFrame = currentFrame;
      this.batchStartTime = currentTime;
    }

    this.buffer.set(inputChannel, this.framesCollected);
    this.framesCollected += inputChannel.length;

    if (this.framesCollected >= this.bufferSize) {
      // Buffer is full, calculate stats and send it.
      let sumOfSquares = 0.0;
      let maxPeak = 0.0;
      let maxPeakIndex = 0;
      for (let i = 0; i < this.buffer.length; i++) {
        const sample = this.buffer[i];
        sumOfSquares += sample * sample;
        const absSample = Math.abs(sample);
        if (absSample > maxPeak) {
          maxPeak = absSample;
          maxPeakIndex = i;
        }
      }
      const rms = Math.sqrt(sumOfSquares / this.buffer.length);

      this.port.postMessage({
        type: 'samples',
        samples: this.buffer,
        rms: rms,
        peak: maxPeak,
        maxPeakIndex: maxPeakIndex,
        startFrame: this.batchStartFrame,
        startTimeS: this.batchStartTime,
      }, [this.buffer.buffer]);

      // Create a new buffer for the next batch and reset the counter.
      this.buffer = new Float32Array(this.bufferSize);
      this.framesCollected = 0;
    }

    // Keep the processor alive.
    return true;
  }
}

registerProcessor('record-processor', RecordProcessor);