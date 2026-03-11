/**
 * Midjourney module config - load from env or defaults
 */

const DEFAULT_DISCORD_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36';

function parseAccounts() {
  const channelId = process.env.MJ_DISCORD_CHANNEL_ID;
  const userToken = process.env.MJ_DISCORD_USER_TOKEN;
  const guildId = process.env.MJ_DISCORD_GUILD_ID;
  const userAgent = process.env.MJ_DISCORD_USER_AGENT || DEFAULT_DISCORD_USER_AGENT;

  if (!channelId || !userToken) {
    return [];
  }

  return [{
    channelId: channelId.trim(),
    userToken: userToken.trim(),
    guildId: guildId ? guildId.trim() : undefined,
    userAgent: userAgent.trim(),
    enable: true,
    coreSize: parseInt(process.env.MJ_CORE_SIZE || '3', 10) || 3,
    queueSize: parseInt(process.env.MJ_QUEUE_SIZE || '10', 10) || 10,
    timeoutMinutes: parseInt(process.env.MJ_TIMEOUT_MINUTES || '5', 10) || 5,
  }];
}

const taskStoreType = process.env.MJ_TASK_STORE_TYPE || 'in_memory';
const redisUrl = process.env.MJ_REDIS_URL || '';

const config = {
  taskStore: {
    type: taskStoreType,
    timeout: process.env.MJ_TASK_STORE_TIMEOUT || '30d',
    redisUrl: redisUrl || undefined,
  },
  accounts: parseAccounts(),
  ngDiscord: {
    server: process.env.MJ_DISCORD_SERVER || 'https://discord.com',
    cdn: process.env.MJ_DISCORD_CDN || 'https://cdn.discordapp.com',
    wss: process.env.MJ_DISCORD_WSS || 'wss://gateway.discord.gg',
    resumeWss: process.env.MJ_DISCORD_RESUME_WSS || 'wss://gateway.discord.gg',
    uploadServer: process.env.MJ_DISCORD_UPLOAD_URL || 'https://discord-attachments-uploads-prd.storage.googleapis.com',
  },
  bodyLimit: parseInt(process.env.MJ_BODY_LIMIT || '26214400', 10) || 25 * 1024 * 1024, // 25MB
  notifyHook: process.env.MJ_NOTIFY_HOOK || '',
  notifyPoolSize: parseInt(process.env.MJ_NOTIFY_POOL_SIZE || '4', 10) || 4,
};

export default config;
