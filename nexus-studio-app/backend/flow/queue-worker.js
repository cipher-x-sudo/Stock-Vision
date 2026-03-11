import path from 'path';
import { APP_CONFIG_FILE } from './config.js';
import { loadAppConfig } from './app-config.js';
import { saveGeneratedItem } from './downloads.js';
import { runGeneration, runUpscalePhase } from './routes/generate.js';
import {
  loadQueueStats,
  appendQueueItem,
  updateQueueItem,
  updateProjectStats,
  persistQueueSnapshot,
} from './stats-store.js';

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

function classifyError(err) {
  const s = (err || '').toLowerCase();
  return {
    isE404: s.includes('404') || s.includes('not found'),
    isApiErr: s.includes('api') || s.includes('503') || s.includes('502') || s.includes('500'),
  };
}

/** Serializable snapshot of a queue item for storage (no image_bytes, no raw result). */
function queueItemSnapshot(item, overrides = {}) {
  const hasImageInput = !!(item.image_bytes || (item.image_bytes_array && item.image_bytes_array.length) || (item.reference_image_media_ids && item.reference_image_media_ids.length) || item.start_image_media_id || item.start_frame_bytes);
  return {
    id: item.id,
    prompt: item.prompt || '',
    promptPreview: (item.prompt || '').slice(0, 80),
    mode: item.mode === 'video' ? 'video' : 'image',
    model: item.model || '',
    aspect: item.aspect || '',
    count: item.count ?? (item.mode === 'video' ? 1 : 2),
    res: item.res || (item.mode === 'video' ? '720p' : '1K'),
    seed: item.seed,
    subMode: item.subMode,
    hasImageInput,
    originalFilename: item.originalFilename,
    createdAt: item.createdAt ?? Date.now(),
    startedAt: item.startedAt,
    finishedAt: item.finishedAt,
    durationMs: item.durationMs,
    status: item.status || 'queued',
    statusMessage: item.statusMessage ?? null,
    nanoImage: item.nanoImage ?? null,
    resultSummary: item.resultSummary ?? null,
    error: item.error ?? null,
    errorType: item.errorType ?? null,
    projectId: item.projectId ?? null,
    resultMedia: item.resultMedia ?? null,
    ...overrides,
  };
}

/** Build resultMedia from outcome.result (images/videos/video) with isUpscaled, originalResolution, downloadedPath. */
function buildResultMedia(res, body) {
  const isImageUpscaled = body.mode === 'image' && (body.res === '2K' || body.res === '4K');
  const isVideoUpscaled = body.mode === 'video' && (body.res === '1080p' || body.res === '4K');
  const images = (res.images || []).map((img, index) => ({
    index,
    url: img.url || '',
    media_generation_id: img.media_generation_id || '',
    prompt: body.prompt || '',
    model: body.model || '',
    aspect: body.aspect || '',
    seed: img.seed,
    resolution: img.resolution || body.res,
    downloadedPath: img.downloadedPath || null,
    isUpscaled: isImageUpscaled,
    originalResolution: isImageUpscaled ? '1K' : undefined,
    upscaleStatus: img.upscaleStatus ?? undefined,
  }));
  const videoSingle = res.video ? {
    video_url: res.video.url || res.video.fifeUrl || res.video.video_url || '',
    thumbnail_url: res.video.thumbnail_url || '',
    media_generation_id: res.video.media_generation_id || res.video.mediaGenerationId || '',
    has_audio: res.video.has_audio ?? false,
    seed: res.video.seed,
    prompt: body.prompt || '',
    model: body.model || '',
    aspect: body.aspect || '',
    resolution: res.video.resolution || body.res,
    downloadedPath: res.video.downloadedPath || null,
    isUpscaled: isVideoUpscaled,
    originalResolution: isVideoUpscaled ? '720p' : undefined,
    upscaleFailed: res.video.upscaleFailed ?? false,
    upscaleTargetRes: res.video.upscaleTargetRes ?? undefined,
    upscaleStatus: res.video.upscaleStatus ?? undefined,
  } : null;
  const videos = (res.videos || []).map((v, index) => ({
    index,
    video_url: v.video_url || '',
    thumbnail_url: v.thumbnail_url || '',
    media_generation_id: v.media_generation_id || '',
    has_audio: v.has_audio ?? false,
    seed: v.seed,
    prompt: body.prompt || '',
    model: body.model || '',
    aspect: body.aspect || '',
    resolution: v.resolution || body.res,
    downloadedPath: v.downloadedPath || null,
    isUpscaled: isVideoUpscaled,
    originalResolution: isVideoUpscaled ? '720p' : undefined,
    upscaleFailed: v.upscaleFailed ?? false,
    upscaleTargetRes: v.upscaleTargetRes ?? undefined,
    upscaleStatus: v.upscaleStatus ?? undefined,
  }));
  return { images, videos, video: videoSingle };
}

