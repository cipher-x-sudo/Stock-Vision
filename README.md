<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1FvzaoplvMDbrsa7RT2oWZ8OhUXjrFo8J

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set your Gemini API key in [.env.local](.env.local): use `GEMINI_API_KEY` for a single key, or `GEMINI_API_KEYS` (comma-separated) for multiple keys; when multiple are set, one is selected at random per Gemini request.
3. Run the app:
   `npm run dev`
