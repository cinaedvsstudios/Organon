// component-data.js
// Source of truth for UI Repository component records. Restored from repository v2.4 plus missing recovered IDs.

window.uiRepositoryComponents = [
      {
        id: '01', title: 'Segmented Control',
        term: 'Toggle group, button switcher, slider capsule.',
        desc: 'Houses a horizontal row of mutually exclusive buttons within a single rounded container.',
        apps: 'Flipping between code panels and previews.',
        wild: '<a href="#" class="text-repo-blue hover:text-white underline">iOS Settings</a>',
        mods: 'Map to animate via CSS transforms.',
        risk: '2', riskText: 'Intermediate',
        html: `
          <div id="sandbox-segmented" class="inline-flex bg-black p-[3px] rounded-full border border-[#333] transition-all duration-300">
            <button onclick="showToast('Code Active')" class="px-5 py-1.5 rounded-full text-xs font-semibold bg-repo-blue text-white border border-repo-lightblue/30">Sub-Space Code</button>
            <button onclick="showToast('Preview Active')" class="px-5 py-1.5 rounded-full text-xs font-semibold text-gray-400 hover:text-gray-100 border border-transparent">Holo-Preview</button>
          </div>
        `,
        prompt: 'Create a Segmented Control Switcher styled with Matrix Blue active states and a subtle neon glow effect.'
      },
      {
        id: '02', title: 'Decorated Input Box',
        term: 'Inline search bar, input action capsule.',
        desc: 'A text field featuring absolute leading icons and embedded trailing action triggers.',
        apps: 'Used for global site searches, filtering grids.',
        wild: '<a href="#" class="text-repo-blue hover:text-white underline">Google Search</a>',
        mods: 'Replace trailing action with voice mic.',
        risk: '1', riskText: 'Easy',
        html: `
          <div class="relative w-full max-w-md mx-auto">
            <span class="absolute left-4 top-1/2 -translate-y-1/2 text-repo-lightblue">🔍</span>
            <input type="text" class="w-full bg-[#1a1b1a] border border-[#444] rounded-full pl-11 pr-12 py-2 text-xs outline-none focus:border-repo-blue text-white" value="dilithium">
            <button onclick="showToast('Randomized!')" class="absolute right-2.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-repo-sand hover:bg-yellow-500 text-repo-dark flex items-center justify-center text-xs transition">🌀</button>
          </div>
        `,
        prompt: 'Build a rounded Input field containing a leading search icon and an absolute-positioned trailing action button inside its right boundary.'
      },
      {
        id: '03', title: 'Collapsible Navigation Drawer',
        term: 'Side nav deck, layout drawer.',
        desc: 'Side nav deck that contracts width, hiding labels to display high-density icon sets.',
        apps: 'Dashboard primary navigation.',
        wild: '<a href="#" class="text-repo-blue hover:text-white underline">YouTube Sidebar</a>',
        mods: 'Can transition to off-canvas on mobile.',
        risk: '3', riskText: 'Difficult',
        html: `
          <div class="w-[220px] bg-repo-dark border border-[#444] rounded-xl p-3 flex flex-col gap-1.5 mx-auto transition-all duration-300" id="sb-sandbox-drawer">
            <div class="flex items-center justify-between px-2 py-1 mb-1">
              <button onclick="document.getElementById('sb-sandbox-drawer').classList.toggle('w-[220px]'); document.getElementById('sb-sandbox-drawer').classList.toggle('w-[70px]'); document.querySelectorAll('.sb-sandbox-lbl').forEach(l=>l.classList.toggle('hidden')); showToast('Toggled Drawer');" class="w-8 h-8 rounded-full border border-[#444] hover:bg-[#333] flex items-center justify-center text-white">🛠️</button>
              <span class="text-[10px] text-gray-400 font-bold uppercase sb-sandbox-lbl">CONTROL</span>
            </div>
            <div class="bg-repo-blue/20 border border-repo-blue/50 text-repo-lightblue flex items-center p-2 rounded-lg text-xs gap-3">
              <span>🛰️</span><span class="font-medium truncate sb-sandbox-lbl">Nexus Core Uplink</span>
            </div>
          </div>
        `,
        prompt: 'Implement a Collapsible Navigation Drawer. When folded, animate its width down and hide text labels, leaving only icons visible.'
      },
      {
        id: '04', title: 'Multi-Row Accordion',
        term: 'Expandable list, collapse panel.',
        desc: 'Expandable menu boxes with Choice Chips.',
        apps: 'E-commerce faceted filtering.',
        wild: '<a href="#" class="text-repo-blue hover:text-white underline">Amazon Filters</a>',
        mods: 'Rig as a true accordion (one open at a time).',
        risk: '2', riskText: 'Intermediate',
        html: `
          <div class="w-full max-w-sm mx-auto border border-[#444] rounded-xl bg-repo-dark overflow-hidden">
            <div class="flex items-center justify-between px-4 py-2.5 bg-[#222] cursor-pointer" onclick="const b=document.getElementById('sb-acc-body'); b.classList.toggle('max-h-0'); b.classList.toggle('p-0'); b.classList.toggle('border-t-0'); b.classList.toggle('max-h-[150px]'); b.classList.toggle('p-3');">
              <span class="text-[10px] font-bold text-repo-lightblue uppercase">Spell Schools</span>
              <span class="text-xs text-repo-blue">▲</span>
            </div>
            <div id="sb-acc-body" class="p-3 border-t border-[#444] flex flex-wrap gap-1.5 transition-all duration-300 max-h-[150px] overflow-hidden">
              <button class="px-2.5 py-1 rounded text-[10px] font-bold border border-repo-blue/50 bg-repo-blue/20 text-repo-lightblue">Evocation</button>
              <button class="px-2.5 py-1 rounded text-[10px] font-bold border border-[#555] text-gray-300">Necromancy</button>
            </div>
          </div>
        `,
        prompt: 'Create an Accordion container. Inside the expanded panel, render a set of choice chip tags.'
      },
      {
        id: '05', title: 'Combobox Popover',
        term: 'Typeahead menu, action launcher.',
        desc: 'Dynamic dropdown panels filtering items locally.',
        apps: 'Filters contacts, command palettes.',
        wild: '<a href="#" class="text-repo-blue hover:text-white underline">Slack Jump To</a>',
        mods: 'Embed rich HTML objects inside list.',
        risk: '3', riskText: 'Difficult',
        html: `
          <div class="w-full max-w-xs mx-auto bg-repo-dark border border-[#444] rounded-xl p-3">
            <input type="text" class="w-full bg-[#111] border border-[#333] rounded-lg py-1.5 px-3 text-xs outline-none text-repo-white" placeholder="Filter targets...">
            <div class="space-y-0.5 mt-2">
              <div class="flex items-center gap-2 p-1.5 rounded text-xs text-repo-cream hover:bg-[#333] cursor-pointer" onclick="showToast('Action selected')"><span>☄️</span><span>Initiate Hyperjump</span></div>
            </div>
          </div>
        `,
        prompt: 'Build a Combobox Popover dropdown. Position a sleek input bar at the top, and let the list elements beneath filter dynamically.'
      },
      {
        id: '09', title: 'Card with Resize Grip',
        term: 'Resizable terminal, active accent card.',
        desc: 'A layout card featuring a left vertical accent stripe representing state, coupled with a draggable resizer grip.',
        apps: 'Code playgrounds, console outputs.',
        wild: '<a href="#" class="text-repo-blue hover:text-white underline">JSFiddle</a>',
        mods: 'Handle visible only on hover.',
        risk: '3', riskText: 'Difficult',
        html: `
          <div class="w-full max-w-sm mx-auto bg-repo-dark border border-[#444] border-l-[5px] border-l-repo-blue p-4 rounded-r-xl">
            <div class="text-[9px] font-black text-gray-400 mb-1 uppercase tracking-widest">ARCANE SPELL MATRIX</div>
            <textarea class="resizable-textarea w-full bg-[#111] border border-[#333] rounded-lg p-2 text-xs text-repo-lightblue outline-none" rows="2" placeholder="Drag corner..."></textarea>
          </div>
        `,
        prompt: 'Create a resizable card featuring a left vertical accent border and a draggable bottom-right resizer grip.'
      },
      {
        id: '11', title: 'Draggable Window',
        term: 'Floating widget, moveable dialog.',
        desc: 'Moveable window panels triggered inside active containment bounding environments.',
        apps: 'HUD interfaces, non-blocking toolbars.',
        wild: '<a href="#" class="text-repo-blue hover:text-white underline">Figma</a>',
        mods: 'Snap to grid functionality.',
        risk: '4', riskText: 'Hard',
        html: `
          <div class="bg-[#161a26] border border-[#2b3142] rounded-xl shadow-2xl w-48 mx-auto overflow-hidden cursor-move">
            <div class="bg-[#212738] px-2.5 py-1.5 flex items-center justify-between">
              <span class="text-[9px] font-bold text-repo-lightblue">🛸 TERMINAL</span>
              <span class="w-2 h-2 rounded-full bg-repo-salmon"></span>
            </div>
            <div class="p-3 text-[11px] text-gray-400">Grab and drag my header bar!</div>
          </div>
        `,
        prompt: 'Create a Draggable Modeless Window component inside a containment area with a header grab-bar.'
      },
      {
        id: '12', title: 'Custom Markup Compiler',
        term: 'Custom string parser, inline formatter.',
        desc: 'Evaluates raw text strings, searching for custom inline delimiters and compiling them directly into styled HTML structures.',
        apps: 'Custom chat client micro-editors.',
        wild: '<a href="#" class="text-repo-blue hover:text-white underline">Discord Markdown</a>',
        mods: 'Support custom regex arrays.',
        risk: '4', riskText: 'Hard',
        html: `
          <div class="bg-black p-4 border border-[#333] rounded-lg space-y-3 w-full max-w-sm mx-auto">
            <textarea class="w-full bg-repo-dark border border-[#444] rounded p-2 text-xs text-repo-lightblue font-mono outline-none" rows="2">!!Bold!! text here</textarea>
            <div class="bg-repo-dark/50 border border-repo-blue/20 rounded p-2.5 text-xs text-gray-300 min-h-[40px]"><strong class="text-repo-lightblue font-extrabold">Bold</strong> text here</div>
          </div>
        `,
        prompt: 'Build a Lightweight Markup Parsing Engine that compiles text bolding using Exclamation (!!bold!!) tags.'
      },
      {
        id: '13', title: 'Fuzzy Typo Search',
        term: 'Spellcheck finder, distance calculator.',
        desc: 'Calculates edit distances between input and data nodes, enabling typo-tolerant lookups.',
        apps: 'Search bars with high typo probability.',
        wild: '<a href="#" class="text-repo-blue hover:text-white underline">Algolia Search</a>',
        mods: 'Adjust threshold of allowed edit steps.',
        risk: '4', riskText: 'Hard',
        html: `
          <div class="w-full max-w-sm mx-auto space-y-2">
            <input type="text" class="w-full bg-repo-dark border border-[#444] rounded-full py-1.5 px-3 text-xs outline-none text-repo-white" placeholder="Type to search (fuzzy)...">
            <div class="flex items-center justify-between bg-[#111] p-1.5 rounded border border-gray-800">
              <span class="font-bold text-gray-200">orichalcum</span>
              <span class="text-[9px] px-1.5 py-0.5 rounded font-mono bg-green-500/10 text-green-400">Offset: 1</span>
            </div>
          </div>
        `,
        prompt: 'Create a Typo-Tolerant search input using a Levenshtein distance matrix function.'
      },
      {
        id: '14', title: 'JSON Syntax Locator',
        term: 'Error syntax parser, visual code pointer.',
        desc: 'Intercepts parsing exceptions and generates a direct visual carat pointer under the error index.',
        apps: 'Code editors, configuration validators.',
        wild: '<a href="#" class="text-repo-blue hover:text-white underline">JSONLint</a>',
        mods: 'Integrated into live forms to prevent submission.',
        risk: '3', riskText: 'Difficult',
        html: `
          <div class="w-full max-w-sm mx-auto">
            <pre class="bg-black border border-repo-maroon/50 text-repo-salmon p-2.5 rounded text-[9px] font-mono whitespace-pre overflow-x-auto min-h-[50px] w-full">Error spot: { "bad": true, }&#10;                           ^</pre>
          </div>
        `,
        prompt: 'Build a JSON syntax validator widget that isolates the character index of an exception and prints a carat pointer.'
      },
      {
        id: '15', title: 'Adaptive Image Cycler',
        term: 'Smart image shifter, fallback loader.',
        desc: 'Validates image path existence offscreen, routing instantly to custom backups upon load failure.',
        apps: 'User profile avatars, robust galleries.',
        wild: '<a href="#" class="text-repo-blue hover:text-white underline">Netflix Thumbnails</a>',
        mods: 'Rotate through an array of fallback images.',
        risk: '2', riskText: 'Intermediate',
        html: `
          <div class="relative cursor-pointer max-w-[200px] mx-auto" onclick="showToast('Cycled image!')">
            <img src="https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=400&q=80" class="w-full h-24 object-cover rounded-xl border border-repo-blue/50">
            <div class="absolute bottom-1 right-1 bg-black/75 px-1.5 py-0.5 rounded text-[8px] text-repo-lightblue font-mono">Index: 1</div>
          </div>
        `,
        prompt: 'Create an image carousel that validates paths before rendering using an in-memory Image instance.'
      },
      {
        id: '16', title: 'Action Confirm',
        term: 'Two-stage trigger, safety-toggle button.',
        desc: 'Protects system critical actions by requiring a verified second click within a strict countdown window.',
        apps: 'Database deletions, irreversible overrides.',
        wild: '<a href="#" class="text-repo-blue hover:text-white underline">AWS Delete Prompts</a>',
        mods: 'Add a shaking animation on the first click.',
        risk: '3', riskText: 'Difficult',
        html: `
          <div class="flex flex-col items-center justify-center p-4 min-h-[80px]">
            <button onclick="showToast('Click 1: Warning state activated!')" class="px-5 py-2.5 rounded-lg bg-repo-maroon hover:bg-repo-magenta text-xs font-black uppercase tracking-wider text-white transition duration-150 border border-repo-salmon animate-pulse">💥 CONFIRM PURGE?</button>
          </div>
        `,
        prompt: 'Create a Two-Stage Confirm Action Button with a 3-second self-canceling timeout on first click.'
      },
      {
        id: '17', title: 'Radial SVG Ticker',
        term: 'Circular countdown, SVG elapsed indicator.',
        desc: 'A circular countdown timer utilizing CSS stroke-dashoffset transitions driven by millisecond tickers.',
        apps: 'Session timeouts, OTP expirations.',
        wild: '<a href="#" class="text-repo-blue hover:text-white underline">Google Auth</a>',
        mods: 'Change color based on time remaining.',
        risk: '3', riskText: 'Difficult',
        html: `
          <div class="relative w-12 h-12 flex items-center justify-center mx-auto">
            <svg class="w-full h-full -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="16" class="fill-none stroke-repo-darkteal stroke-[2px]" />
              <circle cx="18" cy="18" r="16" class="fill-none stroke-repo-teal stroke-[2px]" style="stroke-dasharray: 100; stroke-dashoffset: 25;" />
            </svg>
            <span class="absolute text-[10px] font-black text-repo-teal font-mono">3s</span>
          </div>
        `,
        prompt: 'Create an SVG Radial Countdown Timer adjusting stroke-dashoffset dynamically inside an interval loop.'
      },
      {
        id: '21', title: 'Highlight Cycler',
        term: 'State color toggle, row highlighter.',
        desc: 'Instantly cycles database rows through glowing semantic overlays.',
        apps: 'Table classifications, priority tagging.',
        wild: '<a href="#" class="text-repo-blue hover:text-white underline">Asana Row Colors</a>',
        mods: 'Persist state to local storage.',
        risk: '2', riskText: 'Intermediate',
        html: `
          <div class="space-y-2 max-w-sm mx-auto cursor-pointer" onclick="showToast('Cycle Layer')">
            <div class="p-3 bg-repo-blue/20 border border-repo-blue rounded-lg text-xs flex justify-between">
              <span class="text-repo-lightblue">🚀 Highlight Level 1</span>
              <span class="text-[9px] text-repo-blue uppercase tracking-wide">Cycle layer</span>
            </div>
          </div>
        `,
        prompt: 'Build an Interactive Highlight Layer Cycler that cycles elements through 5 semantic translucent glowing colors on click.'
      },
      {
        id: '24', title: 'Debounced Drawer',
        term: 'Hover menu, delayed dropdown.',
        desc: 'Hovering over the trigger bar opens secondary options. Employs a 200ms bridge window to glide across visual gaps seamlessly.',
        apps: 'Mega-menus, complex navigation bars.',
        wild: '<a href="#" class="text-repo-blue hover:text-white underline">Stripe Mega Menu</a>',
        mods: 'Click to lock persistence.',
        risk: '4', riskText: 'Hard',
        html: `
          <div class="flex flex-col items-center max-w-sm mx-auto">
            <div class="w-full h-3 border-y border-repo-teal bg-repo-darkteal/30 rounded cursor-pointer transition flex items-center justify-center relative z-20" onclick="showToast('Locked Panel')">
              <span class="text-[6px] tracking-widest text-repo-teal font-bold">HOVER DIVIDER BRIDGE</span>
            </div>
            <div class="w-full bg-[#111] border border-[#333] rounded-b-xl p-3 flex gap-2 justify-center shadow-2xl relative z-10 -mt-1">
              <button class="px-3 py-1.5 bg-repo-blue hover:bg-repo-lightblue text-white rounded text-[10px] font-black uppercase">☄️ Jump</button>
            </div>
          </div>
        `,
        prompt: 'Create a Multi-Tiered Hover Drawer with Bridged Debounce utilizing a 200ms gap to maintain open dropdown states.'
      },
      {
        id: '25', title: 'Portal Step Guide',
        term: 'Onboarding walkthrough, tour pulse.',
        desc: 'Sequentially targets specific DOM nodes, applying glowing pulsers and automatically sliding them into center focus.',
        apps: 'New user onboarding, feature tours.',
        wild: '<a href="#" class="text-repo-blue hover:text-white underline">Intro.js</a>',
        mods: 'Add skip/back functionality.',
        risk: '4', riskText: 'Hard',
        html: `
          <div class="flex items-center justify-center p-4">
            <button onclick="showToast('Started guide!')" class="px-5 py-2.5 rounded-lg bg-repo-sand text-repo-dark font-bold text-xs uppercase tracking-wider shadow-[0_0_15px_#df9f5e]">🚀 Launch Tutorial</button>
          </div>
        `,
        prompt: 'Create a Step-by-Step Tutorial Walkthrough targeting specific layout elements with pulsating highlight outlines.'
      },
      {
        id: '26', title: 'Stacked Toasts',
        term: 'Notification drawer, sliding alerts.',
        desc: 'Instantiates non-blocking notification cards that stack cleanly with semantic colors and timeline timers.',
        apps: 'Server warnings, success responses.',
        wild: '<a href="#" class="text-repo-blue hover:text-white underline">Vercel Dashboard</a>',
        mods: 'Swipe to dismiss.',
        risk: '4', riskText: 'Hard',
        html: `
          <div class="flex flex-wrap gap-2 justify-center p-4">
            <div class="bg-green-900/40 border border-green-500/40 text-green-300 text-xs font-bold rounded-lg p-3 w-full">
              Success: Sub-space aligned.
            </div>
          </div>
        `,
        prompt: 'Create an animated Stacked Toast Notification System with slide-in animations and automated self-destruction timers.'
      },
      {
        id: '27', title: 'Spinners',
        term: 'Async visual loaders, progress loops.',
        desc: 'Highly optimized vector animation loops indicating operations are running in the background.',
        apps: 'API loading, form submissions.',
        wild: '<a href="#" class="text-repo-blue hover:text-white underline">YouTube Buffering</a>',
        mods: 'Determinate progress variants.',
        risk: '2', riskText: 'Intermediate',
        html: `
          <div class="flex items-center justify-center py-4">
            <svg class="animate-spin h-8 w-8 text-repo-sand" style="box-shadow: 0 0 15px rgba(223,159,94,0.5); border-radius: 9999px;" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        `,
        prompt: 'Build Indeterminate Loading Spinners using inline SVGs featuring Tailwind keyframe animations and glows.'
      },
      {
        id: '28', title: 'Custom Toggles',
        term: 'Switch button, binary slider.',
        desc: 'Smooth, iOS-styled switches that slide their thumb nodes seamlessly.',
        apps: 'Settings panels, binary states.',
        wild: '<a href="#" class="text-repo-blue hover:text-white underline">iOS Settings</a>',
        mods: 'Change colors dynamically based on state.',
        risk: '1', riskText: 'Easy',
        html: `
          <div class="flex items-center justify-center gap-4 py-4" onclick="showToast('Toggled!')">
            <div class="w-10 h-6 bg-repo-blue rounded-full p-0.5 transition-colors duration-200 relative shadow-[0_0_10px_rgba(81,133,197,0.4)] cursor-pointer">
              <span class="w-5 h-5 bg-white rounded-full block transition-transform duration-200 translate-x-4"></span>
            </div>
          </div>
        `,
        prompt: 'Build a custom toggle switch animating the indicator node shift and changing track background colors.'
      },
      {
        id: '29', title: 'Blocking Modal Dialog',
        term: 'Popup window, overlay alert.',
        desc: 'A high-priority popup window. Blurs the parent viewport layout, locking focus until resolved.',
        apps: 'Critical confirmations, paywalls.',
        wild: '<a href="#" class="text-repo-blue hover:text-white underline">Stripe Checkout</a>',
        mods: 'Click outside to dismiss.',
        risk: '3', riskText: 'Difficult',
        html: `
          <div class="flex items-center justify-center py-4">
            <button onclick="openSandboxBlockingModal()" class="px-5 py-2 rounded bg-repo-maroon hover:bg-repo-magenta text-white font-bold text-xs uppercase transition shadow-lg">Initiate Lock</button>
          </div>
        `,
        prompt: 'Build a Blocking Modal Dialog with an absolute backdrop, centered scale-up panel, and ESC key bindings.'
      },
      {
        id: '30', title: 'Skeleton Placeholders',
        term: 'Ghost loader, content wireframe.',
        desc: 'Pulsating placeholder blocks indicating that content is compiling.',
        apps: 'Heavy API queries, feed loading.',
        wild: '<a href="#" class="text-repo-blue hover:text-white underline">LinkedIn Feed</a>',
        mods: 'Shimmer sweep animation instead of pulse.',
        risk: '2', riskText: 'Intermediate',
        html: `
          <div class="animate-pulse space-y-3 max-w-xs mx-auto">
            <div class="h-16 bg-[#333] rounded-xl"></div>
            <div class="h-3 w-2/3 bg-[#333] rounded"></div>
          </div>
        `,
        prompt: 'Create Skeleton Loader Placeholders matching the exact layout structure with keyframe pulse animations.'
      },
      {
        id: '31', title: 'Semantic Dot Badges',
        term: 'Status chip, indicator pill.',
        desc: 'Badges carrying minor dot-indicators, mapping status properties immediately through color standards.',
        apps: 'User online status, server health.',
        wild: '<a href="#" class="text-repo-blue hover:text-white underline">GitHub Actions</a>',
        mods: 'Ping animation on the dot.',
        risk: '1', riskText: 'Easy',
        html: `
          <div class="flex justify-center py-4">
            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-repo-darkteal/20 text-repo-teal border border-repo-teal/40">
              <span class="w-1.5 h-1.5 rounded-full bg-repo-teal animate-pulse"></span> Live System
            </span>
          </div>
        `,
        prompt: 'Build semantic status Tag/Badge components with matching translucent backgrounds and embedded dot lights.'
      },
      {
        id: '32', title: 'Navigational Breadcrumbs',
        term: 'Hierarchy trail, route path.',
        desc: 'Active step lines detailing route hierarchy, with inline divider chevron characters.',
        apps: 'Deep folder structures, e-commerce categories.',
        wild: '<a href="#" class="text-repo-blue hover:text-white underline">Amazon Categories</a>',
        mods: 'Dropdowns on intermediate steps.',
        risk: '1', riskText: 'Easy',
        html: `
          <div class="flex justify-center py-4">
            <nav class="flex items-center gap-2 text-xs font-mono text-gray-500">
              <span class="text-repo-lightblue">SYSTEM</span> <span>➔</span> <span class="text-repo-white font-bold">NEXUS_A</span>
            </nav>
          </div>
        `,
        prompt: 'Build a Navigational Breadcrumbs Trail component. Style links with hover changes and separate them with chevrons.'
      },
      {
        id: '33', title: 'Runic Star Evaluator',
        term: 'Rating matrix, review stars.',
        desc: 'Clickable rating matrices that dynamically update filled vectors on mouseenter and click.',
        apps: 'Product reviews, user feedback.',
        wild: '<a href="#" class="text-repo-blue hover:text-white underline">Yelp Reviews</a>',
        mods: 'Half-star support.',
        risk: '2', riskText: 'Intermediate',
        html: `
          <div class="flex justify-center py-4 text-2xl cursor-pointer" onclick="showToast('Rated 3 stars')">
            <span class="text-repo-sand">★</span><span class="text-repo-sand">★</span><span class="text-repo-sand">★</span><span class="text-[#333]">★</span><span class="text-[#333]">★</span>
          </div>
        `,
        prompt: 'Build a 5-Star Rating matrix. Bind hover, mouseleave, and click events to fill in preceding vectors dynamically.'
      },
      {
        id: '34', title: 'Morphing Copy Button',
        term: 'Clipboard trigger, success button.',
        desc: 'Buttons that capture string parameters and temporarily morph text/styles to green checkmarks upon success.',
        apps: 'Share links, API key reveals.',
        wild: '<a href="#" class="text-repo-blue hover:text-white underline">Tailwind UI Docs</a>',
        mods: 'Slide-up icon animation on success.',
        risk: '2', riskText: 'Intermediate',
        html: `
          <div class="flex justify-center py-4">
            <button onclick="showToast('Copied!')" class="inline-flex items-center gap-2 px-5 py-2.5 bg-repo-darkteal/30 border border-repo-teal text-xs font-black text-repo-teal rounded-lg transition hover:bg-repo-darkteal/50">
              ✓ COPIED SECURE!
            </button>
          </div>
        `,
        prompt: 'Create a Copy-to-Clipboard Action Button that morphs text/icons temporarily to a success state for 2 seconds.'
      },
      {
        id: '35', title: 'Progress Upload Cards',
        term: 'File transfer block, progress bar.',
        desc: 'Card layouts detailing asynchronous transfer states, complete with advancing percentage indicators.',
        apps: 'Cloud drives, form attachments.',
        wild: '<a href="#" class="text-repo-blue hover:text-white underline">Google Drive Upload</a>',
        mods: 'Cancel/Pause functionality.',
        risk: '2', riskText: 'Intermediate',
        html: `
          <div class="w-full max-w-sm mx-auto space-y-2 bg-[#111] p-3 rounded-lg border border-[#333]">
            <div class="flex justify-between text-[10px] font-black text-gray-400"><span>warp_drive.bin</span><span>65%</span></div>
            <div class="w-full h-2 bg-gray-800 rounded-full"><div class="w-[65%] h-full bg-repo-blue shadow-[0_0_10px_#5185c5]"></div></div>
          </div>
        `,
        prompt: 'Create a Progressive File Upload status card displaying file metadata and a horizontal percentage bar.'
      },
      {
        id: '36', title: 'Interactive Glossary Box',
        term: 'Concept preview board, hover lookup.',
        desc: 'A split column layout where hovering over dictionary tags instantly compiles a visual simulation card.',
        apps: 'API documentation, design systems.',
        wild: '<a href="#" class="text-repo-blue hover:text-white underline">Stripe Docs</a>',
        mods: 'Mouseclick triggers as a persistent lock.',
        risk: '4', riskText: 'Hard',
        html: `
          <div class="grid grid-cols-2 gap-2 text-xs">
            <div class="p-2 bg-[#111] border border-[#333] rounded cursor-pointer hover:bg-[#222]"><span class="text-repo-sand">⚡ Affordance</span></div>
            <div class="p-2 bg-[#111] border border-[#333] rounded text-center text-gray-500">Preview Area</div>
          </div>
        `,
        prompt: 'Create an Interactive Glossary and Preview component arranged in a layout, triggered via Hover.'
      },
      {
        id: '37', title: 'Context Right-Click Menu',
        term: 'Floating action list, custom context.',
        desc: 'Overrides the native browser context menu, positioning an absolute floating menu block at the mouse cursor.',
        apps: 'Web-based OS interfaces, file managers.',
        wild: '<a href="#" class="text-repo-blue hover:text-white underline">Google Drive</a>',
        mods: 'Nested sub-menus on hover.',
        risk: '3', riskText: 'Difficult',
        html: `
          <div class="w-full bg-[#111] border-2 border-dashed border-[#444] rounded-xl p-4 text-center text-xs text-gray-400 hover:border-repo-blue transition cursor-context-menu" onclick="document.getElementById('sandbox-context-menu').classList.toggle('hidden')">
            Right-Click inside zone
          </div>
        `,
        prompt: 'Build a Contextual Right-Click Dropdown component. Cancel native context actions, mapping absolute coordinates to a hidden node.'
      },
      {
        id: '38', title: 'Stepped Milestones',
        term: 'Progress stepper, milestone bar.',
        desc: 'A progression trail mapping completed, active, and locked phases with vector connected track bars.',
        apps: 'Checkout flows, onboarding wizards.',
        wild: '<a href="#" class="text-repo-blue hover:text-white underline">Shopify Checkout</a>',
        mods: 'Clickable steps for navigation back.',
        risk: '2', riskText: 'Intermediate',
        html: `
          <div class="flex items-center justify-between w-full max-w-sm mx-auto pt-2">
            <div class="w-6 h-6 rounded-full bg-repo-teal text-[10px] text-white flex items-center justify-center shadow-[0_0_10px_#56a29a]">✓</div>
            <div class="flex-1 h-0.5 bg-repo-teal"></div>
            <div class="w-6 h-6 rounded-full bg-[#111] border border-repo-blue text-[10px] text-repo-lightblue flex items-center justify-center animate-pulse shadow-[0_0_10px_#5185c5]">02</div>
            <div class="flex-1 h-0.5 bg-[#444]"></div>
            <div class="w-6 h-6 rounded-full bg-[#111] border border-[#444] text-[10px] text-gray-600 flex items-center justify-center">03</div>
          </div>
        `,
        prompt: 'Build a Stepped Milestones Tracker. Style connectors and circular indicators with status properties.'
      },
      {
        id: '39', title: 'Password Entropy Meter',
        term: 'Strength indicator, security bar.',
        desc: 'Evaluating character density and key metrics on input, rendering structured semantic safety indicators.',
        apps: 'Account creation, settings updates.',
        wild: '<a href="#" class="text-repo-blue hover:text-white underline">1Password Generator</a>',
        mods: 'Custom rules for special characters.',
        risk: '2', riskText: 'Intermediate',
        html: `
          <div class="w-full max-w-sm mx-auto space-y-2">
            <div class="flex gap-1 h-1.5 w-full bg-[#111] rounded-full overflow-hidden">
              <div class="flex-1 bg-repo-teal shadow-[0_0_10px_#56a29a]"></div>
              <div class="flex-1 bg-repo-teal shadow-[0_0_10px_#56a29a]"></div>
              <div class="flex-1 bg-transparent"></div>
            </div>
            <div class="text-[9px] font-mono text-repo-teal uppercase">Entropy: Moderate</div>
          </div>
        `,
        prompt: 'Build a Password Entropy and Security Meter. Analyze character strings on input and update multi-layered color bars showing security depth.'
      },
      {
        id: '40', title: 'Multi-Tabbed Nav Deck',
        term: 'Tab layout, panel switcher.',
        desc: 'Smooth tab controls that swap nested viewport panels instantly, maintaining active state highlights.',
        apps: 'Settings panels, complex dashboards.',
        wild: '<a href="#" class="text-repo-blue hover:text-white underline">GitHub Settings</a>',
        mods: 'Vertical tabs on desktop, horizontal on mobile.',
        risk: '2', riskText: 'Intermediate',
        html: `
          <div class="w-full max-w-sm mx-auto space-y-3 text-xs">
            <div class="flex border-b border-[#333]">
              <div class="px-4 py-2 border-b-2 border-repo-blue text-repo-lightblue font-black cursor-pointer">SHIELDS</div>
              <div class="px-4 py-2 border-b-2 border-transparent text-gray-500 hover:text-gray-300 cursor-pointer">REACTORS</div>
            </div>
            <div class="bg-[#111] p-3 rounded border border-[#333] text-gray-400 text-center">Shields Active</div>
          </div>
        `,
        prompt: 'Build a Multi-Tabbed Navigation Deck component. Style segment triggers with border highlights and active text colors, swapping nested layout panels on tab click.'
      },
      {
        id: '41', title: 'Virtualized List Loader',
        term: 'Infinite scroll, lazy loading.',
        desc: 'A high-density list that virtualizes rows on scroll, appending placeholder templates continuously.',
        apps: 'Social feeds, large data tables.',
        wild: '<a href="#" class="text-repo-blue hover:text-white underline">Twitter Feed</a>',
        mods: 'Bi-directional virtual scrolling.',
        risk: '5', riskText: 'Warning',
        html: `
          <div class="w-full max-w-sm mx-auto h-24 overflow-hidden border border-[#333] rounded bg-[#111] p-2 space-y-1 relative">
            <div class="p-2 bg-repo-dark rounded text-[10px] text-gray-400">Item 1 loaded...</div>
            <div class="p-2 bg-repo-dark rounded text-[10px] text-gray-400">Item 2 loaded...</div>
            <div class="absolute bottom-0 left-0 w-full h-8 bg-gradient-to-t from-[#111] to-transparent"></div>
          </div>
        `,
        prompt: 'Create a Virtualized List Scroll Loader. Detect container scroll-height limits to load additional dataset elements asynchronously on the fly.'
      },
      {
        id: '42', title: 'Interactive Tag Pill Input',
        term: 'Typeahead tags, multi-select input.',
        desc: 'Type keywords and press Comma or Enter to convert strings into dismissible, styled tag chips.',
        apps: 'Email recipients, blog tags.',
        wild: '<a href="#" class="text-repo-blue hover:text-white underline">Gmail To: Field</a>',
        mods: 'Auto-complete suggestions dropdown.',
        risk: '3', riskText: 'Difficult',
        html: `
          <div class="w-full max-w-sm mx-auto flex flex-wrap gap-1.5 p-2 bg-[#111] border border-[#333] rounded">
            <span class="inline-flex items-center gap-1.5 px-2 py-1 bg-repo-blue/20 border border-repo-blue/50 text-repo-lightblue text-[10px] font-bold rounded">Evocation <span class="cursor-pointer text-gray-500 hover:text-white">✕</span></span>
            <input type="text" class="bg-transparent border-none outline-none text-xs text-gray-300 w-24" placeholder="Add...">
          </div>
        `,
        prompt: 'Build an Interactive Tag Pill Input Field. Monitor character entry, transforming text into styled, dismissible tag pills upon matching space or enter keys.'
      },
      {
        id: '43', title: 'Comparison Split Slider',
        term: 'Before/after slider, image wipe.',
        desc: 'A draggable divider overlay allowing users to slide and compare Before/After image layers.',
        apps: 'Photo editing tools, product showcases.',
        wild: '<a href="#" class="text-repo-blue hover:text-white underline">Lightroom UI</a>',
        mods: 'Vertical orientation sliding.',
        risk: '3', riskText: 'Difficult',
        html: `
          <div class="w-full max-w-xs mx-auto h-20 bg-[#222] rounded overflow-hidden relative border border-[#444] cursor-col-resize">
            <div class="absolute inset-y-0 left-0 w-1/2 bg-repo-blue/30 border-r-2 border-repo-blue"></div>
            <div class="absolute inset-0 flex items-center justify-center pointer-events-none text-[10px] text-white/50 font-bold">Slide to Compare</div>
          </div>
        `,
        prompt: 'Build a Visual Comparison Split Slider. Position two images on top of each other, binding range slider metrics to control the width clip style property of the top-most wrapper.'
      },
      {
        id: '44', title: 'Color Token Palette Copier',
        term: 'Design token grid, swatch copier.',
        desc: 'Displays application styling tokens inside an interactive grid. Clicking swatches copies HEX codes.',
        apps: 'Design system documentation, theme editors.',
        wild: '<a href="#" class="text-repo-blue hover:text-white underline">Tailwind Colors</a>',
        mods: 'Toggle between HEX, RGB, HSL values.',
        risk: '1', riskText: 'Easy',
        html: `
          <div class="grid grid-cols-3 gap-2 max-w-xs mx-auto">
            <div class="p-2 bg-[#111] border border-[#333] rounded cursor-pointer text-center hover:border-repo-blue transition">
              <div class="w-6 h-6 bg-repo-blue mx-auto rounded mb-1"></div>
              <span class="text-[8px] font-mono text-gray-400">#5185c5</span>
            </div>
            <div class="p-2 bg-[#111] border border-[#333] rounded cursor-pointer text-center hover:border-repo-sand transition">
              <div class="w-6 h-6 bg-repo-sand mx-auto rounded mb-1"></div>
              <span class="text-[8px] font-mono text-gray-400">#df9f5e</span>
            </div>
            <div class="p-2 bg-[#111] border border-[#333] rounded cursor-pointer text-center hover:border-repo-teal transition">
              <div class="w-6 h-6 bg-repo-teal mx-auto rounded mb-1"></div>
              <span class="text-[8px] font-mono text-gray-400">#56a29a</span>
            </div>
          </div>
        `,
        prompt: 'Build a Color Token Palette Copier grid. Display key design tokens in styled block swatches, enabling click-to-copy handlers.'
      },
      {
        id: '45', title: 'Command Palette Omnibar',
        term: 'Global command launcher, spotlight search.',
        desc: 'A prompt-style modal overlay triggered via hotkey combos (Ctrl+K), executing global shortcuts.',
        apps: 'Power user navigation, complex enterprise apps.',
        wild: '<a href="#" class="text-repo-blue hover:text-white underline">Raycast</a>, <a href="#" class="text-repo-blue hover:text-white underline">VS Code</a>',
        mods: 'Integration with global router histories.',
        risk: '4', riskText: 'Hard',
        html: `
          <div class="w-full max-w-sm mx-auto bg-[#111] border border-[#333] rounded-lg p-3 shadow-2xl">
            <input type="text" class="w-full bg-[#1a1b1a] border border-[#444] rounded py-1.5 px-3 text-xs outline-none text-white mb-2" placeholder="> Search commands...">
            <div class="space-y-1">
              <div class="p-1.5 bg-repo-blue/20 text-repo-lightblue rounded text-[10px] flex justify-between cursor-pointer"><span>🚀 Launch</span><span class="opacity-50">CMD+Enter</span></div>
              <div class="p-1.5 text-gray-400 hover:bg-[#222] rounded text-[10px] flex justify-between cursor-pointer"><span>⚙️ Settings</span><span class="opacity-50">CMD+,</span></div>
            </div>
          </div>
        `,
        prompt: 'Build a Command Palette Omni-bar. Create an overlay container bound to keyboard event listeners (Ctrl+K), housing fuzzy filterable global system terminal command lists.'
      },
      {
        id: '06', title: 'Floating Action Button with Notification Badge',
        term: 'Floating Action Button, FAB, sticky widget button, fixed floaty bubble, notification badge.',
        desc: 'A high-emphasis circular button fixed over the page canvas. It opens a primary utility, popup, action menu, chat, or control panel, while the badge shows alerts, selected items, unread messages, or pending tasks.',
        apps: 'Support chat launchers, quick-tool bubbles, action popups, alert centers, builder launch buttons, mini command panels.',
        wild: '<a href="#" class="text-repo-blue hover:text-white underline">Material Design FAB</a>, <a href="#" class="text-repo-blue hover:text-white underline">Gmail Compose</a>, <a href="#" class="text-repo-blue hover:text-white underline">mobile chat widgets</a>',
        mods: 'Badge on/off, badge count, bottom-left or bottom-right positioning, icon style, pulse/glow active state, popup menu content, auto-hide on scroll.',
        risk: '2', riskText: 'Intermediate',
        html: `
          <div class="relative inline-flex">
            <button onclick="showToast('Floating action opened!')" class="w-16 h-16 rounded-full bg-repo-sand text-repo-dark border-2 border-repo-blue shadow-[0_0_18px_rgba(223,159,94,0.5)] text-2xl flex items-center justify-center hover:scale-105 transition">⚡</button>
            <span class="absolute -top-1 -right-1 bg-repo-maroon text-white text-[11px] font-black rounded-full w-6 h-6 flex items-center justify-center border border-repo-salmon">3</span>
          </div>
        `,
        prompt: 'Create a Floating Action Button with Notification Badge. Place a circular high-emphasis button fixed to a viewport corner, show an overlapping badge count, and open a contextual popup or utility panel when clicked.'
      },
      {
        id: '07', title: 'Range Slider & Custom Select Dropdown',
        term: 'Range slider, value adjuster, scrubber, custom select, dropdown selector.',
        desc: 'A paired control pattern where range sliders adjust numeric settings visually and styled select dropdowns choose from predefined options while matching the design system.',
        apps: 'Settings panels, image tools, volume controls, opacity controls, scale controls, export format selectors, filter panels.',
        wild: '<a href="#" class="text-repo-blue hover:text-white underline">photo editors</a>, <a href="#" class="text-repo-blue hover:text-white underline">audio controls</a>, <a href="#" class="text-repo-blue hover:text-white underline">system settings</a>',
        mods: 'Min/max values, step size, value labels, custom track colours, live preview binding, disabled state, pill dropdown style.',
        risk: '2', riskText: 'Intermediate',
        html: `
          <div class="w-full max-w-md mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="bg-repo-dark border border-[#444] rounded-xl p-4">
              <label class="text-[10px] font-black text-repo-lightblue uppercase block mb-2">Intensity</label>
              <input type="range" min="0" max="100" value="65" class="custom-range" oninput="document.getElementById('slider-demo-value').innerText=this.value+'%'">
              <div id="slider-demo-value" class="text-xs text-repo-sand mt-2 font-mono">65%</div>
            </div>
            <div class="bg-repo-dark border border-[#444] rounded-xl p-4">
              <label class="text-[10px] font-black text-repo-lightblue uppercase block mb-2">Format</label>
              <select onchange="showToast('Format set to '+this.value)" class="w-full bg-[#1a1b1a] border border-[#444] rounded-full px-3 py-2 text-xs text-repo-cream outline-none">
                <option>PNG</option><option>JPG</option><option>WEBP</option>
              </select>
            </div>
          </div>
        `,
        prompt: 'Build a Range Slider and Custom Select Dropdown control set. Use the slider for a numeric value with live value feedback, and a styled dropdown selector for choosing one option from a predefined list.'
      },
      {
        id: '08', title: 'Persistent Bottom Sheet / Sheet Footer Bar',
        term: 'Persistent bottom sheet, sheet footer bar, sticky bottom control panel, footer action tray, curved folder tab overlay.',
        desc: 'A persistent panel anchored to the bottom of a viewport or container. It holds high-priority actions while the main content scrolls above it.',
        apps: 'Editor action controls, mobile tool trays, save/export footers, bottom navigation actions, confirmation buttons, favourites panels.',
        wild: '<a href="#" class="text-repo-blue hover:text-white underline">mobile bottom sheets</a>, <a href="#" class="text-repo-blue hover:text-white underline">Google Maps panels</a>, <a href="#" class="text-repo-blue hover:text-white underline">checkout bars</a>',
        mods: 'Collapsed/expanded state, curved folder-tab top edge, sticky or fixed mode, icon/text buttons, two-button or multi-button layout, mobile safe-area padding.',
        risk: '2', riskText: 'Intermediate',
        html: `
          <div class="w-full max-w-md mx-auto bg-black border border-[#333] rounded-xl overflow-hidden pt-16 relative min-h-[150px]">
            <div class="absolute bottom-0 left-0 right-0 bg-repo-sand text-repo-dark border-t-2 border-repo-blue rounded-t-3xl p-4 flex gap-3 shadow-[0_-8px_20px_rgba(0,0,0,0.45)]">
              <button onclick="showToast('Draft saved')" class="flex-1 rounded-full bg-repo-dark text-repo-cream py-2 text-[10px] font-black uppercase">Save</button>
              <button onclick="showToast('Export opened')" class="flex-1 rounded-full bg-repo-blue text-white py-2 text-[10px] font-black uppercase">Export</button>
            </div>
          </div>
        `,
        prompt: 'Create a Persistent Bottom Sheet / Sheet Footer Bar anchored to the bottom of the viewport or container. Give it a curved top edge and include primary action buttons that remain available while content scrolls above.'
      },
      {
        id: '10', title: 'Text Button with Leading Icon',
        term: 'Text button with leading icon, icon text button, inline action button, leading-icon button.',
        desc: 'A button that combines a text label with an icon before the text. The icon helps users identify the action quickly before reading the label.',
        apps: 'Copy, export, download, attach, import, save, open, add item, send to editor, apply settings.',
        wild: '<a href="#" class="text-repo-blue hover:text-white underline">Material buttons</a>, <a href="#" class="text-repo-blue hover:text-white underline">GitHub actions</a>, <a href="#" class="text-repo-blue hover:text-white underline">Slack actions</a>',
        mods: 'Leading or trailing icon, icon-only mobile variant, pill/rectangle style, outline/filled/ghost state, loading state, success morph state.',
        risk: '1', riskText: 'Easy',
        html: `
          <button onclick="showToast('Sent to editor')" class="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-repo-blue hover:bg-repo-lightblue text-white border border-repo-lightblue text-xs font-black uppercase transition">
            <span>⬆️</span><span>Send to Editor</span>
          </button>
        `,
        prompt: 'Create a Text Button with Leading Icon. Place a small semantic icon before the label, keep the button visually compact, and support hover/active states.'
      },
      {
        id: '18', title: 'Drag-and-Drop Raw Textarea Loader',
        term: 'Drop zone loader, drag-and-drop file loader, textarea file importer, raw text drop area.',
        desc: 'A drop zone that monitors drag events, highlights while a file is over it, and loads dropped raw text files into a textarea or editor.',
        apps: 'Importing JSON, loading HTML snippets, prompt files, bulk text cleanup, code editor import zones, CSV/text ingestion.',
        wild: '<a href="#" class="text-repo-blue hover:text-white underline">file upload drop zones</a>, <a href="#" class="text-repo-blue hover:text-white underline">JSON formatter upload boxes</a>',
        mods: 'Accepted file types, drag-over glow, max file size, filename/status display, auto-parse JSON, mobile upload button fallback.',
        risk: '3', riskText: 'Difficult',
        html: `
          <div class="w-full max-w-md mx-auto border-2 border-dashed border-repo-blue rounded-xl p-4 bg-repo-dark text-center" ondragover="event.preventDefault(); this.classList.add('bg-repo-blue/20')" ondragleave="this.classList.remove('bg-repo-blue/20')" ondrop="event.preventDefault(); this.classList.remove('bg-repo-blue/20'); showToast('Drop detected - loader would read file text');">
            <div class="text-2xl mb-2">📥</div>
            <div class="text-xs font-bold text-repo-lightblue uppercase">Drop raw text / json here</div>
            <textarea class="mt-3 w-full h-20 bg-black border border-[#444] rounded p-2 text-[10px] text-repo-cream font-mono" placeholder="Loaded text appears here..."></textarea>
          </div>
        `,
        prompt: 'Build a Drag-and-Drop Raw Textarea Loader. Add drag-over highlighting, accept dropped text/JSON/CSV files, read the file client-side, and load its contents into a textarea with filename/status feedback.'
      },
      {
        id: '19', title: 'Interactive Column Width Resizer',
        term: 'Column resizer, splitter handle, draggable column divider, manual pixel resizer.',
        desc: 'A draggable divider between columns that lets users manually adjust panel widths. It is useful for split code/preview layouts and data tables.',
        apps: 'Code editor split panes, table column resizing, side-by-side preview layouts, inspector panels, dashboard workspaces.',
        wild: '<a href="#" class="text-repo-blue hover:text-white underline">spreadsheet columns</a>, <a href="#" class="text-repo-blue hover:text-white underline">VS Code split panels</a>, <a href="#" class="text-repo-blue hover:text-white underline">browser devtools</a>',
        mods: 'Horizontal or vertical splitter, min/max widths, snap points, double-click reset, persistence, mobile toggle fallback.',
        risk: '3', riskText: 'Difficult',
        html: `
          <div class="w-full max-w-md mx-auto flex border border-[#444] rounded-xl overflow-hidden bg-black min-h-[110px]">
            <div class="flex-1 p-3 text-xs text-repo-lightblue">Left panel</div>
            <div class="w-2 bg-repo-sand cursor-col-resize" title="Drag handle"></div>
            <div class="flex-1 p-3 text-xs text-repo-salmon">Right panel</div>
          </div>
        `,
        prompt: 'Create an Interactive Column Width Resizer. Place a draggable splitter between two panels, enforce min/max widths, and persist the chosen panel sizes where appropriate.'
      },
      {
        id: '20', title: 'Composite Multi-Key Sequence Selector',
        term: 'Composite key selector, ordered key builder, multi-key matching sequence, priority badge selector.',
        desc: 'A selector that lets users click available fields to build an ordered matching sequence. Selected fields display ordered badges like 1, 2, 3 and update as items are added or removed.',
        apps: 'Data matching, deduplication tools, import mapping, sort priority configuration, multi-field lookup setup.',
        wild: '<a href="#" class="text-repo-blue hover:text-white underline">data import mappers</a>, <a href="#" class="text-repo-blue hover:text-white underline">database query builders</a>',
        mods: 'Reorder selected keys, remove selected keys, drag sequence order, required keys, export sequence array, priority numbers.',
        risk: '3', riskText: 'Difficult',
        html: `
          <div class="w-full max-w-md mx-auto bg-repo-dark border border-[#444] rounded-xl p-4 space-y-3">
            <div class="flex flex-wrap gap-2">
              <button onclick="showToast('Added Email as key 1')" class="px-3 py-1 rounded-full bg-repo-blue text-white text-[10px]">Email</button>
              <button onclick="showToast('Added Name as key 2')" class="px-3 py-1 rounded-full bg-repo-blue text-white text-[10px]">Name</button>
              <button onclick="showToast('Added City as key 3')" class="px-3 py-1 rounded-full bg-repo-blue text-white text-[10px]">City</button>
            </div>
            <div class="flex flex-wrap gap-2 border-t border-[#444] pt-3">
              <span class="px-3 py-1 rounded-full bg-repo-sand text-repo-dark text-[10px] font-bold">1 Email</span>
              <span class="px-3 py-1 rounded-full bg-repo-sand text-repo-dark text-[10px] font-bold">2 Name</span>
            </div>
          </div>
        `,
        prompt: 'Build a Composite Multi-Key Sequence Selector. Let users choose fields to form an ordered matching sequence, show numbered priority badges, support removing/reordering keys, and export the final key order.'
      },
      {
        id: '22', title: 'Layered Priority Sort Configuration',
        term: 'Priority sort builder, layered sort configuration, query prioritizer, ordered sort stack.',
        desc: 'A rule builder where multiple sort/filter rules are stacked in priority order. The first rule has highest priority, followed by secondary and tertiary criteria.',
        apps: 'Data sorting, search ranking, inventory sorting, component filtering, result prioritisation, import logic.',
        wild: '<a href="#" class="text-repo-blue hover:text-white underline">Airtable sort panel</a>, <a href="#" class="text-repo-blue hover:text-white underline">spreadsheet sort rules</a>',
        mods: 'Add/remove sort layers, drag reorder, ascending/descending toggles, priority badges, export JSON rule list.',
        risk: '3', riskText: 'Difficult',
        html: `
          <div class="w-full max-w-md mx-auto bg-repo-dark border border-[#444] rounded-xl p-4 space-y-2">
            <div class="flex items-center gap-2 bg-black border border-repo-blue/40 rounded-lg p-2 text-xs"><span class="bg-repo-sand text-repo-dark rounded-full w-5 h-5 flex items-center justify-center font-bold">1</span><span class="flex-1">Sort by Code Risk</span><span>DESC</span></div>
            <div class="flex items-center gap-2 bg-black border border-repo-blue/40 rounded-lg p-2 text-xs"><span class="bg-repo-sand text-repo-dark rounded-full w-5 h-5 flex items-center justify-center font-bold">2</span><span class="flex-1">Then by Category</span><span>ASC</span></div>
          </div>
        `,
        prompt: 'Create a Layered Priority Sort Configuration panel. Let users add multiple ordered sort rules, display numbered priority badges, support drag reorder, and export the ordered rule stack.'
      },
      {
        id: '23', title: 'Global Search-and-Replace Sanitizer',
        term: 'Search and replace tool, text sanitizer, global replace utility, find/delete tool.',
        desc: 'A tool that finds text patterns and replaces or deletes them globally. It is used to clean pasted data, normalize strings, or remove unwanted characters.',
        apps: 'Data cleanup, HTML cleanup, prompt cleanup, CSV/JSON text repair, removing unwanted characters, replacing old labels.',
        wild: '<a href="#" class="text-repo-blue hover:text-white underline">Notepad Find/Replace</a>, <a href="#" class="text-repo-blue hover:text-white underline">VS Code search panel</a>',
        mods: 'Literal or regex mode, case-sensitive toggle, preview matches, replace all, delete matches, count affected items, undo step.',
        risk: '3', riskText: 'Difficult',
        html: `
          <div class="w-full max-w-md mx-auto bg-repo-dark border border-[#444] rounded-xl p-4 space-y-2">
            <div class="grid grid-cols-2 gap-2"><input class="bg-black border border-[#444] rounded px-2 py-1 text-xs" value="old"><input class="bg-black border border-[#444] rounded px-2 py-1 text-xs" value="new"></div>
            <textarea class="w-full h-16 bg-black border border-[#444] rounded p-2 text-[10px] font-mono">old button, old label, old border</textarea>
            <button onclick="showToast('3 matches would be replaced')" class="px-3 py-1 rounded bg-repo-blue text-white text-[10px] font-bold uppercase">Preview Replace</button>
          </div>
        `,
        prompt: 'Build a Global Search-and-Replace Sanitizer. Provide find/replace fields, count matching text, preview affected results, and support safe replace-all/delete operations with an undo-friendly workflow.'
      }

    ];

