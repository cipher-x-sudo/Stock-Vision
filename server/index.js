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
app.use(express.json({ limit: "50mb" }));

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
        const dataUrl = `data:${mimeType};base64,${part.inlineData.data}`;
        return res.json({ image: dataUrl });
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

    // Extract base64 data and mime type from data URL
    const match = image.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!match) {
      return res.status(400).json({ error: "Invalid image data URL format" });
    }
    const [, mimeType, base64Data] = match;

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
        const dataUrl = `data:${outMime};base64,${part.inlineData.data}`;
        return res.json({ image: dataUrl });
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
    const keywords = JSON.parse(response.text || "[]");
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

    const parsed = JSON.parse(response.text || "{}");
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
    const events = JSON.parse(response.text || "[]");
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

Generate 20 distinct image prompts for Nano Banana Pro. Each prompt must be a single image (no video). Vary scene, style, composition, lighting, and color.`;

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
            
            Output ONLY a JSON array of 20 image prompt objects.`
          }]
        },
        generationConfig: {
          temperature: 0.85, // Higher creativity to avoid repetition
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

    res.json({ prompts: allPrompts });
  } catch (err) {
    console.error("Generate prompts error:", err.message || err);
    res.status(500).json({ error: err.message || "Prompt generation failed" });
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
