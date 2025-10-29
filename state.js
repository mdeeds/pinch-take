export class State {

  /** @type {any} */
  data;

  /** @type {Map<string, State | State[]>} */
  state;

  /** @type {State} */
  parentState;

  /** @type {Map<string, Set<(number)=>void>} */
  fieldCallbacks = new Map();

  /** @type {Set<()=>void>} */
  broadCallbacks = new Set();


  /**
   * @param {any} data
   * @param {State} parentState
   */
  constructor(data, parentState) {
    this.data = data;
    this.state = new Map();
    this.parentState = parentState;
  }

  /**
   * @param {string} key
   * @param {State | State[]} state
   */
  addChildState(key, state) {
    this.state.set(key, state);
  }

  /**
   * @param {string} key
   * @returns { State | number | string | boolean | State[] }
   */
  get(key) {
    return this.data[key] || this.state.get(key);
  }

  /**
   * @param {string} key
   * @param {number | string | boolean } value
   */
  set(key, value) {
    this.data[key] = value;
    this.notify(key, value);
    this.notifyAll();
  }

  /**
   * @param {string} key
   * @param {number | string | boolean } value
   */
  notify(key, value) {
    const callbacks = this.fieldCallbacks.get(key);
    if (callbacks) {
      for (const callback of callbacks) {
        callback(value);
      }
    }
  }

  notifyAll() {
    for (const callback of this.broadCallbacks) {
      callback();
    }
  }

  /**
   * Returns a JSON-serializable object representing the object's state.
   * @returns {Object}
   */
  getJSON() {
    return JSON.parse(JSON.stringify(this.data));
  }

}