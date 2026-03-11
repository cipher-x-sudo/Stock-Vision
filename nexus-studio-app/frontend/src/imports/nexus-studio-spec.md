Nexus Studio — The Complete UI/UX Master Specification
To the Designer (Figma / AI Generator): You are designing the frontend for Nexus Studio, a massive, premium desktop-style application. Nexus Studio is an all-in-one "Creative Intelligence & Generation Suite". It connects real-world stock market data to state-of-the-art AI generation engines (Google Veo/Imagen) to plan, conceptualize, and physically render 4K video and high-end imagery.

There are no tabs or context switches that feel disjointed. The data flows seamlessly from one intelligence module into the heavily structured rendering queues.

Vibe & Tone:

"Sci-Fi Trading Terminal meets High-End Cinema Workstation."
Backgrounds: Deep space (#050810), Navy Canvas (#0a0f1d), Translucent Glass Panels with heavy background-blur (#161d2f/80%).
Brand Accents:
Neon Sky Blue (#0ea5e9) - Represents Data, Intelligence, and Scraping.
Radiant Amber (#f59e0b) & Deep Violet (#8b5cf6) Gradients - Represents the AI Generation Engine in action.
Emerald (#10b981) - Success states in the render queue.
Typography:
Main UI Text: Inter or SF Pro Display (extremely crisp, low weight).
Data Tables / Quotes / Prompts: JetBrains Mono or Roboto Mono.
Huge Headers: Space Grotesk (bold, slightly italicized).
Interactions:
Extremely tactile. A highly polished, data-dense look requiring perfect alignment.
🏗️ 1. Global App Architecture
The Fixed Left Sidebar (Width: ~280px) This is the command center that never leaves the screen.

Top Area (Brand):
Icon: A sleek combination of a Radar Wave and a Camera Lens.
Text: NEXUS STUDIO (Huge, bold, tracking-tight).
The 6 Core Modules (Vertical Navigation):
📡 Market Pipeline (For discovering data trends)
💡 Conceptualize (Raw text-to-prompts)
🧬 DNA Extraction (URL/CSV reverse engineering)
🖼️ Image Studio Queue (High-fidelity batch rendering)
🎬 Video Studio Queue (Multi-modal video rendering)
🕰️ The Archive (Universal History)
Bottom Area (System Status):
A persistent "Engine Status" card.
Shows an animated glowing dot. 🟢 Primary Engine Online or 🟡 Fallback Engine Active.
A small gear icon for Settings.
The Main Canvas (Remaining Width) Every module loads into this area. It must feel like a powerful, complex control panel.

📺 2. Module A: Market Pipeline (Data Discovery)
Purpose: Analyze real-world trends, build a creative brief, and output hundreds of optimized prompts straight into the Studio Queues.

Top Row: 90-Day Horizon Calendar

A smooth horizontal scrolling ribbon of "Event Cards".
Hover/Click: Hovering makes the card border glow Blue. Clicking it auto-fills the search bar.
Center: The Deep Scanner

A massive search input: "Target a niche or event..."
Attached Button: [ ⚡ DEEP SCAN ].
Loading State: An animated data-mapping sequence replacing the search bar. "Synthesizing Brief..." (No generic spinning wheels).
Bottom Area: The Creative Brief

Expands dramatically after scanning.
Section 1: 4-column masonry grid of Market Evidence images (with Download Count pills).
Section 2: A Line Chart showing demand over time + a Top Sellers list.
Section 3: A giant pulsing button [ EXPAND INTO 100 PROMPTS ].
Output: A huge, slick table of Prompts.
Super important Action Buttons above table: [ ➡️ ADD SELECTED TO IMAGE QUEUE ] | [ ➡️ ADD SELECTED TO VIDEO QUEUE ].
📺 3. Module B: Conceptualize & Module C: DNA Extraction
(Designer note: These modules share the same ultimate function as Module A—getting prompts into the Studio Queues.)

Conceptualize: A giant textarea for a vague text intro ("A rainy cyberpunk street") -> hit [ CONCEPTUALIZE ] -> Outputs the 100-Prompt Table to send to the Queue.
DNA Extraction: Paste a competitor URL or CSV -> loads a grid of competitor images -> select your favorites -> output the 100-Prompt Table to send to the Queue.
📺 4. Module D & E: The Studio Render Queues (IMAGE & VIDEO)
CRITICAL DESIGN DIRECTIVE: The user wants this to be a highly polished TABULAR QUEUE SYSTEM. It is NOT a messy scattered grid. It is an organized, Excel-on-steroids rendering pipeline.

The differences between Image and Video are just the settings available (AspectRatio, Modes), but the core UI is the exact same.

Layout: The Master Queue Table + Side Inspector

1. The Global Queue Header (Top Bar)

A sticky, heavily frosted glass bar.
Mass Action Buttons (Left Align): [ ▶️ START QUEUE ] (Giant Green Button), [ ⏸️ PAUSE QUEUE ], [ 🗑️ CLEAR COMPLETED ].
Queue Stats (Center): 8 Pending, 2 Rendering, 45 Completed.
Global Config (Right Align): Dropdowns to enforce a setting across every row below it (e.g., Set All Models to Veo 3.1).
2. The Render Queue Table (The Main Area - 75% Width)

This is a beautiful, dark-mode data table where every row is a distinct media generation job.
Table Columns (Left to Right):
[Checkbox] (for bulk actions).
Status Icon (⏳ Pending, 🌀 Animating gradient circle for Rendering, ✅ Success, ❌ Failed).
Prompt Details: A large, scrollable text cell. If the prompt came from DNA Extraction or requires Image-to-Video (or multiple Frames-to-Video), tiny thumbnail thumbnails sit right inside or directly beneath the text in this cell.
Model: Dropdown (e.g., Imagen 3.5, Veo 3.1 12-Step).
Ratio: Dropdown (16:9, 1:1, 9:16).
Seed: Input field (default random).
Output: The most important column.
If Pending: Shows dashed outline [ Awaiting Render ].
If Rendering: A horizontal progress bar fills the cell: [ 65% - Fetching from Node ].
If Done: The high-res media thumbnail appears directly in the cell.
Interaction Mechanics in the Table:

Inline Editing: Clicking any dropdown/text in the table immediately allows editing (like Notion or Airtable).
Adding Items: A permanent, empty "Ghost Row" at the bottom of the table: [ + Type or paste a new prompt here to add to queue ].
3. The Inspector Panel (The Side Area - 25% Width)

The far-right side of the screen is a persistent, sticky "Inspector" vertical panel.
Function: Whichever row is currently selected/clicked in the table, all of its details expand here for fine-tuning.
Inspector Sections:
Massive preview of the final rendered Media (if done), featuring a huge [ ⬇️ DOWNLOAD HD ] button.
Full prompt editor (easier to read than the table row).
Detail tags: "Rendered in 12.4s", "Model: Nano Banana Pro", Timestamp.
Video-Specific settings: If the selected row is a Multi-Frame Storyboard Video, the Inspector shows a vertical drag-and-drop filmstrip to rearrange the exact 3 images being pushed into that specific render job.
📺 5. Module F: The Archive (Universal History)
Purpose: A searchable vault of everything completed.

By default, the Queue tabs are cleared of completed items after the session. They all flow here.
Layout: Full-screen width canvas. Massively filterable.
Section 1: A dense Filter Row. Search by keywords, models, date, type (Image vs Video).
Section 2: A masonry grid of media. (Unlike the Queues which are strictly tabular, the Archive is visual to let the user admire their work).
Hover/Click: Hovering a card plays the video or highlights the prompt. Clicking a card opens a full-screen "Theater Mode" modal with download buttons and a [ ↩️ Send back to Queue ] button.
⚙️ 6. The Engine Hub (Global Settings)
Accessed via the tiny gear icon bottom-left in the sidebar.

UI: A highly technical, glassmorphism overlay modal.
Section A: The Neural Link (Engine Router):
This app needs Google Flow cookies to run Veo4K.
Visual: Status card showing 🟢 SYSTEM LINKED. NODE AUTHENTICATED.
Button: "Upload current 
cookies.json
".
Auto-Routing Toggle: A giant switch: "Enable API Fallback to Gemini Vertex on Timeout". (Critical fallback logic).
Section B: API Keys:
Masked input fields (••••••••) for connecting external Gemini API keys. Include 'Test Connection' buttons.
🔔 Global Micro-Interactions
The Fallback Toast: If a table row is rendering via Veo4K and it fails mid-render, a small toast slides gracefully from the bottom right: ⚠️ Primary Node Timeout. Render #44 elegantly rerouted to Gemini Fallback Node. (The table row status changes to yellow briefly, then goes back to rendering).
Queue Flow: When you hit "Start Queue", rows should animate. The status icon spins. The row background might hold a very faint, slow pulsing color transition (dark blue to deep violet) to indicate it is "active".
FINAL INSTRUCTION: Execute this design emphasizing the Queue Table in the Studio sections. The user must feel like they are managing a massive, sophisticated data pipeline of rendering tasks. Everything must align perfectly, with a highly polished enterprise SaaS / specialized broadcast-software aesthetic.


Comment
Ctrl+Alt+M
