// @ts-check

export class ChatUI {
  /** @type {HTMLElement} */
  #chatHistoryElement;

  /**
   * @param {HTMLElement} chatHistoryElement The HTML element to display chat messages in.
   */
  constructor(chatHistoryElement) {
    if (!chatHistoryElement) throw new Error('chatHistoryElement is required.');
    this.#chatHistoryElement = chatHistoryElement;
  }

  /**
   * Appends a message to the chat history UI.
   * @param {string} message The message content.
   * @param {'user-message' | 'model-message'} className The CSS class for the message bubble.
   */
  displayMessage(message, className) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${className}`;
    messageDiv.textContent = message;
    this.#chatHistoryElement.appendChild(messageDiv);
    // Scroll to the bottom of the chat history
    this.#chatHistoryElement.scrollTop = this.#chatHistoryElement.scrollHeight;
  }
}