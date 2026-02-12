import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult, StockInsight, GroundingSource, CreativeBrief, ImagePrompt } from "../types";
import { parseCalendarCsv, filterEventsNext90Days } from "../utils/eventCalendar";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Load calendar from CSV (single source of truth)
import calendarCsv from "../event_calendar_2026.csv?raw";

/**
 * Utility to execute a generateContent call with a fallback model if 500 occurs
 */
async function generateWithFallback(parameters: any, fallbackModel: string = 'gemini-2.5-flash') {
  try {
    return await ai.models.generateContent(parameters);
  } catch (error: any) {
    if (error?.message?.includes('500') || error?.status === 'INTERNAL') {
      console.warn(`Gemini 500 error, falling back to ${fallbackModel}`);
      return await ai.models.generateContent({
        ...parameters,
        model: fallbackModel
      });
    }
    throw error;
  }
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
  const dataString = rawData.length > 0 ? JSON.stringify(slice) : "NO_RAW_DATA_AVAILABLE";
  const truncatedNote = rawData.length > MAX_ITEMS_FOR_PROMPT ? ` (Showing first ${MAX_ITEMS_FOR_PROMPT} of ${rawData.length} items.)` : "";

  const response = await generateWithFallback({
    model: "gemini-3-pro-preview",
    contents: {
      parts: [{
        text: `
STRICT MARKET ANALYSIS PROTOCOL:
Target Event: "${eventName}"
DATA SOURCE: ${dataString === "NO_RAW_DATA_AVAILABLE" ? "Direct API fetch failed. Use GOOGLE SEARCH to find actual top-performing assets on Adobe Stock." : `Analyze this real market data: ${dataString}${truncatedNote}`}

TASK:
1. Analyze creators and styles.
2. Identify content saturation gaps and suggest what we can make.
3. Generate a Creative Brief and Shot List (4 items: idea, type Image or Video, description).
4. Provide projected market trends (month, demand, saturation).
Response MUST be JSON.`
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
              missingNiches: { type: Type.ARRAY, items: { type: Type.STRING } },
              shotList: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    idea: { type: Type.STRING },
                    type: { type: Type.STRING },
                    description: { type: Type.STRING }
                  },
                  required: ["idea", "type", "description"]
                }
              },
              colorPalette: { type: Type.ARRAY, items: { type: Type.STRING } },
              compositionTips: { type: Type.ARRAY, items: { type: Type.STRING } },
              technicalSpecs: { type: Type.STRING },
              suggestedKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ["event", "bestSellers", "missingNiches", "shotList", "colorPalette", "compositionTips", "technicalSpecs", "suggestedKeywords"]
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
          },
          insights: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                title: { type: Type.STRING },
                downloads: { type: Type.STRING },
                premium: { type: Type.STRING },
                creator: { type: Type.STRING },
                mediaType: { type: Type.STRING },
                dimensions: { type: Type.STRING },
                uploadDate: { type: Type.STRING },
                keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
                thumbnailUrl: { type: Type.STRING }
              }
            }
          }
        },
        required: ["brief", "trends", "insights"]
      }
    }
  });

  const parsed = JSON.parse(response.text || "{}");
  return {
    ...parsed,
    insights: rawData.length > 0 ? rawData : (parsed.insights || []),
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
    : brief.suggestedKeywords.slice(0, 10).join(", ");
  const promptIntro = `
Event: ${eventName}
Creative direction: ${brief.compositionTips.join("; ")}
Color palette: ${brief.colorPalette.join(", ")}
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
