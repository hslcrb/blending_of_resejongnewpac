# 세종문화회관 건축 둘러보기

제공된 사진을 바탕으로 Blender에서 제작한 세종문화회관 외관 모델과 React 3D 뷰어입니다. 실측 도면 없이 사진의 비례를 추정했으며, 부조와 사진에 가려진 부분은 해석을 포함합니다. 정밀 실측 모델은 아닙니다.

## 실행

```sh
npm ci
npm run dev
```

`npm run build`는 Cloudflare Pages에 배포할 `dist` 디렉터리를 만듭니다. `main` 브랜치의 변경은 GitHub에 연결된 Cloudflare Pages에서 빌드합니다.

원본 Blender 파일은 `public/model/sejong.blend`, 웹용 파일은 `public/model/sejong.glb`입니다. `scripts/build_sejong.py`는 Blender의 Python 환경에서 모델을 재생성하는 스크립트입니다.