/** Run upscale in background. Does not block. Updates item when done.
 * Video-level slots are managed inside runUpscalePhase, not here. */
async function runUpscaleInBackground(state, item, body, targetRes) {
  // One-time log of effective upscale config (path and values)
  if (!state._upscaleConfigLogged) {
    state._upscaleConfigLogged = true;
    const cfg = loadAppConfig();
    const maxUpscales = Math.max(1, Math.min(10, cfg.maxConcurrentUpscales ?? 4));
    const upscaleStartDelayMs = Math.max(0, Math.min(30000, cfg.upscaleStartDelayMs ?? 3000));
    const rootLog = state._rootLog || state._log;
    rootLog(`Batch upscale config: maxConcurrentUpscales=${maxUpscales} (per-video), upscaleStartDelayMs=${upscaleStartDelayMs}, configFile=${APP_CONFIG_FILE}`);
  }

  // Item status is already upscale_pending from runSingleItem; set to upscaling now
  item.status = 'upscaling';
  updateQueueItem(state, item.id, { status: 'upscaling', statusMessage: null });

  const rootLog = state._rootLog || state._log;  // Use root log to avoid nesting when concurrent
  const queueNum = (() => { const idx = state.queue_items.findIndex((it) => it.id === item.id); return idx >= 0 ? idx + 1 : item.id; })();
  state._log = (msg) => rootLog(`[QUEUE - ${queueNum}] ${msg}`);

  // Callback to update per-video status in item.result and persist
  const onVideoStatusChange = (index, status, videoResult) => {
    if (item.result?.videos && item.result.videos[index]) {
      item.result.videos[index].upscaleStatus = status;
      if (videoResult) {
        // Merge upscale result into the video
        Object.assign(item.result.videos[index], videoResult);
      }
      // Rebuild resultMedia and persist
      const bodyForMedia = { ...body, res: body.mode === 'image' ? '1K' : '720p' };
      item.resultMedia = buildResultMedia(item.result, bodyForMedia);
      updateQueueItem(state, item.id, { result: item.result, resultMedia: item.resultMedia });
      setImmediate(() => { try { persistQueueSnapshot(state); } catch (_) { } });
    }
  };

  try {
    const baseResult = item.result;
    const upscaleOutcome = await runUpscalePhase(
      state,
      baseResult,
      targetRes,
      body,
      (p) => {
        item.progress = 90 + Math.floor(p * 0.1);
        updateQueueItem(state, item.id, { progress: item.progress });
      },
      item.id,
      onVideoStatusChange
    );

    if (upscaleOutcome.success && upscaleOutcome.result) {
      item.status = 'done';
      item.result = upscaleOutcome.result;
      item.progress = 100;
      item.error = null;
      item.finishedAt = item.finishedAt ?? Date.now();
      item.durationMs = (item.startedAt ? item.finishedAt - item.startedAt : 0);

      const res = upscaleOutcome.result;
      item.resultSummary = {
        imageCount: res.images?.length ?? 0,
        videoCount: res.videos?.length ?? (res.video ? 1 : 0),
        resolutions: res.images ? res.images.map((i) => i.resolution || body.res) : (res.videos ? res.videos.map((v) => v.resolution || body.res) : (res.video ? [res.video.resolution || body.res] : [])),
        mode: res.mode || body.mode,
        resolution: body.res,
      };
      item.resultMedia = buildResultMedia(res, body);

      const cfg = loadAppConfig();
      state.auto_download = cfg.autoDownload;
      state.output_dir = cfg.outputDir;
      state.auto_download_upscaled_only = cfg.autoDownloadUpscaledOnly;

      const resMatch = (a, b) => String(a || '').toUpperCase() === String(b || '').toUpperCase();
      const hasImages = res.images?.some((img) => img?.url);
      const singleVideoUrl = res.video ? (res.video.url || res.video.fifeUrl || res.video.video_url) : null;
      const singleVideoIsUpscaled = res.video && resMatch(res.video.resolution, body.res);
      const hasUpscaledVideos = res.videos?.some((v) => v?.video_url && resMatch(v.resolution, body.res));
      const hasAnyToSave = hasImages || (singleVideoUrl && singleVideoIsUpscaled) || hasUpscaledVideos;

      const firstVid = res.videos?.[0];
      state._log(`Auto-download check: body.res=${body.res}, hasUpscaledVideos=${!!hasUpscaledVideos}, hasAnyToSave=${!!hasAnyToSave}, firstVideoRes=${firstVid?.resolution ?? 'N/A'}, firstVideoHasUrl=${!!firstVid?.video_url}`);

      if (state.auto_download_upscaled_only && !hasAnyToSave) {
        state._log(`Auto-download skipped: upscaled only and no upscaled URLs (hasUpscaledVideos=${!!hasUpscaledVideos}, videosCount=${res.videos?.length ?? 0}, singleVideoUrl=${!!singleVideoUrl})`);
      } else if (state.auto_download && state.output_dir && hasAnyToSave) {
        const prompt = body.prompt;
        const outDir = path.resolve(state.output_dir);
        const upscaleCount = (res.videos?.filter((v) => v.video_url && resMatch(v.resolution, body.res)).length ?? 0) + (singleVideoUrl && singleVideoIsUpscaled ? 1 : 0);
        state._log(`Auto-download: saving ${upscaleCount} upscaled videos to ${outDir}`);
        const downloadOpts = { filenamePrefix: cfg.autoDownloadPrefix, filenameSuffix: cfg.autoDownloadSuffix };
        if (res.images) {
          for (const img of res.images) {
            if (img.url) {
              const outPath = await saveGeneratedItem('image', img.url, prompt, outDir, state._log, downloadOpts);
              if (outPath) { img.downloaded = true; img.downloadedPath = outPath; }
            }
          }
        }
        if (res.videos) {
          for (let i = 0; i < res.videos.length; i++) {
            const v = res.videos[i];
            if (v.video_url && resMatch(v.resolution, body.res)) {
              const outPath = await saveGeneratedItem('video', v.video_url, prompt, outDir, state._log, { ...downloadOpts, resolution: body.res });
              if (outPath) {
                v.downloaded = true;
                v.downloadedPath = outPath;
              } else {
                state._log(`Auto-download failed for video ${i + 1}: fetch or write failed`);
              }
            }
          }
        }
        if (singleVideoUrl && singleVideoIsUpscaled) {
          const outPath = await saveGeneratedItem('video', singleVideoUrl, prompt, outDir, state._log, { ...downloadOpts, resolution: body.res });
          if (outPath) {
            res.video.downloaded = true;
            res.video.downloadedPath = outPath;
          } else {
            state._log(`Auto-download failed for single video: fetch or write failed`);
          }
        }
      }

      updateQueueItem(state, item.id, {
        status: 'done',
        progress: 100,
        resultSummary: item.resultSummary,
        resultMedia: item.resultMedia,
        error: null,
      });
      if (state.stats) {
        if (body.mode === 'image') state.stats.images = (state.stats.images || 0) + (item.resultSummary?.imageCount ?? 0);
        else state.stats.videos = (state.stats.videos || 0) + (item.resultSummary?.videoCount ?? (res.video ? 1 : 0));
      }
      const projectId = state.auth_state?.project_id;
      if (projectId) {
        updateProjectStats(state, projectId, {
          lastActivityAt: item.finishedAt,
          totalDone: 1,
          totalImages: item.resultSummary?.imageCount ?? 0,
          totalVideos: item.resultSummary?.videoCount ?? 0,
          byMode: { [body.mode]: 1 },
          byResolution: { [body.res]: 1 },
          byStatus: { done: 1 },
          itemId: item.id,
        });
      }
    } else {
      item.status = 'failed';
      item.error = upscaleOutcome.error || 'Upscale failed';
      item.errorType = 'other';
      updateQueueItem(state, item.id, { status: 'failed', error: item.error, errorType: item.errorType });
      const projectId = state.auth_state?.project_id;
      if (projectId) {
        updateProjectStats(state, projectId, {
          lastActivityAt: Date.now(),
          totalFailed: 1,
          byStatus: { failed: 1 },
          errors: { other: 1 },
          itemId: item.id,
        });
      }
    }
  } catch (e) {
    state._log(`Upscale background error: ${e.message}`);
    item.status = 'failed';
    item.error = String(e.message);
    item.errorType = 'other';
    updateQueueItem(state, item.id, { status: 'failed', error: item.error, errorType: item.errorType });
  } finally {
    state._log = rootLog;  // Restore to root log
    // Note: video-level slots are released inside runUpscalePhase, not here
    setImmediate(() => { try { persistQueueSnapshot(state); } catch (_) { } });
  }
}

