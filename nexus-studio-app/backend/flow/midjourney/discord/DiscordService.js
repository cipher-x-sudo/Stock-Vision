/**
 * Discord HTTP client - imagine, upscale, variation, upload, etc.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Message } from '../result/Message.js';
import { getBlendDimensionsValue } from '../constants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_SESSION_ID = 'f1a313a09ce079ce252459dc70231f30';

function loadParams() {
  const dir = path.join(__dirname, '..', 'resources', 'api-params');
  const files = ['imagine', 'upscale', 'variation', 'reroll', 'describe', 'shorten', 'blend', 'custom-action', 'modal-submit', 'edits', 'message'];
  const map = new Map();
  for (const name of files) {
    try {
      const p = path.join(dir, `${name}.json`);
      const raw = fs.readFileSync(p, 'utf-8');
      map.set(name, raw);
    } catch (e) {
      // ignore missing
    }
  }
  return map;
}

export class DiscordService {
  constructor(account, paramsMap, discordHelper) {
    this.account = account;
    this.paramsMap = paramsMap || loadParams();
    this.discordHelper = discordHelper;
    const server = this.discordHelper.getServer();
    this.discordInteractionUrl = `${server}/api/v9/interactions`;
    this.discordAttachmentUrl = `${server}/api/v9/channels/${account.channelId}/attachments`;
    this.discordMessageUrl = `${server}/api/v9/channels/${account.channelId}/messages`;
    this.sessionId = null;
    this.getSessionIdCallback = null;
  }

  setSessionIdGetter(callback) {
    this.getSessionIdCallback = callback;
  }

  setSessionId(sessionId) {
    this.sessionId = sessionId;
  }

  getSessionId() {
    if (this.getSessionIdCallback) {
      const id = this.getSessionIdCallback();
      if (id) return id;
    }
    if (this.sessionId) return this.sessionId;
    return DEFAULT_SESSION_ID;
  }

  replaceInteractionParams(template, nonce) {
    const sessionId = this.getSessionId();
    return template
      .replace(/\$guild_id/g, this.account.guildId || '')
      .replace(/\$channel_id/g, this.account.channelId || '')
      .replace(/\$session_id/g, sessionId)
      .replace(/\$nonce/g, nonce);
  }

  async postJsonAndCheckStatus(json) {
    try {
      const payload = JSON.parse(json);
      const res = await fetch(this.discordInteractionUrl, {
        method: 'POST',
        headers: {
          Authorization: this.account.userToken,
          'Content-Type': 'application/json',
          'User-Agent': this.account.userAgent || 'Mozilla/5.0',
        },
        body: json,
      });
      if (res.status === 200 || res.status === 204) return Message.success();
      const text = await res.text();
      return Message.failureWithDescription(`HTTP ${res.status}: ${text}`);
    } catch (e) {
      return Message.failureWithDescription(e.message || 'Request failed');
    }
  }

  async imagine(prompt, nonce) {
    const raw = this.paramsMap.get('imagine');
    if (!raw) return Message.failureWithDescription('imagine template not found');
    const str = this.replaceInteractionParams(raw, nonce).replace(/\$prompt/g, prompt);
    const params = JSON.parse(str);
    params.data.options[0].value = prompt;
    return this.postJsonAndCheckStatus(JSON.stringify(params));
  }

  async upscale(messageId, index, messageHash, messageFlags, nonce) {
    const raw = this.paramsMap.get('upscale');
    if (!raw) return Message.failureWithDescription('upscale template not found');
    let str = this.replaceInteractionParams(raw, nonce)
      .replace(/\$message_id/g, messageId)
      .replace(/\$index/g, String(index))
      .replace(/\$message_hash/g, messageHash);
    const params = JSON.parse(str);
    params.message_flags = messageFlags;
    return this.postJsonAndCheckStatus(JSON.stringify(params));
  }

  async variation(messageId, index, messageHash, messageFlags, nonce) {
    const raw = this.paramsMap.get('variation');
    if (!raw) return Message.failureWithDescription('variation template not found');
    let str = this.replaceInteractionParams(raw, nonce)
      .replace(/\$message_id/g, messageId)
      .replace(/\$index/g, String(index))
      .replace(/\$message_hash/g, messageHash);
    const params = JSON.parse(str);
    params.message_flags = messageFlags;
    return this.postJsonAndCheckStatus(JSON.stringify(params));
  }

  async reroll(messageId, messageHash, messageFlags, nonce) {
    const raw = this.paramsMap.get('reroll');
    if (!raw) return Message.failureWithDescription('reroll template not found');
    let str = this.replaceInteractionParams(raw, nonce)
      .replace(/\$message_id/g, messageId)
      .replace(/\$message_hash/g, messageHash);
    const params = JSON.parse(str);
    params.message_flags = messageFlags;
    return this.postJsonAndCheckStatus(JSON.stringify(params));
  }

  async describe(finalFileName, nonce) {
    const raw = this.paramsMap.get('describe');
    if (!raw) return Message.failureWithDescription('describe template not found');
    const fileName = finalFileName.includes('/') ? finalFileName.substring(finalFileName.lastIndexOf('/') + 1) : finalFileName;
    const str = this.replaceInteractionParams(raw, nonce)
      .replace(/\$file_name/g, fileName)
      .replace(/\$final_file_name/g, finalFileName);
    return this.postJsonAndCheckStatus(str);
  }

  async shorten(prompt, nonce) {
    const raw = this.paramsMap.get('shorten');
    if (!raw) return Message.failureWithDescription('shorten template not found');
    const str = this.replaceInteractionParams(raw, nonce);
    const params = JSON.parse(str);
    params.data.options[0].value = prompt;
    return this.postJsonAndCheckStatus(JSON.stringify(params));
  }

  async blend(finalFileNames, dimensions, nonce) {
    const raw = this.paramsMap.get('blend');
    if (!raw) return Message.failureWithDescription('blend template not found');
    const str = this.replaceInteractionParams(raw, nonce);
    const params = JSON.parse(str);
    const options = params.data.options || [];
    const attachments = params.data.attachments || [];
    for (let i = 0; i < finalFileNames.length; i++) {
      const fn = finalFileNames[i];
      const fileName = fn.includes('/') ? fn.substring(fn.lastIndexOf('/') + 1) : fn;
      attachments.push({ id: String(i), filename: fileName, uploaded_filename: fn });
      options.push({ type: 11, name: `image${i + 1}`, value: i });
    }
    options.push({ type: 3, name: 'dimensions', value: `--ar ${getBlendDimensionsValue(dimensions)}` });
    params.data.options = options;
    params.data.attachments = attachments;
    return this.postJsonAndCheckStatus(JSON.stringify(params));
  }

  async customAction(messageId, messageFlags, customId, nonce) {
    const raw = this.paramsMap.get('custom-action');
    if (!raw) return Message.failureWithDescription('custom-action template not found');
    let str = this.replaceInteractionParams(raw, nonce)
      .replace(/\$message_id/g, messageId)
      .replace(/\$custom_id/g, customId);
    const params = JSON.parse(str);
    params.message_flags = messageFlags;
    return this.postJsonAndCheckStatus(JSON.stringify(params));
  }

  async modalSubmit(taskId, fields, nonce) {
    const raw = this.paramsMap.get('modal-submit');
    if (!raw) return Message.failureWithDescription('modal-submit template not found');
    let str = this.replaceInteractionParams(raw, nonce).replace(/\$task_id/g, taskId);
    const params = JSON.parse(str);
    if (fields) {
      if (typeof fields.prompt === 'string') params.data.prompt = fields.prompt;
      if (typeof fields.maskBase64 === 'string') params.data.maskBase64 = fields.maskBase64;
    }
    return this.postJsonAndCheckStatus(JSON.stringify(params));
  }

  async edits(messageId, customId, nonce) {
    const raw = this.paramsMap.get('edits') || this.paramsMap.get('custom-action');
    if (!raw) return Message.failureWithDescription('edits template not found');
    let str = this.replaceInteractionParams(raw, nonce)
      .replace(/\$message_id/g, messageId)
      .replace(/\$custom_id/g, customId);
    const params = JSON.parse(str);
    return this.postJsonAndCheckStatus(JSON.stringify(params));
  }

  async upload(fileName, dataUrl) {
    try {
      const fileObj = { filename: fileName, file_size: dataUrl.data.length, id: '0' };
      const res = await fetch(this.discordAttachmentUrl, {
        method: 'POST',
        headers: {
          Authorization: this.account.userToken,
          'Content-Type': 'application/json',
          'User-Agent': this.account.userAgent || 'Mozilla/5.0',
        },
        body: JSON.stringify({ files: [fileObj] }),
      });
      const data = await res.json();
      if (res.status !== 200 || !data.attachments || data.attachments.length === 0) {
        return Message.failureWithDescription('Failed to get upload URL');
      }
      const attachment = data.attachments[0];
      const uploadUrl = this.discordHelper.getDiscordUploadUrl(attachment.upload_url);
      await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': dataUrl.mimeType,
          'Content-Length': String(dataUrl.data.length),
          'User-Agent': this.account.userAgent || 'Mozilla/5.0',
        },
        body: dataUrl.data,
      });
      return Message.successWithResult(attachment.upload_filename);
    } catch (e) {
      return Message.failureWithDescription(e.message || 'Upload failed');
    }
  }

  async sendImageMessage(content, finalFileName) {
    try {
      const fileName = finalFileName.includes('/') ? finalFileName.substring(finalFileName.lastIndexOf('/') + 1) : finalFileName;
      const raw = this.paramsMap.get('message');
      if (!raw) return Message.failureWithDescription('message template not found');
      const payloadStr = raw
        .replace(/\$content/g, content)
        .replace(/\$channel_id/g, this.account.channelId || '')
        .replace(/\$file_name/g, fileName)
        .replace(/\$final_file_name/g, finalFileName);
      const payload = JSON.parse(payloadStr);
      const res = await fetch(this.discordMessageUrl, {
        method: 'POST',
        headers: {
          Authorization: this.account.userToken,
          'Content-Type': 'application/json',
          'User-Agent': this.account.userAgent || 'Mozilla/5.0',
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.status === 200 && data.attachments && data.attachments.length > 0) {
        return Message.successWithResult(data.attachments[0].url);
      }
      return Message.failureWithDescription('Failed to send image message');
    } catch (e) {
      return Message.failureWithDescription(e.message || 'Send image failed');
    }
  }

  async fetchMessage(messageId) {
    try {
      const server = this.discordHelper.getServer();
      const url = `${server}/api/v9/channels/${this.account.channelId}/messages/${messageId}`;
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: this.account.userToken,
          'User-Agent': this.account.userAgent || 'Mozilla/5.0',
        },
      });
      if (res.status === 200) {
        const data = await res.json();
        return Message.successWithResult(data);
      }
      return Message.failureWithDescription(`HTTP ${res.status}`);
    } catch (e) {
      return Message.failureWithDescription(e.message || 'Fetch message failed');
    }
  }
}
