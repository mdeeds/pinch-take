// @ts-check

/**
 * @interface
 */
export class Stateful {
  /**
   * Returns a JSON-serializable object representing the object's state.
   * @returns {Object}
   */
  getJSON() {
    throw new Error("Method 'getJSON()' must be implemented.");
  }
}