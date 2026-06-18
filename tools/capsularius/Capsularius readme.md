# Organon Capsularius File Manager

## Product Specification and Implementation Plan

Capsularius is a local-first, browser-based file manager for Organon. It is intended to make working with folders on a Windows PC faster and clearer than Explorer for project assets, media, code, archives, and game files.

It opens from Organon in its own app-style window. When installed as a PWA, it should use standalone display mode so the app window does not show the ordinary browser address bar.

The application is not a fake file browser or a demo workspace. Mounted folders must be real user-selected folders, and all visible navigation, copy, move, rename, delete, search, preview, and archive actions must operate on those real folders after the user grants permission.

---

## 1. Product Goals

Capsularius must support:

- Mounting multiple real folders from the computer.
- Opening several folder windows at once on a snap-to-grid workspace.
- List view and thumbnail-grid view for every normal folder, Library, and Recents.
- Dragging files or folders between windows to copy or move them.
- A confirmation step after every drag-and-drop transfer, before any files are changed.
- Real progress feedback, cancellation, and error feedback for lengthy operations.
- Previewing supported files in a draggable floating preview window.
- Fuzzy filtering within the current folder and deep search across mounted locations.
- A user-managed Library drive and an automatic Recents drive.
- Keyboard shortcuts matching standard Windows file-manager expectations.
- Local persistence of mounted locations, workspace layout, Library entries, recent locations, and view preferences.

Capsularius must remain client-side. No file names, file contents, previews, or search indexes should be uploaded to a server merely for normal file-manager operation.

---

## 2. Platform Constraints

Capsularius uses the File System Access API for folders explicitly chosen by the user.

- Folder mounting must be initiated by a user action.
- The application must request read/write access when the user mounts a working folder.
- Directory handles are stored in IndexedDB, not localStorage.
- Stored handles must be permission-checked whenever the app reloads or a saved location is reopened.
- A previously saved location may require the user to approve access again. The app must explain this clearly and never pretend the folder is available when permission has been lost.
- The normal physical-file move implementation is copy first, verify success, then remove the original. A failed copy must never delete the source.
- Permanent delete must use the selected directory handle's `removeEntry()` operation only after confirmation.
- The first functional version targets Chromium browsers. Unsupported browsers must show a plain compatibility message rather than a broken workspace.

---

## 3. Primary Workspace

### 3.1 Canvas

The main application area is a large pan-and-zoom workspace with a subtle grid.

- Folder windows are draggable, resizable, numbered, and snap to the grid.
- The top bar contains the app controls, mount controls, Library, Recents, search, and workspace actions.
- The workspace must be pannable so windows remain reachable even when several are open.
- A `+` control creates another folder window.
- Each window can be assigned a nickname and colour without changing the actual folder name.
- Each window remembers its own view mode, size, position, sort order, and current location.

### 3.2 Folder Windows

A folder window shows one physical mounted folder, a Library drive, a Recents drive, or a virtual archive view.

Every folder window includes:

- Breadcrumb navigation.
- Back and forward navigation.
- Refresh.
- List and thumbnail-grid view toggles.
- Sort controls.
- Current-folder fuzzy filter.
- A visible item count and selection count.
- Drag-and-drop target state.
- Empty-state messaging that distinguishes an empty folder from a permission or loading problem.

---

## 4. Drives and Saved Locations

### 4.1 Mounted Drives

A mounted drive is a real user-selected directory handle.

- The app stores its handle, display name, nickname, colour, workspace settings, and last opened path.
- Mounting a drive never scans every nested file by default. It loads only the open folder, then reads deeper folders when the user opens or searches them.
- Directory enumeration must be asynchronous and cancellable.

### 4.2 Library Drive

Library is a special virtual drive, visually and behaviourally the same as an ordinary drive window.

- It displays saved locations as normal folder entries in list or thumbnail-grid view.
- Each Library entry can have a custom nickname, emoji, and colour.
- Changing a Library entry's nickname, emoji, or colour never renames or alters the real folder.
- Double-clicking a Library folder opens the real saved location in a normal numbered folder window.
- Right-clicking a real folder offers **Add to Library**.
- Library entries can be edited, reordered, or removed without affecting their actual folders.

### 4.3 Recents Drive

Recents is a second special virtual drive.

- It automatically displays the last 10 opened locations.
- It uses the same list and thumbnail-grid views as ordinary folders.
- Each entry points to the actual opened path, not a copied version of its contents.
- Recents should avoid duplicates by moving an already-listed location back to the top when reopened.
- The user can clear individual entries or clear all Recents without changing real files.

---

