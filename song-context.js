// @ts-check


export class SectionContext {
  /** @type {string} */
  name;
  /** @type {number} */
  bpm;
  /** @type {number} */
  beatsPerMeasure;
  /** @type {number} */
  measureCount;

  /**
   * @param {{ name: string; bpm: number; beatsPerMeasure: number; measureCount: number; }} args
   */
  constructor(args) {
    this.name = args.name;
    this.bpm = args.bpm;
    this.beatsPerMeasure = args.beatsPerMeasure;
    this.measureCount = args.measureCount;
  }

  durationS() {
    return this.measureCount * this.beatsPerMeasure * 60 / this.bpm;
  }
}

export class SongContext {

  /** @type {SectionContext[]} */
  sections = [];

  /** @type {number[]} */
  startTimesS = [];

  /** @type {number } */
  songLengthS = 0.0;

  constructor() {
  }

  /**
   * @param {{ name: string; bpm?: number; beatsPerMeasure?: number; measureCount: number; }} sectionArgs
   */
  addSection(sectionArgs) {
    const lastSection = this.sections.length > 0 ? this.sections[this.sections.length - 1] : null;

    if (sectionArgs.bpm === undefined && lastSection) {
      sectionArgs.bpm = lastSection.bpm;
    }
    if (sectionArgs.beatsPerMeasure === undefined && lastSection) {
      sectionArgs.beatsPerMeasure = lastSection.beatsPerMeasure;
    }

    if (sectionArgs.bpm === undefined) {
      throw new Error('bpm is required for the first section.');
    }
    if (sectionArgs.beatsPerMeasure === undefined) {
      throw new Error('beatsPerMeasure is required for the first section.');
    }
    const section = new SectionContext(/** @type {any} */(sectionArgs));
    this.sections.push(section);
    this.startTimesS.push(this.songLengthS);
    this.songLengthS += section.durationS();
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