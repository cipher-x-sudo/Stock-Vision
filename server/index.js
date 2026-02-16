/**
 * Authenticated proxy for trackadobestock.com.
 * Uses same URL, cookies, and headers as reverse_search.py.
 * Credentials from env; never exposed to the frontend.
 */
import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";
import { parseCalendarCsv, filterEventsNext90Days } from "./eventCalendar.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const PORT = process.env.PORT || 3001;
const app = express();

app.use(cors({ origin: true }));
app.use(cors({ origin: true }));
app.use(express.json({ limit: "50mb" }));
app.use("/api/videos", express.static(path.join(__dirname, "generated_videos")));

// Configure Storage
const STORAGE_DIR = process.env.STORAGE_DIR || path.join(__dirname, "storage");
const VIDEOS_DIR = path.join(STORAGE_DIR, "videos");
const IMAGES_DIR = path.join(STORAGE_DIR, "images");
const BATCHES_DIR = path.join(STORAGE_DIR, "batches");

[VIDEOS_DIR, IMAGES_DIR, BATCHES_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Serve storage statically
app.use("/api/storage", express.static(STORAGE_DIR));

// ── Cleanup Utility ───────────────────────────────────────────
function cleanupOldFiles(dir, maxAgeMs) {
  fs.readdir(dir, (err, files) => {
    if (err) return console.error(`Cleanup read error for ${dir}:`, err);
    const now = Date.now();
    files.forEach(file => {
      const filePath = path.join(dir, file);
      fs.stat(filePath, (err, stats) => {
        if (err) return;
        if (now - stats.mtimeMs > maxAgeMs) {
          fs.unlink(filePath, (err) => {
            if (err) console.error(`Failed to delete old file ${file}:`, err);
            else console.log(`Deleted old file: ${file}`);
          });
        }
      });
    });
  });
}

// Run cleanup daily (7 days retention)
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
setInterval(() => {
  [VIDEOS_DIR, IMAGES_DIR, BATCHES_DIR].forEach(dir => cleanupOldFiles(dir, RETENTION_MS));
}, 24 * 60 * 60 * 1000);

// Run once on startup
[VIDEOS_DIR, IMAGES_DIR, BATCHES_DIR].forEach(dir => cleanupOldFiles(dir, RETENTION_MS));

function getCookieHeader() {
  if (process.env.TRACK_ADOBE_COOKIES) {
    return process.env.TRACK_ADOBE_COOKIES.trim();
  }
  const session = process.env.TRACK_ADOBE_SESSION_TOKEN;
  const csrf = process.env.TRACK_ADOBE_CSRF_TOKEN;
  const callback = process.env.TRACK_ADOBE_CALLBACK_URL || "https%3A%2F%2Ftrackadobestock.com";
  const stripe = process.env.TRACK_ADOBE_STRIPE_MID || "";
  if (!session || !csrf) return null;
  const parts = [];
  if (stripe) parts.push(`__stripe_mid=${stripe}`);
  parts.push(`__Host-next-auth.csrf-token=${csrf}`);
  parts.push(`__Secure-next-auth.callback-url=${callback}`);
  parts.push(`__Secure-next-auth.session-token=${session}`);
  return parts.join("; ");
}

const TRACK_HEADERS = {
  accept: "*/*",
  "accept-language": "en-GB,en;q=0.9,ur-PK;q=0.8,ur;q=0.7,en-US;q=0.6",
  "cache-control": "no-cache",
  pragma: "no-cache",
  referer: "https://trackadobestock.com/search",
  rsc: "1",
  "next-router-state-tree":
    "%5B%22%22%2C%7B%22children%22%3A%5B%22search%22%2C%7B%22children%22%3A%5B%22__PAGE__%22%2C%7B%7D%2Cnull%2Cnull%5D%7D%2Cnull%2Cnull%5D%7D%2Cnull%2Cnull%2Ctrue%5D",
  "next-url": "/search",
  "sec-ch-ua": '"Not(A:Brand";v="8", "Chromium";v="144", "Google Chrome";v="144"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-origin",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36",
};

function mapImages(data) {
  return (data.images || []).map((img) => {
    const keywords = img.keywords;
    const kwList =
      typeof keywords === "string"
        ? keywords
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean)
        : Array.isArray(keywords) ? keywords : [];
    return {
      id: img.id ?? "",
      title: img.title ?? "",
      downloads: img.downloads ?? "",
      premium: img.premium ?? "",
      creator: img.creator ?? "",
      creatorId: img.creatorId,
      mediaType: img.mediaType ?? "",
      category: img.category,
      contentType: img.contentType,
      dimensions: img.dimensions ?? "",
      uploadDate: img.creationDate ?? "",
      keywords: kwList,
      thumbnailUrl: img.thumbnailUrl ?? "",
      isAI: img.isAI === true,
    };
  });
}

