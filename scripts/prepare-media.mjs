import {mkdir,writeFile,copyFile,chmod,readFile,mkdtemp,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const sources=JSON.parse(await readFile(new URL('../vendor/SOURCES.json',import.meta.url),'utf8'));
const scratch=await mkdtemp(join(tmpdir(),'streamtorrent-media-'));
async function download(url,expected,algorithm){
 const response=await fetch(url);if(!response.ok)throw Error(`Download failed: ${response.status}`);
 const data=Buffer.from(await response.arrayBuffer());
 const actual=createHash(algorithm).update(data).digest(algorithm==='sha512'?'base64':'hex');
 if(actual!==expected)throw Error('Checksum mismatch: '+url);return data;
}
try {
 for(const [index,source] of sources.entries()){
  const platform=source.name.split('/')[1],tool=source.name.includes('ffprobe')?'ffprobe':'ffmpeg';
  const filename=tool+(platform.startsWith('win')?'.exe':'');
  const dir=join(scratch,String(index));await mkdir(dir);await mkdir(`vendor/${platform}`,{recursive:true});
  await writeFile(join(dir,'package.tgz'),await download(source.url,source.integrity.replace('sha512-',''),'sha512'));
  execFileSync('tar',['-xzf',join(dir,'package.tgz'),'-C',dir]);
  await copyFile(join(dir,'package',filename),`vendor/${platform}/${filename}`);await chmod(`vendor/${platform}/${filename}`,0o755);
  console.log('Prepared',source.name,source.version);
 }
 const archive=join(scratch,'datachannel.tgz');
 await writeFile(archive,await download('https://github.com/murat-dogan/node-datachannel/releases/download/v0.32.3/node-datachannel-v0.32.3-napi-v8-win32-x64.tar.gz','3bfacc4125b296197fe9e22ebd9a52f05321c50aca9d80b92897507f898c12c3','sha256'));
 execFileSync('tar',['-xzf',archive,'-C',scratch]);
 await copyFile(join(scratch,'build/Release/node_datachannel.node'),'vendor/win32-x64/node_datachannel.node');
 console.log('Prepared Windows node-datachannel 0.32.3');
} finally {await rm(scratch,{recursive:true,force:true});}
