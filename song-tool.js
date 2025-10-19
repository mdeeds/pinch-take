// @ts-check

import { MakeToolResponse } from './tool.js';
import { SongContext } from './song-context.js';

/**
 * @typedef {import('./tool.js').Tool} Tool
 * @typedef {import('./tool.js').FunctionResponse} FunctionResponse
 * @typedef {import('./tool.js').FunctionDeclaration} FunctionDeclaration
 */

/**
 * The SongTool implementation for adding sections to a song.
 * @implements {Tool}
 */
export class SongTool {
  /** @type {FunctionDeclaration} */
  declaration = {
    name: 'add_song_section',
    description: 'Adds a new section to the song, like a verse or chorus.',
    parameters: {
      type: 'OBJECT',
      properties: {
        name: {
          type: 'STRING',
          description: 'The name of the section (e.g., "Verse 1", "Chorus").',
        },
        measureCount: {
          type: 'INTEGER',
          description: 'The number of measures in this section.',
        },
        bpm: {
          type: 'NUMBER',
          description: 'The tempo in beats per minute for this section. If not provided, uses the tempo of the previous section.',
        },
        beatsPerMeasure: {
          type: 'INTEGER',
          description: 'The number of beats per measure for this section. If not provided, uses the time signature of the previous section.',
        },
      },
      required: ['name', 'measureCount'],
    },
  };

  /** @type {SongContext} */
  #songContext;

  /**
   * @param {SongContext} songContext The song context to modify.
   */
  constructor(songContext) {
    this.#songContext = songContext;
  }

  /**
   * @param {any} args
   * @returns {Promise<FunctionResponse>}
   */
  async run(args) {
    try {
      this.#songContext.addSection(args);
      const responseText = `Added section "${args.name}" with ${args.measureCount} measures.`;
      return MakeToolResponse(this, responseText);
    } catch (error) {
      console.error('Error adding section:', error);
      return MakeToolResponse(this, `Error adding section: ${error.message}`);
    }
  }
}