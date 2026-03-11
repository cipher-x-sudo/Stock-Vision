/**
 * Blend success handler
 */

import { MessageHandler } from './messageHandler.js';
import { MessageType } from '../../constants.js';
import { TaskAction } from '../../constants.js';
import { parseContent } from '../../utils/convertUtils.js';

export class BlendSuccessHandler extends MessageHandler {
  order() {
    return 89;
  }

  handle(instance, messageType, message, eventType) {
    const content = this.getMessageContent(message);
    const parseData = parseContent(content);
    if (!parseData || messageType !== MessageType.CREATE) return;
    const interactionName = this.getInteractionName(message);
    if (interactionName === 'blend') {
      const task = instance.getRunningTaskByNonce(this.getMessageNonce(message));
      if (task) {
        task.promptEn = parseData.prompt;
        task.prompt = parseData.prompt;
      }
    }
    if (this.hasImage(message)) {
      this.findAndFinishImageTask(instance, TaskAction.BLEND, parseData.prompt, message);
    }
  }
}