## 5. Selection and Keyboard Controls

Capsularius supports standard desktop selection behaviour:

- Click: select one item.
- `Ctrl` + click: add or remove an item from the selection.
- `Shift` + click: select a contiguous range in the current ordered view.
- `Ctrl+A`: select all items in the current folder.
- Click an empty area: clear selection.

Initial keyboard shortcuts:

| Shortcut | Action |
|---|---|
| `Ctrl+C` | Copy selected items to the Capsularius clipboard |
| `Ctrl+X` | Cut selected items to the Capsularius clipboard |
| `Ctrl+V` | Paste into the active folder window |
| `Delete` | Start permanent-delete confirmation for selected items |
| `F2` | Rename the single selected item |
| `Ctrl+A` | Select all in the active folder |
| `Ctrl+F` | Focus the active folder's filter field |
| `Esc` | Close the active menu, dialog, or pending operation prompt where safe |

The active folder window is the one most recently clicked or focused.

---

## 6. Copy, Move, Paste, and Delete

### 6.1 Drag-and-Drop Transfer Flow

Dragging selected files or folders onto another folder window does not immediately change anything.

1. The drag target highlights and indicates the intended action.
2. Default action: copy.
3. Holding `Shift` while dragging: move.
4. The user drops the selection into the target folder.
5. Capsularius opens a confirmation toast or dialog before starting the operation.

For copy:

```text
Copy 5 items to “Game Assets”?
From: “Downloads”
[Confirm Copy] [Cancel]
```

For move:

```text
Move 5 items to “Game Assets”?
From: “Downloads”
[Confirm Move] [Cancel]
```

The action button is always first. **Cancel** is always second for a standard two-button confirmation.

### 6.2 Progress and Completion Feedback

After confirmation:

- The confirmation controls are replaced by a working toast with a spinner.
- The toast shows current item count and byte progress whenever that information is available.
- A long operation exposes a visible **Cancel** control.
- Cancelling stops future queued work safely. It does not corrupt already completed files.
- A success toast has no button and closes itself automatically.
- An error toast remains visible long enough to read and explains which item failed and why.

Example:

```text
⟳ Copying 2 of 5 items
1.8 GB of 4.2 GB
[Cancel]
```

Completion:

```text
Copied 5 items to “Game Assets”
```

### 6.3 Clipboard Paste Flow

Keyboard paste uses the same confirmation and progress system as drag-and-drop.

- `Ctrl+C` prepares a copy operation.
- `Ctrl+X` prepares a move operation.
- `Ctrl+V` in a target folder opens the relevant confirmation prompt.
- Nothing is copied or moved merely by pressing the shortcut; confirmation is required first.

### 6.4 File Conflicts

When a target already contains an item with the same name, Capsularius pauses the operation and asks what to do.

```text
“castle.png” already exists in “Game Assets”.
[Replace] [Rename] [Cancel]
```

- **Replace** overwrites the existing target file after confirmation of the chosen conflict action.
- **Rename** opens a rename dialog containing the old name and an editable suggested new name, such as `castle (2).png`.
- **Cancel** stops the current operation without applying that conflicting item.

Rename dialog:

```text
Old name: castle.png
New name: castle (2).png
[Confirm Rename] [Cancel]
```

The suggested new name is editable. The name field must preserve the file extension unless the user deliberately changes it.

### 6.5 Folder Copy and Move Behaviour

Folder transfer follows normal Windows-style file-manager behaviour:

- Dragging or pasting a selected folder into a destination creates that folder inside the destination.
- If the destination already contains a folder with the same name, Capsularius merges the two folders.
- Any conflicting files inside the merge use the same **Replace / Rename / Cancel** flow.
- A move removes the source folder only after every required copy operation has completed successfully.
- The app must prevent moving a folder into itself or one of its own descendants.

### 6.6 Permanent Delete

Delete applies to the current selection.

```text
Delete 5 items permanently?
[Delete 5 Items] [Cancel]
```

- The delete action is permanent within the browser-supported file system workflow; it is not a Windows Recycle Bin action.
- The wording must say **Delete** or **Permanently delete**. Do not use exaggerated language such as “Force Delete” or “Wiped.”
- After confirmation, show spinner/progress feedback and then an automatic success toast.

---

## 7. Context Menus

Right-clicking selected files or folders provides actions appropriate to the selection:

- Open
- Open in new window
- Preview
- Copy
- Cut
- Rename
- Delete
- Add to Library

Right-clicking an empty area in a real folder provides:

- Paste
- New Folder
- Refresh

Menus must disable actions that do not apply to the current selection or permission state.
