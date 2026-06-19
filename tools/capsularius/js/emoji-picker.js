const CHOICES = [
  ['📄','file document page'],['📁','folder'],['🗂️','folders organiser'],['🗃️','archive box'],['📝','memo writing'],['📚','library books'],['📕','pdf book'],['📘','word document'],['📙','presentation'],['🖼️','image picture photo frame'],['📷','camera photo'],['🎨','art palette design'],['🎮','game controller'],['🎲','blender 3d dice'],['📐','3d model ruler'],['🎵','music audio note'],['🎼','midi music score'],['🎧','headphones audio'],['🎥','video camera movie'],['🎬','film video'],['📦','package archive zip'],['🗜️','compression archive'],['💿','disc iso'],['⚙️','code settings executable'],['🧰','tools installer'],['🗄️','database storage'],['🌐','web internet html'],['💻','computer code'],['🐍','python'],['☕','java'],['🔤','font letters'],['📊','chart spreadsheet'],['🌊','volume fluid data'],['🧬','data science'],['🗺️','map'],['🧪','test laboratory'],['⭐','star'],['✨','sparkles'],['💎','gem'],['🪙','coin']
];

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function closeEmojiPicker() {
  document.querySelector('.caps-emoji-picker')?.remove();
}

export function openEmojiPicker(input) {
  closeEmojiPicker();
  const picker = el('section','caps-emoji-picker');
  const search = document.createElement('input');
  search.type = 'search';
  search.placeholder = 'Search emoji…';
  search.autocomplete = 'off';
  const grid = el('div','caps-emoji-grid');
  const render = () => {
    const term = search.value.trim().toLowerCase();
    grid.replaceChildren();
    CHOICES.filter(([emoji,name]) => !term || emoji.includes(term) || name.includes(term)).forEach(([emoji,name]) => {
      const button = el('button','caps-emoji-choice',emoji);
      button.type = 'button';
      button.title = name;
      button.addEventListener('click', () => {
        input.value = emoji;
        input.dispatchEvent(new Event('input',{ bubbles:true }));
        input.focus();
        closeEmojiPicker();
      });
      grid.append(button);
    });
    if (!grid.children.length) grid.append(el('p','caps-emoji-empty','No match. Paste your own icon instead.'));
  };
  search.addEventListener('input',render);
  search.addEventListener('keydown',(event) => { if (event.key === 'Escape') closeEmojiPicker(); });
  picker.append(search,grid);
  const box = input.getBoundingClientRect();
  picker.style.left = `${Math.max(8,Math.min(box.left,window.innerWidth-312))}px`;
  picker.style.top = `${Math.max(8,Math.min(box.bottom+6,window.innerHeight-340))}px`;
  document.body.append(picker);
  render();
  setTimeout(() => {
    search.focus();
    document.addEventListener('pointerdown',(event) => { if (!picker.contains(event.target) && event.target !== input) closeEmojiPicker(); },{ once:true });
  },0);
}
