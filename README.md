# 세종문화회관 건축 둘러보기

제공된 사진과 대극장 종단면 도면을 바탕으로 Blender에서 제작한 세종문화회관 외관 모델과 React 3D 뷰어입니다. 종단면의 전면·후면 기준선 간 거리 112.5m와 객석·무대 지붕 높이를 매스 배치에 참고했습니다. 정면 전체 폭과 도면에 나타나지 않은 세부는 사진의 비례에 따른 추정이며, 부조와 가려진 부분은 해석을 포함합니다. 정밀 실측 모델은 아닙니다.

도면의 지면 기준으로 객석 지붕 +35.060m, 무대 파라펫 +45.045m를 매스에 참고했습니다. 녹청 지붕의 마루 높이 +37.2m와 길이, 정면 전체 폭은 사진과 배치도에 근거한 추정입니다. 변환된 DWG의 일부 객체 이름에 경고가 있어 수치는 원본 도면과 교차 확인이 필요합니다. 112.5m는 기준선 사이의 길이이며 전체 외피 길이와 같다고 단정하지 않습니다.

## 실행

```sh
npm ci
npm run dev
```

`npm run build`는 Cloudflare Pages에 배포할 `dist` 디렉터리를 만듭니다. `main` 브랜치의 변경은 GitHub에 연결된 Cloudflare Pages에서 빌드합니다.

원본 Blender 파일은 `public/model/sejong.blend`, 웹용 파일은 `public/model/sejong.glb`입니다. `scripts/build_sejong.py`는 Blender의 Python 환경에서 모델을 재생성하는 스크립트입니다. 본관 좌우 부조는 제공된 사진에서 추출한 `assets/left-relief-reference.png`, `assets/relief-reference.png`와 얕은 메시를 함께 사용하므로, 가려진 부분과 세부 깊이는 실측이 아닙니다. 해당 이미지는 Blender 파일과 GLB에도 포함됩니다.
