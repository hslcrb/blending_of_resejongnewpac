# 대극장 영상 영사와 공간 음향

사용자가 제공한 전체 길이의 원본 영상은 `source_media/one-day-more-original.mp4`에 보관한다. 원본은 1920×1080 H.264/AAC, 220.654512초, 40,009,080바이트이며 SHA-256은 `bda685d6de9215223e0b23de23a40293de13708ca9087e8887225ee046f24bdb`다. Cloudflare Pages의 단일 자산 한도를 고려해 `public/media/one-day-more-720p.mp4`를 웹용으로 사용한다. 이 파일은 1280×720 H.264/AAC, 220.654512초, 19,201,643바이트이며 SHA-256은 `02c56b00b8d8408e8e736959b7b3b23cd36f46686f9fdee7d11533a042416d0b`다. `+faststart`를 적용해 처음부터 재생할 수 있다. 원본의 저작권·공개 이용 허락은 이 파일이나 구현만으로 확인되지 않는다.

변환 명령 (FFmpeg):

```powershell
ffmpeg -i source_media/one-day-more-original.mp4 -vf 'scale=-2:720' -c:v libx264 -preset veryfast -threads 2 -b:v 600k -maxrate 900k -bufsize 1200k -c:a aac -b:a 96k -movflags +faststart public/media/one-day-more-720p.mp4
```

`createTheatreMedia({THREE, camera, screen, effectLights, onStatus, src})`는 스크린의 원래 재질을 저장하고 영상 텍스처를 적용한다. 비디오는 사용자의 재생 동작에서 시작한다. `play()`, `pause()`, `setVolume(0..1)`, `setEffects(boolean)`, 렌더 루프의 `update()`와 종료 시 `dispose()`를 호출한다. 재생 오류는 `onStatus`로 보고하고 Promise를 거부한다. 볼륨과 영상을 같은 media element로 연결하므로 별도 동기화가 필요 없다.

무대 화면에 Three.js `PositionalAudio`를 연결하고 청취자는 카메라에 부착한다. Web Audio의 HRTF 공간화를 이용하므로 헤드폰에서 방향 차이를 들을 수 있지만, 실제 대극장의 측정된 잔향이나 임펄스 응답을 재현한 것은 아니다. 무대효과는 선택적으로 주파수 분석기의 현재 에너지에 따라 전달한 조명의 강도를 부드럽게 조절하며, 끄거나 정지하면 원래 강도로 복원한다. 재생 속도·소리·조명은 모두 같은 영상에 연결된다. 모듈 종료 시 화면 재질과 조명, 영상 리소스 및 음원을 정리한다.

검증: `node --test tests/theatre-media.test.js`와 Chrome/Playwright `tests/theatre-media-browser.cjs`에서 실제 720p 영상 프레임의 재생, HRTF panner, 실행 중 AudioContext, 오디오 변화에 따른 조명 및 자원 정리를 확인했다. 테스트 서버는 `npm run dev -- --port 3178`이다.
