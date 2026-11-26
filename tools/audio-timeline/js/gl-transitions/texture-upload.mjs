// Allocate texture storage once per size; upload current pixels on every draw.
// Scratch canvases are mutable even when their object identity is unchanged.
// Never skip content uploads based on source identity or timeline time.
const dimensions=new WeakMap();
export function uploadTransitionTexture(gl,texture,source){
    const width=source.width,height=source.height;
    const cached=dimensions.get(texture);
    if(cached&&cached.width===width&&cached.height===height){
        gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,gl.RGBA,gl.UNSIGNED_BYTE,source);
    }else{
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);
        dimensions.set(texture,{width,height});
    }
}
