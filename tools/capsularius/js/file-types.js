import { extensionOf, iconForEntry, typeForFile } from './filesystem.js';

export const FILE_TYPE_OVERRIDES_KEY = 'capsularius.fileTypeOverrides.v1';

export const FILE_TYPES = Object.freeze({
  jpg: ['🖼️', 'JPEG Image · .jpg'], jpeg: ['🖼️', 'JPEG Image · .jpeg'], png: ['🖼️', 'PNG Image · .png'], gif: ['🖼️', 'GIF Image · .gif'], webp: ['🖼️', 'WebP Image · .webp'], bmp: ['🖼️', 'Bitmap Image · .bmp'], avif: ['🖼️', 'AVIF Image · .avif'], svg: ['🖼️', 'SVG Vector · .svg'], tif: ['🖼️', 'TIFF Image · .tif'], tiff: ['🖼️', 'TIFF Image · .tiff'], ico: ['🖼️', 'Icon Image · .ico'], heic: ['🖼️', 'HEIC Image · .heic'],
  mp3: ['🎵', 'MP3 Audio · .mp3'], wav: ['🎵', 'WAV Audio · .wav'], ogg: ['🎵', 'Ogg Audio · .ogg'], m4a: ['🎵', 'M4A Audio · .m4a'], flac: ['🎵', 'FLAC Audio · .flac'], aac: ['🎵', 'AAC Audio · .aac'], wma: ['🎵', 'WMA Audio · .wma'], aiff: ['🎵', 'AIFF Audio · .aiff'], mid: ['🎼', 'MIDI File · .mid'], midi: ['🎼', 'MIDI File · .midi'],
  mp4: ['🎥', 'MP4 Video · .mp4'], webm: ['🎥', 'WebM Video · .webm'], mov: ['🎥', 'QuickTime Video · .mov'], mkv: ['🎥', 'Matroska Video · .mkv'], avi: ['🎥', 'AVI Video · .avi'], mpeg: ['🎥', 'MPEG Video · .mpeg'], mpg: ['🎥', 'MPEG Video · .mpg'], m4v: ['🎥', 'M4V Video · .m4v'],
  glb: ['📐', '3D Model · .glb'], gltf: ['📐', '3D Model · .gltf'], obj: ['📐', '3D Model · .obj'], fbx: ['📐', '3D Model · .fbx'], stl: ['📐', '3D Model · .stl'], dae: ['📐', '3D Model · .dae'], blend: ['🎲', 'Blender File · .blend'], unitypackage: ['🎮', 'Unity Package · .unitypackage'], unity: ['🎮', 'Unity Asset · .unity'], uni: ['🎮', 'Data File · .uni'], uasset: ['🎮', 'Unreal Asset · .uasset'], umap: ['🎮', 'Unreal Map · .umap'], pak: ['🎮', 'Game Package · .pak'],
  pdf: ['📕', 'PDF Document · .pdf'], doc: ['📘', 'Word Document · .doc'], docx: ['📘', 'Word Document · .docx'], odt: ['📘', 'OpenDocument Text · .odt'], rtf: ['📘', 'Rich Text Document · .rtf'], xls: ['📊', 'Excel Workbook · .xls'], xlsx: ['📊', 'Excel Workbook · .xlsx'], ods: ['📊', 'OpenDocument Spreadsheet · .ods'], csv: ['📊', 'CSV Data · .csv'], tsv: ['📊', 'TSV Data · .tsv'], ppt: ['📙', 'PowerPoint Presentation · .ppt'], pptx: ['📙', 'PowerPoint Presentation · .pptx'], odp: ['📙', 'OpenDocument Presentation · .odp'],
  ttf: ['🔤', 'TrueType Font · .ttf'], otf: ['🔤', 'OpenType Font · .otf'], woff: ['🔤', 'Web Font · .woff'], woff2: ['🔤', 'Web Font · .woff2'],
  zip: ['📦', 'ZIP Archive · .zip'], rar: ['📦', 'RAR Archive · .rar'], '7z': ['📦', '7-Zip Archive · .7z'], tar: ['📦', 'TAR Archive · .tar'], gz: ['📦', 'GZip Archive · .gz'], bz2: ['📦', 'BZip2 Archive · .bz2'], iso: ['💿', 'Disc Image · .iso'], exe: ['⚙️', 'Windows Application · .exe'], msi: ['⚙️', 'Windows Installer · .msi'], apk: ['⚙️', 'Android Package · .apk'],
  txt: ['📄', 'Text File · .txt'], md: ['📝', 'Markdown Document · .md'], log: ['📄', 'Log File · .log'], json: ['⚙️', 'JSON Data · .json'], xml: ['⚙️', 'XML Data · .xml'], yaml: ['⚙️', 'YAML Data · .yaml'], yml: ['⚙️', 'YAML Data · .yml'], ini: ['⚙️', 'Configuration · .ini'], cfg: ['⚙️', 'Configuration · .cfg'], conf: ['⚙️', 'Configuration · .conf'], html: ['🌐', 'HTML Document · .html'], htm: ['🌐', 'HTML Document · .htm'], css: ['🎨', 'Stylesheet · .css'], js: ['⚙️', 'JavaScript · .js'], mjs: ['⚙️', 'JavaScript Module · .mjs'], cjs: ['⚙️', 'CommonJS Module · .cjs'], ts: ['⚙️', 'TypeScript · .ts'], tsx: ['⚙️', 'TypeScript React · .tsx'], jsx: ['⚙️', 'JavaScript React · .jsx'], py: ['🐍', 'Python Script · .py'], java: ['☕', 'Java Source · .java'], cs: ['⚙️', 'C# Source · .cs'], cpp: ['⚙️', 'C++ Source · .cpp'], c: ['⚙️', 'C Source · .c'], h: ['⚙️', 'Header File · .h'], php: ['⚙️', 'PHP Script · .php'], sql: ['🗄️', 'SQL Script · .sql'], sh: ['⚙️', 'Shell Script · .sh'], bat: ['⚙️', 'Batch Script · .bat'], ps1: ['⚙️', 'PowerShell Script · .ps1'],
  psd: ['🎨', 'Photoshop File · .psd'], ai: ['🎨', 'Illustrator File · .ai'], aseprite: ['🎨', 'Aseprite File · .aseprite'], kra: ['🎨', 'Krita File · .kra'], xcf: ['🎨', 'GIMP File · .xcf'], db: ['🗄️', 'Database File · .db'], sqlite: ['🗄️', 'SQLite Database · .sqlite'], vdb: ['🌊', 'Volume Data · .vdb'], bin: ['📄', 'Binary Data · .bin'], dat: ['📄', 'Data File · .dat']
});

function readOverrides() {
  try {
    const value = JSON.parse(localStorage.getItem(FILE_TYPE_OVERRIDES_KEY) || '{}');
    return value && typeof value === 'object' ? value : {};
  } catch (_) {
    return {};
  }
}

export function saveOverrides(value) {
  localStorage.setItem(FILE_TYPE_OVERRIDES_KEY, JSON.stringify(value));
}

export function fileTypeDescriptor(name) {
  const extension = extensionOf(name);
  const override = String(readOverrides()[extension] || '').trim();
  const fallback = FILE_TYPES[extension];
  const icon = fallback?.[0] || iconForEntry({ kind: 'file', name, fileType: typeForFile(name) });
  const label = override || fallback?.[1] || (extension ? `File · .${extension}` : 'File');
  return { extension, icon, label };
}

export function allKnownExtensions(extra = []) {
  return [...new Set([...Object.keys(FILE_TYPES), ...extra.filter(Boolean)])].sort((first, second) => first.localeCompare(second));
}
