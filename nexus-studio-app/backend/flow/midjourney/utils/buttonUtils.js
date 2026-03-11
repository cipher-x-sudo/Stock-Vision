/**
 * Extract button info from Discord message components
 */

export function extractButtonsFromMessage(message) {
  if (!message || !message.components || !Array.isArray(message.components)) return [];
  const buttons = [];
  for (const component of message.components) {
    if (component.type === 1 && component.components && Array.isArray(component.components)) {
      for (const button of component.components) {
        if (button.type === 2 && button.custom_id) {
          const info = { customId: button.custom_id, type: button.type };
          if (button.label) info.label = button.label;
          if (button.emoji) info.emoji = { name: button.emoji.name, id: button.emoji.id, animated: button.emoji.animated };
          if (button.style !== undefined) info.style = button.style;
          if (button.disabled !== undefined) info.disabled = button.disabled;
          if (button.url) info.url = button.url;
          buttons.push(info);
        }
      }
    }
  }
  return buttons;
}
