/**
 * Discord account model - guildId, channelId, userToken, userAgent, etc.
 */

import { DEFAULT_DISCORD_USER_AGENT } from '../constants.js';

export class DiscordAccount {
  id;
  properties = {};
  guildId;
  channelId;
  userToken;
  userAgent = DEFAULT_DISCORD_USER_AGENT;
  enable = true;
  coreSize = 3;
  queueSize = 10;
  timeoutMinutes = 5;

  setProperty(name, value) {
    this.properties[name] = value;
    return this;
  }

  getProperty(name) {
    return this.properties?.[name];
  }

  getDisplay() {
    return this.channelId || '';
  }
}
