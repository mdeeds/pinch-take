/**
 * @class RecordProcessor
 * @extends AudioWorkletProcessor
 *
 * This processor handles recording of audio samples between a specified
 * 'punch-in' and 'punch-out' time.
 */
class RecordProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffers = [];
    this._punchInFrame = 0;
    this._punchOutFrame = Infinity;
    this._isRecording = false;
    this._id = null;
    this._totalSamples = 0;
    this._startTime = 0;
    this._sendLiveStats = false;

    this.port.onmessage = this.handleMessage.bind(this);
  }

  /**
   * Handles messages from the main thread.
   * 'punch': Sets up recording parameters.
   * 'stop': Stops the current recording and sends back the samples.
   * @param {MessageEvent} event
   */
  handleMessage(event) {
    const { method, id, in: punchIn, out: punchOut } = event.data;

    if (method === 'punch') {
      // If we are currently recording, send back the existing samples first.
      if (this._isRecording) {
        this.sendSamples();
      }

      this._startTime = punchIn;
      // Convert times to frame counts
      this._punchInFrame = Math.floor(punchIn * sampleRate);
      this._punchOutFrame = punchOut !== undefined ? Math.floor(punchOut * sampleRate) : Infinity;
      this._id = id;
      this._isRecording = false;
      this._buffers = [];
      this._totalSamples = 0;
    } else if (method === 'stop') {
      if (this._isRecording) {
        this.sendSamples();
        this._isRecording = false;
      }
    } else if (method === 'startLiveStats') {
      this._sendLiveStats = true;
    } else if (method === 'stopLiveStats') {
      this._sendLiveStats = false;
    }
  }

  /**
   * Concatenates the collected audio buffers and sends them to the main thread.
   */
  sendSamples() {
    if (this._buffers.length === 0) {
      return;
    }

    // Create a single Float32Array to hold all samples.
    const samples = new Float32Array(this._totalSamples);
    let offset = 0;
    for (const buffer of this._buffers) {
      samples.set(buffer, offset);
      offset += buffer.length;
    }

    this.port.postMessage({
      type: 'sample',
      samples: samples,
      startTime: this._startTime,
      id: this._id,
    });

    // Reset buffers
    this._buffers = [];
    this._totalSamples = 0;
  }

  /**
   * The main processing function. It's called for each block of 128 audio frames.
   * @param {Float32Array[][]} inputs - Array of inputs, each with an array of channels.
   * @returns {boolean} - `true` to keep the processor alive.
   */
  process(inputs) {
    const inputChannel = inputs[0]?.[0];

    // If there's no input, or we're not set up to record, do nothing.
    if (!inputChannel) {
      return true;
    }

    if (this._sendLiveStats) {
      let maxAbsSample = 0.0;
      let sumSq = 0.0;
      for (let i = 0; i < inputChannel.length; i++) {
        const sample = inputChannel[i];
        maxAbsSample = Math.max(maxAbsSample, Math.abs(sample));
        sumSq += sample * sample;
      }
      const rms = Math.sqrt(sumSq / inputChannel.length);
      postMessage({ type: 'stats', maxAbsSample, rms });
    }


    // If there's no input, or we're not set up to record, do nothing.
    if (this._punchInFrame === 0) {
      return true;
    }

    const bufferStartFrame = currentFrame;
    const bufferEndFrame = currentFrame + inputChannel.length;

    // Check if this buffer is relevant to our recording timespan.
    const startsIn = bufferStartFrame <= this._punchInFrame && this._punchInFrame < bufferEndFrame;
    const endsIn = bufferStartFrame < this._punchOutFrame && this._punchOutFrame <= bufferEndFrame;

    if (startsIn && !this._isRecording) {
      this._isRecording = true;
    }

    if (this._isRecording) {
      // Calculate the precise slice of the buffer to record.
      const startIndex = Math.max(0, this._punchInFrame - bufferStartFrame);
      const endIndex = Math.min(inputChannel.length, this._punchOutFrame - bufferStartFrame);
      const slice = inputChannel.slice(startIndex, endIndex);

      this._buffers.push(slice);
      this._totalSamples += slice.length;

      if (endsIn || bufferStartFrame >= this._punchOutFrame) {
        this.sendSamples();
        this._isRecording = false;
      }
    }

    // Keep the processor alive.
    return true;
  }
}

registerProcessor('record-processor', RecordProcessor);