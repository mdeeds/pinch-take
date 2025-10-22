// @ts-check


export class SectionContext {
  /** @type {string} */
  name;
  /** @type {number} */
  measureCount;
  /** @type {number} */
  durationS;
  /** @type {number} */
  startTimeS;

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
}

export class SongContext {

  /** @type {SectionContext[]} */
  sections = [];

  /** @type {number[]} */
  startTimesS = [];

  /** @type {number } */
  songLengthS = 0.0;

  tempo = 120;
  beatsPerMeasure = 4;

  constructor() {
  }

  getJSON() {
    return {
      tempo: this.tempo,
      beatsPerMeasure: this.beatsPerMeasure,
      sections: this.sections
    }
  }

  /**
   * 
   * @param {{tempo: number, beatsPerMeasure: number}} param0 
   */
  setSongTime({ tempo, beatsPerMeasure }) {
    this.tempo = tempo;
    this.beatsPerMeasure = beatsPerMeasure;
  }

  /**
   * @param {{ name: string; measureCount: number; }} sectionArgs
   */
  addSection(sectionArgs) {
    const section = new SectionContext(/** @type {any} */(sectionArgs));
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