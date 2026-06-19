const CHOICES = [
  // Files, folders and documents
  ['📄','file document page'],['📃','document page text'],['📑','bookmarks document tabs'],['🗒️','note document'],['📝','memo writing note'],['📋','clipboard list'],['📂','open folder'],['📁','folder'],['🗀','folder file'],['🗁','folder document'],['🗂️','folders organiser'],['🗃️','archive box'],['🗄️','database storage cabinet'],['📚','library books'],['📖','open book'],['📕','pdf red book'],['📘','word blue book'],['📗','spreadsheet green book'],['📙','presentation orange book'],['📓','notebook'],['📔','decorative notebook'],['📒','ledger'],['📜','scroll document'],['📰','newspaper'],['🧾','receipt invoice'],
  // Images, design and art
  ['🖼️','image picture photo frame'],['🖼','image picture frame'],['📷','camera photo'],['📸','camera flash photo'],['🎨','art palette design'],['🖌️','paint brush'],['🖍️','crayon art'],['✏️','pencil edit'],['✒️','pen ink'],['🖊️','pen writing'],['🧿','art eye'],['🪄','magic wand effect'],['✨','sparkles effect'],['💫','dizzy star effect'],['🌈','rainbow colour'],['🎭','masks theatre art'],['🧩','puzzle game asset'],['🪞','mirror'],['🖥️','display monitor'],['🖨️','printer'],['📐','ruler triangle 3d model'],['📏','ruler measure'],['✂️','scissors cut'],['🧵','thread textile'],['🪡','needle sewing'],
  // 3D, games and tools
  ['🎮','game controller'],['🕹️','joystick arcade'],['🎲','dice blender 3d'],['🎯','target game'],['🧱','brick building asset'],['🏗️','construction crane'],['🏛️','building architecture'],['🗿','statue model'],['🪨','rock asset'],['⚒️','hammer pick tools'],['🔨','hammer'],['🪚','saw'],['🔧','wrench configuration'],['🪛','screwdriver'],['⚙️','gear code settings executable'],['🛠️','tools repair'],['🧰','toolbox installer'],['🔩','bolt hardware'],['⛓️','chain'],['🧲','magnet'],['🔬','microscope'],['🔭','telescope'],['🧪','test laboratory'],['🧫','petri dish'],['🧬','dna data science'],
  // Music, audio and video
  ['🎵','music audio note'],['🎶','music notes'],['🎼','midi music score'],['🎧','headphones audio'],['🎤','microphone vocal'],['🎙️','studio microphone recording'],['🔊','speaker loud sound'],['🔉','speaker audio'],['🔇','muted sound'],['📻','radio audio'],['🎚️','audio sliders mixer'],['🎛️','control knobs mixer'],['🎹','keyboard piano midi'],['🥁','drum percussion'],['🎷','saxophone music'],['🎸','guitar music'],['🎺','trumpet music'],['🎻','violin music'],['🎥','video camera movie'],['🎬','film clapperboard'],['📽️','film projector'],['📺','television video'],['📼','vhs tape'],['🎞️','film frames'],['📹','video camera recording'],
  // Web, code, data and technology
  ['🌐','web internet html'],['💻','computer code'],['🖥️','desktop monitor'],['⌨️','keyboard script'],['🖱️','computer mouse'],['📱','mobile app phone'],['📲','mobile download app'],['🔌','plug integration'],['🛰️','satellite map'],['📡','signal network'],['🔗','link url'],['🔒','lock secure'],['🔓','unlock'],['🔐','secure key lock'],['🔑','key access'],['🗝️','old key'],['🐍','python'],['☕','java'],['💎','ruby gem'],['🐘','postgres database elephant'],['🐳','docker whale'],['☁️','cloud drive'],['🛜','wireless network'],['📶','signal bars'],['🧠','ai brain'],
  // Archives, packages and storage
  ['📦','package archive zip'],['🗜️','compression archive'],['💿','disc iso'],['📀','dvd disc'],['🧳','package suitcase'],['🎒','package bag'],['🪣','container bucket'],['🗑️','trash delete'],['♻️','recycle'],['🪤','trap package'],['🛢️','oil barrel storage'],['🧱','block data'],['🧺','basket collection'],['🪙','coin'],['💰','money bag'],['💳','payment card'],['🏷️','tag label'],['🔖','bookmark'],['📌','pin'],['📍','location pin'],
  // Data, science, maps and general
  ['📊','chart spreadsheet'],['📈','graph analytics rise'],['📉','graph analytics fall'],['🗺️','map'],['🧭','compass navigation'],['🌊','volume fluid data'],['🔥','fire effect'],['💧','water liquid'],['⚡','electric energy'],['❄️','ice snow'],['🌪️','wind vortex'],['🌙','night moon'],['☀️','sun light'],['🌲','forest tree'],['🌳','tree'],['🌿','plant'],['🍃','leaf'],['🌸','flower'],['🦴','bone'],['💀','skull'],['👁️','eye'],['⭐','star'],['🌟','glowing star'],['🏆','trophy'],['🎁','gift']
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
