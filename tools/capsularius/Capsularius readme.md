# **Organon *Capsularius* File Manager**

## **Platform Specification & Implementation Plan**

This document outlines the system architecture, file structure, API mapping, and interactive workflows for the custom modular File Manager tailored to the **Organon Blueprint** aesthetic.

## **🏛️ Project Inspiration & Architectural Alignment**

To surpass the limitations of Windows Explorer and align with clean, performance-optimized workspace aesthetics, the Organon File Manager takes inspiration from two flagship platforms:

1. **FileBrowser Core (https://github.com/filebrowser/filebrowser)** \* **Takeaways**: Minimalist layout, lighting-fast query speed, robust recursive index structures, and simple, clean contextual actions.  
   * **Adaptation**: We emulate the direct workspace controls while bypassing the requirement of a Go-based backend by routing disk operations directly through the browser's client-side sandboxed handlers.  
2. **FileBrowser Quantum (https://github.com/gtsteffaniak/filebrowser)** \* **Takeaways**: Modern UX design elements, active responsive grid structures, dark-mode styling, customizable layout cards, and advanced indexing workflows.  
   * **Adaptation**: Replicating this premium design style using Organon's design system (--stone-ochre, \--chiseled-bronze, and \--bg-nightsky) layered on a full-viewport Grid canvas.

## **📁 Proposed Folder Structure**

When migrating the single-file prototype into your production-level repository, organize assets using this modular layout to prevent code bloat and preserve file scalability:

/organon-file-manager/  
│  
├── index.html                  \# Core platform entry point (Grid Canvas & Overlay controls)  
│  
├── css/  
│   ├── layout.css              \# Canvas viewport, Window positioning, Resizing, & Grid snapping  
│   ├── theme.css               \# Organon variables, custom scrollbars, and tactile card classes  
│   └── components.css          \# Drag indicators, context menus, and custom toast styling  
│  
├── js/  
│   ├── app.js                  \# App Entry Point: Bootstraps DOM & manages the Global Event Bus  
│   ├── state.js                \# State Management: Active selections, clipboard stacks, and IndexedDB bindings  
│   ├── windowManager.js        \# Window Class: Spawning, coordinate-tracking, snapping, and layout rendering  
│   ├── fileSystem.js           \# Disk Handlers: Wrapper API for directory pickers, handles, and file streaming  
│   ├── operations.js           \# File Mechanics: Copies, moves, rename validations, and toast pipelines  
│   ├── zipEngine.js            \# Archive Handler: Slices .zip headers and mounts them as virtual directory folders  
│   └── previewer.js            \# Floating Media Viewer: Draggable viewports, wheel zoom metrics, and 3D wireframe renderers  
│  
└── assets/  
    ├── images/                 \# Theme-aligned icons (folders, assets, custom file-type graphics)  
    └── models/                 \# Asset placeholders for 3D file preview testing (.obj, .gltf)

## **🔌 Core Architectural APIs**

### **1\. File System Access API**

Enables high-fidelity native file manipulations directly in the web browser.

* **Mounting Directory Pickers**:  
  const directoryHandle \= await window.showDirectoryPicker({  
    mode: 'readwrite'  
  });

* **Persistent Sessions via IndexedDB**:  
  Directory handles must be stored as serialized JS handles inside IndexedDB. On app reload, the system iterates over active keys, requests read-write authorization triggers from the user for those specific paths, and automatically recreates the layout canvas windows without triggering folder picker prompts.

### **2\. Multi-Window Drag-and-Drop Protocol**

To facilitate dragging assets between independent window panes, we map drag transfer payloads across customized DOM event matrices:

// Drag Source Pane  
element.addEventListener('dragstart', (e) \=\> {  
  const data \= {  
    sourceWindowId: windowId,  
    filePath: file.path,  
    fileName: file.name,  
    fileType: file.type  
  };  
  e.dataTransfer.setData('application/organon-file', JSON.stringify(data));  
  e.dataTransfer.effectAllowed \= 'copyMove';  
});

// Drag Target Pane  
element.addEventListener('dragover', (e) \=\> {  
  e.preventDefault();  
  // Check if Shift key is pressed to alter transfer display dynamically  
  const isMove \= e.shiftKey;   
  updateToastIndicators(isMove ? 'move' : 'copy');  
});

## **🎨 Interactive User Workflows**

### **💻 Canvas Snap-to-Grid Mechanism**

To preserve visual harmony, window frames snap to a virtual ![][image1] grid block.

* When resizing or dragging, positions are dynamically calculated:  
  ![][image2]

### **🖼️ Zoomable Floating Media Previews**

The unified floating component spawns a modular display overlay layer with:

* **Draggable Window Header**: Tracks cursor delta bounds during movement.  
* **Transform Scales**: Uses CSS variables transform: translate3d(x, y, 0\) scale(val) to control dynamic canvas and image layouts smoothly.  
* **Mousewheel Zoom Handler**:  
  ![][image3]  
* **3D Visualizer Simulation**: Uses standard requestAnimationFrame mechanics rendering a revolving wireframe matrix or a light-weight WebGL glTF model preview canvas.

## **🚀 Next Phases of Development**

1. **Phase 1 (Active)**: Build out the visual workspace prototype showcasing multi-window canvas snapping, simulated operations toast layouts, modular color/nicknaming controls, and floating zoomable previews.  
2. **Phase 2**: Add JS zip library integrations (zip.js) allowing visual expanding and copying elements straight out of loaded .zip folders.  
3. **Phase 3**: Hook up complete IndexedDB read/write verification states to store physical machine paths across window reloads securely.

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAI8AAAAfCAYAAADeBZ7QAAACDklEQVR4Xu2QUYrtMAxDZyd3/6t8j3wYhJDsJk2Z3okPBBod20n689M0TdM0TdM0TdM8zOfz+ceLa5CZ2lOY+SdcW9W/FnXx7EHKqewU1NtVFjinslfjHjJwzmWu/i+TvTvLORu4+teCj+eLX80wV+4vg+/mt1/Ngsy9kuzCyqkMydxvMXOnmdpB/A/Vp3KVIZn7KtRDVYagj+9qqX72nEV+laovc6uomSpD0Md3tVS/8i5/BHWIyhD0fFm3VD97ziK/StWXuVXUTJUh6OO7WqpfeZc/gjpEZYjy2YVXcs5mUHN5vwt3FmeI8pFxnjmVRc7ZdrLDVR4oHxnngfOYKb8Kz2W/A3dflwfKR8Z54Dxn7B+BD0UyN1A+Ms6DzKNTfpXd85BsduYGykfGeZB5dMpvpTpkxVeXv+tXeGLmoJq54qu73vW3cQeoPWeIcm52kHl0yq+Ac3bP5VlqzxmiXPQoN8g8OuW34IZzltWtuIHzuHc1s6j+p2fznrPAuep+zqs9Z1twgznL6lbcwHncu5pZVP/Ts3nPWeBcdT/n1Z6z2+Dhaql6lWX1lbubV1R9lc+IXrdUPWeDrH7WqSzLl8DD3eKeAdes1Koe5zhnn3G1bjBTO+D7qMU9A65ZqVU9M479K/mqy76Qo//f0Y/fwNH/7+jHb+DI/4ePPvIH3IT/W/+/pmmapmmapvkS/gPv/RoOfn4XlQAAAABJRU5ErkJggg==>

[image2]: <data:image/png;base64,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>

[image3]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmwAAAA4CAYAAABAFaTtAAAFHElEQVR4Xu3VWa7jyA4FwN5J7X+Vr6GPxGMfkCnJQ/kOEYAA85BMyUbp1j//AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAV/bnz5//ZfaT/bbvCz+J9xe+uOMlXdeqc+YRrzrnu/pt3/+rf9/6b/yV3nHmd/bO3+OdZ/8202855cCH5cv5qv/UXnXOT3L391i/4d29u951j7Pnr/k0U+3OuutV5xxeedYd0+/xTPasu8/U5Tt357+au8+fv1HuZ79aval/mHpTDnzI9DJ32V3T2b9F990zy3pyde6Tpmfc/Tuo+W5uyX7Wk6tzj3rV+Y+c0+10v2XWU/as7t4rz+ww5ZO7819NPn/WKft36ykDvpm7f1zvmM7+LfK7d79H1pOrc580PWP3vbs869T1s55cnXvUq85/5Jxu5+pv1WXP6u698swOUz65O/+VdL9N1tXZ/Fl/lwHf0Hrpu5d/mfq73V3W9V4p71Pv12W7vOtNc0vXu5p1rsxU9dz1ubu6+S7rdqpHel3eZUvX67LJmp3maz9npnzJfHfWzp3ZJe9x596rP83vzpp6Wdc8s0PO57m5t+qcydku2+nmuuwZ3fN02TL1Vtb1p6zWaepPOfBB6yU/e9nzc53P3a5en7s61fN3V+4tXX9X1/lpN+drv8rZO1nnykzKs/OMs3plecaVuWrqdXmXLV2vyyZrtl61l3O7en3uspy/45G9vN/6nHknZ2qdu9Ncmnpddsj5nLtbr2x35uSRnTvyuaZsmXor6/pTVus09acc+CLqC9+9/J01V2enOq/Vf7Xu/LN66XaXXW/pZq5mnSszKXe6umbZ77LcOcsPU6/Lu2zpel12Vd27esZ0vzyru+r8bi6v3Ot087Wezsk8d7rraq+eu/LMDjmfZ+beWZ26M3YenT+76my3X7Nl6t09L+s09acc+IDphVwvfffyV9nPz1mvz39D3n9lU73mV5az1a53mO59JetcmUm509U1y36X5c5Zfph6Xd5lS9frss40s/Kpv9T7dLM1u/pMnWf2uvvunvmQeT0je1V3r2Xqddkh86xT9rNern6XND3/K3Rnd9ky9er3yv6U1TpN/SkHPmB6IXd/EJauV+vs5+yZtX925d7S9Xf1rld156ZuZspqPbk6V+VOV9cs+12WO2f5Yep1edbV3fnqbG7Xz17WmXXPedUze919u6zKXp3PXrU7d+p12SHzrFP2az09e9aT7qxX6n6brKtuvur6WU9ZNfWnHPiA6YWvWfaXbq5m2V9Z9/kdzu6fdX7O/a5en1PO1nyqp51Dl+/mD9nr6rx/7XdZ7pzlh7Ne/Zxzd+puf+ny3e70uau7LOurHt07TLtTfsjes7/DIc+o+dXszn272d3MpJvpsmflme+up6ya+lMOfED9A1evbq7rZd59rjtd9g71Pleu3Kn1rleztMu7vV3W7WRd5U7uZ5b9s5k6V+e7LK/dTNfrsm6+y5a6c7afefZy5kq+sjN3ZtPd3Xzu7nm7rOr6mdU6r/+f9F/TzFneZdNOteu9w+6Zpuxsp+vlXvaXuznAj/I3/tj9jXtc9RWe5Ss8wzO++/Pz/Uz/5qYcgAf4o/pffg+4Z3pnphzgR3rnH713nv2oTz7TJ+8N39HxznTvzZQDAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAfAX/Akg7WoyC0ggwAAAAAElFTkSuQmCC>