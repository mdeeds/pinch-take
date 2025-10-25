// @ts-check

import { MakeToolResponse } from './tool.js';
import { Mixer } from './mixer.js';

/**
 * @typedef {import('./tool.js').Tool} Tool
 * @typedef {import('./tool.js').FunctionResponse} FunctionResponse
 * @typedef {import('./tool.js').FunctionDeclaration} FunctionDeclaration
 */

/**
 * The MixerTool implementation.
 * @implements {Tool}
 */
export class MixerTool {
  /** @type {FunctionDeclaration} */
  declaration = {
    name: 'set_channel_properties',
    description: 'Sets properties for a mixer channel, like volume or panning.',
    parameters: {
      type: 'OBJECT',
      properties: {
        channelNumber: {
          type: 'INTEGER',
          description: 'The channel number to modify (0-indexed).',
        },
        volume: {
          type: 'NUMBER',
          description: 'The channel volume in decibels (dB). 0 is nominal level, negative values are quieter.',
        },
        pan: {
          type: 'NUMBER',
          description: 'The stereo pan, from -1.0 (full left) to 1.0 (full right).',
        },
      },
      required: ['channelNumber'],
    },
  };

  /** @type {Mixer} */
  #mixer;

  /**
   * @param {Mixer} mixer
   */
  constructor(mixer) {
    this.#mixer = mixer;
  }

  /**
   * @param {{ channelNumber: number, volume?: number, pan?: number }} args
   * @returns {Promise<FunctionResponse>}
   */
  async run(args) {
    const channel = this.#mixer.getChannel(args.channelNumber);
    if (!channel) {
      return MakeToolResponse(this, `Error: Channel ${args.channelNumber} not found.`);
    }

    channel.set({ volume: args.volume, pan: args.pan });

    const responseText = `Set channel ${args.channelNumber} properties: ${JSON.stringify(args)}.`;
    return MakeToolResponse(this, responseText);
  }
}
