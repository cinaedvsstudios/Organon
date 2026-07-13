ORGANON VIDCOMPRESSOR — v0.02

LOCATION
The active files are stored at:
  tools/vidcompressor/

ACTIVE ENTRY
  tools/vidcompressor/index.html

TOOLBAR PLACEMENT
VidCompressor belongs in Organon's VIDEO toolbar group.

WHAT THIS VERSION DOES
- Opens MP4, M4V, MOV, MKV, AVI, WebM, OGV and OGG video files.
- Provides an Output Format selector:
  - Keep source format where supported.
  - MP4 using H.264 video and AAC audio.
  - OGV using Theora video and Vorbis audio.
- Uses one Compression slider, mapped separately for H.264/AAC and Theora/Vorbis.
- Keeps the source dimensions.
- Shows original size, compressed size and file-size change.
- Saves OGV output with the .ogv extension and video/ogg MIME type.
- Allows Save Over Original only when the chosen output extension matches the opened source extension.
- Requires Save New Copy when converting between formats.
- Shows an explanatory fallback instead of a broken preview when the browser cannot play Theora/OGV.
- Runs locally in the browser. Video content is not sent to an Organon server.

OGV COMPRESSION
OGV output uses:
  Video: libtheora with quality mapped from 0 to 10.
  Audio: libvorbis with quality mapped from 0 to 8.

MP4 COMPRESSION
MP4-compatible output continues to use:
  Video: libx264 with CRF mapped from 35 to 18.
  Audio: AAC from 96k to 192k depending on the selected quality.

BROWSER REQUIREMENT FOR DIRECT OVERWRITE
Use current Chrome or Edge over HTTPS or localhost. The browser's File System Access API is needed to reopen a file with write permission and overwrite it. The module falls back to Save New Copy where that API is unavailable.

IMPORTANT
The FFmpeg engine is bundled in vendor/ and is loaded only when the user first compresses a video in a browser tab. Video files are held in browser memory while compressing, so very long or large files may require substantial available RAM.

The active JavaScript is split into four sequential classic-script files so the implementation remains practical to maintain without changing the existing browser execution model.
