import test from 'node:test';
import assert from 'node:assert/strict';
import { File } from 'node:buffer';
import { isPersistentFileHandle, getPermittedMediaFile, saveMediaHandle, getMediaHandle } from '../js/media-handle-store.mjs';

const fakeFile=()=>new File([Uint8Array.of(1,2,3)],'source.mov',{type:'video/quicktime'});
test('only actual file-like handles are eligible; never save a raw File or Blob',()=>{
    assert.equal(isPersistentFileHandle(null),false);
    assert.equal(isPersistentFileHandle(fakeFile()),false);
    assert.equal(isPersistentFileHandle({kind:'directory',getFile(){}}),false);
    assert.equal(isPersistentFileHandle({kind:'file',getFile(){return fakeFile();}}),true);
});
test('granted file handle reads only after permission check',async()=>{
    let opened=0;
    const handle={kind:'file',async queryPermission(){return 'granted';},
        async getFile(){opened++;return fakeFile();}};
    const file=await getPermittedMediaFile(handle);
    assert.equal(file.name,'source.mov');
    assert.equal(opened,1);
});
test('ungranted permission never prompts on automatic reload',async()=>{
    let requested=0,opened=0;
    const handle={kind:'file',async queryPermission(){return 'prompt';},
        async requestPermission(){requested++;return 'granted';},
        async getFile(){opened++;return fakeFile();}};
    assert.equal(await getPermittedMediaFile(handle),null);
    assert.equal(requested,0);
    assert.equal(opened,0);
    assert.equal((await getPermittedMediaFile(handle,{requestPermission:true})).name,'source.mov');
    assert.equal(requested,1);
    assert.equal(opened,1);
});
test('revoked permission or moved files are never silently returned',async()=>{
    let reads=0;
    const denied={kind:'file',async queryPermission(){return 'denied';},
        async getFile(){reads++;return fakeFile();}};
    assert.equal(await getPermittedMediaFile(denied),null);
    assert.equal(reads,0);
    const moved={kind:'file',async queryPermission(){return 'granted';},
        async getFile(){const error=new Error('Moved');error.name='NotFoundError';throw error;}};
    assert.equal(await getPermittedMediaFile(moved),null);
});
test('without IndexedDB, persistence is optional and raw file data is never stored',async()=>{
    // Browser acceptance exercises real IndexedDB/OPFS structured cloning.
    assert.equal(await saveMediaHandle('a',{kind:'file',getFile:fakeFile}),false);
    assert.equal(await getMediaHandle('a'),null);
});
