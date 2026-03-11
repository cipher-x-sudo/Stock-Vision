/**
 * NEXUS STUDIO COLOR SYSTEM
 * 
 * A sci-fi inspired color palette for the complete creative intelligence suite.
 * 
 * BACKGROUNDS:
 * - Deep Space: #050810 (Main app background)
 * - Navy Canvas: #0a0f1d (Module backgrounds)
 * - Glass Panels: #161d2f/80% (Translucent overlays with backdrop-blur)
 * 
 * BRAND ACCENTS:
 * - Neon Sky Blue: #0ea5e9 (Data, Intelligence, Primary actions)
 * - Radiant Amber: #f59e0b (AI Generation gradient start)
 * - Deep Violet: #8b5cf6 (AI Generation gradient end)
 * - Emerald: #10b981 (Success states, completions)
 * 
 * TYPOGRAPHY:
 * - UI Text: Inter (Clean, modern interface)
 * - Data/Prompts: JetBrains Mono (Technical, monospace)
 * - Headers: Space Grotesk (Bold, sci-fi aesthetic)
 * 
 * INTERACTIONS:
 * - Hover glow: 0_0_20px_rgba(14,165,233,0.3)
 * - Active scale: 0.98
 * - Border animations on active states
 */

export const colors = {
  background: {
    deepSpace: '#050810',
    navyCanvas: '#0a0f1d',
    glassPanel: '#161d2f',
  },
  accent: {
    neonBlue: '#0ea5e9',
    amber: '#f59e0b',
    violet: '#8b5cf6',
    emerald: '#10b981',
  },
  text: {
    primary: '#ffffff',
    secondary: '#9ca3af',
    muted: '#6b7280',
  },
} as const;
