// @ts-check

import { ReverbEffect } from './reverb.js';
import { State } from './state.js';
import { Stateful } from './stateful.js';

/**
 * Represents a single channel strip in the mixer.
 * Each channel has its own input, fader for volume control, and a panner for stereo positioning.
 * @implements {Stateful}
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
  /** @type {GainNode} */
  #reverbSend;
  /** @type {State} */
  state;

  /**
   * @param {AudioContext} audioCtx The audio context.
   * @param {AudioNode} reverbInput The input node of the reverb effect.
   */
  constructor(audioCtx, reverbInput) {
    this.#audioCtx = audioCtx;

    this.#input = this.#audioCtx.createGain();
    this.#fader = this.#audioCtx.createGain();
    this.#panner = this.#audioCtx.createStereoPanner();
    this.#reverbSend = this.#audioCtx.createGain();
    this.#reverbSend.gain.value = 0; // Default to no reverb send (-Infinity dB)

    // The signal flow for a channel is: source -> input -> fader -> panner -> mixer master out
    this.#input.connect(this.#fader);
    this.#fader.connect(this.#panner);
    // Post-fader send to the reverb
    this.#fader.connect(this.#reverbSend);
    this.#reverbSend.connect(reverbInput);

    this.state = new State({
      volume: 0, // 0 dB
      pan: 0,
      reverbSend: -Infinity,
    });

    this.state.addFieldCallback('volume', (/** @type {number} */ volume) => {
      const gain = Math.pow(10, volume / 20);
      this.#fader.gain.setTargetAtTime(gain, this.#audioCtx.currentTime, 0.01);
    });

    this.state.addFieldCallback('pan', (/** @type {number} */ pan) => {
      this.#panner.pan.setTargetAtTime(pan, this.#audioCtx.currentTime, 0.01);
    });

    this.state.addFieldCallback('reverbSend', (/** @type {number} */ reverbSend) => {
      const gain = reverbSend <= -Infinity ? 0 : Math.pow(10, reverbSend / 20);
      this.#reverbSend.gain.setTargetAtTime(gain, this.#audioCtx.currentTime, 0.01);
    });
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

  /**
   * @param {{ volume?: number, pan?: number, reverbSend?: number }} settings
   */
  set(settings) {
    if (settings.volume !== undefined) this.state.set('volume', settings.volume);
    if (settings.pan !== undefined) this.state.set('pan', settings.pan);
    if (settings.reverbSend !== undefined) this.state.set('reverbSend', settings.reverbSend);
  }

  /**
   * Returns a JSON-serializable object representing the channel's state.
   */
  getJSON() {
    return this.state.getJSON();
  }
}

/**
 * The Mixer class manages multiple audio channels, mixes them into a stereo output,
 * and will provide support for send effects.
 * @implements {Stateful}
 */
export class Mixer {
  /** @type {AudioContext} */
  #audioCtx;
  /** @type {Channel[]} */
  #channels = [];
  /** @type {GainNode} */
  #master;
  /** @type {ReverbEffect} */
  #reverb;
  /** @type {State} */
  state;

  /**
   * @param {AudioContext} audioCtx The audio context.
   */
  constructor(audioCtx) {
    this.#audioCtx = audioCtx;
    this.#master = this.#audioCtx.createGain();

    // Create a reverb effect with a 2-second half-life and connect it to the master bus.
    this.#reverb = new ReverbEffect(this.#audioCtx, 2.0);
    this.#reverb.connect(this.#master);
    this.#master.connect(this.#audioCtx.destination);

    this.state = new State({
      masterVolume: 0, // 0 dB
    });
    this.state.addList('channels');
    this.state.addFieldCallback('masterVolume', (/** @type {number} */ volume) => {
      this.#master.gain.value = Math.pow(10, volume / 20);
    });
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
    const channel = new Channel(this.#audioCtx, this.#reverb.inputNode);
    channel.connect(this.#master);
    this.#channels.push(channel);
    this.state.getList('channels').add(channel.state);
  }

  /**
   * 
   * @param {number} channelNumber 
   * @returns Channel
   */
  getChannel(channelNumber) {
    if (channelNumber < 0 || channelNumber >= this.#channels.length) {
      throw new Error(`Invalid channel number: ${channelNumber}`);
    }
    return this.#channels[channelNumber];
  }

  /**
   * Returns a JSON-serializable object representing the mixer's state,
   * including the master volume and the state of all its channels.
   */
  getJSON() {
    return this.state.getJSON();
  }
}
