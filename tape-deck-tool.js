// @ts-check

import { MakeToolResponse } from './tool.js';
import { SongContext } from './song-context.js';
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
    description: 'Controls the tape deck playback. Returns the recorded audio as a file. Please critique.',
    parameters: {
      type: 'OBJECT',
      properties: {
        action: {
          type: 'STRING',
          description: "The action to perform: 'play', 'stop', or 'record'.",
        },
        trackNumber: {
          type: 'INTEGER',
          description: 'The track number to arm for recording. Required if action is "record".',
        },
        section: {
          type: 'STRING',
          description: 'The name of the song section to play or record over (e.g., "Verse 1", "Chorus"). If unspecified, the entire song is used.',
        },
      },
      required: ['action'],
    },
  };

  /** @type {TapeDeck} */
  #tapeDeck;

  /** @type {SongContext} */
  #songContext;

  /**
   * @param {TapeDeck} tapeDeck
   * @param {SongContext} songContext
   */
  constructor(tapeDeck, songContext) {
    this.#tapeDeck = tapeDeck;
    this.#songContext = songContext;
  }

  /**
   * @param {{action: 'play' | 'stop' | 'record', trackNumber?: number, section?: string}} args
   * @returns {Promise<FunctionResponse>}
   */
  async run(args) {
    let responseText = '';

    let startTimeS = 0;
    let endTimeS = this.#songContext.songLengthS || TapeDeck.MAX_TRACK_LENGTH_S;

    if (args.section) {
      try {
        const section = this.#songContext.getSection(args.section);
        startTimeS = section.startTimeS;
        endTimeS = section.startTimeS + section.durationS;
      } catch (e) {
        return MakeToolResponse(this, e.message);
      }
    }

    if (args.action === 'play') {
      this.#tapeDeck.startPlayback(startTimeS, endTimeS);
      if (args.section) {
        responseText = `Playback started for section "${args.section}".`;
      } else {
        responseText = 'Playback started.';
      }
    } else if (args.action === 'stop') {
      this.#tapeDeck.stop();
      responseText = 'Playback stopped.';
    } else if (args.action === 'record') {
      if (args.trackNumber === undefined) {
        return MakeToolResponse(this, 'Error: trackNumber is required for recording.');
      }
      this.#tapeDeck.arm(args.trackNumber);
      this.#tapeDeck.startPlayback(startTimeS, endTimeS, { punchInS: startTimeS, punchOutS: endTimeS });

      await this.#tapeDeck.waitForEnd();

      const uploadedFile = await this.#tapeDeck.getTrackSlice(args.trackNumber, startTimeS, endTimeS);

      if (args.section) {
        responseText = `Finished recording track ${args.trackNumber} for section "${args.section}". Please analyze the audio file and identify the content.`;
      } else {
        responseText = `Finished recording track ${args.trackNumber}. Please analyze the audio file and identify the content.`;
      }
      const fileData = { mimeType: uploadedFile.mimeType, fileUri: uploadedFile.fileUri };
      return MakeToolResponse(this, responseText, fileData);
    } else {
      return MakeToolResponse(this, `Unknown action: ${args.action}`);
    }

    return MakeToolResponse(this, responseText);
  }
}