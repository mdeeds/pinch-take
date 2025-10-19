// @ts-check
/** @typedef {import('./tool.js').Tool} Tool */

/**
 * @typedef {{role: 'user' | 'model', parts: {text: string}[]}} ChatMessage
 * @typedef {import('./tool.js').FunctionResponse} FunctionResponse
 */

export class GeminiChat {
  /** @type {string} */
  #apiKey;
  /** @type {HTMLElement} */
  #chatHistoryElement;
  /** @type {string | null} */
  #systemInstructions = null;
  /** @type {ChatMessage[]} */
  conversationHistory = [];
  /** @type {Map<string, Tool>} */
  #tools = new Map();

  /**
   * @param {string} apiKey Your Google AI API key.
   * @param {HTMLElement} chatHistoryElement The HTML element to display chat messages in.
   */
  constructor(apiKey, chatHistoryElement) {
    if (!apiKey) throw new Error('apiKey is required.');
    if (!chatHistoryElement) throw new Error('chatHistoryElement is required.');
    this.#apiKey = apiKey;
    this.#chatHistoryElement = chatHistoryElement;
  }

  /**
   * 
   * @param {Tool} tool 
   */
  addTool(tool) {
    this.#tools.set(tool.declaration.name, tool);
  }

  /**
   * Appends a message to the chat history UI.
   * @param {string} message The message content.
   * @param {string} className The CSS class for the message bubble ('user-message' or 'model-message').
   */
  displayMessage(message, className) {
    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${className}`;
    messageDiv.textContent = message;
    this.#chatHistoryElement.appendChild(messageDiv);
    // Scroll to the bottom of the chat history
    this.#chatHistoryElement.scrollTop = this.#chatHistoryElement.scrollHeight;
  }

  /**
   * Executes tool calls from the model's response.
   * @param {any[]} parts The parts array from the model's content response.
   * @returns {Promise<any[] | null>} An array of tool responses or null if no tool calls were made.
   */
  async handleToolCalls(parts) {
    const toolResponseParts = [];
    for (const part of parts) {
      if (part.functionCall) {
        const { name, args } = part.functionCall;
        const toolResponse = {
          name,
          response: { content: 'No response from tool.' }
        }
        const tool = this.#tools.get(name);
        if (tool) {
          console.log(`Running tool '${name}' with args:`, args);
          let toolDescription = `${name} (${JSON.stringify(args)})`;
          if (toolDescription.length > 200) {
            toolDescription = toolDescription.slice(0, 200) + '...';
          }
          const result = await tool.run(args);
          toolResponse.response = result;
        } else {
          console.error(`Tool '${name}' not found.`);
          toolResponse.response.content = `Tool '${name}' not found.`;
        }
        toolResponseParts.push({ functionResponse: toolResponse });
      }
    }
    return toolResponseParts.length > 0 ? toolResponseParts : null;

  }

  /**
   * Handles sending a message to the Gemini model and displaying the response.
   * @param {string} message The user's message.
   */
  async sendMessage(message) {
    this.displayMessage(message, 'user-message');
    this.conversationHistory.push({ role: 'user', parts: [{ text: message }] });

    let processing = true;
    while (processing) {
      const MODEL_NAME = 'gemini-flash-latest';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${this.#apiKey}`;

      const toolDeclarations = Array.from(this.#tools.values()).map(tool => tool.declaration);
      const requestBody = {
        contents: this.conversationHistory,
        tools: [{ function_declarations: toolDeclarations }],
      };

      if (this.#systemInstructions) {
        // @ts-ignore
        requestBody.system_instruction = {
          parts: [{ text: this.#systemInstructions }],
        };
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorBody = await response.json();
        console.error('API Error:', errorBody);
        if (errorBody.error?.code === 429) {
          const retryInfo = errorBody.error?.details?.find((detail) => {
            return detail['@type'] === 'type.googleapis.com/google.rpc.RetryInfo';
          });
          if (retryInfo) {
            const delayString = retryInfo.retryDelay;
            console.log(`429: retry in ${delayString}`);
            const m = delayString.match(/(\d+)s/);
            // if (m) {
            //   delay = Math.max(parseFloat(m[1]) * 1000, delay);
            // }
          }
        }

        throw new Error(`API call failed with status: ${response.status}`);
      }

      const data = await response.json();
      const modelContent = data.candidates?.[0]?.content;

      if (!modelContent || !modelContent.parts || modelContent.parts.length === 0) {
        this.displayMessage('Received an empty response from the model.', 'model-message');
        processing = false;
        continue;
      }

      this.conversationHistory.push(modelContent);

      const toolResponseParts = await this.handleToolCalls(modelContent.parts);

      if (toolResponseParts) {
        this.conversationHistory.push({
          role: 'tool',
          parts: toolResponseParts,
        });
        // Continue loop to send tool results back to the model
      } else {
        // No tool calls, look for a text response to display
        const textPart = modelContent.parts.find(part => part.text);
        if (textPart) {
          this.displayMessage(textPart.text, 'model-message');
        } else {
          // This can happen if the model *only* returns tool calls that we couldn't handle
          // or if the response is malformed.
          this.displayMessage(
            'Model finished but did not provide a text response.',
            'model-message'
          );
        }
        processing = false; // End the loop
      }
    }
  }
}