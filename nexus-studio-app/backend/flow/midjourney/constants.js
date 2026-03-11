/**
 * Return codes and task property keys for MJ API
 */

export const ReturnCode = {
  SUCCESS: 1,
  NOT_FOUND: 3,
  VALIDATION_ERROR: 4,
  FAILURE: 9,
  EXISTED: 21,
  IN_QUEUE: 22,
  QUEUE_REJECTED: 23,
  BANNED_PROMPT: 24,
};

export const TASK_PROPERTY_NOTIFY_HOOK = 'notifyHook';
export const TASK_PROPERTY_FINAL_PROMPT = 'finalPrompt';
export const TASK_PROPERTY_MESSAGE_ID = 'messageId';
export const TASK_PROPERTY_MESSAGE_HASH = 'messageHash';
export const TASK_PROPERTY_PROGRESS_MESSAGE_ID = 'progressMessageId';
export const TASK_PROPERTY_FLAGS = 'flags';
export const TASK_PROPERTY_NONCE = 'nonce';
export const TASK_PROPERTY_DISCORD_INSTANCE_ID = 'discordInstanceId';
export const TASK_PROPERTY_REFERENCED_MESSAGE_ID = 'referencedMessageId';
export const TASK_PROPERTY_SEED = 'seed';
export const TASK_PROPERTY_SEED_REQUESTED_AT = 'seedRequestedAt';
export const TASK_PROPERTY_BUTTONS = 'buttons';
export const TASK_PROPERTY_IFRAME_MODAL_CREATE_CUSTOM_ID = 'iframe_modal_custom_id';
export const TASK_PROPERTY_REMIX_MODAL_MESSAGE_ID = 'remixModalMessageId';
export const TASK_PROPERTY_INTERACTION_METADATA_ID = 'interactionMetadataId';
export const TASK_PROPERTY_CUSTOM_ID = 'customId';

/** Flag set on message object when a handler has processed it */
export const MJ_MESSAGE_HANDLED = 'mj_proxy_handled';

export const DEFAULT_DISCORD_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36';

export const DISCORD_SERVER_URL = 'https://discord.com';
export const DISCORD_CDN_URL = 'https://cdn.discordapp.com';
export const DISCORD_WSS_URL = 'wss://gateway.discord.gg';

export const WebSocketCode = {
  HEARTBEAT: 1,
  IDENTIFY: 2,
  RESUME: 6,
  RECONNECT: 7,
  INVALIDATE_SESSION: 9,
  HELLO: 10,
  HEARTBEAT_ACK: 11,
  DISPATCH: 0,
};

export const TaskAction = {
  IMAGINE: 'IMAGINE',
  UPSCALE: 'UPSCALE',
  VARIATION: 'VARIATION',
  REROLL: 'REROLL',
  DESCRIBE: 'DESCRIBE',
  SHORTEN: 'SHORTEN',
  BLEND: 'BLEND',
};

export const TaskStatus = {
  NOT_START: 'NOT_START',
  SUBMITTED: 'SUBMITTED',
  IN_PROGRESS: 'IN_PROGRESS',
  FAILURE: 'FAILURE',
  SUCCESS: 'SUCCESS',
  MODAL: 'MODAL',
};

/** Discord message event types for Gateway */
export const MessageType = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
};

export function getMessageType(eventType) {
  switch (eventType) {
    case 'MESSAGE_CREATE':
      return MessageType.CREATE;
    case 'MESSAGE_UPDATE':
      return MessageType.UPDATE;
    case 'MESSAGE_DELETE':
      return MessageType.DELETE;
    default:
      return null;
  }
}

export const BlendDimensions = {
  PORTRAIT: 'PORTRAIT',
  SQUARE: 'SQUARE',
  LANDSCAPE: 'LANDSCAPE',
};

export function getBlendDimensionsValue(dimensions) {
  switch (dimensions) {
    case BlendDimensions.PORTRAIT:
      return '2:3';
    case BlendDimensions.SQUARE:
      return '1:1';
    case BlendDimensions.LANDSCAPE:
      return '3:2';
    default:
      return '1:1';
  }
}
