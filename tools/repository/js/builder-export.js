(function(){
  function cleanGroupName(name) {
    return String(name || 'GROUP').replace(/^GROUP\s*\d*\s*:\s*/i, '').trim() || 'GROUP';
  }

  function isPrimarySection(name) { return /TOP|UPPER|MID|MIDDLE|CENTER|LOWER|BOTTOM/i.test(String(name || '')); }

  function exportItems(items, depth = 0, counters = { group: 0 }) {
    let out = '';
    const indent = depth > 0 ? '' : '';
    for (const item of items || []) {
      if (item.type === 'group') {
        counters.group += 1;
        out += `\n======== GROUP ${counters.group}: ${cleanGroupName(item.name).toUpperCase()} ========\n\n`;
        out += 'Notes:\n[None]\n\nThis feature should appear on:\n[Mobile] [Desktop]\n\nCode Risk:\n[Not set]\n\n';
        out += exportItems(item.children || [], depth + 1, counters);
        out += '\n================================\n\n';
      } else if (item.type === 'section') {
        out += `\n.......... ${String(item.name || '').toUpperCase()} ..........\n\n`;
        if (isPrimarySection(item.name)) {
          out += 'Align = [Not set]\nColors = [Not set]\n\nComponents:\n';
        }
        out += exportItems(item.children || [], depth + 1, counters);
        out += '\n..........\n\n';
      } else if (item.type === 'component') {
        out += `${indent}[${item.compId} ${item.name}]\n  Prompt: ${item.prompt || ''}\n`;
        if (item.settings) out += `  Settings: ${JSON.stringify(item.settings)}\n`;
      } else if (item.type === 'text') {
        const text = String(item.text || '').trim();
        if (text) out += `${indent}${text}\n`;
      }
    }
    return out;
  }

  function generateBuilderOutput() {
    const items = window.builderState?.items || [];
    const out = '=== UI BUILDER SPEC ===\n\n' + exportItems(items).trim();
    return out.trim();
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
