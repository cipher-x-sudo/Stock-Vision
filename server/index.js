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
import fsp from "fs/promises";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";
import { parseCalendarCsv, filterEventsNext90Days } from "./eventCalendar.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Multiple API keys: GEMINI_API_KEYS (comma-separated) or single GEMINI_API_KEY
const GEMINI_API_KEYS_ARRAY = process.env.GEMINI_API_KEYS
  ? process.env.GEMINI_API_KEYS.split(",").map((k) => k.trim()).filter(Boolean)
  : process.env.GEMINI_API_KEY
    ? [process.env.GEMINI_API_KEY]
    : [];

function getGeminiClient() {
  if (GEMINI_API_KEYS_ARRAY.length === 0) return null;
  const key = GEMINI_API_KEYS_ARRAY[Math.floor(Math.random() * GEMINI_API_KEYS_ARRAY.length)];
  return new GoogleGenAI({ apiKey: key });
}

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

const FAVORITES_DIR = path.join(STORAGE_DIR, "favorites");
if (!fs.existsSync(FAVORITES_DIR)) {
  fs.mkdirSync(FAVORITES_DIR, { recursive: true });
}
const FAV_CONTRIBUTORS_FILE = path.join(FAVORITES_DIR, "contributors.json");
if (!fs.existsSync(FAV_CONTRIBUTORS_FILE)) {
  fs.writeFileSync(FAV_CONTRIBUTORS_FILE, JSON.stringify([]));
}

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
  const markers = ['{"query":"', '{"contributorId":"', '{"search":"'];
  let startIdx = -1;
  let markerFound = "";

  for (const m of markers) {
    const idx = content.indexOf(m);
    if (idx !== -1) {
      if (startIdx === -1 || idx < startIdx) {
        startIdx = idx;
        markerFound = m;
      }
    }
  }

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
  const order = req.query.order; // relevance, nb_downloads, creation, featured

  const encodedQuery = encodeURIComponent(q);
  let url = `https://trackadobestock.com/search?q=${encodedQuery}`;
  if (aiOnly) url += "&generative_ai=only";
  if (contentType && contentType !== 'all') url += `&content_type=${contentType}`;
  if (order && order !== 'relevance') url += `&order=${order}`;
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

