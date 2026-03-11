import {
  API_VIDEO_GENERATION,
  API_VIDEO_STATUS,
  API_VIDEO_UPSCALE,
  API_VIDEO_START_IMAGE,
  API_VIDEO_REFERENCE_IMAGES,
  VIDEO_MODELS,
  VIDEO_ASPECTS,
  VIDEO_RESOLUTIONS,
  VIDEO_UPSCALER_MODELS,
  VIDEO_POLL_INTERVAL_MS,
  VIDEO_POLL_MAX_ATTEMPTS,
  RECAPTCHA_APPLICATION_TYPE,
  getFlowSessionId,
} from '../config.js';

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export class VideoAPI {
  constructor(client, logCallback = () => { }) {
    this.client = client;
    this._log = logCallback;
  }

  async generate({
    prompt,
    recaptcha_token,
    model_name = 'Veo 3.1 - Fast (Audio)',
    aspect_name = '16:9 Landscape',
    count = 1,
    on_progress,
    on_phase,
    options = {},
  }) {
    if (!VIDEO_MODELS[model_name]) {
      return { success: false, error: `Unknown model: ${model_name}` };
    }
    if (!VIDEO_ASPECTS[aspect_name]) {
      return { success: false, error: `Unknown aspect: ${aspect_name}` };
    }
    if (!this.client.auth_state.project_id) {
      return { success: false, error: 'No project ID set. Please ensure you are logged in and have a project.' };
    }

    const modelKey = VIDEO_MODELS[model_name].key;
    const modelCapabilities = VIDEO_MODELS[model_name].capabilities || [];
    const aspectKey = VIDEO_ASPECTS[aspect_name];
    const sessionId = getFlowSessionId();

    this._log(`[DEBUG] video sessionId: ${sessionId.slice(0, 12)}...`);

    // Support for image inputs (I2V and Ingredients modes)
    const imageBytes = options?.image_bytes; // Single image (base64)
    const imageBytesArray = options?.image_bytes_array; // Multiple images (base64 array)
    const startImageMediaId = options?.start_image_media_id; // Media ID for start image
    const referenceImageMediaIds = options?.reference_image_media_ids; // Array of media IDs for reference images

    // Determine mode and endpoint
    let mode = 't2v';
    let endpoint = API_VIDEO_GENERATION;

    if (referenceImageMediaIds && referenceImageMediaIds.length > 0) {
      mode = 'reference';
      endpoint = API_VIDEO_REFERENCE_IMAGES;
    } else if (startImageMediaId) {
      mode = 'start_image';
      endpoint = API_VIDEO_START_IMAGE;
    } else if (imageBytesArray?.length > 1) {
      mode = 'ingredients';
    } else if (imageBytes || imageBytesArray?.length === 1) {
      mode = 'i2v';
    }

    // Validate model supports requested mode
    if (mode === 'i2v' || mode === 'ingredients' || mode === 'start_image') {
      if (!modelCapabilities.includes('I2V')) {
        return {
          success: false,
          error: `Model ${model_name} does not support Image-to-Video mode. Use an I2V-capable model like "Veo 3.1 - I2V".`
        };
      }
    } else if (mode === 't2v' || mode === 'reference') {
      if (!modelCapabilities.includes('T2V')) {
        return {
          success: false,
          error: `Model ${model_name} does not support Text-to-Video mode. Use a T2V-capable model.`
        };
      }
    }

    this._log(`Generating ${count} video(s) with ${model_name}... (${mode.toUpperCase()})`);
    this._log(`[DEBUG] Mode: ${mode.toUpperCase()}`);
    if (on_progress) on_progress(5);

    const requestsList = [];
    for (let i = 0; i < count; i++) {
      const requestSceneId = uuid();
      const requestSeed = typeof options?.seed === 'number' ? options.seed : Math.floor(Math.random() * 999999);
      const requestItem = {
        aspectRatio: aspectKey,
        seed: requestSeed,
        videoModelKey: modelKey,
        metadata: { sceneId: requestSceneId },
      };

      // Add text input (required for all modes)
      if (prompt) {
        requestItem.textInput = { prompt: String(prompt).trim() };
      }

      // Add image input(s) for I2V or Ingredients mode
      if (mode === 'reference') {
        // Reference images mode: use referenceImages array with mediaId
        requestItem.referenceImages = referenceImageMediaIds.map(mediaId => ({
          imageUsageType: 'IMAGE_USAGE_TYPE_ASSET',
          mediaId: mediaId,
        }));
      } else if (mode === 'start_image') {
        // Start image mode: use startImage.mediaId
        requestItem.startImage = {
          mediaId: startImageMediaId,
        };
      } else if (imageBytesArray && imageBytesArray.length > 0) {
        // Ingredients mode: multiple images - use array format
        if (imageBytesArray.length === 1) {
          // Single image in array - treat as I2V
          requestItem.imageInput = { imageBytes: imageBytesArray[0] };
        } else {
          // Multiple images - Ingredients mode
          requestItem.imageInput = imageBytesArray.map(img => ({ imageBytes: img }));
        }
      } else if (imageBytes) {
        // I2V mode: single image
        requestItem.imageInput = { imageBytes: imageBytes };
      }

      requestsList.push(requestItem);
    }

    const payload = {
      requests: requestsList,
      clientContext: {
        recaptchaContext: { token: recaptcha_token, applicationType: RECAPTCHA_APPLICATION_TYPE },
        sessionId,
        projectId: this.client.auth_state.project_id,
        tool: 'PINHOLE',
      },
    };

    // Log the actual payload sent to the API (token and long base64 redacted)
    const maxStrLen = 80;
    const replacer = (key, value) => {
      if (key === 'token' && typeof value === 'string') return '[REDACTED]';
      if (typeof value === 'string' && value.length > maxStrLen) return value.slice(0, maxStrLen) + '...';
      return value;
    };
    this._log(`[DEBUG] Endpoint: ${endpoint}`);
    this._log(`[DEBUG] Request payload (actual): ${JSON.stringify(payload, replacer, 2)}`);

    const result = await this.client.post(endpoint, payload, 60000);
    if (!result.success) {
      this._log(`Video generation failed: ${result.error}`);
      if (result.status === 400) {
        this._log(`Full error response: ${JSON.stringify(result.data || {})}`);
      }
      return result;
    }
    if (on_progress) on_progress(10);

    const data = result.data || {};
    const operations = data.operations || [];
    if (!operations.length) return { success: false, error: 'No operation returned' };

    // Extract all operations for polling
    const operationInfos = operations.map((op, idx) => ({
      operationName: op.operation?.name,
      sceneId: op.sceneId || requestsList[idx]?.metadata?.sceneId,
      index: idx,
    })).filter(op => op.operationName);

    if (!operationInfos.length) return { success: false, error: 'No valid operations returned' };

    if (operationInfos.length > 1) {
      this._log(`Multiple videos submitted (${operationInfos.length}), polling for completion...`);
    } else {
      this._log('Video submitted, polling for completion...');
    }

    return this._pollMultipleVideoStatus(operationInfos, prompt, model_name, aspect_name, on_progress, on_phase);
  }

  async _pollMultipleVideoStatus(operationInfos, prompt, model_name, aspect_name, on_progress, on_phase) {
    on_phase?.('polling');
    const completed = new Map(); // Track completed videos by index
    const failed = new Map(); // Track failed videos by index

    for (let attempt = 0; attempt < VIDEO_POLL_MAX_ATTEMPTS; attempt++) {
      await delay(VIDEO_POLL_INTERVAL_MS);

      // Calculate progress based on completed videos
      const total = operationInfos.length;
      const doneCount = completed.size + failed.size;
      const progress = Math.min(10 + Math.floor((doneCount / total) * 80), 90);
      if (on_progress) on_progress(progress);

      // Check all pending operations
      const pendingOps = operationInfos.filter(op => !completed.has(op.index) && !failed.has(op.index));
      if (pendingOps.length === 0) {
        // All operations completed
        break;
      }

      const statusPayload = {
        operations: pendingOps.map(op => ({
          operation: { name: op.operationName },
          sceneId: op.sceneId,
        })),
      };

      this._log('[DEBUG] Status request payload: ' + JSON.stringify(statusPayload));
      const result = await this.client.post(API_VIDEO_STATUS, statusPayload);
      if (!result.success) {
        this._log(`Polling error: ${result.error}, retrying...`);
        continue;
      }

      const data = result.data || {};
      const ops = data.operations || [];
      if (!ops.length) continue;

      // Create a map of sceneId to operation info for matching
      const sceneIdMap = new Map(pendingOps.map(op => [op.sceneId, op]));

      // Process each operation result - match by sceneId
      for (const op of ops) {
        const opSceneId = op.sceneId;
        const opInfo = sceneIdMap.get(opSceneId);
        if (!opInfo) {
          // Operation not in our pending list (shouldn't happen)
          continue;
        }

        const status = op.status || '';

        if (status === 'MEDIA_GENERATION_STATUS_SUCCESSFUL') {
          // API returns video data under operation.metadata.video (not op.metadata.video)
          const meta = op.operation?.metadata?.video ?? op.metadata?.video;
          const videoUrl = op.fifeVideoUrl || op.initialFifeVideoUrl || meta?.fifeUrl || '';
          const mediaGenerationId = op.mediaGenerationId || meta?.mediaGenerationId || '';
          const thumbnailUrl = op.thumbnailImage?.thumbnailSrc || op.thumbnailVideo?.thumbnailSrc || meta?.servingBaseUri || '';
          const hasAudio = op.hasAudio || false;
          const seed = meta?.seed ?? op.seed ?? op.media?.video?.seed;

          this._log('[DEBUG] Status response (successful op): ' + JSON.stringify(op, null, 2));
          this._log('[DEBUG] Extracted meta, seed: ' + JSON.stringify({ meta, seed }));

          completed.set(opInfo.index, {
            index: opInfo.index,
            video_url: videoUrl,
            thumbnail_url: thumbnailUrl,
            media_generation_id: mediaGenerationId,
            has_audio: hasAudio,
            seed: seed,
            prompt,
            model: model_name,
            aspect: aspect_name,
          });
          this._log(`Video ${opInfo.index + 1} complete!`);
        } else if (status === 'MEDIA_GENERATION_STATUS_FAILED') {
          const msg = op.error?.message || 'Unknown error';
          failed.set(opInfo.index, msg);
          this._log(`Video ${opInfo.index + 1} failed: ${msg}`);
        } else {
          // Still pending
          this._log(`Video ${opInfo.index + 1} status: ${status}`);
        }
      }
    }

    // Collect all completed videos
    const videos = Array.from(completed.values()).sort((a, b) => a.index - b.index);

    if (videos.length === 0) {
      if (failed.size > 0) {
        const firstError = Array.from(failed.values())[0];
        return { success: false, error: `Video generation failed: ${firstError}` };
      }
      return { success: false, error: 'Video generation timed out after 10 minutes' };
    }

    if (on_progress) on_progress(100);
    this._log(`Video generation complete! ${videos.length}/${operationInfos.length} videos generated`);

    // For backward compatibility, return single video format if only one
    if (videos.length === 1) {
      const v = videos[0];
      return {
        success: true,
        video_url: v.video_url,
        thumbnail_url: v.thumbnail_url,
        media_generation_id: v.media_generation_id,
        has_audio: v.has_audio,
        seed: v.seed,
        prompt,
        model: model_name,
        aspect: aspect_name,
      };
    }

    // Return multiple videos
    return {
      success: true,
      videos,
      count: videos.length,
      prompt,
      model: model_name,
      aspect: aspect_name,
    };
  }

  /**
   * Submit one video upscale without polling. Returns operation name and sceneId for batch poll.
   * @returns {{ success: boolean, operationName?: string, sceneId?: string, error?: string }}
   */
  async submitUpscaleOnly(media_generation_id, aspect_ratio, recaptcha_token, resolution = '4K') {
    if (resolution === '720p') {
      return { success: false, error: '720p is the default resolution. Use 1080p or 4K for upscaling.' };
    }
    if (!VIDEO_RESOLUTIONS[resolution]) {
      return { success: false, error: `Unknown resolution: ${resolution}. Supported upscale resolutions: 1080p, 4K` };
    }
    if (!VIDEO_UPSCALER_MODELS[resolution]) {
      return { success: false, error: `No upscaler model available for ${resolution}. Supported: ${Object.keys(VIDEO_UPSCALER_MODELS).join(', ')}` };
    }
    const resolutionKey = VIDEO_RESOLUTIONS[resolution];
    const upscalerModel = VIDEO_UPSCALER_MODELS[resolution];
    const aspectKey = (aspect_ratio && VIDEO_ASPECTS[aspect_ratio]) ? VIDEO_ASPECTS[aspect_ratio] : (aspect_ratio || 'VIDEO_ASPECT_RATIO_LANDSCAPE');
    const sessionId = getFlowSessionId();
    const sceneId = uuid();
    const payload = {
      requests: [{
        aspectRatio: aspectKey,
        resolution: resolutionKey,
        seed: Math.floor(Math.random() * 99999),
        videoInput: { mediaId: media_generation_id },
        videoModelKey: upscalerModel,
        metadata: { sceneId },
      }],
      clientContext: {
        recaptchaContext: { token: recaptcha_token, applicationType: RECAPTCHA_APPLICATION_TYPE },
        recaptchaToken: recaptcha_token,
        sessionId,
      },
    };
    const replacer = (key, value) => {
      if ((key === 'token' || key === 'recaptchaToken') && typeof value === 'string') return '[REDACTED]';
      if (typeof value === 'string' && value.length > 80) return value.slice(0, 80) + '...';
      return value;
    };
    this._log(`[DEBUG] Video upscale request payload: ${JSON.stringify(payload, replacer, 2)}`);
    const result = await this.client.post(API_VIDEO_UPSCALE, payload, 60000);
    if (!result.success) {
      this._log(`Video upscale submit failed: ${result.error}`);
      return { success: false, error: result.error };
    }
    const data = result.data || {};
    const operations = data.operations || [];
    if (!operations.length) return { success: false, error: 'No operation returned' };
    const op = operations[0];
    const operationName = op.operation?.name;
    const opSceneId = op.sceneId || sceneId;
    if (!operationName) return { success: false, error: 'No operation name returned' };
    return { success: true, operationName, sceneId: opSceneId };
  }

  /**
   * Poll multiple upscale operations until all complete or timeout.
   * @param {{ operationName: string, sceneId: string, index: number }[]} operationInfos
   * @param {number} totalVideos - total number of videos (baseResult.videos.length) so returned array is indexed by video index
   * @param {string} resolution - for logging
   * @param {(p: number) => void} [on_progress]
   * @returns {Promise<{ success: boolean, video_url?: string, thumbnail_url?: string, media_generation_id?: string, seed?: number, error?: string }[]>}
   */
  async pollUpscaleOperations(operationInfos, totalVideos, resolution, on_progress) {
    const total = operationInfos.length;
    const results = new Map(); // index -> result
    let pending = operationInfos.slice();

    for (let attempt = 0; attempt < VIDEO_POLL_MAX_ATTEMPTS; attempt++) {
      await delay(VIDEO_POLL_INTERVAL_MS);
      const doneCount = results.size;
      const progress = Math.min(10 + Math.floor((doneCount / total) * 80), 90);
      if (on_progress) on_progress(progress);

      if (pending.length === 0) {
        if (on_progress) on_progress(100);
        return Array.from({ length: totalVideos }, (_, i) => results.get(i) || { success: false, error: 'Unknown' });
      }

      const statusPayload = {
        operations: pending.map(op => ({ operation: { name: op.operationName }, sceneId: op.sceneId })),
      };
      const res = await this.client.post(API_VIDEO_STATUS, statusPayload);
      if (!res.success) continue;
      const ops = res.data?.operations || [];
      if (!ops.length) continue;

      const sceneIdMap = new Map(pending.map(op => [op.sceneId, op]));

      for (const op of ops) {
        const opSceneId = op.sceneId;
        const opInfo = sceneIdMap.get(opSceneId);
        if (!opInfo) continue;

        const status = op.status || '';

        if (status === 'MEDIA_GENERATION_STATUS_SUCCESSFUL') {
          const metaVideo = op.operation?.metadata?.video;
          const videoUrl = metaVideo?.fifeUrl || op.fifeVideoUrl || op.initialFifeVideoUrl || op.video?.fifeUrl || op.video?.url || op.videoUrl || op.url || '';
          const mediaGenerationId = metaVideo?.mediaGenerationId || op.mediaGenerationId || op.media?.video?.mediaGenerationId || '';
          const thumbnailUrl = op.thumbnailImage?.thumbnailSrc || op.thumbnailVideo?.thumbnailSrc || '';
          const seed = metaVideo?.seed ?? op.seed ?? op.media?.video?.seed;
          results.set(opInfo.index, {
            success: true,
            video_url: videoUrl,
            thumbnail_url: thumbnailUrl,
            media_generation_id: mediaGenerationId,
            seed,
          });
          pending = pending.filter(p => p.index !== opInfo.index);
          this._log(`Upscale ${resolution} complete for index ${opInfo.index}`);
        } else if (status === 'MEDIA_GENERATION_STATUS_FAILED') {
          const msg = op.error?.message || 'Unknown error';
          results.set(opInfo.index, { success: false, error: msg });
          pending = pending.filter(p => p.index !== opInfo.index);
          this._log(`Upscale failed for index ${opInfo.index}: ${msg}`);
        }
      }
    }

    // Timeout: mark remaining as failed
    for (const op of pending) {
      results.set(op.index, { success: false, error: 'Upscale timed out' });
    }
    if (on_progress) on_progress(100);
    return Array.from({ length: totalVideos }, (_, i) => results.get(i) || { success: false, error: 'Timed out' });
  }

  async upscale(media_generation_id, aspect_ratio, recaptcha_token, resolution = '4K', on_progress) {
    // Only 1080p and 4K are valid upscale targets (default is 720p)
    if (resolution === '720p') {
      return { success: false, error: '720p is the default resolution. Use 1080p or 4K for upscaling.' };
    }
    if (!VIDEO_RESOLUTIONS[resolution]) {
      return { success: false, error: `Unknown resolution: ${resolution}. Supported upscale resolutions: 1080p, 4K` };
    }
    if (!VIDEO_UPSCALER_MODELS[resolution]) {
      return { success: false, error: `No upscaler model available for ${resolution}. Supported: ${Object.keys(VIDEO_UPSCALER_MODELS).join(', ')}` };
    }
    const resolutionKey = VIDEO_RESOLUTIONS[resolution];
    const upscalerModel = VIDEO_UPSCALER_MODELS[resolution];
    const aspectKey = (aspect_ratio && VIDEO_ASPECTS[aspect_ratio]) ? VIDEO_ASPECTS[aspect_ratio] : (aspect_ratio || 'VIDEO_ASPECT_RATIO_LANDSCAPE');
    this._log(`Upscaling video to ${resolution}...`);
    if (on_progress) on_progress(5);
    const sessionId = getFlowSessionId();
    const sceneId = uuid();
    const payload = {
      requests: [{
        aspectRatio: aspectKey,
        resolution: resolutionKey,
        seed: Math.floor(Math.random() * 99999),
        videoInput: { mediaId: media_generation_id },
        videoModelKey: upscalerModel,
        metadata: { sceneId },
      }],
      clientContext: {
        recaptchaContext: { token: recaptcha_token, applicationType: RECAPTCHA_APPLICATION_TYPE },
        recaptchaToken: recaptcha_token,
        sessionId,
      },
    };
    const replacerUpscale = (key, value) => {
      if ((key === 'token' || key === 'recaptchaToken') && typeof value === 'string') return '[REDACTED]';
      if (typeof value === 'string' && value.length > 80) return value.slice(0, 80) + '...';
      return value;
    };
    this._log(`[DEBUG] Video upscale request payload: ${JSON.stringify(payload, replacerUpscale, 2)}`);
    const result = await this.client.post(API_VIDEO_UPSCALE, payload, 60000);
    if (!result.success) {
      this._log(`Video upscale failed: ${result.error}`);
      return result;
    }
    if (on_progress) on_progress(10);

    const data = result.data || {};
    const operations = data.operations || [];
    if (!operations.length) return { success: false, error: 'No operation returned' };
    const op = operations[0];
    const operationName = op.operation?.name;
    const opSceneId = op.sceneId || sceneId;
    if (!operationName) return { success: false, error: 'No operation name returned' };

    this._log('Upscale submitted, polling for completion...');
    for (let attempt = 0; attempt < VIDEO_POLL_MAX_ATTEMPTS; attempt++) {
      await delay(VIDEO_POLL_INTERVAL_MS);
      const progress = Math.min(10 + Math.floor((attempt / VIDEO_POLL_MAX_ATTEMPTS) * 85), 95);
      if (on_progress) on_progress(progress);

      const statusPayload = { operations: [{ operation: { name: operationName }, sceneId: opSceneId }] };
      const res = await this.client.post(API_VIDEO_STATUS, statusPayload);
      if (!res.success) continue;
      const ops = res.data?.operations || [];
      if (!ops.length) continue;

      const status = ops[0].status || '';
      this._log(`Upscale status: ${status}`);
      if (status === 'MEDIA_GENERATION_STATUS_SUCCESSFUL') {
        const op = ops[0];
        const metaVideo = op.operation?.metadata?.video;
        const videoUrl = metaVideo?.fifeUrl || op.fifeVideoUrl || op.initialFifeVideoUrl || op.video?.fifeUrl || op.video?.url || op.videoUrl || op.url || '';
        const mediaGenerationId = metaVideo?.mediaGenerationId || op.mediaGenerationId || op.media?.video?.mediaGenerationId || '';
        const thumbnailUrl = op.thumbnailImage?.thumbnailSrc || op.thumbnailVideo?.thumbnailSrc || '';
        const seed = metaVideo?.seed ?? op.seed ?? op.media?.video?.seed;
        if (!videoUrl) {
          this._log(`[DEBUG] Upscale response keys: ${Object.keys(op).join(', ')}`);
        }
        if (on_progress) on_progress(100);
        this._log(`Video upscale to ${resolution} complete!`);
        return {
          success: true,
          video_url: videoUrl,
          thumbnail_url: thumbnailUrl,
          media_generation_id: mediaGenerationId,
          seed: seed,
          resolution,
        };
      }
      if (status === 'MEDIA_GENERATION_STATUS_FAILED') {
        const msg = ops[0].error?.message || 'Unknown error';
        return { success: false, error: `Video upscale failed: ${msg}` };
      }
    }
    return { success: false, error: 'Video upscale timed out' };
  }

  // Backward compatibility: keep upscale_4k as alias
  async upscale_4k(media_generation_id, aspect_ratio, recaptcha_token, on_progress) {
    return this.upscale(media_generation_id, aspect_ratio, recaptcha_token, '4K', on_progress);
  }
}
