import { randomUUID } from 'crypto';
import { VIDEO_ASPECTS, API_VIDEO_STATUS } from '../config.js';
import { loadAppConfig } from '../app-config.js';

const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const UPSCALE_SUBMIT_STAGGER_MS = 1500;

/** Get max concurrent upscale slots from config (video-level, not item-level). */
function getUpscaleMax(state) {
  const cfg = loadAppConfig();
  return Math.max(1, Math.min(10, cfg.maxConcurrentUpscales ?? 4));
}

/**
 * Acquire an upscale slot for a specific video/image.
 * @param {object} state - app state
 * @param {string} key - unique key like "itemId-videoIndex" or "itemId-imgIndex"
 * @returns {Promise<boolean>} true if had to wait for a slot
 */
async function acquireUpscaleSlot(state, key) {
  const max = getUpscaleMax(state);
  if (!state.activeUpscaleSlots) state.activeUpscaleSlots = new Set();
  let hadToWait = false;
  while (state.activeUpscaleSlots.size >= max) {
    hadToWait = true;
    await delay(200);
  }
  state.activeUpscaleSlots.add(key);
  // Apply delay when reusing a freed slot
  if (hadToWait) {
    const cfg = loadAppConfig();
    const delayMs = Math.max(0, Math.min(30000, cfg.upscaleStartDelayMs ?? 3000));
    if (delayMs > 0) await delay(delayMs);
  }
  return hadToWait;
}

/**
 * Release an upscale slot.
 * @param {object} state - app state
 * @param {string} key - unique key that was passed to acquireUpscaleSlot
 */
function releaseUpscaleSlot(state, key) {
  if (state.activeUpscaleSlots) {
    state.activeUpscaleSlots.delete(key);
  }
}

/**
 * Detect generation mode from request body
 * Returns: 't2i', 'i2i', 't2v', 'i2v', 'ingredients', 'start_image', 'reference'
 */
function detectGenerationMode(body) {
  const { mode, image_bytes, image_bytes_array, start_image_media_id, reference_image_media_ids } = body;

  // Check for new media ID modes first
  if (reference_image_media_ids && reference_image_media_ids.length > 0) {
    return mode === 'video' ? 'reference' : 'i2i'; // Reference images for video or image
  }
  if (start_image_media_id) {
    return 'start_image'; // Start image mode (video only)
  }

  // Explicit mode override
  if (mode === 'image' || mode === 'video') {
    const hasImageInput = image_bytes || (image_bytes_array && image_bytes_array.length > 0);
    if (mode === 'image') {
      return hasImageInput ? 'i2i' : 't2i';
    } else {
      if (image_bytes_array && image_bytes_array.length > 1) return 'ingredients';
      if (image_bytes || (image_bytes_array && image_bytes_array.length === 1)) return 'i2v';
      return 't2v';
    }
  }

  // Auto-detect from inputs
  if (image_bytes_array && image_bytes_array.length > 1) {
    return 'ingredients'; // Multiple images = Ingredients to Video
  }
  if (image_bytes || (image_bytes_array && image_bytes_array.length === 1)) {
    // Single image - determine if image or video mode
    return mode === 'video' ? 'i2v' : 'i2i';
  }

  // Default: text-only mode
  return mode === 'video' ? 't2v' : 't2i';
}

/**
 * Shared image upscale: get token and call image_api.upscale. Used by generation flow and gallery route.
 * @param {object} state - app state
 * @param {string} media_id
 * @param {string} resolution - '2K' | '4K'
 * @returns {Promise<{ success: boolean, encoded_image?: string, resolution?: string, error?: string }>}
 */
export async function runImageUpscale(state, media_id, resolution) {
  // Flow uses IMAGE_GENERATION action for both generation and upscale
  const token = await state.recaptcha.getImageToken();
  if (!token) return { success: false, error: 'reCAPTCHA failed' };
  return state.image_api.upscale(media_id, token, resolution);
}

/**
 * Shared video upscale: get token and call video_api.upscale. Used by generation flow and gallery route.
 * @param {object} state - app state
 * @param {string} media_generation_id
 * @param {string} aspect_ratio - display name or API key (e.g. VIDEO_ASPECT_RATIO_LANDSCAPE)
 * @param {string} resolution - '1080p' | '4K'
 * @param {(p: number) => void} [on_progress]
 * @returns {Promise<{ success: boolean, video_url?: string, thumbnail_url?: string, media_generation_id?: string, error?: string }>}
 */
export async function runVideoUpscale(state, media_generation_id, aspect_ratio, resolution, on_progress) {
  // Flow uses VIDEO_GENERATION action for both generation and upscale
  const token = await state.recaptcha.getVideoToken();
  if (!token) return { success: false, error: 'reCAPTCHA failed' };
  const aspectKey = (aspect_ratio && VIDEO_ASPECTS[aspect_ratio]) ? VIDEO_ASPECTS[aspect_ratio] : (aspect_ratio || 'VIDEO_ASPECT_RATIO_LANDSCAPE');
  return state.video_api.upscale(media_generation_id, aspectKey, token, resolution, on_progress);
}

