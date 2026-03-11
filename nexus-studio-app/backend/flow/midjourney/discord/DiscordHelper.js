/**
 * Discord URL helpers
 */

import { DISCORD_SERVER_URL, DISCORD_CDN_URL, DISCORD_WSS_URL } from '../constants.js';

const DISCORD_UPLOAD_URL = 'https://discord-attachments-uploads-prd.storage.googleapis.com';

export class DiscordHelper {
  constructor(config = {}) {
    this.ngDiscord = config.ngDiscord || {};
  }

  getServer() {
    return this.ngDiscord.server || DISCORD_SERVER_URL;
  }

  getCdn() {
    return this.ngDiscord.cdn || DISCORD_CDN_URL;
  }

  getWss() {
    return this.ngDiscord.wss || DISCORD_WSS_URL;
  }

  getResumeWss() {
    return this.ngDiscord.resumeWss || this.ngDiscord.wss || DISCORD_WSS_URL;
  }

  getUploadServer() {
    return this.ngDiscord.uploadServer || DISCORD_UPLOAD_URL;
  }

  getDiscordUploadUrl(uploadUrl) {
    if (!this.ngDiscord.uploadServer || !uploadUrl) return uploadUrl;
    const base = this.ngDiscord.uploadServer.endsWith('/') ? this.ngDiscord.uploadServer.slice(0, -1) : this.ngDiscord.uploadServer;
    return uploadUrl.replace(DISCORD_UPLOAD_URL, base);
  }

  getMessageHash(imageUrl) {
    if (!imageUrl) return null;
    if (imageUrl.endsWith('_grid_0.webp')) {
      const i = imageUrl.lastIndexOf('/');
      if (i < 0) return null;
      return imageUrl.substring(i + 1, imageUrl.length - '_grid_0.webp'.length);
    }
    const i = imageUrl.lastIndexOf('_');
    if (i < 0) return null;
    const part = imageUrl.substring(i + 1);
    const dot = part.indexOf('.');
    return dot >= 0 ? part.substring(0, dot) : part;
  }
}
