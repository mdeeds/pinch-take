// @ts-check

import { Stateful } from "./stateful.js";
import { State } from "./state.js"

/**
 * @implements {Stateful}
 */
export class SectionContext {
  /** @type {State} */
  state;

  /**
   * @param {{ name: string; measureCount: number; startTimeS: number; }} args
   */
  constructor(args) {
    this.state = new State({
      name: args.name,
      measureCount: args.measureCount,
      startTimeS: args.startTimeS,
      durationS: 0, // Will be calculated
    });
  }

  get name() { return this.state.get('name'); }
  get measureCount() { return this.state.getNumber('measureCount'); }
  get startTimeS() { return this.state.getNumber('startTimeS'); }
  get durationS() { return this.state.getNumber('durationS'); }

  /**
   * @param {number} bpm
   * @param {number} beatsPerMeasure
   */
  recalculateDuration(bpm, beatsPerMeasure) {
    const durationS = this.state.getNumber('measureCount') * beatsPerMeasure * 60 / bpm;
    this.state.set('durationS', durationS);
  }

  /**
   * @returns {any}
   */
  getJSON() {
    return this.state.getJSON();
  }
}

/**
 * @implements {Stateful}
 */
export class SongContext {
  /** @type {State} */
  state;

  /** @type {SectionContext[]} */
  #sections = [];

  /** @type {((songContext: SongContext) => void)[]} */
  #onSongTimeChangedCallbacks = [];

  constructor() {
    this.state = new State({
      tempo: 120,
      beatsPerMeasure: 4,
      songLengthS: 0.0,
    });
    this.state.addList('sections');
  }

  /**
   * @param {(songContext: SongContext) => void} callback
   */
  onSongTimeChanged(callback) {
    this.#onSongTimeChangedCallbacks.push(callback);
  }

  get tempo() { return this.state.getNumber('tempo'); }
  get beatsPerMeasure() { return this.state.getNumber('beatsPerMeasure'); }
  get songLengthS() { return this.state.getNumber('songLengthS'); }

  /**
   * @returns {any}
   */
  getJSON() {
    return this.state.getJSON();
  }

  /**
   * Recalculates section durations and start times based on the current song tempo and time signature.
   */
  #recalculateSections() {
    let currentSongLengthS = 0;
    for (const section of this.#sections) {
      section.state.set('startTimeS', currentSongLengthS);
      section.recalculateDuration(this.tempo, this.beatsPerMeasure);
      currentSongLengthS += section.state.getNumber('durationS');
    }
    this.state.set('songLengthS', currentSongLengthS);
  }

  /**
   * 
   * @param {{tempo: number, beatsPerMeasure: number}} param0 
   */
  setSongTime({ tempo, beatsPerMeasure }) {
    if (tempo) this.state.set('tempo', tempo);
    if (beatsPerMeasure) this.state.set('beatsPerMeasure', beatsPerMeasure);
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
      startTimeS: this.songLengthS,
    });
    section.recalculateDuration(this.tempo, this.beatsPerMeasure);
    this.#sections.push(section);
    this.state.set('songLengthS', this.songLengthS + section.state.getNumber('durationS'));
    // The `add` method on the StateList will handle adding the child and its data.
    this.state.getList('sections').add(section.state);
  }

  /**
   * @param {number} tapeTimeS
   * @returns {SectionContext}
   */
  getSectionAtTime(tapeTimeS) {
    for (const section of this.#sections) {
      const startTime = section.state.getNumber('startTimeS');
      const endTime = startTime + section.state.getNumber('durationS');
      if (tapeTimeS >= startTime && tapeTimeS < endTime) {
        return section;
      }
    }
    return this.#sections[this.#sections.length - 1];
  }

  /**
   * @param {string} name
   * @returns {SectionContext}
   * @throws {Error} if section is not found.
   */
  getSection(name) {
    const section = this.#sections.find(s => s.state.get('name') === name);
    if (!section) {
      throw new Error(`Section "${name}" not found.`);
    }
    return section;
  }

}