/**
 * Run upscale phase only - used by background upscale handler.
 * Uses video-level slots: each video/image acquires a slot before upscaling.
 * @param {object} state - app state
 * @param {object} baseResult - { images } | { videos } | { video }
 * @param {string} targetRes - '2K'|'4K' for images, '1080p'|'4K' for videos
 * @param {object} body - { aspect, prompt, model, mode }
 * @param {(p: number) => void} [onProgress]
 * @param {string} [itemId] - queue item ID for slot keys
 * @param {(index: number, status: string, result?: object) => void} [onVideoStatusChange] - callback when a video's upscale status changes
 * @returns {Promise<{ success: boolean, result?: object, error?: string }>}
 */
export async function runUpscalePhase(state, baseResult, targetRes, body, onProgress = () => {}, itemId = null, onVideoStatusChange = null) {
  const log = state._log;
  const isImage = baseResult.images && baseResult.images.length > 0;
  const isVideoMulti = baseResult.videos && baseResult.videos.length > 0;
  const isVideoSingle = baseResult.video;
  const slotPrefix = itemId || randomUUID();

  log(`[DEBUG] runUpscalePhase: isImage=${isImage}, isVideoMulti=${isVideoMulti}, isVideoSingle=${!!isVideoSingle}, videos=${baseResult.videos?.length ?? 0}`);

  if (isImage) {
    const upscaledImages = [];
    for (let i = 0; i < baseResult.images.length; i++) {
      const img = baseResult.images[i];
      const mediaId = img.media_generation_id;
      const slotKey = `${slotPrefix}-img-${i}`;
      if (mediaId) {
        // Acquire slot before upscaling this image
        await acquireUpscaleSlot(state, slotKey);
        try {
          onProgress(10 + Math.floor((i + 1) / baseResult.images.length * 80));
          const upscaleResult = await runImageUpscale(state, mediaId, targetRes);
          if (upscaleResult.success && upscaleResult.encoded_image) {
            upscaledImages.push({
              ...img,
              url: `data:image/jpeg;base64,${upscaleResult.encoded_image}`,
              resolution: targetRes,
              upscaleStatus: 'done',
            });
            log(`Image ${i + 1} upscaled to ${targetRes}`);
          } else {
            log(`Failed to upscale image ${i + 1} to ${targetRes}, using original: ${upscaleResult.error || 'Unknown error'}`);
            upscaledImages.push({ ...img, upscaleStatus: 'failed' });
          }
        } finally {
          releaseUpscaleSlot(state, slotKey);
        }
      } else {
        log(`No mediaGenerationId for image ${i + 1}, skipping upscale`);
        upscaledImages.push({ ...img, upscaleStatus: 'failed' });
      }
    }
    onProgress(100);
    return {
      success: true,
      result: { images: upscaledImages, count: upscaledImages.length, mode: baseResult.mode || 't2i', resolution: targetRes },
    };
  }

  if (isVideoMulti) {
    // Video-level slot logic: submit up to maxSlots videos, poll, release slots on complete, repeat
    const totalVideos = baseResult.videos.length;
    const upscaledVideos = new Array(totalVideos).fill(null);
    const pendingIndices = []; // indices not yet submitted
    const inFlightOps = new Map(); // index -> { operationName, sceneId, slotKey }
    const completedIndices = new Set();

    // Initialize all videos as upscale_pending
    for (let i = 0; i < totalVideos; i++) {
      const vid = baseResult.videos[i];
      const mediaId = vid.media_generation_id || vid.mediaGenerationId;
      log(`[DEBUG] Video ${i + 1} media_id check: '${mediaId || 'NONE'}'`);
      if (!mediaId) {
        log(`No mediaGenerationId for video ${i + 1}, skipping upscale`);
        upscaledVideos[i] = { ...vid, upscaleFailed: true, upscaleTargetRes: targetRes, upscaleStatus: 'failed' };
        completedIndices.add(i);
        if (onVideoStatusChange) onVideoStatusChange(i, 'failed', upscaledVideos[i]);
      } else {
        // Store the resolved mediaId back on the video object for later use
        vid._resolvedMediaId = mediaId;
        pendingIndices.push(i);
        if (onVideoStatusChange) onVideoStatusChange(i, 'upscale_pending', null);
      }
    }

    // Warn if all videos failed initialization
    if (pendingIndices.length === 0 && totalVideos > 0) {
      log(`[WARN] All ${totalVideos} videos failed media_generation_id check - no upscales will be attempted`);
    }

    // Main loop: submit pending videos when slots available, poll in-flight, repeat until all done
    while (completedIndices.size < totalVideos) {
      // Submit pending videos up to available slots
      while (pendingIndices.length > 0) {
        const max = getUpscaleMax(state);
        const currentSlots = state.activeUpscaleSlots ? state.activeUpscaleSlots.size : 0;
        if (currentSlots >= max) break;

        const i = pendingIndices.shift();
        const vid = baseResult.videos[i];
        const slotKey = `${slotPrefix}-vid-${i}`;

        // Acquire slot (waits until available)
        await acquireUpscaleSlot(state, slotKey);

        // Update status to upscaling
        if (onVideoStatusChange) onVideoStatusChange(i, 'upscaling', null);

        // Apply stagger delay between submits
        if (inFlightOps.size > 0) await delay(UPSCALE_SUBMIT_STAGGER_MS);

        // Get reCAPTCHA token and submit
        const token = await state.recaptcha.getVideoToken();
        if (!token) {
          log(`Video ${i + 1}: reCAPTCHA failed`);
          upscaledVideos[i] = { ...vid, upscaleFailed: true, upscaleTargetRes: targetRes, upscaleStatus: 'failed' };
          completedIndices.add(i);
          releaseUpscaleSlot(state, slotKey);
          if (onVideoStatusChange) onVideoStatusChange(i, 'failed', upscaledVideos[i]);
          continue;
        }

        const mediaId = vid._resolvedMediaId || vid.media_generation_id || vid.mediaGenerationId;
        const submitResult = await state.video_api.submitUpscaleOnly(mediaId, body.aspect, token, targetRes);
        if (!submitResult.success || !submitResult.operationName) {
          log(`Video ${i + 1}: submit failed - ${submitResult.error || 'Unknown error'}`);
          upscaledVideos[i] = { ...vid, upscaleFailed: true, upscaleTargetRes: targetRes, upscaleStatus: 'failed' };
          completedIndices.add(i);
          releaseUpscaleSlot(state, slotKey);
          if (onVideoStatusChange) onVideoStatusChange(i, 'failed', upscaledVideos[i]);
          continue;
        }

        inFlightOps.set(i, { operationName: submitResult.operationName, sceneId: submitResult.sceneId, slotKey });
        log(`Video ${i + 1}: upscale submitted (${inFlightOps.size} in flight, ${pendingIndices.length} pending)`);
      }

      // If nothing in flight and nothing pending, we're done
      if (inFlightOps.size === 0 && pendingIndices.length === 0) break;

      // Waiting for slots but have pending - delay and retry submit on next iteration
      if (inFlightOps.size === 0 && pendingIndices.length > 0) {
        await delay(2000);
        continue;
      }

      // Poll all in-flight operations
      await delay(5000); // Poll interval

      const opsToCheck = Array.from(inFlightOps.entries()).map(([idx, op]) => ({
        operation: { name: op.operationName },
        sceneId: op.sceneId,
        index: idx,
      }));

      const statusPayload = { operations: opsToCheck.map(o => ({ operation: o.operation, sceneId: o.sceneId })) };
      log(`[Upscale] Polling ${inFlightOps.size} operations...`);
      const res = await state.video_api.client.post(API_VIDEO_STATUS, statusPayload);

      if (!res.success) {
        log(`[Upscale] Poll error: ${res.error || 'Unknown'}`);
      } else if (!res.data?.operations?.length) {
        log(`[Upscale] No operations in response`);
      }

      if (res.success && res.data?.operations) {
        const sceneIdToIndex = new Map(opsToCheck.map(o => [o.sceneId, o.index]));

        for (const op of res.data.operations) {
          const opSceneId = op.sceneId;
          const idx = sceneIdToIndex.get(opSceneId);
          if (idx === undefined) continue;

          const status = op.status || '';
          const vid = baseResult.videos[idx];
          const opInfo = inFlightOps.get(idx);

          if (status === 'MEDIA_GENERATION_STATUS_SUCCESSFUL') {
            // req.md: Section 7 uses op.operation.metadata.video; Section 1 uses op.metadata.video (top-level)
            const metaVideo = op.operation?.metadata?.video || op.metadata?.video;
            const videoUrl = metaVideo?.fifeUrl || op.fifeVideoUrl || op.initialFifeVideoUrl || op.video?.fifeUrl || op.video?.url || op.videoUrl || op.url || '';
            const thumbnailUrl = op.thumbnailImage?.thumbnailSrc || op.thumbnailVideo?.thumbnailSrc || '';
            if (!videoUrl) {
              log(`[Upscale] Video ${idx + 1} success but no URL - op keys: ${Object.keys(op).join(', ')}`);
            }
            const seed = metaVideo?.seed ?? op.seed;

            upscaledVideos[idx] = {
              ...vid,
              video_url: videoUrl,
              thumbnail_url: thumbnailUrl || vid.thumbnail_url || '',
              resolution: targetRes,
              upscaleStatus: 'done',
            };
            completedIndices.add(idx);
            inFlightOps.delete(idx);
            releaseUpscaleSlot(state, opInfo.slotKey);
            log(`Video ${idx + 1} upscaled to ${targetRes}`);
            if (onVideoStatusChange) onVideoStatusChange(idx, 'done', upscaledVideos[idx]);
          } else if (status === 'MEDIA_GENERATION_STATUS_FAILED') {
            const msg = op.error?.message || 'Unknown error';
            log(`Video ${idx + 1}: upscale failed - ${msg}`);
            upscaledVideos[idx] = { ...vid, upscaleFailed: true, upscaleTargetRes: targetRes, upscaleStatus: 'failed' };
            completedIndices.add(idx);
            inFlightOps.delete(idx);
            releaseUpscaleSlot(state, opInfo.slotKey);
            if (onVideoStatusChange) onVideoStatusChange(idx, 'failed', upscaledVideos[idx]);
          }
          // else still active, keep polling
        }
      }

      // Update progress
      const doneCount = completedIndices.size;
      onProgress(10 + Math.floor((doneCount / totalVideos) * 80));

      // Timeout check: if we've been polling too long, mark remaining as failed
      // (This is handled by the outer loop timing out naturally after many iterations)
    }

    // Fill in any remaining nulls (shouldn't happen, but safety)
    for (let i = 0; i < totalVideos; i++) {
      if (!upscaledVideos[i]) {
        const vid = baseResult.videos[i];
        upscaledVideos[i] = { ...vid, upscaleFailed: true, upscaleTargetRes: targetRes, upscaleStatus: 'failed' };
        // Release any lingering slots
        const slotKey = `${slotPrefix}-vid-${i}`;
        releaseUpscaleSlot(state, slotKey);
      }
    }

    onProgress(100);
    return {
      success: true,
      result: { videos: upscaledVideos, count: upscaledVideos.length, mode: baseResult.mode || 't2v', resolution: targetRes },
    };
  }

  if (isVideoSingle) {
    const vid = baseResult.video;
    const mediaId = vid.media_generation_id;
    const slotKey = `${slotPrefix}-vid-single`;

    if (mediaId) {
      // Acquire slot before upscaling
      await acquireUpscaleSlot(state, slotKey);
      try {
        onProgress(20);
        const upscaleResult = await runVideoUpscale(state, mediaId, body.aspect, targetRes, (p) => onProgress(20 + Math.floor(p * 0.8)));
        if (upscaleResult.success && upscaleResult.video_url) {
          onProgress(100);
          return {
            success: true,
            result: {
              video: {
                ...vid,
                url: upscaleResult.video_url,
                fifeUrl: upscaleResult.video_url,
                thumbnail_url: upscaleResult.thumbnail_url || vid.thumbnail_url || '',
                resolution: targetRes,
                upscaleStatus: 'done',
              },
              mode: baseResult.mode || 't2v',
              resolution: targetRes,
            },
          };
        }
        log(`Failed to upscale video to ${targetRes}, using original: ${upscaleResult.error || 'Unknown error'}`);
      } finally {
        releaseUpscaleSlot(state, slotKey);
      }
    }
    onProgress(100);
    return {
      success: true,
      result: { video: { ...vid, upscaleFailed: true, upscaleTargetRes: targetRes, upscaleStatus: 'failed' }, mode: baseResult.mode || 't2v', resolution: vid.resolution || targetRes },
    };
  }

  return { success: false, error: 'No base result to upscale' };
}

