/** MotoriClip selected-effects catalog, batch 1. User-selected 19 Nov 2026.
 * Names deliberately preserve the user's spelling/capitalization, including
 * "Brokey dissolve". Listing an effect is NOT a claim of implementation.
 * Append future batches without reassigning these IDs.
 */
export const SELECTED_TRANSITION_NAMES = Object.freeze([
    "SpiralBlockWipe",
    "Hologram",
    "Cell dissolve",
    "Vortex",
    "Crumple",
    "Liquid fill",
    "Heat haze",
    "Sphere",
    "Rings wipe",
    "Snapshot",
    "Color panel wipe",
    "Gallery",
    "VHS tracking",
    "Card swipe",
    "Camera shake",
    "Smoke dissolve",
    "Splatter wipe",
    "Bloom dissolve",
    "Brokey dissolve",
    "Light rays",
    "Block cover",
    "Disintegrate",
    "ASCII",
    "Film strip",
    "Ink bleed",
    "Refraction",
    "Spin",
    "Paper tear",
    "Aperture wipe",
    "Spiral wipe",
    "Prisms",
    "TV turn off",
    "Color codes",
    "Cross warp",
    "Cross hatch",
    "Cube",
    "Fade",
    "Glitch flicker",
    "Pixelize",
    "Random squares",
    "Ripple"
]);
export const transitionId = name => String(name).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
export const TRANSITION_CATALOG = Object.freeze(SELECTED_TRANSITION_NAMES.map((name,index)=>Object.freeze({
    id:transitionId(name),label:name,group:'User selection: first 10 gallery pages',
    status:['Fade','Pixelize','Random squares','Glitch flicker','Ripple','TV turn off','Aperture wipe','Spiral wipe','Rings wipe','Color panel wipe','Block cover','Cross hatch','Film strip','Card swipe','Camera shake','VHS tracking','Spin','Cube','Cross warp','Paper tear','Ink bleed','Splatter wipe','Cell dissolve','Bloom dissolve','Smoke dissolve','Vortex','Heat haze','Refraction','Liquid fill','Disintegrate','Light rays','ASCII','Color codes','Prisms'].includes(name)?'available':'requested',selectedOrder:index+1
})));
