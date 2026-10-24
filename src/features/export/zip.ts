const table = Array.from({ length:256 }, (_,n) => {
  for (let k=0;k<8;k++) n=n&1?0xedb88320^(n>>>1):n>>>1;
  return n>>>0;
});
export const crc32 = (bytes: Uint8Array) => {
  let crc=0xffffffff; for (const byte of bytes) crc=table[(crc^byte)&255]^(crc>>>8); return (crc^0xffffffff)>>>0;
};
export function zipFiles(files: {name:string;data:Uint8Array}[]): Blob {
  const chunks: Uint8Array[]=[]; const directory: Uint8Array[]=[]; let offset=0;
  for (const file of files) {
    const name=new TextEncoder().encode(file.name); const crc=crc32(file.data); const size=file.data.length;
    const header=new Uint8Array(30+name.length); const view=new DataView(header.buffer);
    view.setUint32(0,0x04034b50,true); view.setUint16(4,20,true); view.setUint16(6,0x0800,true);
    view.setUint32(14,crc,true); view.setUint32(18,size,true); view.setUint32(22,size,true); view.setUint16(26,name.length,true); header.set(name,30);
    chunks.push(header,file.data);
    const central=new Uint8Array(46+name.length); const cv=new DataView(central.buffer);
    cv.setUint32(0,0x02014b50,true); cv.setUint16(4,20,true); cv.setUint16(6,20,true); cv.setUint16(8,0x0800,true);
    cv.setUint32(16,crc,true); cv.setUint32(20,size,true); cv.setUint32(24,size,true); cv.setUint16(28,name.length,true);
    cv.setUint32(42,offset,true); central.set(name,46); directory.push(central);
    offset+=header.length+size;
  }
  const directorySize=directory.reduce((sum,part)=>sum+part.length,0);
  const end=new Uint8Array(22); const ev=new DataView(end.buffer);
  ev.setUint32(0,0x06054b50,true); ev.setUint16(8,files.length,true); ev.setUint16(10,files.length,true);
  ev.setUint32(12,directorySize,true); ev.setUint32(16,offset,true);
  return new Blob([...chunks,...directory,end].map(part=>new Uint8Array(part)),{type:'application/zip'});
}
