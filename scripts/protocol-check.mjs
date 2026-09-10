import {_electron as electron} from 'playwright';
import executablePath from 'electron';
import WebTorrent from 'webtorrent';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const dir=await mkdtemp(join(tmpdir(),'streamtorrent-protocol-'));const seed=new WebTorrent({dht:false,tracker:false,lsd:false,natUpnp:false,natPmp:false,utp:false});let app;
try{
 const file=join(dir,'protocol-test.txt');await writeFile(file,'Local protocol test');const torrent=await new Promise(resolve=>seed.seed(file,{announce:[]},resolve));const magnet=torrent.magnetURI+`&x.pe=127.0.0.1:${seed.torrentPort}`;
 app=await electron.launch({executablePath:process.env.PACKAGED_APP||executablePath,args:process.env.PACKAGED_APP?[magnet]:['.',magnet],env:{...process.env,STREAMTORRENT_TEST_DIR:join(dir,'state'),STREAMTORRENT_DOWNLOAD_DIR:join(dir,'downloads')}});
 const page=await app.firstWindow();let snapshot;for(let i=0;i<150;i++){snapshot=await page.evaluate(()=>window.torrent.snapshot());if(snapshot.torrents[0]?.metadata)break;await new Promise(r=>setTimeout(r,100))}
 assert.equal(snapshot.torrents[0]?.metadata,true);assert.equal(snapshot.torrents.length,1);
 await app.evaluate(({app},url)=>app.emit('open-url',{preventDefault(){}},url),magnet);
 await new Promise(r=>setTimeout(r,250));assert.equal((await page.evaluate(()=>window.torrent.snapshot())).torrents.length,1);
 console.log('PASS: cold-start magnet argument, metadata from local peer, duplicate warm-start URL');
}finally{if(app)await app.close();await new Promise(resolve=>seed.destroy(resolve));await rm(dir,{recursive:true,force:true})}
