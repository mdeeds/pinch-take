// @ts-check

export class FileData {
  /** @type {string} */
  mimeType;
  /** @type {string} */
  fileUri;

  /**
   * @param {string} mimeType
   * @param {string} fileUri
   */
  constructor(mimeType, fileUri) {
    this.mimeType = mimeType;
    this.fileUri = fileUri;
  }
}

/**
 * Manages uploading files to the Gemini API.
 */
export class GeminiFileManager {
  /** @type {string} */
  #apiKey;

  /**
   * @param {string} apiKey Your Google AI API key.
   */
  constructor(apiKey) {
    if (!apiKey) throw new Error('apiKey is required.');
    this.#apiKey = apiKey;
  }

  /**
   * Encodes raw PCM audio data into a WAV file format Blob.
   * @param {Float32Array} samples The raw audio samples.
   * @param {number} sampleRate The sample rate of the audio.
   * @returns {Blob} A Blob containing the WAV file data.
   */
  #encodeWav(samples, sampleRate) {
    const numChannels = 1; // Mono
    const bytesPerSample = 2; // 16-bit PCM
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = samples.length * bytesPerSample;
    const fileSize = 36 + dataSize;

    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    // RIFF header
    view.setUint32(0, 0x52494646, false); // "RIFF"
    view.setUint32(4, fileSize, true);
    view.setUint32(8, 0x57415645, false); // "WAVE"

    // "fmt " sub-chunk
    view.setUint32(12, 0x666d7420, false); // "fmt "
    view.setUint32(16, 16, true); // Sub-chunk size
    view.setUint16(20, 1, true); // Audio format (1 = PCM)
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true); // Bits per sample

    // "data" sub-chunk
    view.setUint32(36, 0x64617461, false); // "data"
    view.setUint32(40, dataSize, true);

    // Write PCM data (converting from 32-bit float to 16-bit int)
    let offset = 44;
    for (let i = 0; i < samples.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }

    return new Blob([view], { type: 'audio/wav' });
  }

  /**
   * Encodes raw PCM audio data into a base64-encoded WAV string for inline use.
   * @param {Float32Array} samples The raw audio samples.
   * @param {number} sampleRate The sample rate of the audio.
   * @returns {Promise<{mimeType: string, data: string}>}
   */
  async encodeWavAsFileData(samples, sampleRate) {
    const wavBlob = this.#encodeWav(samples, sampleRate);
    const arrayBuffer = await wavBlob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < uint8Array.byteLength; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    const base64Data = btoa(binary);

    return {
      mimeType: wavBlob.type,
      data: base64Data,
    };
  }


  /**
   * Uploads raw Float32 audio data as a WAV file to the Gemini API.
   * @param {Float32Array} audioData The raw audio samples.
   * @param {number} sampleRate The sample rate of the audio.
   * @param {string} displayName A display name for the file.
   * @returns {Promise<FileData>} A promise that resolves with the file data.
   */
  async uploadWav(audioData, sampleRate, displayName) {
    const wavBlob = this.#encodeWav(audioData, sampleRate);

    // --- Step 1: Get the upload URL ---
    const startUploadUrl = `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${this.#apiKey}`;
    const startResponse = await fetch(startUploadUrl, {
      method: 'POST',
      headers: {
        'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Command': 'start',
        'X-Goog-Upload-Header-Content-Length': wavBlob.size.toString(),
        'X-Goog-Upload-Header-Content-Type': wavBlob.type,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ file: { display_name: displayName } }),
    });

    if (!startResponse.ok) {
      throw new Error(`Failed to start file upload: ${startResponse.statusText}`);
    }

    const uploadUrl = startResponse.headers.get('X-Goog-Upload-Url');
    if (!uploadUrl) {
      throw new Error('Did not receive an upload URL from the server.');
    }

    // --- Step 2: Upload the file content ---
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Length': wavBlob.size.toString(),
        'X-Goog-Upload-Offset': 0,
        'X-Goog-Upload-Command': 'upload, finalize',
        'Content-Type': wavBlob.type,
      },
      body: wavBlob,
    });

    if (!uploadResponse.ok) {
      throw new Error(`File upload failed: ${uploadResponse.statusText}`);
    }

    const uploadResult = await uploadResponse.json();
    return new FileData(wavBlob.type, uploadResult.file.name);
  }
}