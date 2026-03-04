# Notes 시스템 설계

## 개요

학습 문서에 종속되지 않는 자유로운 Q&A를 토픽 단위로 축적하고, 계층 태그로 분류하는 시스템.

## 핵심 결정사항

| 항목 | 결정 |
|------|------|
| 접근법 | C — 커스텀 Astro 컬렉션 + 커스텀 페이지 |
| 노트 단위 | **토픽 단위 성장형** — 1 토픽 = 1 파일, Q&A가 시간에 따라 누적 |
| 태그 | 계층형 2레벨 (`카테고리/키워드`) |
| 인덱스 정렬 | 최종 업데이트순 |
| 기존 로그 | `log/` → `notes/`로 마이그레이션 |
| 레이아웃 | 접근성 좋은 UI/UX 우선, Starlight 테마 통일 불필요 |

## 사용자 시나리오

1. 일상에서 랜덤하게 기술 궁금증 발생
2. Claude에게 질문 → Q&A 생성
3. 해당 토픽 노트에 날짜 구분과 함께 Q&A 추가
4. 나중에 인덱스에서 태그 필터링 또는 사이드바 태그 트리로 탐색

## UI/UX 설계

### 인덱스 페이지 (`/notes/`)

```
┌─────────────────────────────────────────────────┐
│  Notes                                          │
│                                                 │
│  [graphics] [mobile] [unreal-engine] [vulkan]   │  ← 카테고리 필터 토글
│                                                 │
│  ─────────────────────────────────────────────── │
│                                     최근 업데이트순 │
│  ┌───────────────────────────────────────────┐  │
│  │ 가상 텍스처                                │  │
│  │ #graphics/virtual-texture  #unreal-engine  │  │
│  │ Q&A 5개 · 최종 업데이트 2026-03-06          │  │
│  └───────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────┐  │
│  │ 렌더패스와 모바일 GPU                       │  │
│  │ #mobile/render-pass  #mobile/memory        │  │
│  │ Q&A 3개 · 최종 업데이트 2026-03-04          │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

- 카드 1개 = 토픽 1개 (살아있는 주제)
- **최종 업데이트순** 정렬
- Q&A 개수 + 최종 업데이트 날짜 표시

### 토픽 상세 페이지 (`/notes/<slug>/`)

```
┌─────────────────────────────────────────────────┐
│  가상 텍스처                                     │
│  #graphics/virtual-texture  #unreal-engine       │
│                                                 │
│  ── 2026-03-04 ──────────────────────────────── │
│                                                 │
│  ## Q: 가상 텍스처가 뭐야?                       │
│  ...                                            │
│                                                 │
│  ## Q: 일반 텍스처 스트리밍과 뭐가 달라?           │
│  ...                                            │
│                                                 │
│  ── 2026-03-06 ──────────────────────────────── │
│                                                 │
│  ## Q: UE5에서 RVT는 어떻게 쓰여?                │
│  ...                                            │
└─────────────────────────────────────────────────┘
```

- 날짜 구분선으로 Q&A 추가 시점 시각화
- 사이드 TOC에 Q 목록 → 특정 질문으로 바로 점프

### 태그 페이지 (`/notes/tags/<category>/`)

```
┌─────────────────────────────────────────────────┐
│  graphics                                       │
│                                                 │
│  하위 태그:                                      │
│  [virtual-texture (3)] [render-pass (2)]         │
│                                                 │
│  (해당 태그의 토픽 노트들 시간순 나열)              │
└─────────────────────────────────────────────────┘
```

### 사이드바 (태그 트리)

`/notes/` 진입 시 카테고리 > 토픽 이름 형태의 트리 표시:

```
Notes
├── graphics
│   ├── 가상 텍스처 (5)
│   └── tile-based-rendering (1)
├── mobile
│   └── 렌더패스와 모바일 GPU (3)
└── vulkan
    └── Vulkan 동기화 (2)
```

### 크로스링크

- Articles ↔ Notes 간 윗첨자 툴팁 링크 패턴 유지
- URL만 `/log/...` → `/notes/...`로 변경

## 데이터 모델

### 컬렉션 스키마

```typescript
// content.config.ts
const notes = defineCollection({
  schema: z.object({
    title: z.string(),
    lastUpdated: z.coerce.date(),
    tags: z.array(z.string()),  // "graphics/virtual-texture" 형태
  })
});
```

### 파일 구조

```
src/content/notes/
├── virtual-texture.md
├── render-pass-mobile.md
├── vulkan-fundamentals.md
├── vulkan-initialization.md
├── vulkan-devsandqueues.md
├── vulkan-synchronization.md
└── gpu-architecture.md
```

- slug 기반 평탄 구조 (디렉토리 중첩 없음)
- 날짜는 파일명이 아닌 프론트매터 + 본문 내 날짜 구분선으로 관리

### 노트 본문 형식

```markdown
---
title: "가상 텍스처"
lastUpdated: 2026-03-06
tags:
  - graphics/virtual-texture
  - unreal-engine/rendering
---

<!-- 2026-03-04 -->

## Q: 가상 텍스처가 뭐야?

...

## Q: 일반 텍스처 스트리밍과 뭐가 달라?

...

<!-- 2026-03-06 -->

## Q: UE5에서 RVT는 어떻게 쓰여?

...
```

## 마이그레이션

| 기존 | → 새 시스템 |
|------|------------|
| `log/vulkan/00_fundamentals.md` | `notes/vulkan-fundamentals.md` + `#vulkan/fundamentals` |
| `log/vulkan/01_initialization.md` | `notes/vulkan-initialization.md` + `#vulkan/initialization` |
| `log/vulkan/02_devsandqueues.md` | `notes/vulkan-devsandqueues.md` + `#vulkan/devices-and-queues` |
| `log/vulkan/04_synchronization.md` | `notes/vulkan-synchronization.md` + `#vulkan/synchronization` |
| `log/misc/gpu_architecture.md` | `notes/gpu-architecture.md` + `#graphics/gpu-architecture` |

마이그레이션 작업:
1. 파일 이동 + 프론트매터 태그/날짜 추가
2. Articles 내 크로스링크 URL 일괄 수정 (`/log/...` → `/notes/...`)
3. `astro.config.mjs` 사이드바에서 기존 `log/` 항목 제거
4. `Sidebar.astro` sectionMap에 `/notes/` 경로 추가
5. `log/index.mdx` 허브 페이지 → 새 인덱스 페이지로 대체
