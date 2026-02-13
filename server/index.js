/**
 * Authenticated proxy for trackadobestock.com.
 * Uses same URL, cookies, and headers as reverse_search.py.
 * Credentials from env; never exposed to the frontend.
 */
import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";

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

// ── Serve Vite-built frontend in production ───────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
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
