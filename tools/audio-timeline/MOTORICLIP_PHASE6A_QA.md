# MotoriClip Phase 6A — Preview performance pass
Date: 17 November 2026 (Berlin)
Scope: Advanced mode preview performance only. No exporter or transitions in this PR.

## Implemented
- Cache top-to-bottom visual track order, invalidating when the track array or any ID/type/order changes.
- Cache processed chroma/light/dark transparency for **static** stickers, preserving full original 1600px processing limit and compositing opacity/blend controls. Reprocess only if the source media or transparency settings change.
- Bound the processed sticker cache to **three** entries (LRU) to avoid retaining every large canvas from a multi-clip project.
- Discard processed images when their tracks are removed or the project is cleared.
- Avoid caching animated GIF/WebP stickers, which could freeze visible animation if cached.
- Keep existing Basic mode unchanged.

## Automated checks
Five new tests passing in a JavaScript mock-canvas harness:
1. Same static PNG processed once across repeated frames
2. Opacity change reuses cache; key colour and feather change invalidate cache
3. GIF chroma key is recalculated for animation
4. Cache stays limited and removes stale source entries on deletion/clear
5. Track ordering cache reuses the array but rebuilds on order changes

## Still required for real-browser performance sign-off

Measure the following on desktop Chrome/Edge, ideally using Chrome Performance + Memory tools, with no transitions:
| Project | Assets | Scenarios |
|---|---|---|
| P02 | 2 MP4 clips + JPEG + PNG | import latency, 1080p scrubbing, play CPU, PNG snapshot |
| P10 | 10 short MP4 clips, audio track, 3 keyed PNGs | continuous playback, rapid scrubbing, clip trimming, heap growth |
| P25 | 25 mixed clips, 6 keyed PNGs, background + audio | repeated previews, deleting 10 clips, clear/re-import, memory after GC |

Compare before/after branch performance, recording average preview FPS, main-thread long tasks, and peak/retained memory. These measurements have **not** been gathered from a real device here.

## Next
Phase 6B — Add baseline Advanced video export with proper format detection, audio mix, progress and cancellation. MediaRecorder-based browser recording (if used) must be clearly labeled **real-time**, not represented as deterministic frame-accurate export. Full deterministic encoding via WebCodecs / Mediabunny remains an additional engineering step.
