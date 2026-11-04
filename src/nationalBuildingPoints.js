// NBP1: count followed by [uint32 fid, int32 easting-decimetres, int32 northing-decimetres].
export function decodeNationalBuildingPoints(buffer) {
 const view=new DataView(buffer);
 if(buffer.byteLength<8 || view.getUint32(0,true)!==0x3150424e)throw new Error('전국 건물 위치 형식이 올바르지 않습니다.');
 const count=view.getUint32(4,true);if(count>2000000||buffer.byteLength!==8+count*12)throw new Error('전국 건물 위치 개수가 올바르지 않습니다.');
 const seoul=new Float32Array(count*3),fids=new Uint32Array(count),local=[];
 for(let i=0;i<count;i++){const offset=8+i*12,e=view.getInt32(offset+4,true)/10,n=view.getInt32(offset+8,true)/10;fids[i]=view.getUint32(offset,true);seoul[i*3]=e-200000;seoul[i*3+1]=4;seoul[i*3+2]=550000-n;const x=n-552531,z=e-197897;if(x>=-210&&x<=240&&z>=-200&&z<=260)local.push(x,4,z);}
 return {count,fids,seoul,local:new Float32Array(local)};
}
export async function loadNationalBuildingPoints(signal) {
 const response=await fetch('/gis/national-building-changes/points.bin.gz',{signal});if(!response.ok)throw new Error(`전국 건물 위치 요청 실패 (${response.status})`);
 const bytes=new Uint8Array(await response.arrayBuffer());
 const buffer=bytes[0]===31&&bytes[1]===139?await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer():bytes.buffer;
 return decodeNationalBuildingPoints(buffer);
}
