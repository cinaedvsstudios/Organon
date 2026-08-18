ORGANON VIDCOMPRESSOR — v0.04

LOCATION
The active files are stored at:
  tools/vidcompressor/

ACTIVE ENTRY
  tools/vidcompressor/index.html

TOOLBAR PLACEMENT
VidCompressor belongs in Organon's VIDEO toolbar group.

SINGLE VIDEO MODE
- Opens MP4, M4V, MOV, MKV, AVI, WebM, OGV and OGG video files.
- Converts or compresses to MP4/H.264/AAC or OGV/Theora/Vorbis.
- Supports Smart Smaller File, Target File Size and Manual Bitrates.
- Displays a live estimated output-size range.
- Keeps separate video and audio controls.
- Allows Save Over Original only when the opened source handle and output extension match.

BULK CONVERT MODE
- Use the Bulk Convert button in the top header to switch modes.
- Add or drop multiple videos into one queue.
- All output format, compression, resolution, pass and audio settings apply to every queued video.
- The Batch Queue shows a selectable dot for each file. Selecting a different file updates the existing estimate panel using that video's size, duration and dimensions.
- Save Options must be used before conversion. It opens the browser directory picker and stores the selected writable folder handle for the current session.
- Convert Queue remains disabled until an output folder has been authorised.
- Videos are processed sequentially, one at a time, to avoid keeping multiple FFmpeg jobs in memory simultaneously.
- Each completed video is written directly to the authorised folder before the next video starts.
- Existing filenames are never silently overwritten. If name-compressed.ext already exists, the output becomes name-compressed-2.ext, then -3, and so on.
- Queue rows show Ready, Converting, Saved or Failed status.
- The latest completed conversion is shown in the result card.

SIZE TARGETING
The estimated size is calculated from video bitrate + audio bitrate + duration + a format/container allowance.
The estimate is displayed as a range rather than an exact promise.

TWO-PASS ENCODING
Two-pass remains the default. Pass one analyses scene complexity and pass two writes the final result. One-pass is available when speed matters more than size accuracy.

BROWSER REQUIREMENTS
Direct overwrite and bulk folder saving use the File System Access API. Use a current Chromium-based browser over HTTPS or localhost. Bulk mode requires showDirectoryPicker support.

IMPORTANT
The FFmpeg engine remains browser-local and is loaded only when conversion begins. Large videos and two-pass conversion can require substantial time and available RAM.
