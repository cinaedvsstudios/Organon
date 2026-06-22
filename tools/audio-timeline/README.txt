ORGANON ADVANCED AUDIO TIMELINE — v0.09

What changed in this pass
- Project Files is now only a media bin. Importing or dropping files never adds them to the timeline by itself.
- Drag a file row from Project Files into the timeline to make a clip. The horizontal drop position becomes its start time.
- Every timeline item is a movable pill. Drag the pill to move it. Drag its right edge to trim video/audio or extend/shorten a sticker/image.
- Video clips keep their embedded audio linked to the video clip. It has a mute switch and volume control in the Video Inspector but no default audio lane.
- Right-click a video clip and choose Extract Audio to Timeline only when you want a separately movable audio version. Extracting automatically mutes the linked video audio to avoid doubled sound.
- Sticker tracks are always shown above video tracks. Sticker 1 is the highest visual layer.
- Right-click a clip to add an empty same-type layer, then drag the appropriate Project File onto that new lane.
- The right Inspector changes by selected clip type: Video, Audio, Sticker, or Project.
- Basic Mode remains unchanged. All Advanced Mode implementation is contained in advanced.html and js/advanced-*.js.

Testing
1. Extract this complete folder / zip.
2. Open Organon as normal and select Advanced Mode, or open advanced.html through the Organon shell.
3. Add test media to Project Files.
4. Drag rows from Project Files to the timeline.

Known scope
- This pass provides advanced-mode preview playback and PNG composite snapshots.
- Browser-native recording/export has not been reconnected to this new timeline architecture yet.
