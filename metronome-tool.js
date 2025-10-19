// @ts-check

import { MakeToolResponse } from './tool.js';

/**
 * @typedef {import('./tool.js').Tool} Tool
 * @typedef {import('./tool.js').FunctionResponse} FunctionResponse
 * @typedef {import('./tool.js').FunctionDeclaration} FunctionDeclaration
 */

/**
 * The MetronomeTool implementation.
 * @type {Tool}
 */
export class MetronomeTool {
  /** @type {FunctionDeclaration} */
  declaration = {
    name: 'set_metronome',
    description: 'Sets the metronome settings.',
    parameters: {
      type: 'OBJECT',
      properties: {
        tempo: {
          type: 'NUMBER',
          description: 'The tempo in beats per minute (BPM).',
        },
        beatsPerMeasure: {
          type: 'INTEGER',
          description: 'The number of beats per measure. Defaults to 4.',
        },
        onWhenRecording: {
          type: 'BOOLEAN',
          description: 'Whether the metronome is active during recording. Defaults to true.',
        },
        onWhenPlaying: {
          type: 'BOOLEAN',
          description: 'Whether the metronome is active during playback. Defaults to true.',
        },
      },
      required: ['tempo'],
    },
  };

  constructor() {
    // No arguments for now, but ready for future dependencies.
  }

  /**
   * @param {any} args
   * @returns {Promise<FunctionResponse>}
   */
  async run(args) {
    // In a real application, this is where you would interact with the
    // metronome service/API of your Digital Audio Workstation.

    const {
      tempo,
      beatsPerMeasure = 4,
      onWhenRecording = true,
      onWhenPlaying = true,
    } = args;

    console.log(`Setting metronome:
      Tempo: ${tempo} BPM
      Beats per measure: ${beatsPerMeasure}
      On during recording: ${onWhenRecording}
      On during playback: ${onWhenPlaying}`);

    const responseText = `Metronome set to ${tempo} BPM, ${beatsPerMeasure} beats per measure.`;

    return MakeToolResponse(this, responseText);
  }
}

const metronomeTool = new MetronomeTool();

export default metronomeTool;