import { chromium } from 'playwright';
import fs from 'fs';
import { COOKIES_FILE, PAGE_LOAD_DELAY_MS } from './config.js';

/** When true, browser opens on-screen and hideBrowser() does not move window off-screen (local dev). */
const isDevVisible = process.env.NODE_ENV === 'development' || process.env.SHOW_BROWSER === 'true';

/**
 * Playwright-based browser manager. Replaces Selenium.
 * Init, cookies, findAuthSession, execute / executeAsync.
 */
export class BrowserManager {
  constructor(logCallback = () => { }) {
    this.browser = null;
    this.page = null;
    this.context = null;
    this.projectId = null;
    this._log = logCallback;
    this.browserVisible = false;
  }

  async initialize(headless = false, projectUrl = null) {
    try {
      this._log(isDevVisible ? 'Starting Chrome browser (visible)...' : 'Starting Chrome browser (hidden)...');
      const launchArgs = [
        '--disable-gpu',
        '--no-sandbox',
        '--disable-dev-shm-usage',
      ];
      if (!isDevVisible) {
        launchArgs.push('--window-position=-2000,-2000');
      }
      this.browser = await chromium.launch({
        headless,
        args: launchArgs,
      });
      this.browserVisible = false;
      this.context = await this.browser.newContext({
        viewport: { width: 1280, height: 720 },
        ignoreHTTPSErrors: true,
      });
      this.page = await this.context.newPage();

      await this.page.goto('https://labs.google/', { waitUntil: 'domcontentloaded', timeout: 30000 });

      if (fs.existsSync(COOKIES_FILE)) {
        await this._loadCookies();
      } else {
        this._log('No cookies found. Please log in manually.');
      }

      if (projectUrl) {
        this._log('Navigating to project...');
        await this.page.goto(projectUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await this._delay(PAGE_LOAD_DELAY_MS);
      }

      this._extractProjectIdFromUrl(this.page.url());
      this._log('Browser ready!');
      return true;
    } catch (e) {
      this._log(`Error initializing browser: ${e.message}`);
      return false;
    }
  }

  _delay(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  async _loadCookies() {
    try {
      const raw = fs.readFileSync(COOKIES_FILE, 'utf8');
      const arr = JSON.parse(raw);
      const cookies = Array.isArray(arr) ? arr : [];
      this._log(`Loading ${cookies.length} cookies from ${COOKIES_FILE}...`);

      const pwCookies = cookies.map((c) => {
        const sameSite = c.sameSite && ['Strict', 'Lax', 'None'].includes(c.sameSite) ? c.sameSite : 'Lax';
        return {
          name: c.name,
          value: c.value,
          domain: c.domain || '.google.com',
          path: c.path || '/',
          secure: !!c.secure,
          httpOnly: !!c.httpOnly,
          sameSite,
          expires: c.expiration || c.expiry ? (c.expiration || c.expiry) : -1,
        };
      }).filter((c) => c.name && c.value);

      await this.context.addCookies(pwCookies);
      await this._delay(2000);
      await this.page.reload();
    } catch (e) {
      this._log(`Error loading cookies: ${e.message}`);
    }
  }

  _extractProjectIdFromUrl(url) {
    try {
      const m = url.match(/\/project\/([^/]+)/);
      if (m) this.projectId = m[1];
    } catch (_) { }
    return this.projectId;
  }

  async findAuthSession() {
    if (!this.page) return null;
    try {
      const auth = await this.page.evaluate(async () => {
        const res = await fetch('/fx/api/auth/session');
        const data = await res.json();
        const token = data.access_token || null;
        const sid = data.session_id || data.sessionId || data.session || null;
        return { access_token: token, session_id: sid ? String(sid) : null };
      });
      if (auth && auth.access_token) {
        this._log(`Found Bearer token: ${auth.access_token.slice(0, 15)}...`);
      }
      return auth;
    } catch (e) {
      this._log(`Error fetching auth session: ${e.message}`);
      return null;
    }
  }

  async findBearerToken() {
    const a = await this.findAuthSession();
    return a?.access_token ?? null;
  }

  refreshProjectId() {
    if (!this.page) return this.projectId;
    try {
      const url = this.page.url();
      this._extractProjectIdFromUrl(url);
    } catch (_) { }
    return this.projectId;
  }

  /**
   * Run JS in page. fn can be a string (eval'd in page) or a function.
   * If result is a Promise, we await it.
   * For strings, we wrap in (function(){ ... })() so "return" is valid.
   * Optional arg: page.evaluate(fn, arg).
   */
  async executeScript(fn, arg) {
    if (!this.page) return null;
    if (typeof fn === 'string') {
      const wrapped = `(function(){ ${fn} })()`;
      return this.page.evaluate((code) => eval(code), wrapped);
    }
    if (arg !== undefined) return this.page.evaluate(fn, arg);
    return this.page.evaluate(fn);
  }

  async executeAsyncScript(fn, arg) {
    return this.executeScript(fn, arg);
  }

  /** Adapter for routes that use browser.driver.get(url) */
  get driver() {
    const self = this;
    return {
      get(url) {
        return self.goto(url);
      },
    };
  }

  async goto(url) {
    if (this.page) await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  }

  async showBrowser() {
    if (!this.browser) return false;
    try {
      const pages = this.context?.pages() || [];
      if (pages.length > 0) {
        // Bring window to foreground by evaluating window.moveTo
        await pages[0].evaluate(() => {
          window.moveTo(100, 100);
          window.focus();
        });
      }
      this.browserVisible = true;
      this._log('Browser shown');
      return true;
    } catch (e) {
      this._log(`Failed to show browser: ${e.message}`);
      return false;
    }
  }

  async hideBrowser() {
    if (!this.browser) return false;
    if (isDevVisible) {
      this._log('Browser visibility locked in dev');
      return true;
    }
    try {
      const pages = this.context?.pages() || [];
      if (pages.length > 0) {
        await pages[0].evaluate(() => {
          window.moveTo(-2000, -2000);
        });
      }
      this.browserVisible = false;
      this._log('Browser hidden');
      return true;
    } catch (e) {
      this._log(`Failed to hide browser: ${e.message}`);
      return false;
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
      this.context = null;
    }
  }
}
