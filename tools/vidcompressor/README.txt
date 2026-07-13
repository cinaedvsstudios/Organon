ORGANON VIDCOMPRESSOR — v0.03

LOCATION
The active files are stored at:
  tools/vidcompressor/

ACTIVE ENTRY
  tools/vidcompressor/index.html

TOOLBAR PLACEMENT
VidCompressor belongs in Organon's VIDEO toolbar group.

WHAT THIS VERSION DOES
- Opens MP4, M4V, MOV, MKV, AVI, WebM, OGV and OGG video files.
- Converts or compresses to MP4/H.264/AAC or OGV/Theora/Vorbis.
- Adds three compression modes:
  - Smart Smaller File: targets 35% to 95% of the original size.
  - Target File Size: calculates bitrates from a requested MB value.
  - Manual Bitrates: uses a directly selected video bitrate.
- Displays a live estimated output-size range whenever the size, video or audio settings change.
- Separates video and audio controls.
- Video controls include calculated/manual bitrate, Keep/Auto/1080p/720p/480p resolution and one-pass/two-pass encoding.
- Audio controls include Remove Audio, 64/96/128/160/192/256 kbps and Keep/Mono/Stereo channel selection.
- Uses format-aware estimate ranges because OGV/Theora output varies more than H.264 at the same nominal bitrate.
- Shows the original, estimated and actual sizes plus estimate accuracy after compression.
- Warns before compression when settings are likely to make the output larger than the original or leave too little bitrate for the selected resolution.
- Keeps Save Over Original restricted to matching input/output extensions.
- Shows an explanatory fallback instead of a broken preview when the browser cannot play Theora/OGV.
- Runs locally in the browser. Video content is not sent to an Organon server.

SIZE TARGETING
The estimated size is calculated from:
  video bitrate + audio bitrate + video duration + a small format/container allowance.

The estimate is displayed as a range rather than an exact promise:
- MP4/H.264: narrower range, especially in two-pass mode.
- OGV/Theora: wider range because Theora can undershoot or overshoot the nominal bitrate depending on the source material.

TWO-PASS ENCODING
Two-pass is the default. The first pass analyses scene complexity. The second pass creates the final file using the calculated bitrate allocation. One-pass is available when faster processing matters more than final-size accuracy.

BROWSER REQUIREMENT FOR DIRECT OVERWRITE
Use current Chrome or Edge over HTTPS or localhost. The browser's File System Access API is needed to reopen a file with write permission and overwrite it. The module falls back to Save New Copy where that API is unavailable.

IMPORTANT
The FFmpeg engine is bundled in vendor/ and is loaded only when the user first compresses a video in a browser tab. Video files are held in browser memory while compressing, and two-pass encoding processes the video twice, so long or high-resolution files may require substantial time and available RAM.
