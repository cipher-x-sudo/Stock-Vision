import { StockInsight } from "../types";

const PROXY_BASE = "https://api.allorigins.win/get?url=";

/** Backend API base (authenticated proxy). Empty = same origin. Set VITE_API_URL in .env when backend runs elsewhere. */
const API_BASE = (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) || "";

/**
 * Map API image objects to StockInsight. Matches reverse_search.py field usage:
 * id, title, downloads, premium, creator, creatorId, mediaType, category, contentType,
 * dimensions, creationDate, keywords (comma-separated string -> array), thumbnailUrl, isAI.
 */
function mapImages(data: any): StockInsight[] {
  return (data.images || []).map((img: any) => {
    const keywords = img.keywords;
    const kwList =
      typeof keywords === "string"
        ? keywords.split(",").map((k: string) => k.trim()).filter(Boolean)
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
      isAI: img.isAI === true
    };
  });
}

/**
 * Search TrackAdobeStock. Prefer authenticated backend (/api/track-adobe); on failure fall back to public proxy.
 * Backend uses same URL, cookies, and headers as reverse_search.py.
 */
export const searchTrackAdobe = async (
  query: string,
  page: number = 1,
  aiOnly: boolean = false
): Promise<{ images: StockInsight[]; usage: any }> => {
  const base = API_BASE ? API_BASE.replace(/\/$/, "") : "";
  const backendUrl = `${base}/api/track-adobe?q=${encodeURIComponent(query)}&page=${page}&ai_only=${aiOnly ? "1" : "0"}`;

  try {
    const response = await fetch(backendUrl);
    if (response.ok) {
      const json = await response.json();
      return { images: json.images || [], usage: json.usage || {} };
    }
    if (response.status === 503 || response.status === 502) {
      console.warn("TrackAdobe backend unavailable, falling back to public proxy.");
    }
  } catch (_) {
    console.warn("TrackAdobe backend request failed, falling back to public proxy.");
  }

  const encodedQuery = encodeURIComponent(query);
  let targetUrl = `https://trackadobestock.com/search?q=${encodedQuery}`;
  if (aiOnly) targetUrl += "&generative_ai=only";
  if (page > 1) targetUrl += `&page=${page}`;
  targetUrl += "&_rsc=1gn38";
  const proxyUrl = PROXY_BASE + encodeURIComponent(targetUrl);

  try {
    const response = await fetch(proxyUrl);
    if (!response.ok) throw new Error(`Proxy Error: ${response.status}`);
    const json = await response.json();
    const content = json.contents;
    const marker = '{"query":"';
    const startIdx = content.indexOf(marker);
    if (startIdx === -1) return { images: [], usage: {} };
    let depth = 0;
    let jsonStr = "";
    for (let i = startIdx; i < content.length; i++) {
      if (content[i] === "{") depth++;
      else if (content[i] === "}") {
        depth--;
        if (depth === 0) {
          jsonStr = content.substring(startIdx, i + 1);
          break;
        }
      }
    }
    if (!jsonStr) return { images: [], usage: {} };
    const data = JSON.parse(jsonStr);
    const images = mapImages(data);
    if (aiOnly && images.length > 0) {
      const aiFiltered = images.filter((img) => img.isAI === true);
      if (aiFiltered.length > 0) return { images: aiFiltered, usage: data.usageData || {} };
    }
    return { images, usage: data.usageData || {} };
  } catch (error) {
    console.error("TrackAdobe Proxy Search Error:", error);
    return { images: [], usage: {} };
  }
};

/**
 * Fetch at least minPages pages and aggregate all images. Uses AI-only filter when requested.
 */
export const searchTrackAdobeMultiplePages = async (
  query: string,
  minPages: number = 3,
  aiOnly: boolean = true
): Promise<{ images: StockInsight[]; usage: any }> => {
  const allImages: StockInsight[] = [];
  let usage: any = {};
  for (let page = 1; page <= minPages; page++) {
    const result = await searchTrackAdobe(query, page, aiOnly);
    allImages.push(...result.images);
    if (result.usage && Object.keys(result.usage).length) usage = result.usage;
    if (result.images.length === 0 && page > 1) break;
  }
  return { images: allImages, usage };
};
