import { API_PROJECT_SEARCH_WORKFLOWS, IMAGE_MODELS, VIDEO_MODELS } from '../config.js';

// Reverse maps: API key -> display name for gallery model label
const IMAGE_KEY_TO_DISPLAY = Object.fromEntries(
  Object.entries(IMAGE_MODELS).map(([name, { key }]) => [key, name])
);
const VIDEO_KEY_TO_DISPLAY = Object.fromEntries(
  Object.entries(VIDEO_MODELS).map(([name, { key }]) => [key, name])
);
// Upscaler keys not in VIDEO_MODELS
VIDEO_KEY_TO_DISPLAY['veo_3_1_upsampler_4k'] = 'Veo 3.1 - Upsampler 4K';
VIDEO_KEY_TO_DISPLAY['veo_3_1_upsampler_1080p'] = 'Veo 3.1 - Upsampler 1080p';

/**
 * Parse workflows response to extract images and videos
 * (Logic matches Veo Downloader's FE_parseWorkflowsResponse exactly)
 */
function parseWorkflowsResponse(data) {
  const items = [];
  const upscaledMap = new Map(); // Map: sourceMediaGenerationId -> 4K video data

  try {
    const workflows = data?.result?.data?.json?.result?.workflows || [];

    // First pass: Find all 4K upscaled videos and build a map (same as Veo Downloader)
    console.log(`[DEBUG] ========== FIRST PASS: Building upscaledMap ==========`);
    workflows.forEach(workflow => {
      workflow.workflowSteps?.forEach(step => {
        const requestData = step.workflowStepLog?.requestData?.videoGenerationRequestData;
        const videoModelName = requestData?.videoModelControlInput?.videoModelName;

        // Log ALL model names to see what values exist
        if (videoModelName) {
          console.log(`[DEBUG] Workflow step model: "${videoModelName}"`);
        }

        // Check if this is a 4K upscaled video
        if (videoModelName === 'veo_3_1_upsampler_4k') {
          console.log(`[DEBUG] MATCH! videoModelName="${videoModelName}" (length=${videoModelName.length})`);
          const sourceInputs = requestData?.videoGenerationVideoInputs || [];
          const sourceMediaGenId = sourceInputs[0]?.mediaGenerationId;

          console.log(`[DEBUG] 4K upscaler found, sourceMediaGenId: type=${typeof sourceMediaGenId}, value=${JSON.stringify(sourceMediaGenId)?.slice(0, 80)}`);

          step.mediaGenerations?.forEach(gen => {
            const videoData = gen.mediaData?.videoData;
            // Only add if we have a source ID and valid video data (same check as Veo Downloader)
            if (videoData && sourceMediaGenId) {
              console.log(`[DEBUG]   -> Adding to map: key=${JSON.stringify(sourceMediaGenId)?.slice(0, 60)}`);
              upscaledMap.set(sourceMediaGenId, {
                mediaKey: gen.mediaGenerationId?.mediaKey,
                mediaGenerationId: videoData.generatedVideo?.mediaGenerationId,
                videoSrc: videoData.fifeUri || '',
                imageSrc: videoData.servingBaseUri || '', // Thumbnail
                aspectRatio: videoData.generatedVideo?.aspectRatio
              });
            }
          });
        }
      });
    });

    console.log(`[DEBUG] ========== upscaledMap has ${upscaledMap.size} entries ==========`);
    console.log(`[DEBUG] Map keys:`);
    for (const [key] of upscaledMap) {
      console.log(`[DEBUG]   key type=${typeof key}, value=${JSON.stringify(key)?.slice(0, 80)}`);
    }

    // Second pass: Parse all media and link 4K versions (matching Veo Downloader logic)
    console.log(`[DEBUG] ========== SECOND PASS: Matching videos ==========`);
    let matchCount = 0;
    let noMatchCount = 0;

    workflows.forEach(workflow => {
      workflow.workflowSteps?.forEach(step => {
        const requestData = step.workflowStepLog?.requestData?.videoGenerationRequestData;
        const videoModelName = requestData?.videoModelControlInput?.videoModelName;
        const videoModelDisplayName = requestData?.videoModelControlInput?.videoModelDisplayName;

        // Skip 4K upsampler workflows (they're linked to originals)
        if (videoModelName === 'veo_3_1_upsampler_4k') {
          return;
        }

        const videoModelLabel = videoModelDisplayName || VIDEO_KEY_TO_DISPLAY[videoModelName] || videoModelName || '';

        step.mediaGenerations?.forEach(gen => {
          const mediaData = gen.mediaData || {};
          const mediaExtraData = gen.mediaExtraData || {};
          const imageData = mediaData.imageData;
          const videoData = mediaData.videoData;

          // Extract prompt from mediaExtraData.mediaTitle (same as Veo Downloader)
          const rawPrompt = mediaExtraData.mediaTitle || mediaData.mediaTitle || '';

          // VIDEO: Check if videoData exists (same condition as Veo Downloader)
          if (videoData) {
            const generatedVideo = videoData.generatedVideo || {};
            const fifeUri = videoData.fifeUri || '';
            const servingBaseUri = videoData.servingBaseUri || ''; // Thumbnail
            const mediaTitle = rawPrompt || generatedVideo.prompt || '';

            // Use raw mediaGenerationId for lookup (same as Veo Downloader)
            const mediaGenerationId = generatedVideo.mediaGenerationId;

            // Check if this video has a 4K upscaled version
            const upscaled4K = upscaledMap.get(mediaGenerationId);

            // Debug logging
            if (upscaled4K) {
              matchCount++;
              console.log(`[DEBUG] MATCH: type=${typeof mediaGenerationId}, id=${JSON.stringify(mediaGenerationId)?.slice(0, 60)}`);
            } else {
              noMatchCount++;
              // Only log first few non-matches to avoid spam
              if (noMatchCount <= 5) {
                console.log(`[DEBUG] NO MATCH: type=${typeof mediaGenerationId}, id=${JSON.stringify(mediaGenerationId)?.slice(0, 60)}`);
              }
            }

            if (fifeUri) {
              items.push({
                type: 'video',
                url: fifeUri,
                thumbnail_url: servingBaseUri || '',
                prompt: mediaTitle,
                model: videoModelLabel,
                aspect: generatedVideo.aspectRatio || '',
                seed: generatedVideo.seed,
                media_generation_id: mediaGenerationId || '',
                // 4K upscaled version info
                has4K: !!upscaled4K,
                upscaled4K: upscaled4K || null,
              });
            }
          } else if (imageData) {
            // IMAGE: Check if imageData exists (same condition as Veo Downloader)
            const generatedImage = imageData.generatedImage || {};
            const fifeUri = imageData.fifeUri || imageData.fifeUrl || '';
            const mediaTitle = rawPrompt || generatedImage.prompt || '';
            // Extract mediaId (Base64 format for API calls) - same as Veo Downloader
            const base64MediaId = gen.mediaId;
            const mediaGenerationId = base64MediaId || (typeof gen.mediaGenerationId === 'string' ? gen.mediaGenerationId : gen.mediaGenerationId?.mediaKey) || '';
            const imageModelKey = generatedImage.modelNameType || '';
            const imageModelLabel = IMAGE_KEY_TO_DISPLAY[imageModelKey] || imageModelKey || '';

            if (fifeUri) {
              items.push({
                type: 'image',
                url: fifeUri,
                prompt: mediaTitle,
                model: imageModelLabel,
                aspect: generatedImage.aspectRatio || '',
                seed: generatedImage.seed,
                media_generation_id: mediaGenerationId,
              });
            }
          }
        });
      });
    });

    console.log(`[DEBUG] ========== SUMMARY ==========`);
    console.log(`[DEBUG] Total videos with 4K match: ${matchCount}`);
    console.log(`[DEBUG] Total videos without 4K match: ${noMatchCount}`);
    console.log(`[DEBUG] upscaledMap size: ${upscaledMap.size}`);
  } catch (e) {
    console.error('Parse workflows error:', e);
  }
  return items;
}

