/**
 * Export all message handlers for UserMessageListener
 */

import { ErrorMessageHandler } from './errorMessageHandler.js';
import { DescribeSuccessHandler } from './describeSuccessHandler.js';
import { ShortenSuccessHandler } from './shortenSuccessHandler.js';
import { ProgressMessageIdUpdateHandler } from './progressMessageIdUpdateHandler.js';
import { BlendSuccessHandler } from './blendSuccessHandler.js';
import { StartAndProgressHandler } from './startAndProgressHandler.js';
import { ImagineSuccessHandler } from './imagineSuccessHandler.js';
import { UpscaleSuccessHandler } from './upscaleSuccessHandler.js';
import { VariationSuccessHandler } from './variationSuccessHandler.js';
import { RerollSuccessHandler } from './rerollSuccessHandler.js';

export function createMessageHandlers(discordHelper) {
  return [
    new ErrorMessageHandler(discordHelper),
    new DescribeSuccessHandler(discordHelper),
    new ShortenSuccessHandler(discordHelper),
    new ProgressMessageIdUpdateHandler(discordHelper),
    new BlendSuccessHandler(discordHelper),
    new StartAndProgressHandler(discordHelper),
    new ImagineSuccessHandler(discordHelper),
    new UpscaleSuccessHandler(discordHelper),
    new VariationSuccessHandler(discordHelper),
    new RerollSuccessHandler(discordHelper),
  ];
}
