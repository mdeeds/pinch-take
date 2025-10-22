// @ts-check

import { MakeToolResponse } from './tool.js';
import { MetronomeSettings, MetronomeHandler } from './metronome-handler.js';

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

  /** @type {MetronomeHandler} */
  #metronome;

  /**
   * @param {MetronomeHandler} metronome
   */
  constructor(metronome) {
    this.#metronome = metronome;
  }

  /**
   * @param {MetronomeSettings} args
   * @returns {Promise<FunctionResponse>}
   */
  async run(args) {
    const settings = this.#metronome.settings;
    Object.assign(settings, args);
    console.log(`Setting metronome: `, this.#metronome.settings);

    const responseText = `Metronome set to ${JSON.stringify(settings)}.`;

    return MakeToolResponse(this, responseText);
  }
}