/**
 * Fetch workflows from Flow API (single request per media type, pageSize 99999).
 */
async function fetchWorkflowsFromFlow(state, mediaType = null) {
  if (!state.api_client || !state.auth_state.project_id) {
    state._log('[DEBUG] History: skip Flow fetch (no api_client or project_id)');
    return [];
  }

  const items = [];
  const mediaTypes = mediaType ? [mediaType] : ['MEDIA_TYPE_IMAGE', 'MEDIA_TYPE_VIDEO'];
  const pageSize = 99999;

  state._log('[DEBUG] History: fetching workflows from Flow');

  for (const mt of mediaTypes) {
    try {
      const input = {
        json: {
          pageSize,
          projectId: state.auth_state.project_id,
          toolName: 'PINHOLE',
          fetchBookmarked: false,
          rawQuery: '',
          mediaType: mt,
        },
        meta: {
          values: { cursor: ['undefined'] },
        },
      };

      state._log(`[DEBUG] History: request mediaType=${mt}`);

      const url = `${API_PROJECT_SEARCH_WORKFLOWS}?input=${encodeURIComponent(JSON.stringify(input))}`;
      const result = await state.api_client.get(url);

      if (!result.success || !result.data) {
        state._log(`[DEBUG] History: ${mt} failed or no data (success=${result.success}, status=${result?.status}, error=${result?.error || 'none'})`);
        continue;
      }

      const workflows = result.data?.result?.data?.json?.result?.workflows || [];
      const parsed = parseWorkflowsResponse({
        result: { data: { json: { result: { workflows } } } },
      });
      items.push(...parsed);
      state._log(`[DEBUG] History: ${mt} got ${workflows.length} workflows, parsed ${parsed.length} items`);
    } catch (e) {
      state._log(`Failed to fetch ${mt} workflows: ${e.message}`);
    }
  }

  state._log(`[DEBUG] History: Flow fetch done, ${items.length} items from workflows`);
  return items;
}