/**
 * Shared generation logic. Does not mutate state.jobs.
 * Mutates state.stats and state.generated_items.
 * @param {object} state - app state
 * @param {object} body - { prompt, mode, model, aspect, count, res, seed, image_bytes, image_bytes_array, reference_image_media_ids, start_image_media_id, preamble }
 * @param {{ onProgress?: (p: number) => void, onPhase?: (phase: string) => void, onStatusMessage?: (msg: string) => void, onNanoImage?: (img: { url: string, media_generation_id: string }) => void }} opts - optional callbacks
 * @returns {Promise<{ success: boolean, result?: object, error?: string, status: 'done'|'error', nanoImage?: object }>}
 */
export async function runGeneration(state, body, { onProgress = () => { }, onPhase, onStatusMessage, onNanoImage } = {}) {
  const log = state._log;
  try {
    if (!state.auth_state.bearer_token && state.browser) {
      const auth = await state.browser.findAuthSession();
      if (auth?.access_token) state.auth_state.bearer_token = auth.access_token;
    }
    if (!state.auth_state.bearer_token) {
      state.stats.failed += 1;
      return { success: false, error: 'No auth token', status: 'error' };
    }

    // Nano Video: image with Nano Banana Pro then video with Veo I2V Start Image (start_image_media_id)
    if (body.subMode === 'nanoVideo' || body.nano2video === true) {
      onProgress(5);
      onStatusMessage?.('Generating image...');
      const imageToken = await state.recaptcha.getToken(false);
      if (!imageToken) {
        return { success: false, error: 'reCAPTCHA failed', status: 'recaptcha_failed' };
      }
      const imageResult = await state.image_api.generate({
        prompt: body.prompt,
        recaptcha_token: imageToken,
        model_name: 'Nano Banana Pro',
        aspect_name: body.aspect || '16:9 Landscape',
        count: 1,
        options: {},
      });
      onProgress(15);
      if (!imageResult.success || !imageResult.images?.length) {
        state.stats.failed += 1;
        return { success: false, error: imageResult.error || 'Image generation failed', status: 'error' };
      }
      const startImageMediaId = imageResult.images[0].media_generation_id;
      if (!startImageMediaId) {
        state.stats.failed += 1;
        return { success: false, error: 'No media ID from image', status: 'error' };
      }
      const nanoImage = { url: imageResult.images[0].url || '', media_generation_id: startImageMediaId };
      onNanoImage?.(nanoImage);
      onStatusMessage?.('Image ready, starting video...');
      const videoToken = await state.recaptcha.getToken(true);
      if (!videoToken) {
        return { success: false, error: 'reCAPTCHA failed', status: 'recaptcha_failed', nanoImage };
      }
      onStatusMessage?.('Generating video...');
      const videoResult = await state.video_api.generate({
        prompt: body.prompt,
        recaptcha_token: videoToken,
        model_name: 'Veo 3.1 - I2V Start Image',
        aspect_name: body.aspect || '16:9 Landscape',
        count: body.count ?? 1,
        on_progress: (p) => onProgress(15 + Math.floor(p * 0.75)),
        on_phase: (phase) => { if (phase === 'polling') onPhase?.('polling'); },
        options: { start_image_media_id: startImageMediaId },
      });
      if (!videoResult.success) {
        state.stats.failed += 1;
        return { success: false, error: videoResult.error || 'Video generation failed', status: 'error', nanoImage };
      }
      const targetRes = body.res || '720p';
      const needsUpscale = targetRes !== '720p';
      if (videoResult.videos && Array.isArray(videoResult.videos)) {
        if (needsUpscale && videoResult.videos.length > 0) {
          onProgress(90);
          return {
            success: true,
            result: { videos: videoResult.videos, count: videoResult.videos.length, mode: 'start_image', resolution: targetRes },
            status: 'upscaling',
            targetRes,
            body: { ...body, mode: 'video' },
            nanoImage,
          };
        }
        const n = videoResult.videos.length;
        state.stats.videos += n;
        for (const vid of videoResult.videos) {
          state.generated_items.push({
            type: 'video',
            url: vid.video_url || '',
            thumbnail_url: vid.thumbnail_url || '',
            prompt: body.prompt,
            model: 'Nano to Video',
            aspect: body.aspect,
            mode: 'start_image',
            resolution: vid.resolution || targetRes,
          });
        }
        onProgress(100);
        return { success: true, result: { videos: videoResult.videos, count: n, mode: 'start_image', resolution: targetRes }, status: 'done', nanoImage };
      }
      const baseVideo = {
        url: videoResult.video_url || '',
        fifeUrl: videoResult.fifeUrl || videoResult.video_url || '',
        thumbnail_url: videoResult.thumbnail_url || '',
        media_generation_id: videoResult.media_generation_id || '',
        mediaGenerationId: videoResult.media_generation_id || '',
        seed: videoResult.seed || body.seed,
        prompt: body.prompt,
        model: 'Nano to Video',
        aspect: body.aspect,
        mode: 'start_image',
      };
      if (needsUpscale && baseVideo.media_generation_id) {
        onProgress(90);
        return {
          success: true,
          result: { video: baseVideo, mode: 'start_image', resolution: targetRes },
          status: 'upscaling',
          targetRes,
          body: { ...body, mode: 'video' },
          nanoImage,
        };
      }
      state.stats.videos += 1;
      state.generated_items.push({
        type: 'video',
        url: baseVideo.url,
        thumbnail_url: baseVideo.thumbnail_url || '',
        prompt: body.prompt,
        model: 'Nano to Video',
        aspect: body.aspect,
        mode: 'start_image',
        resolution: baseVideo.resolution || targetRes,
      });
      onProgress(100);
      return { success: true, result: { video: baseVideo, mode: 'start_image', resolution: targetRes }, status: 'done', nanoImage };
    }

    // Token choice based only on queue item mode (body.mode), not detectGenerationMode
    const recaptchaIsVideo = body.mode === 'video';
    log(`[DEBUG] reCAPTCHA for item mode: ${body.mode} → action ${recaptchaIsVideo ? 'VIDEO_GENERATION' : 'IMAGE_GENERATION'}`);
    const token = await state.recaptcha.getToken(recaptchaIsVideo);
    if (!token) {
      return { success: false, error: 'reCAPTCHA failed', status: 'recaptcha_failed' };
    }

    const generationMode = detectGenerationMode(body);
    log(`Detected generation mode: ${generationMode.toUpperCase()}`);

    // Image generation modes (T2I, I2I)
    if (generationMode === 't2i' || generationMode === 'i2i') {
      onProgress(10);

      const options = {};
      if (generationMode === 'i2i') {
        if (body.reference_image_media_ids && body.reference_image_media_ids.length > 0) {
          options.reference_image_media_ids = body.reference_image_media_ids;
        } else if (body.image_bytes) {
          options.image_bytes = body.image_bytes;
        } else if (body.image_bytes_array && body.image_bytes_array.length > 0) {
          options.image_bytes = body.image_bytes_array[0];
        } else {
          state.stats.failed += 1;
          return { success: false, error: 'Image input required for I2I mode', status: 'error' };
        }
      } else if (generationMode === 't2i' && body.reference_image_media_ids && body.reference_image_media_ids.length > 0) {
        options.reference_image_media_ids = body.reference_image_media_ids;
      }
      if (body.seed !== undefined) options.seed = body.seed;
      if (body.preamble) options.preamble = body.preamble;

      const result = await state.image_api.generate({
        prompt: body.prompt,
        recaptcha_token: token,
        model_name: body.model,
        aspect_name: body.aspect,
        count: body.count ?? 2,
        options,
      });
      onProgress(50);

      if (result.success) {
        const n = result.count || 0;
        const targetRes = body.res || '1K';
        const needsUpscale = targetRes !== '1K';

        if (needsUpscale && result.images && result.images.length > 0) {
          onProgress(90);
          return {
            success: true,
            result: { images: result.images, count: result.images.length, mode: generationMode, resolution: targetRes },
            status: 'upscaling',
            targetRes,
            body: { ...body, mode: 'image' },
          };
        }
        state.stats.images += n;
        for (const img of result.images || []) {
          state.generated_items.push({
            type: 'image',
            url: img.url || '',
            prompt: body.prompt,
            model: body.model,
            aspect: body.aspect,
            mode: generationMode,
          });
        }
        onProgress(100);
        return { success: true, result: { images: result.images, count: n, mode: generationMode }, status: 'done' };
      }
      state.stats.failed += 1;
      return { success: false, error: result.error || 'Unknown error', status: 'error' };
    }

    // Video generation modes (T2V, I2V, Ingredients, start_image, reference)
    const options = {};
    if (generationMode === 'start_image') {
      if (!body.start_image_media_id) {
        state.stats.failed += 1;
        return { success: false, error: 'start_image_media_id required for start image mode', status: 'error' };
      }
      options.start_image_media_id = body.start_image_media_id;
    } else if (generationMode === 'reference') {
      if (!body.reference_image_media_ids || body.reference_image_media_ids.length === 0) {
        state.stats.failed += 1;
        return { success: false, error: 'reference_image_media_ids required for reference images mode', status: 'error' };
      }
      options.reference_image_media_ids = body.reference_image_media_ids;
    } else if (generationMode === 'i2v') {
      if (body.image_bytes) {
        options.image_bytes = body.image_bytes;
      } else if (body.image_bytes_array && body.image_bytes_array.length > 0) {
        options.image_bytes = body.image_bytes_array[0];
      } else {
        state.stats.failed += 1;
        return { success: false, error: 'Image input required for I2V mode', status: 'error' };
      }
    } else if (generationMode === 'ingredients') {
      if (body.image_bytes_array && body.image_bytes_array.length > 1) {
        options.image_bytes_array = body.image_bytes_array;
      } else {
        state.stats.failed += 1;
        return { success: false, error: 'Multiple image inputs required for Ingredients mode', status: 'error' };
      }
    }
    if (body.seed !== undefined) options.seed = body.seed;

    const result = await state.video_api.generate({
      prompt: body.prompt,
      recaptcha_token: token,
      model_name: body.model,
      aspect_name: body.aspect,
      count: body.count ?? 1,
      on_progress: (p) => onProgress(Math.floor(p * 0.9)),
      on_phase: (phase) => { if (phase === 'polling') onPhase?.('polling'); },
      options,
    });
    if (result.success) {
      const targetRes = body.res || '720p';
      const needsUpscale = targetRes !== '720p';
      const aspectKey = VIDEO_ASPECTS[body.aspect] || 'VIDEO_ASPECT_RATIO_LANDSCAPE';

      if (result.videos && Array.isArray(result.videos)) {
        if (needsUpscale && result.videos.length > 0) {
          onProgress(90);
          return {
            success: true,
            result: { videos: result.videos, count: result.videos.length, mode: generationMode, resolution: targetRes },
            status: 'upscaling',
            targetRes,
            body: { ...body, mode: 'video' },
          };
        }
        const n = result.videos.length;
        state.stats.videos += n;
        for (const vid of result.videos) {
          state.generated_items.push({
            type: 'video',
            url: vid.video_url || '',
            thumbnail_url: vid.thumbnail_url || '',
            prompt: body.prompt,
            model: body.model,
            aspect: body.aspect,
            mode: generationMode,
            resolution: vid.resolution || targetRes,
          });
        }
        onProgress(100);
        return { success: true, result: { videos: result.videos, count: n, mode: generationMode, resolution: targetRes }, status: 'done' };
      }

      const baseVideo = {
        url: result.video_url || '',
        fifeUrl: result.fifeUrl || result.video_url || '',
        thumbnail_url: result.thumbnail_url || '',
        media_generation_id: result.media_generation_id || '',
        mediaGenerationId: result.media_generation_id || '',
        seed: result.seed || body.seed,
        prompt: body.prompt,
        model: body.model,
        aspect: body.aspect,
        mode: generationMode,
      };
      if (needsUpscale && baseVideo.media_generation_id) {
        onProgress(90);
        return {
          success: true,
          result: { video: baseVideo, mode: generationMode, resolution: targetRes },
          status: 'upscaling',
          targetRes,
          body: { ...body, mode: 'video' },
        };
      }
      state.stats.videos += 1;
      state.generated_items.push({
        type: 'video',
        url: baseVideo.url,
        thumbnail_url: baseVideo.thumbnail_url || '',
        prompt: body.prompt,
        model: body.model,
        aspect: body.aspect,
        mode: generationMode,
        resolution: baseVideo.resolution || targetRes,
      });
      onProgress(100);
      return { success: true, result: { video: baseVideo, mode: generationMode, resolution: targetRes }, status: 'done' };
    }
    state.stats.failed += 1;
    return { success: false, error: result.error || 'Unknown error', status: 'error' };
  } catch (e) {
    state.stats.failed += 1;
    log(`Generate error: ${e.message}`);
    if (e.stack) log(`Stack: ${e.stack}`);
    return { success: false, error: String(e.message), status: 'error' };
  }
}

