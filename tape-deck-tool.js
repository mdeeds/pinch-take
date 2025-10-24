// @ts-check

import { MakeToolResponse } from './tool.js';
import { TapeDeck } from './tape-deck.js';

/**
 * @typedef {import('./tool.js').Tool} Tool
 * @typedef {import('./tool.js').FunctionResponse} FunctionResponse
 * @typedef {import('./tool.js').FunctionDeclaration} FunctionDeclaration
 */

/**
 * The TapeDeckTool implementation.
 * @implements {Tool}
 */
export class TapeDeckTool {
  /** @type {FunctionDeclaration} */
  declaration = {
    name: 'transport_control',
    description: 'Controls the tape deck playback.',
    parameters: {
      type: 'OBJECT',
      properties: {
        action: {
          type: 'STRING',
          description: "The action to perform: 'play' or 'stop'.",
        },
      },
      required: ['action'],
    },
  };

  /** @type {TapeDeck} */
  #tapeDeck;

  /**
   * @param {TapeDeck} tapeDeck
   */
  constructor(tapeDeck) {
    this.#tapeDeck = tapeDeck;
  }

  /**
   * @param {{action: 'play' | 'stop'}} args
   * @returns {Promise<FunctionResponse>}
   */
  async run(args) {
    let responseText = '';
    if (args.action === 'play') {
      // For now, we'll just play from the beginning.
      this.#tapeDeck.startPlayback(0);
      responseText = 'Playback started.';
    } else if (args.action === 'stop') {
      this.#tapeDeck.stop();
      responseText = 'Playback stopped.';
    } else {
      responseText = `Unknown action: ${args.action}`;
    }

    return MakeToolResponse(this, responseText);
  }
}