export function registerHistory(app) {
  app.get('/api/flow/history', async (req, res) => {
    const state = req.app.state;
    const items = state?.generated_items || [];
    const typeParam = req.query.type;
    const mediaType = typeParam === 'videos' ? 'MEDIA_TYPE_VIDEO' : typeParam === 'images' ? 'MEDIA_TYPE_IMAGE' : null;

    state._log('[DEBUG] History: GET /api/history (generated_items=' + items.length + ', type=' + (typeParam || 'all') + ')');

    // Also fetch existing media from Flow project
    try {
      const flowItems = await fetchWorkflowsFromFlow(state, mediaType);

      // Merge: Flow items first (older), then generated items (newer)
      // Use a Set to deduplicate by URL
      const urlSet = new Set();
      const merged = [];

      // Add Flow items first
      for (const item of flowItems) {
        if (item.url && !urlSet.has(item.url)) {
          urlSet.add(item.url);
          merged.push(item);
        }
      }

      // Add generated items (may override Flow items with same URL)
      for (const item of items) {
        if (item.url && !urlSet.has(item.url)) {
          urlSet.add(item.url);
          merged.push(item);
        }
      }

      state._log(`[DEBUG] History: merged ${merged.length} items (flow=${flowItems.length}, generated=${items.length})`);
      res.json({ items: merged });
    } catch (e) {
      // If Flow fetch fails, just return generated_items
      state._log(`History fetch error: ${e.message}`);
      state._log(`[DEBUG] History: fallback to generated_items only (${items.length} items)`);
      res.json({ items });
    }
  });
}
