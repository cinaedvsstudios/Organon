Organon Advanced Audio Timeline v0.21

New in v0.21:
- Rebuilt OS/File Explorer / Finder dropping as one import path instead of duplicated nested handlers.
- Drop anywhere in Advanced Mode or directly on Project Files.
- When run inside the same-origin Organon Hub, the Advanced Mode page also catches a file drop that lands on the iframe edge before it reaches the child document.
- The full-screen drop overlay is now visual only, so it cannot steal the native drop event.

This package contains Advanced Mode plus the untouched Basic Mode index.html.

Use the entire extracted folder, including js/. Open it through the Organon hub as before.

Project File placement: drag a Project Files pill with the mouse/pointer directly onto any timeline lane.


v0.21:
- Restores the always-visible blue current-time line over the entire timeline.
- Draws per-clip end markers in each clip type colour.
- Loudness/beat gradients now crop to the visible source range while trimming; clip resize remains a crop, not a speed adjustment.
