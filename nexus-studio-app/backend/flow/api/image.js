import {
  API_IMAGE_GENERATION,
  API_IMAGE_UPSCALE,
  API_IMAGE_UPLOAD,
  IMAGE_MODELS,
  IMAGE_ASPECTS,
  IMAGE_RESOLUTIONS,
  DEFAULT_IMAGE_MODEL,
  RECAPTCHA_APPLICATION_TYPE,
  getFlowSessionId,
} from '../config.js';

export class ImageAPI {
  constructor(client, logCallback = () => {}) {
    this.client = client;
    this._log = logCallback;
  }

  async generate({
    prompt,
    recaptcha_token,
    model_name = DEFAULT_IMAGE_MODEL,
    aspect_name = '16:9 Landscape',
    count = 2,
    options = {},
  }) {
    if (!IMAGE_MODELS[model_name]) {
      return { success: false, error: `Unknown model: ${model_name}` };
    }
    if (!IMAGE_ASPECTS[aspect_name]) {
      return { success: false, error: `Unknown aspect: ${aspect_name}` };
    }
    if (!this.client.auth_state.project_id) {
      return { success: false, error: 'No project ID set' };
    }

    const modelKey = IMAGE_MODELS[model_name].key;
    const aspectKey = IMAGE_ASPECTS[aspect_name];
    const sessionId = getFlowSessionId();
    const projectId = this.client.auth_state.project_id;
    const clientContextBase = {
      recaptchaContext: { token: recaptcha_token, applicationType: RECAPTCHA_APPLICATION_TYPE },
      sessionId,
      projectId,
      tool: 'PINHOLE',
    };

    // Support for image input (I2I mode)
    const imageBytes = options?.image_bytes; // Base64 encoded source image
    const hasI2I = !!(imageBytes || (options?.reference_image_media_ids?.length > 0));
    const mode = hasI2I ? 'i2i' : 't2i';

    this._log(`Generating ${count} image(s) with ${model_name}... (${mode.toUpperCase()})`);
    this._log(`[DEBUG] Mode: ${mode.toUpperCase()}`);
    this._log(`[DEBUG] image sessionId: ${sessionId.slice(0, 12)}...`);

    const requestsList = [];
    for (let i = 0; i < count; i++) {
      const requestSeed = typeof options?.seed === 'number' ? options.seed : Math.floor(Math.random() * 999999);
      const requestItem = {
        clientContext: { ...clientContextBase },
        seed: requestSeed,
        imageModelName: modelKey,
        imageAspectRatio: aspectKey,
        prompt: String(prompt).trim(),
        imageInputs: [],
      };

      // Add image inputs for I2I mode or reference images
      const referenceMediaIds = options?.reference_image_media_ids || [];
      if (referenceMediaIds.length > 0) {
        requestItem.imageInputs = referenceMediaIds.map(mediaId => ({
          name: mediaId,
          imageInputType: 'IMAGE_INPUT_TYPE_REFERENCE',
        }));
      } else if (imageBytes) {
        requestItem.imageInput = { imageBytes: imageBytes };
      }

      requestsList.push(requestItem);
    }

    const payload = {
      clientContext: clientContextBase,
      requests: requestsList,
    };

    // Log full request payload for debugging (token and long base64 redacted)
    const maxStrLen = 80;
    const replacer = (key, value) => {
      if (key === 'token' && typeof value === 'string') return '[REDACTED]';
      if (typeof value === 'string' && value.length > maxStrLen) return value.slice(0, maxStrLen) + '...';
      return value;
    };
    this._log(`[DEBUG] Request payload (actual): ${JSON.stringify(payload, replacer, 2)}`);

    const url = API_IMAGE_GENERATION(this.client.auth_state.project_id);
    const result = await this.client.post(url, payload);

    if (!result.success) {
      this._log(`Image generation failed: ${result.error}`);
      this._log(`[DEBUG] Image API failure status: ${result.status}`);
      this._log(`[DEBUG] Image API failure response: ${JSON.stringify(result.data || {})}`);
      return result;
    }

    const data = result.data || {};
    const mediaList = data.media || [];
    const images = mediaList.map((item, i) => {
      const gen = item?.image?.generatedImage;
      const url = gen?.fifeUrl || gen?.fifeUri || gen?.imageUri || '';
      const mediaGenerationId = gen?.mediaGenerationId || item?.name || '';
      return {
        index: i,
        url,
        media_generation_id: mediaGenerationId, // Include for upscaling
        prompt,
        model: model_name,
        aspect: aspect_name,
        seed: gen?.seed ?? requestsList[i]?.seed,
      };
    });

    this._log(`Generated ${images.length} image(s)`);
    return { success: true, images, count: images.length };
  }

