// @ts-check

import { Stateful } from "./state.js";

/**
 * @implements {Stateful}
 */
export class SectionContext {
  /** @type {string} */
  name;
  /** @type {number} */
  measureCount;
  /** @type {number} */
  durationS;
  /** @type {number} */
  startTimeS;
  /** @type {number} */
  bpm;
  /** @type {number} */
  beatsPerMeasure;

  /**
   * @param {{ name: string; bpm: number; beatsPerMeasure: number; measureCount: number; }} args
   */
  constructor(args) {
    this.name = args.name;
    this.bpm = args.bpm;
    this.beatsPerMeasure = args.beatsPerMeasure;
    this.measureCount = args.measureCount;
    this.durationS = this.getDurationS();
    this.startTimeS = 0.0;
  }

  getDurationS() {
    return this.measureCount * this.beatsPerMeasure * 60 / this.bpm;
  }

  /**
   * @returns {{name: string, measureCount: number}}
   */
  getJSON() {
    return {
      name: this.name,
      measureCount: this.measureCount,
    };
  }
}

/**
 * @implements {Stateful}
 */
export class SongContext {
  /** @type {SectionContext[]} */
  sections = [];

  /** @type {number[]} */
  startTimesS = [];

  /** @type {number } */
  songLengthS = 0.0;

  tempo = 120;
  beatsPerMeasure = 4;

  /** @type {((songContext: SongContext) => void)[]} */
  #onSongTimeChangedCallbacks = [];

  constructor() {
  }

  /**
   * @param {(songContext: SongContext) => void} callback
   */
  onSongTimeChanged(callback) {
    this.#onSongTimeChangedCallbacks.push(callback);
  }

  getJSON() {
    return {
      tempo: this.tempo,
      beatsPerMeasure: this.beatsPerMeasure,
      sections: this.sections.map(s => s.getJSON()),
    }
  }

  /**
   * Recalculates section durations and start times based on the current song tempo and time signature.
   */
  #recalculateSections() {
    this.songLengthS = 0;
    this.startTimesS = [];
    for (const section of this.sections) {
      section.bpm = this.tempo;
      section.beatsPerMeasure = this.beatsPerMeasure;
      section.durationS = section.getDurationS();
      section.startTimeS = this.songLengthS;

      this.startTimesS.push(this.songLengthS);
      this.songLengthS += section.durationS;
    }
  }

  /**
   * 
   * @param {{tempo: number, beatsPerMeasure: number}} param0 
   */
  setSongTime({ tempo, beatsPerMeasure }) {
    this.tempo = tempo || this.tempo;
    this.beatsPerMeasure = beatsPerMeasure || this.beatsPerMeasure;
    this.#recalculateSections();
    for (const callback of this.#onSongTimeChangedCallbacks) {
      callback(this);
    }
  }

  /**
   * @param {{ name: string; measureCount: number; }} sectionArgs
   */
  addSection(sectionArgs) {
    const section = new SectionContext({
      ...sectionArgs,
      bpm: this.tempo,
      beatsPerMeasure: this.beatsPerMeasure,
    });
    if (this.sections.length > 0) {
      section.startTimeS = this.songLengthS;
    }
    this.sections.push(section);
    this.startTimesS.push(this.songLengthS);
    this.songLengthS += section.durationS;
  }

  /**
   * @param {number} tapeTimeS
   * @returns {SectionContext}
   */
  getSectionAtTime(tapeTimeS) {
    for (let i = 1; i < this.startTimesS.length; i++) {
      if (tapeTimeS < this.startTimesS[i]) {
        return this.sections[i - 1];
      }
    }
    return this.sections[this.sections.length - 1];
  }

}