app.get("/api/track-contributor", async (req, res) => {
  const cookieHeader = getCookieHeader();
  if (!cookieHeader) {
    res.status(503).json({
      error: "TrackAdobe auth not configured",
    });
    return;
  }

  const q = req.query.q;
  if (!q) {
    res.status(400).json({ error: "Missing query parameter: q" });
    return;
  }
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const aiOnly = req.query.ai_only === "1" || req.query.ai_only === "true";
  const contentType = req.query.content_type || "all";
  const order = req.query.order || "relevance";

  const encodedQuery = encodeURIComponent(q);
  let url = `https://trackadobestock.com/contributor?search=${encodedQuery}&order=${order}&content_type=${contentType}&generative_ai=${aiOnly ? 'only' : 'all'}`;
  if (page > 1) url += `&page=${page}`;

  // Contributor pages need a normal HTML fetch, NOT an RSC fetch.
  // The TRACK_HEADERS contain rsc:1, next-url:/search which are wrong here.
  const headers = {
    "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "accept-language": "en-GB,en;q=0.9,ur-PK;q=0.8,ur;q=0.7,en-US;q=0.6",
    "cache-control": "no-cache",
    "pragma": "no-cache",
    "referer": "https://trackadobestock.com/contributor",
    "sec-ch-ua": '"Not:A-Brand";v="99", "Google Chrome";v="145", "Chromium";v="145"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "sec-fetch-dest": "document",
    "sec-fetch-mode": "navigate",
    "sec-fetch-site": "same-origin",
    "sec-fetch-user": "?1",
    "upgrade-insecure-requests": "1",
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
    "cookie": cookieHeader,
  };

  try {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      res.status(response.status).json({
        error: "TrackAdobe request failed",
        status: response.status,
      });
      return;
    }
    const html = await response.text();

    // Next.js embeds data via self.__next_f.push([1,"..."]) calls in <script> tags.
    // The payload is a huge double-escaped JSON string. We need to:
    // 1. Find each self.__next_f.push call
    // 2. Extract the full argument (handling nested brackets)
    // 3. JSON.parse the argument array to get the decoded string
    // 4. Search decoded strings for the images data
    let data = null;

    // Strategy 1: Try parseRscResponse on the raw HTML first
    data = parseRscResponse(html);

    // Strategy 2: Extract from self.__next_f.push payloads properly
    if (!data) {
      // The format is: self.__next_f.push([1, "ESCAPED_CONTENT"])
      // Note: there may or may not be whitespace after the comma.
      // Inside the string, all " are escaped as \", and \\ represents a literal backslash.
      // We use a regex to find each push call start, then track escape state to find string end.
      const pushPattern = /self\.__next_f\.push\(\[1,\s*"/g;
      let combined = "";
      let match;

      while ((match = pushPattern.exec(html)) !== null) {
        const strStart = match.index + match[0].length;
        // Find the end of the JSON string by tracking escape state
        let escaped = false;
        let strEnd = -1;
        for (let i = strStart; i < html.length; i++) {
          if (escaped) {
            escaped = false;
            continue;
          }
          if (html[i] === '\\') {
            escaped = true;
            continue;
          }
          if (html[i] === '"') {
            strEnd = i;
            break;
          }
        }

        if (strEnd === -1) continue;

        const rawStr = html.substring(strStart, strEnd);

        // Decode the escaped string — reconstruct as a JSON string and parse
        let decoded;
        try {
          decoded = JSON.parse('"' + rawStr + '"');
        } catch (_) {
          continue;
        }

        // Check if this decoded chunk contains the data we need
        if (decoded.includes('"images"') || decoded.includes('"contributorId"')) {
          combined += decoded;
        }
      }

      if (combined) {
        data = parseRscResponse(combined);

        // Fallback: parseRscResponse markers may not match contributor page data.
        // The images are nested inside React component tree like: ["$","$L25",null,{"images":[...]}]
        // Search directly for {"images":[ and extract the containing JSON object.
        if (!data) {
          const imgMarker = '"images":[';
          const imgIdx = combined.indexOf(imgMarker);
          if (imgIdx !== -1) {
            // Walk backwards to find the opening { of this object
            let objStart = -1;
            for (let i = imgIdx - 1; i >= 0; i--) {
              if (combined[i] === '{') { objStart = i; break; }
              if (combined[i] !== ',' && combined[i] !== '"' && combined[i] !== ' ' && combined[i] !== '\n') break;
            }
            if (objStart !== -1) {
              let depth = 0;
              for (let i = objStart; i < combined.length; i++) {
                if (combined[i] === '{') depth++;
                else if (combined[i] === '}') {
                  depth--;
                  if (depth === 0) {
                    try {
                      data = JSON.parse(combined.substring(objStart, i + 1));
                    } catch (_) { }
                    break;
                  }
                }
              }
            }
          }
        }
      }
    }

    if (!data) {
      console.warn("TrackAdobe contributor: could not parse response data from", url);
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
    console.error("TrackAdobe contributor proxy error:", err);
    res.status(502).json({
      error: "TrackAdobe proxy error",
      message: err.message,
    });
  }
});


app.get("/api/favorites/contributors", (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(FAV_CONTRIBUTORS_FILE, 'utf8'));
    res.json({ contributors: data });
  } catch (e) {
    res.status(500).json({ error: "Failed to read favorites" });
  }
});

app.post("/api/favorites/contributors", (req, res) => {
  const creator = req.body;
  if (!creator || !creator.id) {
    return res.status(400).json({ error: "Invalid creator" });
  }

  try {
    let favorites = JSON.parse(fs.readFileSync(FAV_CONTRIBUTORS_FILE, 'utf8'));
    const index = favorites.findIndex(f => f.id === creator.id);
    if (index > -1) {
      favorites.splice(index, 1);
      res.json({ success: true, action: "removed", contributors: favorites });
    } else {
      favorites.push(creator);
      res.json({ success: true, action: "added", contributors: favorites });
    }
    fs.writeFileSync(FAV_CONTRIBUTORS_FILE, JSON.stringify(favorites, null, 2));
  } catch (e) {
    res.status(500).json({ error: "Failed to update favorites" });
  }
});

// ── History API ───────────────────────────────────────────────

// ── History API (Server-Side Persistence) ─────────────────────
const HISTORY_DIR = path.join(STORAGE_DIR, "history");
if (!fs.existsSync(HISTORY_DIR)) {
  fs.mkdirSync(HISTORY_DIR, { recursive: true });
}

// Ensure cleanup for history too (optional, maybe keep longer?)
// [VIDEOS_DIR, IMAGES_DIR, BATCHES_DIR, HISTORY_DIR].forEach... 
// For now, let's NOT auto-delete history unless user requests.

