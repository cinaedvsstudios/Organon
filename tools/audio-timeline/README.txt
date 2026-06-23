ORGANON AUDIO TIMELINE — ADVANCED MODE v0.10

Rollback baseline: v0.09.

Changed in v0.10:
- Restored the missing Advanced Mode startup calls that register file dropping and preview resizing.
- Dropping operating-system files anywhere in the window, or directly on the Project Files pad, now adds them to Project Files.
- Project File rows now include standard drag payload fallbacks and can be dropped onto an empty timeline, an existing lane, or blank timeline space.
- External-file drops are handled exactly once, including when aimed directly at the Project Files pad.
- Dropping a Project File into a different-type lane creates a correctly typed new layer rather than rejecting it.

Unchanged:
- Basic Mode index.html and its original JavaScript remain separate and untouched.
- Files imported into Project Files do not enter the timeline automatically.


v0.12
- Project Files use blue video, red audio, and gold image cards with emoji identifiers.
- JPEG/JPG imports are Background clips: gold, rendered behind visuals, and always grouped beneath audio at the bottom of the timeline.
- GIF/WebP/PNG remain top-layer Sticker assets.


V0.12 FIX
Project File rows can now be dragged reliably onto the timeline. The implementation keeps the dragged DOM row in place, stores the active file ID for dragover/drop, and does not depend on DataTransfer.getData() during dragover.
