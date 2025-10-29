export class StateList {
  /** @type {State[]} */
  #list = [];

  /** @type {State | null} */
  #parentState = null;

  #dataList = [];

  /**
   * @param {State[]} initialList
   */
  constructor(parentState, dataList) {
    this.#parentState = parentState;
    this.dataList = dataList;
  }

  /**
   * @param {State} item
   */
  add(item) {
    this.#list.push(item);
    this.#dataList.push(item.protectedData);
    this.#parentState.addChild(item);
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

  /** @type {Map<string, Set<(number)=>void>} */
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
    this.#children.set(key, child);
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

  }

  /**
   * @param {string} key
   * @returns { State | number | string | boolean | StateList }
   */
  get(key) {
    return this.protectedData[key] || this.state.get(key);
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
    const callbacks = this.#fieldCallbacks.get(key);
    if (callbacks) {
      for (const callback of callbacks) {
        callback(value);
      }
    }
  }

  notifyAll() {
    for (const callback of this.#broadCallbacks) {
      callback();
    }
    if (this.#parentState) {
      this.#parentState.notifyAll();
    }
  }

  /**
   * Returns a JSON-serializable object representing the object's state.
   * @returns {Object}
   */
  getJSON() {
    return = JSON.parse(JSON.stringify(this.protectedData));
  }

}