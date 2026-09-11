import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import WebTorrent,{type Torrent} from 'webtorrent';
import {Engine} from '../electron/engine';
import {metadataFromProbe} from '../electron/media';
const exec=promisify(execFile);
const offline={dht:false,tracker:false,lsd:false,natUpnp:false,natPmp:false,utp:false};
const wait=async(check:()=>boolean)=>{for(let n=0;n<300;n++){if(check())return;await new Promise(r=>setTimeout(r,100))}throw Error('Metadata timeout')};
test('metadata uses explicit release tags, not file creation dates',()=>{
 assert.deepEqual(metadataFromProbe({format:{duration:'120.5',tags:{date:'2010-09-27',title:'Sintel'}}}),{duration:120.5,year:'2010',title:'Sintel'});
 assert.equal(metadataFromProbe({format:{tags:{creation_time:'2026-09-10'}}}).year,undefined);
 assert.equal(metadataFromProbe({format:{duration:'NaN'}}).duration,undefined);
});
test('video tags and thumbnail are read through the torrent HTTP gateway without a playback status', {timeout:45000},async()=>{
 const dir=await mkdtemp(join(tmpdir(),'streamtorrent-media-'));const tools=resolve('vendor',`${process.platform}-${process.arch}`);
 const seed=new WebTorrent(offline),engine=new Engine(join(dir,'state'),join(dir,'downloads'),offline);
 try{
  const movie=join(dir,'test.mp4');await exec(join(tools,process.platform==='win32'?'ffmpeg.exe':'ffmpeg'),['-v','error','-f','lavfi','-i','testsrc2=size=320x180:rate=15','-t','8','-c:v','mpeg4','-q:v','5','-metadata','date=2010','-metadata','title=Local streaming test','-movflags','+faststart',movie]);
  const torrent=await new Promise<Torrent>(resolve=>seed.seed(movie,{announce:[]},resolve));
  await engine.start();engine.enableMedia(tools);await engine.add(Buffer.from(torrent.torrentFile));const e=[...engine.entries.values()][0];await wait(()=>!!e.torrent?.ready);e.torrent!.addPeer(`127.0.0.1:${seed.torrentPort}`);await wait(()=>!!e.media?.thumbnail);
  assert.equal(e.media!.year,'2010');assert.ok(e.media!.duration!>=7.9);assert.ok(e.media!.thumbnail!.startsWith('data:image/jpeg;base64,'));assert.equal(engine.view(e).serving,false);assert.ok(engine.view(e).bufferSeconds!>7);
  await engine.remove(e.id,true);assert.equal(engine.entries.size,0);
 }finally{await engine.close();await new Promise<void>(resolve=>seed.destroy(()=>resolve()));await rm(dir,{recursive:true,force:true})}
});
