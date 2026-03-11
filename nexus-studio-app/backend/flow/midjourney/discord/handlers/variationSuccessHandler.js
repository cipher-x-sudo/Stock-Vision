/**
 * Variation success handler
 */

import { MessageHandler } from './messageHandler.js';
import { MessageType } from '../../constants.js';
import { TaskAction } from '../../constants.js';
import { parseContentWithRegex } from '../../utils/convertUtils.js';

const CONTENT_REGEX_1 = '\\*\\*(.*)\\*\\* - Variations by <@\\d+> \\((.*?)\\)';
const CONTENT_REGEX_2 = '\\*\\*(.*)\\*\\* - Variations \\(.*?\\) by <@\\d+> \\((.*?)\\)';

export class VariationSuccessHandler extends MessageHandler {
  order() {
    return 103;
  }

  handle(instance, messageType, message, eventType) {
    const content = this.getMessageContent(message);
    const parseData = this.getParseData(content);
    if (messageType === MessageType.CREATE && parseData && this.hasImage(message)) {
      this.findAndFinishImageTask(instance, TaskAction.VARIATION, parseData.prompt, message);
    }
  }

  getParseData(content) {
    return parseContentWithRegex(content, CONTENT_REGEX_1) || parseContentWithRegex(content, CONTENT_REGEX_2);
  }
}