function parseRscResponse(content) {
  const marker = '{"query":"';
  const startIdx = content.indexOf(marker);
  if (startIdx === -1) return null;
  let depth = 0;
  for (let i = startIdx; i < content.length; i++) {
    if (content[i] === "{") depth++;
    else if (content[i] === "}") {
      depth--;
      if (depth === 0) {
        const jsonStr = content.substring(startIdx, i + 1);
        return JSON.parse(jsonStr);
      }
    }
  }
  return null;
}

app.get("/api/track-adobe", async (req, res) => {
  const cookieHeader = getCookieHeader();
  if (!cookieHeader) {
    res.status(503).json({
      error: "TrackAdobe auth not configured",
      message: "Set TRACK_ADOBE_COOKIES or TRACK_ADOBE_SESSION_TOKEN + TRACK_ADOBE_CSRF_TOKEN in server env.",
    });
    return;
  }

  const q = req.query.q;
  if (!q || typeof q !== "string") {
    res.status(400).json({ error: "Missing query parameter: q" });
    return;
  }
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const aiOnly = req.query.ai_only === "1" || req.query.ai_only === "true";
  const contentType = req.query.content_type; // photo, video, vector, illustration

  const encodedQuery = encodeURIComponent(q);
  let url = `https://trackadobestock.com/search?q=${encodedQuery}`;
  if (aiOnly) url += "&generative_ai=only";
  if (contentType && contentType !== 'all') url += `&content_type=${contentType}`;
  if (page > 1) url += `&page=${page}`;
  url += "&_rsc=1gn38";

  const headers = { ...TRACK_HEADERS, cookie: cookieHeader };

  try {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      res.status(response.status).json({
        error: "TrackAdobe request failed",
        status: response.status,
      });
      return;
    }
    const content = await response.text();
    const data = parseRscResponse(content);
    if (!data) {
      res.json({ images: [], usage: {} });
      return;
    }
    let images = mapImages(data);
    if (aiOnly && images.length > 0) {
      const aiFiltered = images.filter((img) => img.isAI === true);
      if (aiFiltered.length > 0) images = aiFiltered;
    }
    res.json({ images, usage: data.usageData || {} });
  } catch (err) {
    console.error("TrackAdobe proxy error:", err);
    res.status(502).json({
      error: "TrackAdobe proxy error",
      message: err.message,
    });
  }
});

// ── History API ───────────────────────────────────────────────
app.get("/api/history/batches", (req, res) => {
  fs.readdir(BATCHES_DIR, (err, files) => {
    if (err) return res.status(500).json({ error: "Failed to read history" });

    // Sort by modification time (newest first)
    const batches = files
      .filter(f => f.endsWith(".json") && f.startsWith("batch-"))
      .map(f => {
        const filePath = path.join(BATCHES_DIR, f);
        try {
          const stats = fs.statSync(filePath);
          // Try to get count from content without reading whole large file if possible, 
          // or just read it since batches aren't huge.
          const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          return {
            filename: f,
            date: stats.mtime.toISOString(),
            count: Array.isArray(content) ? content.length : 0,
            timestamp: stats.mtimeMs
          };
        } catch (e) {
          return null;
        }
      })
      .filter(Boolean)
      .sort((a, b) => b.timestamp - a.timestamp);

    res.json({ batches });
  });
});

app.get("/api/history/batches/:filename", (req, res) => {
  const filename = req.params.filename;
  // Security check: ensure no path traversal
  if (!filename.match(/^batch-[\w.-]+\.json$/)) {
    return res.status(400).json({ error: "Invalid filename" });
  }
  const filePath = path.join(BATCHES_DIR, filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "Batch not found" });
  }
  res.sendFile(filePath);
});


