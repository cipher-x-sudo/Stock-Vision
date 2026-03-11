/**
 * User message listener - dispatch Discord events to handlers
 */

import { getMessageType, MessageType } from '../constants.js';
import { MJ_MESSAGE_HANDLED } from '../constants.js';

export class UserMessageListener {
  constructor(messageHandlers) {
    this.instance = null;
    this.messageHandlers = [...(messageHandlers || [])].sort((a, b) => (a.order?.() ?? 100) - (b.order?.() ?? 100));
  }

  setInstance(instance) {
    this.instance = instance;
  }

  onMessage(raw) {
    if (!this.instance) return;
    const eventType = raw.t;
    const messageType = getMessageType(eventType);
    const data = raw.d;

    if (messageType) {
      if (messageType === MessageType.DELETE) return;
      if (this.ignoreAndLogMessage(data, messageType)) return;
    }

    setTimeout(() => {
      for (const handler of this.messageHandlers) {
        if (data[MJ_MESSAGE_HANDLED] === true) return;
        handler.handle(this.instance, messageType || MessageType.CREATE, data, eventType);
      }
    }, 50);
  }

  ignoreAndLogMessage(data, messageType) {
    const channelId = data?.channel_id;
    const guildId = data?.guild_id;
    const isDM = !guildId || data?.channel_type === 1;
    if (!this.instance) return true;
    if (!isDM && channelId !== this.instance.account()?.channelId) return true;
    const authorName = data?.author?.username || 'System';
    const content = (data?.content || '').substring(0, 60);
    const channelTypeStr = isDM ? 'DM' : 'Channel';
    const display = this.instance.account()?.getDisplay?.() ?? this.instance.getInstanceId?.() ?? '';
    if (typeof console?.debug === 'function') {
      console.debug(`${display} - ${messageType} - ${channelTypeStr} - ${authorName}: ${content}`);
    }
    return false;
  }
}
