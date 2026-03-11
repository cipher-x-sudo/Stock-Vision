import {
  RECAPTCHA_SITE_KEY,
  RECAPTCHA_SCRIPT_URL,
  RECAPTCHA_ACTION_IMAGE,
  RECAPTCHA_ACTION_VIDEO,
  RECAPTCHA_ACTION_IMAGE_UPSCALE,
  RECAPTCHA_ACTION_VIDEO_UPSCALE,
} from './config.js';

/**
 * reCAPTCHA Enterprise token generation. Uses browser execute (same JS as Python).
 * Generation: IMAGE_GENERATION / VIDEO_GENERATION. Upscale: PINHOLE_UPSCALE_IMAGE / PINHOLE_UPSCALE_VIDEO.
 * Token acquisition is serialized (mutex) so only one getToken() runs at a time.
 */
export class RecaptchaHandler {
  constructor(executeAsync, logCallback = () => {}) {
    this._execute = executeAsync;
    this._log = logCallback;
    this._lastAction = null;
    /** @type {Promise<void>} - mutex: next caller waits on this, then runs and replaces it */
    this._tokenMutex = Promise.resolve();
  }

  async resetGrecaptcha() {
    this._lastAction = null;
    this._log('[DEBUG] reCAPTCHA state reset (lastAction cleared)');
  }

  async getTokenWithAction(action) {
    const run = async () => {
      if (this._lastAction != null && this._lastAction !== action) {
        this._log(`[DEBUG] reCAPTCHA action switch: ${this._lastAction} → ${action}, resetting`);
        await this.resetGrecaptcha();
      }
      this._lastAction = action;

      this._log(`[DEBUG] reCAPTCHA request action: ${action}`);
      this._log(`Generating reCAPTCHA token with action: ${action}`);

      const jsCode = `
      return (async function() {
        try {
          if (typeof grecaptcha === 'undefined' || !grecaptcha.enterprise || typeof grecaptcha.enterprise.execute === 'undefined') {
            await new Promise((resolve, reject) => {
              const script = document.createElement('script');
              script.src = "${RECAPTCHA_SCRIPT_URL}";
              script.async = true;
              script.defer = true;
              script.onload = () => resolve();
              script.onerror = () => reject(new Error("Failed to load reCAPTCHA script"));
              document.head.appendChild(script);
            });
            await new Promise(r => setTimeout(r, 1500));
          }
          return await new Promise((resolve, reject) => {
            window.grecaptcha.enterprise.ready(() => {
              window.grecaptcha.enterprise.execute('${RECAPTCHA_SITE_KEY}', { action: '${action}' })
                .then(token => resolve({ success: true, token }))
                .catch(err => resolve({ success: false, error: err.toString() }));
            });
          });
        } catch (e) {
          return { success: false, error: e.toString() };
        }
      })();
    `;

      try {
        const result = await this._execute(jsCode);
        if (result && result.success && result.token) {
          this._log(`Token obtained: ${result.token.slice(0, 40)}...`);
          this._log(`[DEBUG] reCAPTCHA token length: ${result.token.length}`);
          this._log(`[DEBUG] reCAPTCHA token obtained at: ${new Date().toISOString()}`);
          return result.token;
        }
        if (typeof result === 'string' && result.startsWith('03')) {
          this._log(`Token obtained: ${result.slice(0, 40)}...`);
          this._log(`[DEBUG] reCAPTCHA token length: ${result.length}`);
          this._log(`[DEBUG] reCAPTCHA token obtained at: ${new Date().toISOString()}`);
          return result;
        }
        this._log(`reCAPTCHA error: ${result?.error || 'Unknown error'}`);
        this._log(`[DEBUG] reCAPTCHA raw result: ${JSON.stringify(result)}`);
        return null;
      } catch (e) {
        this._log(`reCAPTCHA execution error: ${e.message}`);
        return null;
      }
    };

    const next = this._tokenMutex.then(run, run);
    this._tokenMutex = next.then(() => {}, () => {});
    return next;
  }

  async getToken(isVideo = false) {
    const action = isVideo ? RECAPTCHA_ACTION_VIDEO : RECAPTCHA_ACTION_IMAGE;
    return this.getTokenWithAction(action);
  }

  getImageToken() {
    return this.getTokenWithAction(RECAPTCHA_ACTION_IMAGE);
  }

  getVideoToken() {
    return this.getTokenWithAction(RECAPTCHA_ACTION_VIDEO);
  }

  getImageUpscaleToken() {
    return this.getTokenWithAction(RECAPTCHA_ACTION_IMAGE_UPSCALE);
  }

  getVideoUpscaleToken() {
    return this.getTokenWithAction(RECAPTCHA_ACTION_VIDEO_UPSCALE);
  }
}
