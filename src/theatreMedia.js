// [공연 영사와 입체 음향 / Theatre projection and spatial audio]
export function effectLevel(previous, frequency, enabled, playing) {
 if (!enabled || !playing) return 0;
 const target=Math.max(0,Math.min(1,Number(frequency||0)/180));
 return previous+(target-previous)*0.12;
}

export function createTheatreMedia({THREE,camera,screen,effectLights=[],onStatus=()=>{},src='/media/one-day-more-720p.mp4',videoFactory=()=>document.createElement('video')}) {
 if(!THREE||!camera||!screen) throw new Error('영사 화면과 카메라가 필요합니다.');
 const video=videoFactory();video.preload='metadata';video.playsInline=true;video.crossOrigin='anonymous';video.src=src;
 const originalMaterial=screen.material;
 const texture=new THREE.VideoTexture(video);texture.colorSpace=THREE.SRGBColorSpace;texture.flipY=false;
 const material=new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide,toneMapped:false});
 screen.material=material;
 const listener=new THREE.AudioListener();camera.add(listener);
 const audio=new THREE.PositionalAudio(listener);audio.setMediaElementSource(video);audio.setRefDistance(12);audio.setRolloffFactor(0.8);audio.setVolume(0.8);audio.panner.panningModel='HRTF';if(screen.geometry){if(!screen.geometry.boundingBox)screen.geometry.computeBoundingBox();screen.geometry.boundingBox?.getCenter(audio.position);}screen.add(audio);
 const analyser=new THREE.AudioAnalyser(audio,256);
 const bases=effectLights.map(light=>light.intensity);
 let enabled=false,level=0,disposed=false;
 const reset=()=>effectLights.forEach((light,i)=>{light.intensity=bases[i];});
 const onError=()=>onStatus('영상을 불러오지 못했습니다. 연결을 확인한 뒤 다시 시도하세요.');
 const onEnded=()=>{reset();onStatus('영상이 끝났습니다.');};
 video.addEventListener('error',onError);video.addEventListener('ended',onEnded);
 return {
  async play(){if(disposed)throw new Error('종료된 영사기입니다.');try{const resume=listener.context.resume();const playback=video.play();await Promise.all([resume,playback]);onStatus('영상과 공간 음향 재생 중');}catch(error){onStatus('재생하지 못했습니다. 재생 버튼을 다시 눌러 주세요.');throw error;}},
  pause(){if(disposed)return;video.pause();level=0;reset();onStatus('영상 일시 정지');},
  setVolume(value){audio.setVolume(Math.max(0,Math.min(1,Number(value)||0)));},
  setEffects(value){enabled=Boolean(value);if(!enabled){level=0;reset();}},
  update(){if(disposed)return;level=effectLevel(level,enabled?analyser.getAverageFrequency():0,enabled,!video.paused&&!video.ended);effectLights.forEach((light,i)=>{light.intensity=bases[i]*(1+level*1.5);});},
  dispose(){if(disposed)return;disposed=true;video.pause();video.removeEventListener('error',onError);video.removeEventListener('ended',onEnded);reset();screen.remove(audio);camera.remove(listener);audio.disconnect();screen.material=originalMaterial;material.dispose();texture.dispose();video.removeAttribute('src');video.load();},
  video,
 };
}
