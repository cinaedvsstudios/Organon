ORGANON VIDCOMPRESSOR — v0.01

LOCATION
Place this complete folder at:
  tools/vidcompressor/

TOOLBAR PLACEMENT
Add the VidCompressor launch item to Organon's VIDEO toolbar group. It does not belong in the Image group.
Its iframe/source path is:
  tools/vidcompressor/index.html

WHAT THIS VERSION DOES
- Opens MP4, M4V, MOV, MKV, AVI and WebM video files.
- Uses one Compression slider only: Smallest File to Highest Quality.
- Keeps the source dimensions.
- Uses H.264 video with AAC audio.
- Shows original size, compressed size and file-size change.
- Lets a File System Access API picker-opened MP4/M4V/MOV/MKV/AVI be overwritten after confirmation.
- Lets dropped files and all other cases save a new copy.
- WebM is exported as MP4, so it always saves as a new copy in this version.
- Runs locally in the browser after the Organon site has loaded. Video content is not sent to an Organon server.

BROWSER REQUIREMENT FOR DIRECT OVERWRITE
Use current Chrome or Edge over HTTPS or localhost. The browser's File System Access API is needed to reopen a file with write permission and overwrite it. The module falls back to Save New Copy where that API is unavailable.

IMPORTANT
The FFmpeg engine is bundled in vendor/ and is about 31 MB. It is loaded only when the user first compresses a video in a browser tab. Video files are held in browser memory while compressing, so very long/large files may need substantial available RAM.

IMPLEMENTATION NOTE
The actual Organon hub/index source was not supplied with this delivery, so this package contains the finished sub-tool but cannot itself inject the Video-toolbar item into an absent hub file.
