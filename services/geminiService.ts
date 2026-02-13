import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult, StockInsight, GroundingSource, CreativeBrief, ImagePrompt } from "../types";
import { parseCalendarCsv, filterEventsNext90Days } from "../utils/eventCalendar";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Load calendar from CSV (single source of truth)
import calendarCsv from "../event_calendar_2026.csv?raw";

/**
 * Utility to execute a generateContent call with cascading fallback models.
 * Falls back on: 500, 503, 429, INTERNAL, UNAVAILABLE, RESOURCE_EXHAUSTED, or any network error.
 */
async function generateWithFallback(
  parameters: any,
  fallbackModels: string[] = ['gemini-2.5-flash', 'gemini-2.0-flash']
) {
  const models = [parameters.model, ...fallbackModels];
  let lastError: any;

  for (let i = 0; i < models.length; i++) {
    try {
      return await ai.models.generateContent({
        ...parameters,
        model: models[i],
      });
    } catch (error: any) {
      lastError = error;
      const msg = error?.message || '';
      const status = error?.status || '';
      const isRetryable =
        msg.includes('500') || msg.includes('503') || msg.includes('429') ||
        msg.includes('RESOURCE_EXHAUSTED') || msg.includes('overloaded') ||
        msg.includes('rate') || msg.includes('quota') ||
        status === 'INTERNAL' || status === 'UNAVAILABLE' || status === 'RESOURCE_EXHAUSTED';

      if (isRetryable && i < models.length - 1) {
        console.warn(`Model ${models[i]} failed (${msg.slice(0, 80)}), falling back to ${models[i + 1]}`);
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

/** Short, search-friendly keywords for TrackAdobe (single words or 2-word phrases, like: romantic, red, glitter, hearts, bokeh, valentine, promotions). */
export const generateVarietyKeywords = async (eventName: string): Promise<string[]> => {
  const response = await generateWithFallback({
    model: "gemini-3-flash-preview",
    contents: {
      parts: [{
        text: `For the event "${eventName}", return 18 search keywords that work well on stock photo sites (Adobe Stock). Use SHORT terms only: single words or two-word phrases. Examples of good format: romantic, red, glitter, hearts, background, shimmering, bokeh, valentine, day, promotions, wedding, invitations, love, couple, gift. Do NOT use long descriptive sentences or full phrases. Return a JSON string array of 18 such keywords.`
      }]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } }
    }
  });
  return JSON.parse(response.text || "[]");
};

const MAX_ITEMS_FOR_PROMPT = 200;

export const analyzeMarketData = async (eventName: string, rawData: StockInsight[]): Promise<AnalysisResult> => {
  const slice = rawData.slice(0, MAX_ITEMS_FOR_PROMPT);

  // Build a detailed summary of each asset for Gemini
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

  const dataString = rawData.length > 0 ? JSON.stringify(assetSummaries) : "NO_DATA";
  const truncatedNote = rawData.length > MAX_ITEMS_FOR_PROMPT ? ` (Showing top ${MAX_ITEMS_FOR_PROMPT} of ${rawData.length} total assets.)` : "";

  const response = await generateWithFallback({
    model: "gemini-3-pro-preview",
    contents: {
      parts: [{
        text: `
You are an Adobe Stock market analyst. I searched AdobeStock for the event "${eventName}" and retrieved ${rawData.length} filtered assets.${truncatedNote}

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
        type: Type.OBJECT,
        properties: {
          brief: {
            type: Type.OBJECT,
            properties: {
              event: { type: Type.STRING },
              bestSellers: { type: Type.ARRAY, items: { type: Type.STRING } },
              shotList: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    idea: { type: Type.STRING },
                    type: { type: Type.STRING },
                    description: { type: Type.STRING },
                    whyItWorks: { type: Type.STRING }
                  },
                  required: ["idea", "type", "description", "whyItWorks"]
                }
              }
            },
            required: ["event", "bestSellers", "shotList"]
          },
          trends: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                month: { type: Type.STRING },
                demand: { type: Type.NUMBER },
                saturation: { type: Type.NUMBER }
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
  return {
    ...parsed,
    insights: rawData,
    sources: (response.candidates?.[0]?.groundingMetadata?.groundingChunks || []) as GroundingSource[]
  };
};

export const getSuggestedEvents = async (): Promise<any[]> => {
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const allEvents = parseCalendarCsv(calendarCsv);
  const filtered = filterEventsNext90Days(allEvents);
  if (filtered.length === 0) return [];
  const eventListText = filtered
    .map((e) => `${e.name} (${e.dateIso})`)
    .join("\n");
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
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            date: { type: Type.STRING },
            category: { type: Type.STRING },
            description: { type: Type.STRING },
            icon: { type: Type.STRING }
          },
          required: ["name", "date", "category", "description", "icon"]
        }
      }
    }
  });
  return JSON.parse(response.text || "[]");
};

const IMAGE_PROMPT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    scene: { type: Type.STRING },
    style: { type: Type.STRING },
    constraints: { type: Type.ARRAY, items: { type: Type.STRING } },
    shot: {
      type: Type.OBJECT,
      properties: {
        composition: { type: Type.STRING },
        resolution: { type: Type.STRING },
        lens: { type: Type.STRING }
      },
      required: ["composition", "resolution", "lens"]
    },
    lighting: {
      type: Type.OBJECT,
      properties: {
        primary: { type: Type.STRING },
        secondary: { type: Type.STRING },
        accents: { type: Type.STRING }
      },
      required: ["primary", "secondary", "accents"]
    },
    color_palette: {
      type: Type.OBJECT,
      properties: {
        background: { type: Type.STRING },
        ink_primary: { type: Type.STRING },
        ink_secondary: { type: Type.STRING },
        text_primary: { type: Type.STRING }
      },
      required: ["background", "ink_primary", "ink_secondary", "text_primary"]
    },
    visual_rules: {
      type: Type.OBJECT,
      properties: {
        prohibited_elements: { type: Type.ARRAY, items: { type: Type.STRING } },
        grain: { type: Type.STRING },
        sharpen: { type: Type.STRING }
      },
      required: ["prohibited_elements", "grain", "sharpen"]
    },
    metadata: {
      type: Type.OBJECT,
      properties: {
        series: { type: Type.STRING },
        task: { type: Type.STRING },
        scene_number: { type: Type.STRING },
        tags: { type: Type.ARRAY, items: { type: Type.STRING } }
      },
      required: ["series", "task", "scene_number", "tags"]
    }
  },
  required: ["scene", "style", "constraints", "shot", "lighting", "color_palette", "visual_rules", "metadata"]
};

/** Generate at least 100 image-only prompts for Nano Banana Pro from event + brief (image items). Uses batched calls. */
export const generateImagePrompts = async (
  eventName: string,
  brief: CreativeBrief,
  _assetSummary?: string
): Promise<ImagePrompt[]> => {
  const imageItems = brief.shotList.filter((s) => s.type === "Image");
  const shotListText = imageItems.length > 0
    ? imageItems.map((s) => `- ${s.idea}: ${s.description}`).join("\n")
    : brief.bestSellers.slice(0, 10).join(", ");
  const promptIntro = `
Event: ${eventName}
Top sellers: ${brief.bestSellers.join(", ")}
Shot ideas (Image only):\n${shotListText}

Generate exactly 25 distinct image prompts for Nano Banana Pro. Each prompt must be a single image (no video). Vary scene, style, composition, lighting, and color. Return a JSON array of 25 objects matching this schema.`;

  const allPrompts: ImagePrompt[] = [];
  const batches = 4;
  for (let b = 0; b < batches; b++) {
    const response = await generateWithFallback({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [{
          text: `${promptIntro} Batch ${b + 1}/${batches}. Output ONLY a JSON array of 25 image prompt objects, no other text.`
        }]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: IMAGE_PROMPT_SCHEMA
        }
      }
    });
    const parsed = JSON.parse(response.text || "[]");
    if (Array.isArray(parsed)) {
      for (const p of parsed) {
        allPrompts.push(normalizeImagePrompt(p));
      }
    }
  }
  return allPrompts;
};

function normalizeImagePrompt(p: any): ImagePrompt {
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