// GET /api/history - List all history items
app.get("/api/history", (req, res) => {
  fs.readdir(HISTORY_DIR, (err, files) => {
    if (err) return res.status(500).json({ error: "Failed to read history" });

    const historyItems = files
      .filter(f => f.endsWith(".json"))
      .map(f => {
        const filePath = path.join(HISTORY_DIR, f);
        try {
          const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          return content;
        } catch (e) {
          return null;
        }
      })
      .filter(Boolean)
      .sort((a, b) => b.timestamp - a.timestamp); // Newest first

    res.json({ history: historyItems });
  });
});

// Helper to list files with metadata (specific routes must be before /api/history/:id)
const listFiles = (dir, urlPrefix) => {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .map(file => {
      const filePath = path.join(dir, file);
      try {
        const stats = fs.statSync(filePath);
        if (stats.isDirectory()) return null;
        return {
          filename: file,
          url: `${urlPrefix}/${file}`,
          timestamp: stats.mtimeMs,
          size: stats.size
        };
      } catch (e) {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.timestamp - a.timestamp);
};

// GET /api/history/images
app.get("/api/history/images", (req, res) => {
  try {
    const images = listFiles(IMAGES_DIR, "/api/storage/images");
    res.json({ images });
  } catch (e) {
    res.status(500).json({ error: "Failed to list images" });
  }
});

// DELETE /api/history/images/:filename
app.delete("/api/history/images/:filename", async (req, res) => {
  const filename = req.params.filename;
  // Basic sanity check to prevent directory traversal
  if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    return res.status(400).json({ error: "Invalid filename" });
  }
  const filePath = path.join(IMAGES_DIR, filename);
  try {
    await fsp.unlink(filePath);
    res.json({ success: true });
  } catch (e) {
    if (e.code === "ENOENT") return res.status(404).json({ error: "File not found" });
    res.status(500).json({ error: "Failed to delete file" });
  }
});

// GET /api/history/videos
app.get("/api/history/videos", (req, res) => {
  try {
    const videos = listFiles(VIDEOS_DIR, "/api/storage/videos");
    res.json({ videos });
  } catch (e) {
    res.status(500).json({ error: "Failed to list videos" });
  }
});

// DELETE /api/history/videos/:filename
app.delete("/api/history/videos/:filename", async (req, res) => {
  const filename = req.params.filename;
  if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) return res.status(400).json({ error: "Invalid filename" });

  const filePath = path.join(VIDEOS_DIR, filename);
  try {
    await fsp.unlink(filePath);
    res.json({ success: true });
  } catch (e) {
    if (e.code === "ENOENT") return res.status(404).json({ error: "File not found" });
    res.status(500).json({ error: "Failed to delete file" });
  }
});

// GET /api/history/batches (Enhanced)
app.get("/api/history/batches", (req, res) => {
  try {
    const batches = listFiles(BATCHES_DIR, "/api/storage/batches")
      .filter(b => b.filename.endsWith(".json"))
      .map(b => {
        // Optionally read count, or simpler just return basic metadata
        return b;
      });
    res.json({ batches });
  } catch (e) {
    res.status(500).json({ error: "Failed to list batches" });
  }
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

// DELETE /api/history/batches/:filename
app.delete("/api/history/batches/:filename", async (req, res) => {
  const filename = req.params.filename;
  if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) return res.status(400).json({ error: "Invalid filename" });

  const filePath = path.join(BATCHES_DIR, filename);
  try {
    await fsp.unlink(filePath);
    res.json({ success: true });
  } catch (e) {
    if (e.code === "ENOENT") return res.status(404).json({ error: "File not found" });
    res.status(500).json({ error: "Failed to delete file" });
  }
});

// GET /api/history/:id - Get specific item (dynamic route must be after specific paths)
app.get("/api/history/:id", (req, res) => {
  const filePath = path.join(HISTORY_DIR, `history-${req.params.id}.json`);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "Item not found" });
  }
  try {
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    res.json(content);
  } catch (e) {
    res.status(500).json({ error: "Failed to parse history item" });
  }
});

// POST /api/history - Create/Add item
app.post("/api/history", (req, res) => {
  const item = req.body;
  if (!item || !item.id) {
    return res.status(400).json({ error: "Invalid history item" });
  }
  const filePath = path.join(HISTORY_DIR, `history-${item.id}.json`);
  try {
    fs.writeFileSync(filePath, JSON.stringify(item, null, 2));
    res.json({ success: true, id: item.id });
  } catch (e) {
    console.error("Save history error:", e);
    res.status(500).json({ error: "Failed to save history" });
  }
});

