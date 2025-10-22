
// Represents a singular moment in time in both the audio context (i.e. perpetually advancing) and
// the tape (i.e. relative to the song start)
export class SyncTime {
  /** @type {number} */
  audioCtxTimeS = undefined;
  /** @type { number} */
  tapeTimeS = undefined;
}