/** MotoriClip selected-effects catalog, batch 1. User-selected 19 Nov 2026.
 * Preserve the requested order and correct the legacy typo "Bokeh dissolve"
 * to the original shader's name BokehDissolve. Saved old IDs are migrated.
 * Append future batches without reassigning the canonical IDs.
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
    "Bokeh dissolve",
    "Light rays",
    "Block cover",
    "Disintegrate",
    "ASCII",
    "Film strip",
    "Ink bleed",
    "Refraction",
    "WhipSpin",
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
/** Canonicalize selected effect IDs, preserving legacy persisted project aliases. */
export const normalizeTransitionEffectId = id =>
    id==='brokey-dissolve'?'bokeh-dissolve'
        :(id==='spin'||id==='whip-spin')?'whipspin':id;
export function normalizeTransitionParameters(parameters={}){
    const result={...(parameters||{})};
    if(Object.hasOwn(result,'brokey-dissolve')){
        if(!Object.hasOwn(result,'bokeh-dissolve'))
            result['bokeh-dissolve']=result['brokey-dissolve'];
        delete result['brokey-dissolve'];
    }
    // Saved MotoriClip projects may still contain the old Spin settings key.
    if(Object.hasOwn(result,'spin')){
        if(!Object.hasOwn(result,'whipspin'))
            result.whipspin=result.spin;
        delete result.spin;
    }
    if(Object.hasOwn(result,'whip-spin')){
        if(!Object.hasOwn(result,'whipspin'))
            result.whipspin=result['whip-spin'];
        delete result['whip-spin'];
    }
    return result;
}
export const transitionId = name => normalizeTransitionEffectId(String(name).toLowerCase()
    .replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''));
export const TRANSITION_CATALOG = Object.freeze(SELECTED_TRANSITION_NAMES.map((name,index)=>Object.freeze({
    id:transitionId(name),label:name,group:'User selection: first 10 gallery pages',
    status:['Fade','Pixelize','Random squares','Glitch flicker','Ripple','TV turn off','Aperture wipe','Spiral wipe','Rings wipe','Color panel wipe','Block cover','Cross hatch','Film strip','Card swipe','Camera shake','VHS tracking','WhipSpin','Cube','Cross warp','Paper tear','Ink bleed','Splatter wipe','Cell dissolve','Bloom dissolve','Smoke dissolve','Vortex','Heat haze','Refraction','Liquid fill','Disintegrate','Light rays','ASCII','Color codes','Prisms','SpiralBlockWipe','Hologram','Crumple','Sphere','Snapshot','Gallery','Bokeh dissolve'].includes(name)?'available':'requested',selectedOrder:index+1
})));