export async function runSingleItem(state, item) {
  const rootLog = state._rootLog || state._log;  // Use root log to avoid nesting when concurrent
  const queueNum = (() => { const idx = state.queue_items.findIndex((it) => it.id === item.id); return idx >= 0 ? idx + 1 : item.id; })();
  state._log = (msg) => rootLog(`[QUEUE - ${queueNum}] ${msg}`);

  try {
    const log = state._log;
    item.status = 'processing';
    item.progress = 0;
    item.createdAt = item.createdAt ?? Date.now();
    item.startedAt = Date.now();

    // Ensure item is in stats store; if not, append snapshot
    const stored = loadQueueStats(state);
    if (!stored.items.some((it) => it.id === item.id)) {
      appendQueueItem(state, queueItemSnapshot(item, { status: 'queued', startedAt: null }));
    }
    updateQueueItem(state, item.id, { startedAt: item.startedAt, status: 'processing' });
    // Upload images on-the-fly if we have raw bytes
    let referenceMediaIds = item.reference_image_media_ids || [];
    let startImageMediaId = item.start_image_media_id;

    // If image_bytes present (I2I mode), upload now to get media_id
    if (item.image_bytes && !referenceMediaIds.length) {
      log('Uploading I2I image...');
      const { media_id } = await state.image_api.uploadImage({
        image_bytes: item.image_bytes,
        mime_type: 'image/jpeg',
        aspect_ratio: item.aspect || '16:9 Landscape',
      });
      referenceMediaIds = [media_id];
      log(`I2I image uploaded: ${media_id}`);
    }

    // If start_frame_bytes present (Frames mode), upload now to get media_id
    if (item.start_frame_bytes && !startImageMediaId) {
      log('Uploading start frame...');
      const { media_id } = await state.image_api.uploadImage({
        image_bytes: item.start_frame_bytes,
        mime_type: 'image/jpeg',
        aspect_ratio: item.aspect || '16:9 Landscape',
      });
      startImageMediaId = media_id;
      log(`Start frame uploaded: ${media_id}`);
    }

    const body = {
      prompt: (item.prompt || '').trim(),
      mode: item.mode === 'video' ? 'video' : 'image',
      model: item.model || '',
      aspect: item.aspect || '',
      count: item.count ?? (item.mode === 'video' ? 1 : 2),
      res: item.res || (item.mode === 'video' ? '720p' : '1K'),
      seed: item.seed,
      image_bytes: item.image_bytes,
      image_bytes_array: item.image_bytes_array,
      reference_image_media_ids: referenceMediaIds.length > 0 ? referenceMediaIds : undefined,
      start_image_media_id: startImageMediaId,
      subMode: item.subMode,
      nano2video: item.subMode === 'nanoVideo',
    };

    const outcome = await runGeneration(state, body, {
      onProgress: (p) => { item.progress = p; },
      onPhase: (phase) => { if (phase === 'polling') updateQueueItem(state, item.id, { status: 'polling' }); },
      onStatusMessage: (msg) => {
        item.statusMessage = msg;
        updateQueueItem(state, item.id, { statusMessage: msg });
      },
      onNanoImage: (img) => {
        item.nanoImage = img;
        updateQueueItem(state, item.id, { nanoImage: img });
      },
    });

    // When base is done and upscale is needed: show base, set upscale_pending, fire background upscale
    if (outcome.status === 'upscaling' && outcome.result && outcome.targetRes && outcome.body) {
      item.status = 'upscale_pending';
      item.statusMessage = null;
      item.result = outcome.result;
      item.progress = 90;
      item.nanoImage = outcome.nanoImage ?? item.nanoImage;
      item.finishedAt = null;
      item.durationMs = item.startedAt ? Date.now() - item.startedAt : 0;
      item.projectId = state.auth_state?.project_id ?? null;
      const res = outcome.result;
      item.resultSummary = {
        imageCount: res.images?.length ?? 0,
        videoCount: res.videos?.length ?? (res.video ? 1 : 0),
        resolutions: res.images ? res.images.map((i) => i.resolution || (body.mode === 'image' ? '1K' : '720p')) : (res.videos ? res.videos.map((v) => v.resolution || '720p') : (res.video ? ['720p'] : [])),
        mode: res.mode || body.mode,
        resolution: body.mode === 'image' ? '1K' : '720p',
      };
      const bodyForMedia = { ...body, res: body.mode === 'image' ? '1K' : '720p' };
      item.resultMedia = buildResultMedia(res, bodyForMedia);
      updateQueueItem(state, item.id, {
        status: 'upscale_pending',
        statusMessage: null,
        progress: 90,
        result: item.result,
        resultSummary: item.resultSummary,
        resultMedia: item.resultMedia,
        nanoImage: item.nanoImage,
      });
      setImmediate(() => { try { persistQueueSnapshot(state); } catch (_) { } });
      runUpscaleInBackground(state, item, outcome.body, outcome.targetRes);
      return;
    }

    item.status = outcome.status === 'done' ? 'done' : outcome.status === 'recaptcha_failed' ? 'recaptcha_failed' : 'failed';
    item.statusMessage = null;
    item.nanoImage = outcome.nanoImage ?? item.nanoImage;
    item.result = outcome.result ?? null;
    item.error = outcome.error ?? null;
    item.finishedAt = Date.now();
    item.durationMs = item.startedAt ? item.finishedAt - item.startedAt : 0;
    item.projectId = state.auth_state?.project_id ?? null;

    if (outcome.status === 'done') {
      item.progress = 100;
      const res = outcome.result;
      if (res) {
        item.resultSummary = {
          imageCount: res.images?.length ?? 0,
          videoCount: res.videos?.length ?? (res.video ? 1 : 0),
          resolutions: res.images ? res.images.map((i) => i.resolution || body.res) : (res.videos ? res.videos.map((v) => v.resolution || body.res) : (res.video ? [res.video.resolution || body.res] : [])),
          mode: res.mode || body.mode,
          resolution: body.res,
        };
      }
    }

    if (outcome.status === 'recaptcha_failed') {
      item.errorType = 'recaptcha';
    } else if (outcome.status === 'error') {
      const { isE404, isApiErr } = classifyError(outcome.error || '');
      item.errorType = isE404 ? 'e404' : isApiErr ? 'apiErr' : 'other';
      if (isE404) state.stats.e404 = (state.stats.e404 || 0) + 1;
      if (isApiErr) state.stats.apiErr = (state.stats.apiErr || 0) + 1;
    }

    // Refresh config from disk so editing app_config.json takes effect without restart
    const cfg = loadAppConfig();
    state.auto_download = cfg.autoDownload;
    state.output_dir = cfg.outputDir;
    state.auto_download_upscaled_only = cfg.autoDownloadUpscaledOnly;

    if (outcome.success && outcome.result) {
      const res = outcome.result;
      const hasImages = res.images?.some((img) => img?.url);
      const hasVideos = res.videos?.some((v) => v?.video_url);
      const singleVideoUrl = res.video ? (res.video.url || res.video.fifeUrl || res.video.video_url) : null;

      const isUpscaleResolution =
        (body.mode === 'video' && (body.res === '1080p' || body.res === '4K')) ||
        (body.mode === 'image' && (body.res === '2K' || body.res === '4K'));

      if (!state.auto_download) {
        log('Auto-download skipped: auto_download=false');
      } else if (!state.output_dir) {
        log('Auto-download skipped: output_dir empty');
      } else if (!hasImages && !hasVideos && !singleVideoUrl) {
        log('Auto-download skipped: no URLs in result');
      } else if (state.auto_download_upscaled_only && !isUpscaleResolution) {
        log('Auto-download skipped: upscaled only and job is base resolution');
      } else {
        const prompt = body.prompt;
        const outDir = path.resolve(state.output_dir);
        log(`Auto-download: saving to ${outDir}`);
        const downloadOpts = { filenamePrefix: cfg.autoDownloadPrefix, filenameSuffix: cfg.autoDownloadSuffix };

        if (res.images) {
          for (const img of res.images) {
            if (img.url) {
              const outPath = await saveGeneratedItem('image', img.url, prompt, outDir, log, downloadOpts);
              if (outPath) {
                img.downloaded = true;
                img.downloadedPath = outPath;
              } else log(`Auto-download: save failed for image ${img.url?.slice(0, 50)}...`);
            }
          }
        }
        if (res.videos) {
          for (const v of res.videos) {
            if (v.video_url) {
              const outPath = await saveGeneratedItem('video', v.video_url, prompt, outDir, log, { ...downloadOpts, resolution: body.res });
              if (outPath) {
                v.downloaded = true;
                v.downloadedPath = outPath;
              } else log(`Auto-download: save failed for video ${v.video_url?.slice(0, 50)}...`);
            }
          }
        }
        if (singleVideoUrl) {
          const outPath = await saveGeneratedItem('video', singleVideoUrl, prompt, outDir, log, { ...downloadOpts, resolution: body.res });
          if (outPath) {
            res.video.downloaded = true;
            res.video.downloadedPath = outPath;
          } else log(`Auto-download: save failed for video ${singleVideoUrl?.slice(0, 50)}...`);
        }
      }

      // Build resultMedia for storage (images/videos with isUpscaled, originalResolution, downloadedPath)
      item.resultMedia = buildResultMedia(res, body);
    }

    // Persist queue item update and project stats
    const updates = {
      finishedAt: item.finishedAt,
      durationMs: item.durationMs,
      status: item.status,
      statusMessage: null,
      nanoImage: item.nanoImage ?? null,
      resultSummary: item.resultSummary ?? null,
      error: item.error ?? null,
      errorType: item.errorType ?? null,
      projectId: item.projectId ?? null,
      resultMedia: item.resultMedia ?? null,
    };
    updateQueueItem(state, item.id, updates);

    const projectId = state.auth_state?.project_id;
    if (projectId) {
      const mode = body.mode || 'image';
      const resVal = body.res || (mode === 'video' ? '720p' : '1K');
      updateProjectStats(state, projectId, {
        lastActivityAt: item.finishedAt,
        totalDone: item.status === 'done' ? 1 : 0,
        totalFailed: item.status === 'failed' ? 1 : 0,
        totalImages: item.status === 'done' && item.resultSummary?.imageCount ? item.resultSummary.imageCount : 0,
        totalVideos: item.status === 'done' && item.resultSummary?.videoCount ? item.resultSummary.videoCount : 0,
        byMode: item.status === 'done' ? { [mode]: 1 } : { [mode]: 0 },
        byResolution: item.status === 'done' ? { [resVal]: 1 } : {},
        byStatus: { [item.status]: 1 },
        errors: item.errorType ? { [item.errorType]: 1 } : {},
        itemId: item.id,
      });
    }

    // Full snapshot so file has all items (non-blocking)
    setImmediate(() => { try { persistQueueSnapshot(state); } catch (_) { } });
  } catch (e) {
    item.status = 'failed';
    item.error = String(e.message);
    item.progress = 0;
    item.finishedAt = item.finishedAt ?? Date.now();
    item.durationMs = item.startedAt ? (item.finishedAt - item.startedAt) : 0;
    item.projectId = state.auth_state?.project_id ?? null;
    item.errorType = 'other';
    state.stats.failed += 1;
    log(`Queue item error: ${e.message}`);
    try {
      updateQueueItem(state, item.id, {
        finishedAt: item.finishedAt,
        durationMs: item.durationMs,
        status: 'failed',
        error: item.error,
        errorType: item.errorType,
        projectId: item.projectId,
      });
      const projectId = state.auth_state?.project_id;
      if (projectId) {
        updateProjectStats(state, projectId, {
          lastActivityAt: item.finishedAt,
          totalFailed: 1,
          byStatus: { failed: 1 },
          errors: { other: 1 },
          itemId: item.id,
        });
      }
      setImmediate(() => { try { persistQueueSnapshot(state); } catch (_) { } });
    } catch (_) { }
  } finally {
    state._log = rootLog;  // Restore to root log
  }
}

