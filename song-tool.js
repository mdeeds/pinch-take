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
export class SectionTool {
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
      const responseText = `Added section "${args.name}"
Full song context:
${JSON.stringify(this.#songContext.sections, null, 2)}
`;
      return MakeToolResponse(this, responseText);
    } catch (error) {
      console.error('Error adding section:', error);
      return MakeToolResponse(this, `Error adding section: ${error.message}`);
    }
  }
}

export class SongTool {
  /** @type {FunctionDeclaration} */
  declaration = {
    name: 'set_song_time',
    description: 'Sets the tempo and beats per measure for a song.',
    parameters: {
      type: 'OBJECT',
      properties: {
        tempo: {
          type: 'NUMBER',
          description: 'The tempo in beats per minute (BPM).',
        },
        beatsPerMeasure: {
          type: 'INTEGER',
          description: 'The number of beats per measure. Default is 4.',
        },
      },
      required: ['tempo'],
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
      this.#songContext.setSongTime(args);
      const responseText = `Set song time
Full song context:
${JSON.stringify(this.#songContext.getJSON, null, 2)}
`;
      return MakeToolResponse(this, responseText);
    } catch (error) {
      console.error('Error adding section:', error);
      return MakeToolResponse(this, `Error adding section: ${error.message}`);
    }
  }
}