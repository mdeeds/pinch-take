// @ts-check

/**
 * Represents a single channel strip in the mixer.
 * Each channel has its own input, fader for volume control, and a panner for stereo positioning.
 */
class Channel {
  /** @type {AudioContext} */
  #audioCtx;
  /** @type {GainNode} */
  #input;
  /** @type {GainNode} */
  #fader;
  /** @type {StereoPannerNode} */
  #panner;

  /**
   * @param {AudioContext} audioCtx The audio context.
   */
  constructor(audioCtx) {
    this.#audioCtx = audioCtx;

    this.#input = this.#audioCtx.createGain();
    this.#fader = this.#audioCtx.createGain();
    this.#panner = this.#audioCtx.createStereoPanner();

    // The signal flow for a channel is: source -> input -> fader -> panner -> mixer master out
    this.#input.connect(this.#fader);
    this.#fader.connect(this.#panner);
  }

  /**
   * The input node for this channel, where an audio source should be connected.
   * @returns {GainNode}
   */
  get input() {
    return this.#input;
  }

  /**
   * Connects the channel's output to a destination node.
   * @param {AudioNode} destination The destination node (e.g., the mixer's master bus).
   */
  connect(destination) {
    this.#panner.connect(destination);
  }
}

/**
 * The Mixer class manages multiple audio channels, mixes them into a stereo output,
 * and will provide support for send effects.
 */
export class Mixer {
  /** @type {AudioContext} */
  #audioCtx;
  /** @type {Channel[]} */
  #channels = [];
  /** @type {GainNode} */
  #master;

  /**
   * @param {AudioContext} audioCtx The audio context.
   */
  constructor(audioCtx) {
    this.#audioCtx = audioCtx;
    this.#master = this.#audioCtx.createGain();
    this.#master.connect(this.#audioCtx.destination);
  }

  /**
   * Patches an audio source to a specific channel in the mixer.
   * If the channel doesn't exist, it will be created.
   * @param {AudioNode} source The audio source node to connect.
   * @param {number} channelNumber The channel number to patch to.
   * @returns {Channel} The channel that the source was patched to.
   */
  patch(source, channelNumber) {
    // Ensure we have enough channels
    while (this.#channels.length <= channelNumber) {
      this.#addChannel();
    }

    const channel = this.#channels[channelNumber];
    source.connect(channel.input);

    return channel;
  }

  /**
   * Creates a new channel, connects it to the master bus, and adds it to the list.
   */
  #addChannel() {
    const channel = new Channel(this.#audioCtx);
    channel.connect(this.#master);
    this.#channels.push(channel);
  }
}
