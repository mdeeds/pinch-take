// @ts-check

/**
 * @typedef {Object} Schema
 * @property {'STRING' | 'NUMBER' | 'INTEGER' | 'BOOLEAN' | 'ARRAY' | 'OBJECT'} type
 * @property {string} [description]
 * @property {string} [format]
 * @property {boolean} [nullable]
 * @property {Schema} [items]
 * @property {Object<string, Schema>} [properties]
 * @property {string[]} [required]
 * @property {any[]} [enum]
 */

/**
 * @typedef {Object} FunctionDeclaration
 * @property {string} name - The name of the function to call.
 * @property {string} description - A short description of the function.
 * @property {Schema} parameters - The parameters of the function.
 */

/** 
 * @typedef {Object} FunctionResponse
 * @property {string} name
 * @property {Object} response
 */

/**
 * @typedef {Object} Tool
 * @property {FunctionDeclaration} declaration - The static declaration of the tool for the Gemini API.
 * @property {(args: any) => Promise<FunctionResponse>} run - The async method to execute the tool's logic.
 */

/**
 * @param {Tool} tool
 * @param {string} responseText
 */
export function MakeToolResponse(tool, responseText) {
  return {
    name: tool.declaration.name,
    response: { content: responseText }
  };
}