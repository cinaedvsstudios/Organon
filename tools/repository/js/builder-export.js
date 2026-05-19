(function(){
  function cleanGroupName(name) {
    return String(name || 'GROUP').replace(/^GROUP\s*\d*\s*:\s*/i, '').trim() || 'GROUP';
  }

  function generateBuilderOutput() {
    const items = window.builderState?.items || [];
    let out = '=== UI BUILDER SPEC ===\n\n';
    let groupCount = 0;
    for (const item of items) {
      if (item.type === 'group_start') {
        groupCount += 1;
        out += `\n======== GROUP ${groupCount}: ${cleanGroupName(item.name).toUpperCase()} ========\n\n`;
        if (!hasImmediateGroupFields(items, item.id)) {
          out += 'Notes:\n[None]\n\nThis feature should appear on:\n[Mobile] [Desktop]\n\nCode Risk:\n[Not set]\n\n';
        }
      } else if (item.type === 'group_end') {
        out += '\n================================\n\n';
      } else if (item.type === 'section') {
        out += `\n.......... ${String(item.name || '').toUpperCase()} ..........\n\n`;
        if (isPrimarySection(item.name)) {
          out += 'Align = [Not set]\nColors = [Not set]\n\nComponents:\n';
        }
      } else if (item.type === 'component') {
        out += `[${item.compId} ${item.name}]\n  Prompt: ${item.prompt || ''}\n`;
        if (item.settings) out += `  Settings: ${JSON.stringify(item.settings)}\n`;
      } else if (item.type === 'text') {
        out += `${item.text || ''}\n`;
      }
    }
    return out.trim();
  }

  function isPrimarySection(name) {
    return /TOP|UPPER|MIDDLE|CENTER|LOWER|BOTTOM/i.test(String(name || ''));
  }

  function hasImmediateGroupFields() {
    return false;
  }

  async function copyBuilderToClipboard() {
    const items = window.builderState?.items || [];
    if (items.length === 0) return showToast('Builder is empty!');
    await copyText(generateBuilderOutput());
  }

  function downloadBuilderTxt() {
    const items = window.builderState?.items || [];
    if (items.length === 0) return showToast('Builder is empty!');
    downloadText(`ui_builder_spec_${Date.now()}.txt`, generateBuilderOutput());
  }

  window.generateBuilderOutput = generateBuilderOutput;
  window.generateNotepadOutput = generateBuilderOutput;
  window.copyBuilderToClipboard = copyBuilderToClipboard;
  window.copyNotepadToClipboard = copyBuilderToClipboard;
  window.downloadBuilderTxt = downloadBuilderTxt;
  window.downloadNotepadTxt = downloadBuilderTxt;
})();