export function queueStats(state) {
  const items = state.queue_items || [];
  const nQueued = items.filter((it) => it.status === 'queued').length;
  const nProcess = items.filter((it) => it.status === 'processing' || it.status === 'polling').length;
  const st = state.stats || {};
  return {
    total: items.length,
    queue: nQueued,
    process: nProcess,
    success: st.success || 0,
    remain: nQueued + nProcess,
    failed: st.failed || 0,
    e404: st.e404 || 0,
    apiErr: st.apiErr || 0,
  };
}

export async function runWorker(state, pollIntervalMs = 500) {
  const stopRequested = () => state.queue_stop_requested;
  const isPaused = () => state.queue_paused;
  const getThreads = () => Math.max(1, Math.min(5, state.queue_threads || 1));
  const activeJobs = new Set();

  // Initialize queue as stopped by default
  if (state.queue_stop_requested === undefined) {
    state.queue_stop_requested = true;
  }

  while (true) {
    // If stopped or paused, wait and continue
    if (stopRequested() || isPaused()) {
      await delay(pollIntervalMs);
      continue;
    }

    // Get number of slots available
    const maxThreads = getThreads();
    const available = maxThreads - activeJobs.size;
    if (available <= 0) {
      await delay(pollIntervalMs);
      continue;
    }

    // Find next queued items up to available slots
    const pendingItems = [];
    for (const it of state.queue_items) {
      if (it.status === 'queued' && !activeJobs.has(it.id) && pendingItems.length < available) {
        pendingItems.push(it);
      }
    }

    // Auto-stop: If no queued items remain and no active jobs, stop the queue
    if (!pendingItems.length && activeJobs.size === 0) {
      const hasQueuedItems = state.queue_items.some(it => it.status === 'queued');
      const hasProcessingItems = state.queue_items.some(it => it.status === 'processing' || it.status === 'polling');
      const hasUpscalingItems = state.queue_items.some(it => it.status === 'upscaling' || it.status === 'upscale_pending');
      const activeUpscaleSlots = (state.activeUpscaleSlots && state.activeUpscaleSlots.size > 0);

      // If nothing is queued, processing, or upscaling, auto-stop or auto-retry failed items
      if (!hasQueuedItems && !hasProcessingItems && !hasUpscalingItems && !activeUpscaleSlots && state.queue_items.length > 0) {
        const failed = state.queue_items.filter(it => it.status === 'failed' || it.status === 'recaptcha_failed');
        const autoRetryCount = state.auto_retry_count ?? 0;
        const maxAutoRetries = 3;

        if (failed.length > 0 && autoRetryCount < maxAutoRetries) {
          for (const it of failed) {
            it.status = 'queued';
            it.error = null;
            it.errorType = null;
            it.result = null;
            it.progress = 0;
          }
          state.auto_retry_count = autoRetryCount + 1;
          state._log?.(`Auto-retry: ${failed.length} failed items, round ${autoRetryCount + 1}/${maxAutoRetries}`);
          setImmediate(() => { try { persistQueueSnapshot(state); } catch (_) { } });
        } else {
          state.queue_stop_requested = true;
          state.auto_retry_count = 0;
          if (failed.length > 0 && autoRetryCount >= maxAutoRetries) {
            state._log?.('Auto-retry limit reached (3), stopping.');
          }
          state._log?.('Queue auto-stopped: all items processed');
        }
      }
      await delay(pollIntervalMs);
      continue;
    }

    // Check if API is ready
    if (!state.image_api || !state.recaptcha) {
      await delay(pollIntervalMs);
      continue;
    }

    // Start processing items with stagger (1–3 s between starts) to avoid reCAPTCHA/session burst
    const STAGGER_MS = 2000;
    for (let i = 0; i < pendingItems.length; i++) {
      if (i > 0) await delay(STAGGER_MS);
      const item = pendingItems[i];
      activeJobs.add(item.id);
      runSingleItem(state, item).finally(() => {
        activeJobs.delete(item.id);
      });
    }

    await delay(100); // Small delay before checking for more
  }
}
