Organon Advanced Audio Timeline v0.19

New in v0.19:
- Restored robust OS/File Explorer drop import: drop a new supported file anywhere in the Advanced Mode window or directly into Project Files.
- The full-screen drop overlay now receives and imports the files instead of only showing a visual hint.
- Project Files → timeline pointer dragging remains unchanged.


This package contains Advanced Mode plus the untouched Basic Mode index.html.

New in v0.19:
- Every new video is placed in its own video lane by default, so videos cannot overlap on the same visual layer.
- Moving a video into an overlap automatically moves it to a clear video lane.
- Video clips magnetically snap to the start or end of other video clips while they are dragged.
- The current-time line is sky blue. Each clip has a full-lane-height end boundary in its own media colour, and the composition END marker adopts the colour of the latest-ending clip.

Use the entire extracted folder, including js/. Open it through the Organon hub as before.


Project File placement: drag a Project Files pill with the mouse/pointer directly onto any timeline lane. v0.19 uses pointer drag rather than browser-native HTML drag, so it does not depend on custom browser drag MIME support.