  async uploadImage({
    image_bytes,
    mime_type = 'image/jpeg',
    aspect_ratio = '16:9 Landscape',
  }) {
    if (!image_bytes) {
      return { success: false, error: 'Image bytes required' };
    }
    if (!IMAGE_ASPECTS[aspect_ratio]) {
      return { success: false, error: `Unknown aspect: ${aspect_ratio}` };
    }

    this._log('Uploading image...');
    const sessionId = getFlowSessionId();
    const aspectKey = IMAGE_ASPECTS[aspect_ratio];

    const payload = {
      imageInput: {
        rawImageBytes: image_bytes,
        mimeType: mime_type,
        isUserUploaded: true,
        aspectRatio: aspectKey,
      },
      clientContext: {
        sessionId,
        tool: 'ASSET_MANAGER',
      },
    };

    const result = await this.client.post(API_IMAGE_UPLOAD, payload);
    if (!result.success) {
      this._log(`Image upload failed: ${result.error}`);
      if (result.status === 400) {
        this._log(`Full error response: ${JSON.stringify(result.data || {})}`);
      }
      return result;
    }

    const data = result.data || {};
    const mediaGenerationId = data.mediaGenerationId?.mediaGenerationId || data.mediaGenerationId;
    if (!mediaGenerationId) {
      return { success: false, error: 'No mediaGenerationId in response' };
    }

    this._log(`Image uploaded successfully: ${mediaGenerationId}`);
    return {
      success: true,
      media_id: mediaGenerationId,
      width: data.width,
      height: data.height,
    };
  }

  async upscale(media_id, recaptcha_token, resolution = '4K') {
    if (!IMAGE_RESOLUTIONS[resolution]) {
      return { success: false, error: `Unknown resolution: ${resolution}. Supported: ${Object.keys(IMAGE_RESOLUTIONS).join(', ')}` };
    }
    const resolutionKey = IMAGE_RESOLUTIONS[resolution];
    this._log(`Upscaling image to ${resolution}...`);
    const sessionId = getFlowSessionId();
    const payload = {
      mediaId: media_id,
      targetResolution: resolutionKey,
      clientContext: {
        recaptchaContext: { token: recaptcha_token, applicationType: RECAPTCHA_APPLICATION_TYPE },
        sessionId,
        projectId: this.client.auth_state.project_id,
        tool: 'PINHOLE',
      },
    };
    const replacer = (key, value) => {
      if (key === 'token' && typeof value === 'string') return '[REDACTED]';
      if (typeof value === 'string' && value.length > 80) return value.slice(0, 80) + '...';
      return value;
    };
    this._log(`[DEBUG] Image upscale request payload: ${JSON.stringify(payload, replacer, 2)}`);
    const result = await this.client.post(API_IMAGE_UPSCALE, payload);
    if (!result.success) {
      this._log(`${resolution} upscale failed: ${result.error}`);
      return result;
    }
    const encoded = result.data?.encodedImage;
    if (!encoded) return { success: false, error: 'No image data in response' };
    this._log(`Image upscaled to ${resolution} successfully`);
    return { success: true, encoded_image: encoded, resolution };
  }

  // Backward compatibility: keep upscale_4k as alias
  async upscale_4k(media_id, recaptcha_token) {
    return this.upscale(media_id, recaptcha_token, '4K');
  }
}