async function runJob(jobId, state, body) {
  const job = state.jobs[jobId];
  job.status = 'running';
  job.progress = 0;
  const outcome = await runGeneration(state, body, { onProgress: (p) => { job.progress = p; } });
  job.status = outcome.status;
  job.result = outcome.result ?? null;
  job.error = outcome.error ?? null;
}

export function registerGenerate(app) {
  app.post('/api/flow/generate', async (req, res) => {
    const state = req.app.state;
    if (!state?.image_api || !state?.video_api) {
      return res.status(503).json({ detail: 'API not initialized' });
    }
    const {
      prompt,
      mode,
      model,
      aspect,
      count,
      res: resolution,
      image_bytes,
      image_bytes_array,
      start_image_media_id,
      reference_image_media_ids,
      seed,
      preamble,
    } = req.body || {};

    // Validation
    if (!prompt || !String(prompt).trim()) {
      return res.status(400).json({ detail: 'Prompt required' });
    }

    // Validate image inputs if provided
    if (image_bytes && typeof image_bytes !== 'string') {
      return res.status(400).json({ detail: 'image_bytes must be a base64 string' });
    }
    if (image_bytes_array && !Array.isArray(image_bytes_array)) {
      return res.status(400).json({ detail: 'image_bytes_array must be an array' });
    }
    if (image_bytes_array) {
      for (let i = 0; i < image_bytes_array.length; i++) {
        if (typeof image_bytes_array[i] !== 'string') {
          return res.status(400).json({ detail: `image_bytes_array[${i}] must be a base64 string` });
        }
      }
    }

    // Validate media IDs if provided
    if (start_image_media_id && typeof start_image_media_id !== 'string') {
      return res.status(400).json({ detail: 'start_image_media_id must be a string' });
    }
    if (reference_image_media_ids && !Array.isArray(reference_image_media_ids)) {
      return res.status(400).json({ detail: 'reference_image_media_ids must be an array' });
    }
    if (reference_image_media_ids) {
      for (let i = 0; i < reference_image_media_ids.length; i++) {
        if (typeof reference_image_media_ids[i] !== 'string') {
          return res.status(400).json({ detail: `reference_image_media_ids[${i}] must be a string` });
        }
      }
    }

    // Validate seed if provided
    if (seed !== undefined && (typeof seed !== 'number' || seed < 0 || seed > 999999999)) {
      return res.status(400).json({ detail: 'seed must be a number between 0 and 999999999' });
    }

    const jobId = randomUUID();
    state.jobs[jobId] = { status: 'running', progress: 0, result: null, error: null };
    runJob(jobId, state, {
      prompt: String(prompt).trim(),
      mode: mode || 'image',
      model,
      aspect,
      count,
      res: resolution,
      image_bytes,
      image_bytes_array,
      start_image_media_id,
      reference_image_media_ids,
      seed,
      preamble,
    }).catch((e) => {
      state._log(`Job ${jobId} error: ${e.message}`);
    });
    res.json({ jobId });
  });

  app.get('/api/flow/generate/status/:job_id', (req, res) => {
    const jobs = req.app.state?.jobs || {};
    const j = jobs[req.params.job_id];
    if (!j) return res.status(404).json({ detail: 'Job not found' });
    const out = { status: j.status };
    if (j.progress != null) out.progress = j.progress;
    if (j.result != null) out.result = j.result;
    if (j.error != null) out.error = j.error;
    res.json(out);
  });

  // Image upload endpoint
  app.post('/api/flow/image/upload', async (req, res) => {
    const state = req.app.state;
    if (!state?.image_api) {
      return res.status(503).json({ detail: 'API not initialized' });
    }
    const { image_bytes, mime_type, aspect_ratio } = req.body || {};

    if (!image_bytes || typeof image_bytes !== 'string') {
      return res.status(400).json({ detail: 'image_bytes (base64 string) required' });
    }

    const result = await state.image_api.uploadImage({
      image_bytes,
      mime_type: mime_type || 'image/jpeg',
      aspect_ratio: aspect_ratio || '16:9 Landscape',
    });

    if (result.success) {
      res.json({
        success: true,
        media_id: result.media_id,
        width: result.width,
        height: result.height,
      });
    } else {
      res.status(400).json({ detail: result.error || 'Upload failed' });
    }
  });

  // Gallery upscale: single image (reuses runImageUpscale used by generation flow)
  app.post('/api/flow/upscale-image', async (req, res) => {
    const state = req.app.state;
    if (!state?.image_api || !state?.recaptcha) {
      return res.status(503).json({ detail: 'API not initialized' });
    }
    const { media_id, resolution } = req.body || {};
    if (!media_id || typeof media_id !== 'string') {
      return res.status(400).json({ detail: 'media_id (string) required' });
    }
    if (!['2K', '4K'].includes(resolution)) {
      return res.status(400).json({ detail: 'resolution must be 2K or 4K' });
    }
    try {
      const result = await runImageUpscale(state, media_id, resolution);
      if (!result.success) {
        return res.status(400).json({ detail: result.error || 'Upscale failed' });
      }
      const payload = { success: true, encoded_image: result.encoded_image, resolution };
      if (result.encoded_image) {
        state.generated_items.push({
          type: 'image',
          url: `data:image/jpeg;base64,${result.encoded_image}`,
          prompt: '',
          model: '',
          aspect: '',
          resolution,
          media_generation_id: '',
        });
      }
      res.json(payload);
    } catch (e) {
      state._log(`Upscale image error: ${e.message}`);
      res.status(500).json({ detail: e.message || 'Upscale failed' });
    }
  });

  // Gallery upscale: single video (reuses runVideoUpscale used by generation flow)
  app.post('/api/flow/upscale-video', async (req, res) => {
    const state = req.app.state;
    if (!state?.video_api || !state?.recaptcha) {
      return res.status(503).json({ detail: 'API not initialized' });
    }
    const { media_generation_id, aspect_ratio, resolution } = req.body || {};
    if (!media_generation_id || typeof media_generation_id !== 'string') {
      return res.status(400).json({ detail: 'media_generation_id (string) required' });
    }
    if (!['1080p', '4K'].includes(resolution)) {
      return res.status(400).json({ detail: 'resolution must be 1080p or 4K' });
    }
    try {
      const result = await runVideoUpscale(state, media_generation_id, aspect_ratio || '', resolution);
      if (!result.success) {
        return res.status(400).json({ detail: result.error || 'Upscale failed' });
      }
      const payload = { success: true, video_url: result.video_url, thumbnail_url: result.thumbnail_url, resolution };
      if (result.video_url) {
        state.generated_items.push({
          type: 'video',
          url: result.video_url,
          thumbnail_url: result.thumbnail_url || '',
          prompt: '',
          model: '',
          aspect: aspect_ratio || '',
          resolution,
          media_generation_id: result.media_generation_id || '',
        });
      }
      res.json(payload);
    } catch (e) {
      state._log(`Upscale video error: ${e.message}`);
      res.status(500).json({ detail: e.message || 'Upscale failed' });
    }
  });
}