// PUT /api/history/:id - Update item (e.g. add prompts)
app.put("/api/history/:id", (req, res) => {
  const id = req.params.id;
  const filePath = path.join(HISTORY_DIR, `history-${id}.json`);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "History item not found" });
  }

  try {
    const existing = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const updates = req.body;

    // Merge updates
    const updated = { ...existing, ...updates };

    fs.writeFileSync(filePath, JSON.stringify(updated, null, 2));
    res.json({ success: true, item: updated });
  } catch (e) {
    console.error("Update history error:", e);
    res.status(500).json({ error: "Failed to update history" });
  }
});

// DELETE /api/history/:id
app.delete("/api/history/:id", async (req, res) => {
  const id = req.params.id;
  const filePath = path.join(HISTORY_DIR, `history-${id}.json`);

  try {
    await fsp.unlink(filePath);
    res.json({ success: true });
  } catch (e) {
    if (e.code === "ENOENT") return res.status(404).json({ error: "Item not found" });
    res.status(500).json({ error: "Failed to delete item" });
  }
});

// ── Image Generation (Nano Banana Pro) ────────────────────────
app.post("/api/generate-image", async (req, res) => {
  try {
    const genai = getGeminiClient();
    if (!genai) return res.status(503).json({ error: "Gemini API key(s) not configured." });

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
      "CRITICAL AVOIDANCE: Ensure there is absolutely NO text, NO handwriting, NO branding, NO logos, NO watermarks, and NO typography anywhere in the scene"
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
    const genai = getGeminiClient();
    if (!genai) return res.status(503).json({ error: "Gemini API key(s) not configured." });

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
  fallbackModels = ["gemini-3-flash-preview", "gemini-2.5-flash", "gemini-2.5-flash-lite"]
) {
  const genai = getGeminiClient();
  if (!genai) throw new Error("Gemini API key(s) not configured.");
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
    if (err.message === "Gemini API key(s) not configured.") return res.status(503).json({ error: err.message });
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
      model: "gemini-3.1-pro-preview",
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
    if (err.message === "Gemini API key(s) not configured.") return res.status(503).json({ error: err.message });
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
    if (err.message === "Gemini API key(s) not configured.") return res.status(503).json({ error: err.message });
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
            Do NOT simplify or flatten the structure.
            CRITICAL INSTRUCTION: Enforce that all scenes and styles strictly prohibit text, handwriting, branding, logos, and watermarks. Include 'text', 'branding', 'logos', 'watermarks' in visual_rules.prohibited_elements.`
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
    if (err.message === "Gemini API key(s) not configured.") return res.status(503).json({ error: err.message });
    console.error("Generate prompts error:", err.message || err);
    res.status(500).json({ error: err.message || "Prompt generation failed" });
  }
});

// ── Video Plan Generation (Director Mode) ──────────────────────
const DIRECTOR_TEMPLATE = JSON.parse(fs.readFileSync(path.join(__dirname, "director_template.json"), "utf8"));

app.post("/api/generate-video-plan", async (req, res) => {
  try {
    const { image, prompt } = req.body;
    if (!image) return res.status(400).json({ error: "Missing image data" });

    let mimeType, base64Data;
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

    const planResponse = await generateWithFallback({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { inlineData: { mimeType, data: base64Data } },
          {
            text: `You are a film director. Analyze this image and the user's request: "${prompt}".\nCreate a detailed video generation plan.\nOutput JSON matching this schema: ${JSON.stringify(DIRECTOR_TEMPLATE)}`
          }
        ]
      },
      config: { responseMimeType: "application/json" }
    });

    const plan = JSON.parse(planResponse.text || "{}");
    res.json({ plan });

  } catch (err) {
    if (err.message === "Gemini API key(s) not configured.") return res.status(503).json({ error: err.message });
    console.error("Video plan generation error:", err.message || err);
    res.status(500).json({ error: err.message || "Video plan generation failed" });
  }
});

