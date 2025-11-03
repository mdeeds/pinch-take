//@ts-check

/**
 * ReverbEffect class generates an exponentially decaying impulse response
 * for a ConvolverNode and sets up a fixed 50% feedback loop using a DelayNode
 * set to the exact IR duration, suitable for a 100% wet send effect.
 */
export class ReverbEffect {
  /** @type {AudioContext} */
  #audioCtx;
  /** @type {number} */
  #halfLifeSeconds;
  /** @type {ConvolverNode} */
  #convolver;
  /** @type {DelayNode} */
  #delay;
  /** @type {GainNode} */
  #feedbackGain;

  /**
   * @param {AudioContext} audioCtx The Web Audio API context.
   * @param {number} halfLifeSeconds The time in seconds for the signal amplitude to decay to half volume.
   */
  constructor(audioCtx, halfLifeSeconds) {
    if (halfLifeSeconds <= 0) {
      throw new Error("Half-life must be a positive number.");
    }

    this.#audioCtx = audioCtx;
    this.#halfLifeSeconds = halfLifeSeconds;

    // 1. Create the Core Nodes
    this.#convolver = audioCtx.createConvolver();

    // Delay Node is set to the half-life duration, matching the IR length
    // Note: if we want a longer delay, we can use a smaller feedback gain.
    // f(t) = 2.0 ^ -(t/t_halflife);  i.e. f(t + t_halflife) = 0.5 f(t)
    // f(t + t_delay) = g_feedback * f(t)
    // Solving for t_delay gives: t_delay = -t_halflife * log2(g_feedback)
    // For g_feedback = 0.5, t_delay = t_halflife.
    // Solving for g_feedback gives: g_feedback = 2.0 ^ -(t_delay / t_halflife)
    const DELAY_TIME = halfLifeSeconds * 0.1;
    const FEEDBACK_GAIN = Math.pow(2.0, -DELAY_TIME / halfLifeSeconds);
    this.#delay = audioCtx.createDelay(DELAY_TIME);
    this.#delay.delayTime.value = DELAY_TIME;
    this.#feedbackGain = audioCtx.createGain();
    this.#feedbackGain.gain.value = FEEDBACK_GAIN;

    // 2. Generate the Impulse Response (IR)
    this.generateImpulseResponse(DELAY_TIME);

    // 3. Connect the Nodes (The Wet Signal Path and Feedback Loop)

    // The input to this effect will connect directly to the convolver.
    // The convolver's output is the primary output of the effect.

    // Feedback Loop: Convolver -> Feedback Gain (0.5) -> Delay (T_half) -> Convolver
    // The delay time matches the IR length, and the gain of 0.5 compensates 
    // for the IR's half-life decay, creating a continuous loop.
    this.#convolver.connect(this.#feedbackGain);
    this.#feedbackGain.connect(this.#delay);
    this.#delay.connect(this.#convolver);
  }

  /**
   * Generates a stereo impulse response buffer with random values that decay
   * exponentially over time. The duration is set by the `duration` parameter,
   * but the decay rate is always determined by `halfLifeSeconds`.
   * @param {number} duration The desired duration of the impulse response in seconds.
   */
  generateImpulseResponse(duration) {
    // The IR duration must match the feedback delay time for a seamless loop.
    const sampleRate = this.#audioCtx.sampleRate;
    const length = duration * sampleRate;
    const buffer = this.#audioCtx.createBuffer(2, length, sampleRate);

    // Lambda (λ) is the decay constant: λ = ln(2) / T_half
    // The exponential decay factor A(t) = exp(-λt)
    const lambda = Math.log(2) / this.#halfLifeSeconds;

    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const time = i / sampleRate;

      // Calculate the exponential decay factor (at time=T_half, this factor is 0.5)
      const decayFactor = Math.exp(-time * lambda);

      // Generate random samples between -1 and 1
      const randomSampleL = (Math.random() * 2 - 1);
      const randomSampleR = (Math.random() * 2 - 1);

      // Apply the decay factor to the random samples
      left[i] = randomSampleL * decayFactor;
      right[i] = randomSampleR * decayFactor;
    }

    this.#convolver.buffer = buffer;
  }

  /**
   * Connects an audio source to the effect's input.
   * @param {AudioNode} input The audio source to connect.
   */
  connectInput(input) {
    input.connect(this.#convolver);
  }

  /**
   * Disconnects an audio source from the effect's input.
   * @param {AudioNode} input The audio source to disconnect.
   */
  disconnectInput(input) {
    input.disconnect(this.#convolver);
  }

  /**
   * Connects the effect's output to another AudioNode.
   * @param {AudioNode} destination 
   */
  connect(destination) {
    this.#convolver.connect(destination);
    // Also connect the delay output for additional richness
    this.#delay.connect(destination);
  }

  /**
   * Disconnects the effect's output.
   * @param {AudioNode} destination 
   */
  disconnect(destination) {
    this.#convolver.disconnect(destination);
    this.#delay.disconnect(destination);
  }

  /**
   * Exposes the input node to connect a source.
   */
  get inputNode() {
    return this.#convolver;
  }
}