// ── Image Generation (Nano Banana Pro) ────────────────────────
app.post("/api/generate-image", async (req, res) => {
  try {
    const p = req.body;
    if (!p || !p.scene) {
      return res.status(400).json({ error: "Missing prompt data (scene required)" });
    }

    // Build a rich prompt from structured fields
    const parts = [
      p.scene,
      p.style ? `Style: ${p.style}` : "",
      p.shot?.composition ? `Composition: ${p.shot.composition}` : "",
      p.shot?.lens ? `Lens: ${p.shot.lens}` : "",
      p.lighting?.primary ? `Lighting: ${p.lighting.primary}` : "",
      p.color_palette?.background ? `Background color: ${p.color_palette.background}` : "",
      p.color_palette?.ink_primary ? `Primary color: ${p.color_palette.ink_primary}` : "",
      p.constraints?.length ? `Constraints: ${p.constraints.join(", ")}` : "",
      p.negativePrompt ? `Avoid: ${p.negativePrompt}` : "",
    ].filter(Boolean).join(". ");

    // Build imageConfig from settings
    const imageConfig = {};
    if (p.aspectRatio) imageConfig.aspectRatio = p.aspectRatio;
    if (p.imageSize) imageConfig.imageSize = p.imageSize;

    const response = await genai.models.generateContent({
      model: "gemini-3-pro-image-preview",
      contents: parts,
      config: {
        responseModalities: ["image", "text"],
        ...(Object.keys(imageConfig).length > 0 && { imageConfig }),
      },
    });

    // Extract image from response
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        const mimeType = part.inlineData.mimeType || "image/png";
        const base64Data = part.inlineData.data;
        const dataUrl = `data:${mimeType};base64,${base64Data}`;

        // Save to storage
        const filename = `img-${Date.now()}-${Math.random().toString(36).substr(2, 6)}.png`;
        const filePath = path.join(IMAGES_DIR, filename);
        fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));

        const fileUrl = `/api/storage/images/${filename}`;

        return res.json({ image: dataUrl, url: fileUrl });
      }
    }

    return res.status(422).json({ error: "Model returned no image. Try a different prompt." });
  } catch (err) {
    console.error("Image generation error:", err.message || err);
    return res.status(500).json({ error: err.message || "Image generation failed" });
  }
});

// ── 4K Upscale (Nano Banana Pro) ──────────────────────────────
app.post("/api/upscale-image", async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ error: "Missing image data" });
    }

    let mimeType, base64Data;

    // Check if input is a URL (from our storage)
    if (image.startsWith("/api/storage/")) {
      // Resolve URL to local file path
      const relPath = image.replace("/api/storage", "");
      const filePath = path.join(STORAGE_DIR, relPath);

      if (fs.existsSync(filePath)) {
        const buffer = fs.readFileSync(filePath);
        base64Data = buffer.toString('base64');
        mimeType = "image/png"; // Assume PNG for now
        if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) mimeType = "image/jpeg";
      } else {
        return res.status(404).json({ error: "Source image file not found on server" });
      }
    } else {
      // Assume Base64 Data URL
      const match = image.match(/^data:(image\/\w+);base64,(.+)$/);
      if (!match) {
        return res.status(400).json({ error: "Invalid image data URL format or file path" });
      }
      mimeType = match[1];
      base64Data = match[2];
    }

    const response = await genai.models.generateContent({
      model: "gemini-3-pro-image-preview",
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64Data,
              },
            },
            {
              text: "Upscale this image to the highest possible resolution. Keep every detail, color, and composition exactly the same. Do not change, add, or remove anything — only increase the resolution.",
            },
          ],
        },
      ],
      config: {
        responseModalities: ["image", "text"],
        imageConfig: {
          imageSize: "4K",
        },
      },
    });

    // Extract upscaled image
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        const outMime = part.inlineData.mimeType || "image/png";
        const outBase64 = part.inlineData.data;
        const dataUrl = `data:${outMime};base64,${outBase64}`;

        // Save upscaled image
        const filename = `upscale-${Date.now()}-${Math.random().toString(36).substr(2, 6)}.png`;
        const filePath = path.join(IMAGES_DIR, filename);
        fs.writeFileSync(filePath, Buffer.from(outBase64, 'base64'));

        const fileUrl = `/api/storage/images/${filename}`;

        return res.json({ image: dataUrl, url: fileUrl });
      }
    }

    return res.status(422).json({ error: "Model returned no upscaled image." });
  } catch (err) {
    console.error("Upscale error:", err.message || err);
    return res.status(500).json({ error: err.message || "Upscale failed" });
  }
});

