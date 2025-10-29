export class StateList {
  /** @type {State[]} */
  #list = [];

  /** @type {State | null} */
  #parentState = null;

  #dataList = undefined;

  /**
   * @param {State[]} initialList
   */
  constructor(parentState, dataList) {
    if (!parentState) {
      throw new Error('Parent state required.');
    }
    this.#parentState = parentState;
    this.#dataList = dataList;
  }

  /**
   * @param {State} item
   */
  add(item) {
    // console.log('Adding', item.getJSON());
    this.#list.push(item);
    this.#dataList.push(item.protectedData);
    this.#parentState.addChild(null, item);
    this.#parentState.notifyAll();
  }

  /**
   * @param {number} index
   * @returns {State | undefined}
   */
  at(index) {
    return this.#list[index];
  }

  /**
   * @returns {any[]}
   */
  getJSON() {
    return this.#list.map(item => item.getJSON());
  }
}

export class State {

  /** @type {any} */
  protectedData;  // Always pure JSON serializable data.

  /** @type {Map<string, State | StateList>} */
  #children = new Map();  // `#children` and `#data` never share keys.

  /** @type {State | null} */
  #parentState = null;

  /** @type {Map<string, Set<(value: any) => void>>} */
  #fieldCallbacks = new Map();

  /** @type {Set<()=>void>} */
  #broadCallbacks = new Set();


  /**
   * @param {any} data
   */
  constructor(data) {
    // We typically do not know our parent when constructed.  Instead our parent is called
    // with `addChild`.
    this.protectedData = data;
  }

  /**
   * @param {string} key
   * @param {State} child
   */
  addChild(key, child) {
    if (key) {
      this.#children.set(key, child);
    }
    child.#parentState = this;
  }

  /**
   * @param {string} key
   */
  addList(key) {
    const dataList = [];
    this.protectedData[key] = dataList;
    const list = new StateList(this, dataList);
    this.#children.set(key, list);
    this.notifyAll();
  }

  /**
   * @param {string} key
   * @returns { State | number | string | boolean | StateList }
   */
  get(key) {
    return this.protectedData[key] || this.#children.get(key);
  }

  /**
   * @param {string} key
   * @returns { StateList }
   */
  getList(key) {
    const child = this.#children.get(key);
    if (child instanceof StateList) {
      return child;
    }
    throw new Error('Not a StateList: ' + key);
  }

  /**
   * 
   * @param {string} key 
   * @returns 
   */
  getNumber(key) {
    const val = this.protectedData[key];
    if (typeof (val) === 'number') {
      return val;
    }
    throw new Error("Value is not a number: " + val);
  }

  /**
   * @param {string} key
   * @param {number | string | boolean } value
   */
  set(key, value) {
    this.protectedData[key] = value;
    this.notify(key, value);
    this.notifyAll();
  }

  /**
   * @param {string} key
   * @param {number | string | boolean } value
   */
  notify(key, value) {
    // console.log(`Notify: ${key} = ${value}`);
    const callbacks = this.#fieldCallbacks.get(key);
    if (callbacks) {
      for (const callback of callbacks) {
        callback(value);
      }
    }
  }

  notifyAll() {
    // console.log('NotifyAll', this.getJSON());
    for (const callback of this.#broadCallbacks) {
      callback();
    }
    if (this.#parentState) {
      this.#parentState.notifyAll();
    } else {
      // console.log('No parent.');
    }
  }

  /**
   * Adds a callback that fires when a specific field is changed via `set()`.
   * @param {string} key The name of the field to watch.
   * @param {(value: any) => void} callback The function to call with the new value.
   */
  addFieldCallback(key, callback) {
    if (!this.#fieldCallbacks.has(key)) {
      this.#fieldCallbacks.set(key, new Set());
    }
    this.#fieldCallbacks.get(key)?.add(callback);
  }

  /**
   * Adds a callback that fires whenever any field in this state object (or any of its children) changes.
   * The callback receives no arguments.
   * @param {() => void} callback The function to call.
   */
  addBroadCallback(callback) {
    this.#broadCallbacks.add(callback);
  }

  /**
   * Returns a JSON-serializable object representing the object's state.
   * @returns {Object}
   */
  getJSON() {
    return JSON.parse(JSON.stringify(this.protectedData));
  }

}