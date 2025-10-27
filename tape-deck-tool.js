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
    description: 'Controls the tape deck playback.',
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
        responseText = `Finished recording track ${args.trackNumber} for section "${args.section}".`;
      } else {
        responseText = `Finished recording track ${args.trackNumber}.`;
      }
      if (!this.#tapeDeck.getTrackName(args.trackNumber)) {
        responseText += ` Finished recording. 
Perform a technical analysis of the audio to determine the instrument playing on the 
track, then call 'set_track_info' with a short name for the track.
You will need to put this call in your response along with any feedback to the user.
`;
      }
      const fileData = { mimeType: uploadedFile.mimeType, fileUri: uploadedFile.fileUri };
      return MakeToolResponse(this, responseText, fileData);
    } else {
      return MakeToolResponse(this, `Unknown action: ${args.action}`);
    }

    return MakeToolResponse(this, responseText);
  }
}

/**
 * The TrackInfoTool implementation for setting track metadata.
 * @implements {Tool}
 */
export class TrackInfoTool {
  /** @type {FunctionDeclaration} */
  declaration = {
    name: 'set_track_info',
    description: 'Sets metadata for a track, such as its name. Call this after completing the recording and you have analyzed the audio.',
    parameters: {
      type: 'OBJECT',
      properties: {
        trackNumber: {
          type: 'INTEGER',
          description: 'The track number to modify (0-indexed).',
        },
        name: {
          type: 'STRING',
          description: 'The new name for the track. Call this after you have analyzed the audio.',
        },
      },
      required: ['trackNumber', 'name'],
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
   * @param {{trackNumber: number, name: string}} args
   * @returns {Promise<FunctionResponse>}
   */
  async run(args) {
    try {
      this.#tapeDeck.setTrackName(args.trackNumber, args.name);
      const responseText = `Set name for track ${args.trackNumber} to "${args.name}".`;
      return MakeToolResponse(this, responseText);
    } catch (error) {
      console.error('Error setting track info:', error);
      return MakeToolResponse(this, `Error setting track info: ${error.message}`);
    }
  }
}