// ── Gemini helper: cascading fallback ─────────────────────────
async function generateWithFallback(
  parameters,
  fallbackModels = ["gemini-2.5-flash", "gemini-2.0-flash"]
) {
  const models = [parameters.model, ...fallbackModels];
  let lastError;
  for (let i = 0; i < models.length; i++) {
    try {
      return await genai.models.generateContent({
        ...parameters,
        model: models[i],
      });
    } catch (error) {
      lastError = error;
      const msg = error?.message || "";
      const status = error?.status || "";
      const isRetryable =
        msg.includes("500") || msg.includes("503") || msg.includes("429") ||
        msg.includes("RESOURCE_EXHAUSTED") || msg.includes("overloaded") ||
        msg.includes("rate") || msg.includes("quota") ||
        status === "INTERNAL" || status === "UNAVAILABLE" || status === "RESOURCE_EXHAUSTED";
      if (isRetryable && i < models.length - 1) {
        console.warn(`Model ${models[i]} failed (${msg.slice(0, 80)}), falling back to ${models[i + 1]}`);
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

// ── Generate Keywords ─────────────────────────────────────────
app.post("/api/generate-keywords", async (req, res) => {
  try {
    const { eventName } = req.body;
    if (!eventName) return res.status(400).json({ error: "Missing eventName" });

    const response = await generateWithFallback({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [{
          text: `For the event "${eventName}", return 18 search keywords that work well on stock photo sites (Adobe Stock). Use SHORT terms only: single words or two-word phrases. Examples of good format: romantic, red, glitter, hearts, background, shimmering, bokeh, valentine, day, promotions, wedding, invitations, love, couple, gift. Do NOT use long descriptive sentences or full phrases. Return a JSON string array of 18 such keywords.`
        }]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: { type: "ARRAY", items: { type: "STRING" } }
      }
    });
    let rawText = response.text || "[]";
    rawText = rawText.replace(/```json\n?|\n?```/g, "").trim();
    const keywords = JSON.parse(rawText);
    res.json({ keywords });
  } catch (err) {
    console.error("Generate keywords error:", err.message || err);
    res.status(500).json({ error: err.message || "Keyword generation failed" });
  }
});

// ── Analyze Market Data ───────────────────────────────────────
app.post("/api/analyze-market", async (req, res) => {
  try {
    const { eventName, rawData } = req.body;
    if (!eventName) return res.status(400).json({ error: "Missing eventName" });

    const MAX_ITEMS = 200;
    const slice = (rawData || []).slice(0, MAX_ITEMS);
    const assetSummaries = slice.map((img, i) => ({
      rank: i + 1,
      title: img.title,
      downloads: img.downloads,
      creator: img.creator,
      creatorId: img.creatorId,
      mediaType: img.mediaType,
      category: img.category,
      contentType: img.contentType,
      dimensions: img.dimensions,
      uploadDate: img.uploadDate,
      keywords: img.keywords?.slice(0, 20),
      isAI: img.isAI,
      premium: img.premium,
    }));

    const dataString = (rawData || []).length > 0 ? JSON.stringify(assetSummaries) : "NO_DATA";
    const truncatedNote = (rawData || []).length > MAX_ITEMS ? ` (Showing top ${MAX_ITEMS} of ${(rawData || []).length} total assets.)` : "";

    const response = await generateWithFallback({
      model: "gemini-3-pro-preview",
      contents: {
        parts: [{
          text: `
You are an Adobe Stock market analyst. I searched AdobeStock for the event "${eventName}" and retrieved ${(rawData || []).length} filtered assets.${truncatedNote}

Here is the FULL market data from TrackAdobe Stock (each asset with title, downloads, creator, media type, category, upload date, keywords, and AI flag):
${dataString === "NO_DATA" ? "No data was available from AdobeStock. Use Google Search to find actual top-performing Adobe Stock assets for this event." : dataString}

Your task:
1. **Top Sellers**: Identify which specific assets or styles are getting the MOST downloads. Name the top patterns, styles, and subjects that buyers are purchasing.
2. **What to Create**: Based on what's selling well, suggest 6-8 specific content ideas we MUST create to compete. For each, explain WHY it works based on the market data (e.g. "similar assets averaging 500+ downloads").
3. **Trends**: Provide projected monthly demand vs. content saturation for this event (4-6 months).

Be data-driven. Reference actual download counts and patterns from the data. Response MUST be JSON.`
        }]
      },
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            brief: {
              type: "OBJECT",
              properties: {
                event: { type: "STRING" },
                bestSellers: { type: "ARRAY", items: { type: "STRING" } },
                shotList: {
                  type: "ARRAY",
                  items: {
                    type: "OBJECT",
                    properties: {
                      idea: { type: "STRING" },
                      type: { type: "STRING" },
                      description: { type: "STRING" },
                      whyItWorks: { type: "STRING" }
                    },
                    required: ["idea", "type", "description", "whyItWorks"]
                  }
                }
              },
              required: ["event", "bestSellers", "shotList"]
            },
            trends: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  month: { type: "STRING" },
                  demand: { type: "NUMBER" },
                  saturation: { type: "NUMBER" }
                },
                required: ["month", "demand", "saturation"]
              }
            }
          },
          required: ["brief", "trends"]
        }
      }
    });

    let rawText = response.text || "{}";
    rawText = rawText.replace(/```json\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(rawText);
    const sources = (response.candidates?.[0]?.groundingMetadata?.groundingChunks || []);
    res.json({ ...parsed, insights: rawData || [], sources });
  } catch (err) {
    console.error("Analyze market error:", err.message || err);
    res.status(500).json({ error: err.message || "Market analysis failed" });
  }
});

// ── Suggested Events ──────────────────────────────────────────
app.get("/api/suggested-events", async (req, res) => {
  try {
    const csvPath = path.join(__dirname, "..", "event_calendar_2026.csv");
    const csv = fs.readFileSync(csvPath, "utf-8");
    const allEvents = parseCalendarCsv(csv);
    const filtered = filterEventsNext90Days(allEvents);
    if (filtered.length === 0) return res.json({ events: [] });

    const today = new Date();
    const todayIso = today.toISOString().slice(0, 10);
    const eventListText = filtered.map((e) => `${e.name} (${e.dateIso})`).join("\n");

    const response = await generateWithFallback({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [{
          text: `Today is ${todayIso}. The following events fall between today and 90 days from today. From this list, select the 8-10 most commercially relevant for stock/visual content. Return each with date in ISO format (YYYY-MM-DD), category (e.g. Holiday, Seasonal, Global Event), short description, and icon (FontAwesome class such as fa-solid fa-gift).\n\nEvents:\n${eventListText}`
        }]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              name: { type: "STRING" },
              date: { type: "STRING" },
              category: { type: "STRING" },
              description: { type: "STRING" },
              icon: { type: "STRING" }
            },
            required: ["name", "date", "category", "description", "icon"]
          }
        }
      }
    });
    let rawText = response.text || "[]";
    rawText = rawText.replace(/```json\n?|\n?```/g, "").trim();
    const events = JSON.parse(rawText);
    res.json({ events });
  } catch (err) {
    console.error("Suggested events error:", err.message || err);
    res.status(500).json({ error: err.message || "Suggested events failed" });
  }
});

// ── Generate Image Prompts ────────────────────────────────────
const IMAGE_PROMPT_SCHEMA = {
  type: "OBJECT",
  properties: {
    scene: { type: "STRING" },
    style: { type: "STRING" },
    constraints: { type: "ARRAY", items: { type: "STRING" } },
    shot: {
      type: "OBJECT",
      properties: {
        composition: { type: "STRING" },
        resolution: { type: "STRING" },
        lens: { type: "STRING" }
      },
      required: ["composition", "resolution", "lens"]
    },
    lighting: {
      type: "OBJECT",
      properties: {
        primary: { type: "STRING" },
        secondary: { type: "STRING" },
        accents: { type: "STRING" }
      },
      required: ["primary", "secondary", "accents"]
    },
    color_palette: {
      type: "OBJECT",
      properties: {
        background: { type: "STRING" },
        ink_primary: { type: "STRING" },
        ink_secondary: { type: "STRING" },
        text_primary: { type: "STRING" }
      },
      required: ["background", "ink_primary", "ink_secondary", "text_primary"]
    },
    visual_rules: {
      type: "OBJECT",
      properties: {
        prohibited_elements: { type: "ARRAY", items: { type: "STRING" } },
        grain: { type: "STRING" },
        sharpen: { type: "STRING" }
      },
      required: ["prohibited_elements", "grain", "sharpen"]
    },
    metadata: {
      type: "OBJECT",
      properties: {
        series: { type: "STRING" },
        task: { type: "STRING" },
        scene_number: { type: "STRING" },
        tags: { type: "ARRAY", items: { type: "STRING" } }
      },
      required: ["series", "task", "scene_number", "tags"]
    },
    unique_id: { type: "STRING" } // Helper for deduplication
  },
  required: ["scene", "style", "constraints", "shot", "lighting", "color_palette", "visual_rules", "metadata"]
};

function normalizeImagePrompt(p) {
  return {
    scene: p.scene ?? "",
    style: p.style ?? "",
    constraints: Array.isArray(p.constraints) ? p.constraints : ["SILENT_OUTPUT"],
    shot: {
      composition: p.shot?.composition ?? "",
      resolution: p.shot?.resolution ?? "1920 × 1080",
      lens: p.shot?.lens ?? ""
    },
    lighting: {
      primary: p.lighting?.primary ?? "",
      secondary: p.lighting?.secondary ?? "",
      accents: p.lighting?.accents ?? ""
    },
    color_palette: {
      background: p.color_palette?.background ?? "",
      ink_primary: p.color_palette?.ink_primary ?? "",
      ink_secondary: p.color_palette?.ink_secondary ?? "",
      text_primary: p.color_palette?.text_primary ?? ""
    },
    visual_rules: {
      prohibited_elements: Array.isArray(p.visual_rules?.prohibited_elements) ? p.visual_rules.prohibited_elements : [],
      grain: p.visual_rules?.grain ?? "none",
      sharpen: p.visual_rules?.sharpen ?? "none"
    },
    metadata: {
      series: p.metadata?.series ?? "",
      task: p.metadata?.task ?? "",
      scene_number: p.metadata?.scene_number ?? "",
      tags: Array.isArray(p.metadata?.tags) ? p.metadata.tags : []
    }
  };
}

app.post("/api/generate-prompts", async (req, res) => {
  try {
    const { eventName, brief } = req.body;
    if (!eventName || !brief) return res.status(400).json({ error: "Missing eventName or brief" });

    const imageItems = (brief.shotList || []).filter((s) => s.type === "Image");
    const shotListText = imageItems.length > 0
      ? imageItems.map((s) => `- ${s.idea}: ${s.description}`).join("\n")
      : (brief.bestSellers || []).slice(0, 10).join(", ");

    const promptIntro = `
Event: ${eventName}
Top sellers: ${(brief.bestSellers || []).join(", ")}
Shot ideas (Image only):\n${shotListText}

Generate 25 distinct image prompts for Nano Banana Pro. Each prompt must be a single image (no video). Vary scene, style, composition, lighting, and color.`;

    const allPrompts = [];
    const seenScenes = new Set();

    // Diversity strategies for each batch
    const batchDirectives = [
      "Focus on commercial, high-value stock photography. Clean, bright, professional.",
      "Focus on creative, artistic, and abstract interpretations. Unique angles and lighting.",
      "Focus on authentic lifestyle, candid moments, and emotional connection.",
      "Focus on detailed close-ups, textures, objects, and macro photography."
    ];

    const batches = 4;
    for (let b = 0; b < batches; b++) {
      // Collect recent scenes to avoid repetition
      const recentScenes = allPrompts.map(p => p.scene).slice(-40).join(" | ");
      const avoidance = recentScenes ? `\n\nDO NOT REPEAT these exact concepts: ${recentScenes}` : "";

      const response = await generateWithFallback({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [{
            text: `${promptIntro}
            Batch ${b + 1}/${batches}.
            STYLE DIRECTIVE: ${batchDirectives[b] || "Ensure maximum variety."}
            ${avoidance}
            
            IMPORTANT: You MUST return a JSON array where each object EXACTLY matches the provided schema.
            Required keys per object: scene, style, constraints, shot (composition, resolution, lens), lighting (primary, secondary, accents), color_palette (background, ink_primary, ink_secondary, text_primary), visual_rules, metadata.
            Do NOT simplify or flatten the structure.`
          }]
        },
        config: {
          temperature: 0.85,
          responseMimeType: "application/json",
          responseSchema: {
            type: "ARRAY",
            items: IMAGE_PROMPT_SCHEMA
          }
        }
      });

      const parsed = JSON.parse(response.text || "[]");
      if (Array.isArray(parsed)) {
        for (const p of parsed) {
          // Simple deduplication based on scene start
          const sceneKey = (p.scene || "").substring(0, 20).toLowerCase();
          if (!seenScenes.has(sceneKey)) {
            seenScenes.add(sceneKey);
            allPrompts.push(normalizeImagePrompt(p));
          }
        }
      }
    }

    // Save prompts batch
    const batchFilename = `batch-${Date.now()}.json`;
    const batchPath = path.join(BATCHES_DIR, batchFilename);
    fs.writeFileSync(batchPath, JSON.stringify(allPrompts, null, 2));
    const batchUrl = `/api/storage/batches/${batchFilename}`;

    res.json({ prompts: allPrompts, url: batchUrl });
  } catch (err) {
    console.error("Generate prompts error:", err.message || err);
    res.status(500).json({ error: err.message || "Prompt generation failed" });
  }
});

// ── Generate Video (Director Mode + Veo) ──────────────────────
const DIRECTOR_TEMPLATE = JSON.parse(fs.readFileSync(path.join(__dirname, "director_template.json"), "utf8"));

app.post("/api/generate-video", async (req, res) => {
  try {
    const { image, prompt, fast } = req.body;
    if (!image) return res.status(400).json({ error: "Missing image data" });

    let mimeType, base64Data;
    // Check if input is a URL (from our storage)
    if (image.startsWith("/api/storage/")) {
      const relPath = image.replace("/api/storage", "");
      const filePath = path.join(STORAGE_DIR, relPath);
      if (fs.existsSync(filePath)) {
        const buffer = fs.readFileSync(filePath);
        base64Data = buffer.toString('base64');
        mimeType = "image/png";
        if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) mimeType = "image/jpeg";
      } else {
        return res.status(404).json({ error: "Source image file not found" });
      }
    } else {
      const match = image.match(/^data:(image\/\w+);base64,(.+)$/);
      if (!match) return res.status(400).json({ error: "Invalid image data" });
      mimeType = match[1];
      base64Data = match[2];
    }

    // 1. Generate Director's Plan (Gemini 2.0 Flash)
    const planResponse = await generateWithFallback({
      model: "gemini-2.0-flash",
      contents: {
        parts: [
          {
            inlineData: { mimeType, data: base64Data }
          },
          {
            text: `You are a film director. Analyze this image and the user's request: "${prompt}".
Create a detailed video generation plan.
Output JSON matching this schema: ${JSON.stringify(DIRECTOR_TEMPLATE)}`
          }
        ]
      },
      config: { responseMimeType: "application/json" }
    });

    const plan = JSON.parse(planResponse.text || "{}");

    // 2. Generate Video via Veo (Mock for now or actual integration if key present)
    // For now, we'll simulate a video generation response since Veo API isn't fully public/integrated here yet
    // In a real scenario, you'd call the Veo API here.

    // START VEO INTEGRATION PLACEHOLDER
    // Note: To use Veo, you need access to the specific model (veo-2.0-generate-preview-001)
    // and potentially different API handling.

    let videoUrl = "";
    try {
      const veoResponse = await genai.models.generateContent({
        model: "veo-2.0-generate-preview-001",
        contents: [
          {
            parts: [
              { text: `Create a video based on this image. Prompt: ${plan.prompt || prompt}` },
              { inlineData: { mimeType, data: base64Data } }
            ]
          }
        ],
        config: {
          responseModalities: ["video"]
        }
      });

      // Extract video
      for (const part of veoResponse.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          const vidMime = part.inlineData.mimeType || "video/mp4";
          const vidData = part.inlineData.data;
          const vidFilename = `vid-${Date.now()}-${Math.random().toString(36).substr(2, 6)}.mp4`;
          const vidPath = path.join(VIDEOS_DIR, vidFilename);
          fs.writeFileSync(vidPath, Buffer.from(vidData, 'base64'));
          videoUrl = `/api/storage/videos/${vidFilename}`;
        }
      }
    } catch (veoErr) {
      console.warn("Veo generation failed, returning only plan:", veoErr.message);
      // Fallback or error handling
    }
    // END VEO INTEGRATION PLACEHOLDER

    res.json({ plan, videoUrl });

  } catch (err) {
    console.error("Video generation error:", err.message || err);
    res.status(500).json({ error: err.message || "Video generation failed" });
  }
});


// ── Generate Cloning Prompts (Vision) ─────────────────────────
app.post("/api/generate-cloning-prompts", async (req, res) => {
  try {
    const { images } = req.body; // Expects array of { url, title, id }
    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ error: "Missing images array" });
    }

    const results = [];

    // Process each image (limit to 5 to avoid timeouts/rate limits)
    for (const img of images.slice(0, 5)) {
      try {
        // 1. Fetch image data
        const imgRes = await fetch(img.url);
        if (!imgRes.ok) throw new Error(`Failed to fetch image: ${imgRes.status}`);
        const arrayBuffer = await imgRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64Data = buffer.toString('base64');
        const mimeType = imgRes.headers.get("content-type") || "image/jpeg";

        // 2. Analyze with Gemini Vision
        const response = await generateWithFallback({
          model: "gemini-2.0-flash", // Use a vision-capable details model
          contents: {
            parts: [
              { inlineData: { mimeType, data: base64Data } },
              {
                text: `Analyze this stock image (Title: "${img.title}").
                            Create a detailed image generation prompt to clone this exact style, composition, and subject.
                            Return a JSON object matching this schema:
                            {
                                "scene": "Detailed description of the scene content",
                                "style": "Artistic style, medium, and aesthetic",
                                "shot": { "composition": "Framing entry", "resolution": "4K", "lens": "Lens type" },
                                "lighting": { "primary": "Main light source", "secondary": "Fill light", "accents": "Highlights" },
                                "color_palette": { "background": "Bg color", "ink_primary": "Main color", "ink_secondary": "Sub color", "text_primary": "Text color or N/A" },
                                "visual_rules": { "prohibited_elements": ["watermark", "text"], "grain": "none", "sharpen": "standard" },
                                "metadata": { "series": "cloning", "task": "clone", "scene_number": "${img.id}", "tags": ["clone", "stock"] }
                            }`
              }
            ]
          },
          config: {
            responseMimeType: "application/json"
          }
        });

        const promptData = JSON.parse(response.text || "{}");
        results.push(normalizeImagePrompt(promptData));

      } catch (innerErr) {
        console.error(`Failed to clone image ${img.id}:`, innerErr.message);
        // Optionally push a fallback or error placeholder
      }
    }

    res.json({ prompts: results });

  } catch (err) {
    console.error("Cloning error:", err.message || err);
    res.status(500).json({ error: err.message || "Cloning failed" });
  }
});


// ── Serve Vite-built frontend in production ───────────────────
const distPath = path.join(__dirname, "..", "dist");
app.use(express.static(distPath));
app.get("*", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

app.listen(PORT, () => {
  console.log(`TrackAdobe proxy listening on http://localhost:${PORT}`);
  if (!getCookieHeader()) {
    console.warn("Warning: TrackAdobe auth not set. Set TRACK_ADOBE_COOKIES or TRACK_ADOBE_SESSION_TOKEN + TRACK_ADOBE_CSRF_TOKEN.");
  }
}).on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`\nPort ${PORT} is already in use (another server may be running).`);
    console.error("Free the port then run npm start again.");
    console.error("Windows (PowerShell):");
    console.error(`  Get-NetTCPConnection -LocalPort ${PORT} -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }`);
    console.error("Or close the terminal/task that is using port " + PORT + ".\n");
    process.exit(1);
  }
  throw err;
});