// v0.02 content expansion pass: keep original recovered text, but add enough practical context for the repository to work as a training/reference tool.
(function(){
  function categoryFor(c) {
    const id = Number(c.id);
    if ([1,2,3,4,5,6,7,8,10].includes(id)) return 'input/control pattern';
    if ([9,11,12,13,14,15,18,19,20,22,23,24,25].includes(id)) return 'logic or layout pattern';
    if ([16,17,21].includes(id)) return 'state and feedback pattern';
    if ([26,27,28,29,30,31,32,33,34,35].includes(id)) return 'dynamic interface module';
    return 'premium interface pattern';
  }
  function richerDesc(c) {
    return `${c.desc || ''} In the UI Repository this should be treated as a reusable ${categoryFor(c)}: it has a visible form, an interaction rule, and a promptable behaviour. When describing it to an AI, mention the trigger, the default state, the active state, what changes visually, and what data or user action it responds to.`;
  }
  function richerApps(c) {
    return `${c.apps || ''} Also useful when building editor panels, control trays, dashboards, import tools, filter systems, preview windows, or mobile/desktop variants where the same interaction needs to be described consistently. In the UI Builder, use this component when that behaviour belongs to a specific group, section, panel, card, or action area.`;
  }
  function richerMods(c) {
    return `${c.mods || ''} Common modifications include changing colour tokens, size, spacing, icon position, hover/focus states, active/disabled states, mobile stacking, desktop split layout, animation timing, persistence, and whether the control opens a popup, updates visible content, or writes into local state. The prompt should say which parts are decorative and which parts are functional.`;
  }
  window.uiRepositoryComponents = (window.uiRepositoryComponents || []).map(c => ({
    ...c,
    desc: richerDesc(c),
    apps: richerApps(c),
    mods: richerMods(c)
  }));
})();