// ── Generate Video (Veo) ───────────────────────────────────────
app.post("/api/generate-video", async (req, res) => {
  // We may need more time for Veo processing. Express usually times out after a few minutes,
  // but we will do our best to poll. If Railway kills it at 100s, this may still fail.
  try {
    const genai = getGeminiClient();
    if (!genai) return res.status(503).json({ error: "Gemini API key(s) not configured." });

    const { image, prompt, plan, fast, videoAspectRatio, videoResolution } = req.body;
    if (!image) return res.status(400).json({ error: "Missing image data" });

    let mimeType, base64Data;
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

    const modelName = fast ? "veo-3.1-fast-generate-preview" : "veo-3.1-generate-preview";
    const baseVideoPrompt = plan?.prompt || plan?.scene || prompt || "A sleek cinematic video of this scene.";
    const videoPrompt = `${baseVideoPrompt}. Camera movements must be exceptionally smooth, cinematic, and professional. The overall visual quality and direction must be indistinguishable from a premium high-end stock video.`;

    console.log(`Starting Veo video generation (${modelName}) with prompt: ${videoPrompt.substring(0, 50)}...`);

    // Call the Veo specific endpoint
    let operation = await genai.models.generateVideos({
      model: modelName,
      prompt: videoPrompt,
      image: { imageBytes: base64Data, mimeType },
      config: {
        ...(videoAspectRatio && { aspectRatio: videoAspectRatio }),
        ...(videoResolution && { resolution: videoResolution })
      }
    });

    console.log("Operation started: ", operation.name);

    // Poll the operation status until the video is ready.
    while (!operation.done) {
      console.log("Waiting for video generation to complete...", operation.name || "");
      await new Promise((resolve) => setTimeout(resolve, 10000));
      operation = await genai.operations.getVideosOperation({
        operation: operation,
      });
    }

    let videoUrl = "";
    if (operation.response && operation.response.generatedVideos && operation.response.generatedVideos.length > 0) {
      const generatedVideoFile = operation.response.generatedVideos[0].video;

      const vidFilename = `vid-${Date.now()}-${Math.random().toString(36).substr(2, 6)}.mp4`;
      const vidPath = path.join(VIDEOS_DIR, vidFilename);

      try {
        await genai.files.download({
          file: generatedVideoFile,
          downloadPath: vidPath
        });
        videoUrl = `/api/storage/videos/${vidFilename}`;
        console.log(`Video downloaded successfully to ${videoUrl}`);
      } catch (dlErr) {
        console.error("Failed to download video file:", dlErr.message);
        throw new Error("Video was generated but failed to download.");
      }
    } else {
      throw new Error("Veo API completed but returned no video output.");
    }

    res.json({ videoUrl });

  } catch (err) {
    if (err.message === "Gemini API key(s) not configured.") return res.status(503).json({ error: err.message });
    console.error("Video generation error:", err.message || err);
    res.status(500).json({ error: err.message || "Video generation failed" });
  }
});


// ── Generate Cloning Prompts (Vision) ─────────────────────────
const VISION_CLONE_MAX_RETRIES = 3;
const VISION_CLONE_RETRY_DELAY_MS = 1500;

app.post("/api/generate-cloning-prompts", async (req, res) => {
  try {
    const { images } = req.body; // Expects array of { url, title, id }
    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ error: "Missing images array" });
    }

    const results = [];
    const delayMs = 500;

    // Process each image (no cap; delay between calls to respect rate limits)
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      let pushed = false;
      for (let attempt = 1; attempt <= VISION_CLONE_MAX_RETRIES && !pushed; attempt++) {
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
            model: "gemini-3-flash-preview", // Use a vision-capable details model
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
                                "visual_rules": { "prohibited_elements": ["watermark", "text", "branding", "logos", "typography"], "grain": "none", "sharpen": "standard" },
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
          if (promptData && (promptData.scene || promptData.style)) {
            results.push(normalizeImagePrompt(promptData));
            pushed = true;
          } else {
            throw new Error("Empty or invalid prompt from Vision");
          }
        } catch (innerErr) {
          console.error(`Clone image ${img.id} attempt ${attempt}/${VISION_CLONE_MAX_RETRIES}:`, innerErr.message);
          if (attempt < VISION_CLONE_MAX_RETRIES) {
            await new Promise((r) => setTimeout(r, VISION_CLONE_RETRY_DELAY_MS));
          }
        }
      }

      // Delay between API calls to respect Gemini rate limits
      if (i < images.length - 1) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }

    res.json({ prompts: results });

  } catch (err) {
    if (err.message === "Gemini API key(s) not configured.") return res.status(503).json({ error: err.message });
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
  setImmediate(() => {
    [VIDEOS_DIR, IMAGES_DIR, BATCHES_DIR].forEach(dir => cleanupOldFiles(dir, RETENTION_MS));
  });
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
