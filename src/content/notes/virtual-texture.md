---
title: "가상 텍스처"
lastUpdated: 2026-03-04
tags:
  - graphics/virtual-texture
  - unreal-engine/rendering
---

<div class="note-date">2026-03-04</div>

## Q: 언리얼 엔진의 가상 텍스처가 뭐야?

가상 텍스처(Virtual Texture)는 거대한 텍스처를 타일 단위로 쪼개서, 현재 카메라에 보이는 타일만 GPU 메모리에 올리는 기술이다.

## Q: 일반 텍스처 스트리밍과 뭐가 달라?

전통적 텍스처 스트리밍은 mip-level 단위로 전체 텍스처를 올리거나 내린다. 가상 텍스처는 같은 mip-level 안에서도 필요한 타일만 선택적으로 로드한다.
