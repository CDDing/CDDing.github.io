# Articles 섹션 추가 디자인

## 목적

Vulkan/CUDA에 딱 맞지 않는 GPU 관련 단편 글(번역, 학습 노트 등)을 사이트 내에 직접 작성하고, 기존 RecentUpdates 시스템과 통합.

## 구조

### 파일 구조

```
src/content/docs/articles/
├── index.mdx              # Articles 허브 페이지
├── warp-divergence.md     # 예시 글
├── resizable-bar.md
└── vulkan-subgroup.md
```

### URL 패턴

`/articles/<slug>/` (예: `/articles/warp-divergence/`)

### Frontmatter

```yaml
---
title: "Warp Divergence란?"
description: "CUDA warp divergence 개념과 성능 영향"
---
```

## updates.ts 통합

### 타입 변경

```ts
category: 'vulkan' | 'cuda' | 'articles';
source: 'Vulkan Spec' | 'CUDA Guide' | 'Article';
```

### 항목 예시

```ts
{
  title: "Warp Divergence란?",
  href: "/articles/warp-divergence/",
  category: "articles",
  source: "Article",
  date: "2026-02-21",
}
```

## UI 변경

### 헤더 네비게이션

기존 Vulkan / CUDA 옆에 **Articles** 링크 추가.

### 배지 색상

| 카테고리 | 색상 | CSS 클래스 |
|----------|------|------------|
| Vulkan | 빨간색 (기존) | `badge-vulkan` |
| CUDA | 초록색 (기존) | `badge-cuda` |
| Articles | 파란색 (#60a5fa) | `badge-articles` |

### 메인 페이지

RecentUpdates 컴포넌트에 articles 카테고리도 함께 표시 (변경 불필요 — 전체 표시 모드에서 자동 포함).

### Articles 허브 페이지

Vulkan/CUDA 허브와 동일 구조:
- 간단한 소개 문구
- `RecentUpdates(category="articles")` 컴포넌트

## 워크플로우

1. `src/content/docs/articles/`에 마크다운 파일 작성
2. `src/data/updates.ts`에 항목 추가
3. 커밋 & 푸시 → 자동 배포

---

# Articles 섹션 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Vulkan/CUDA 외 GPU 단편 글을 사이트 내에 직접 작성하고 RecentUpdates에 통합하는 Articles 섹션 추가

**Architecture:** Starlight docs 구조(`src/content/docs/articles/`)에 마크다운 파일을 추가하고, 기존 `updates.ts` 타입에 `articles` 카테고리를 확장. 헤더 네비게이션과 배지 CSS를 추가하여 기존 Vulkan/CUDA와 동일한 UX 제공.

**Tech Stack:** Astro + Starlight, TypeScript, CSS

---

### Task 1: updates.ts 타입 확장

**Files:**
- Modify: `src/data/updates.ts:1-9`

**Step 1: category와 source 타입에 articles 추가**

```ts
export interface Update {
  title: string;
  href: string;
  /** Controls badge CSS class (badge-vulkan / badge-cuda / badge-articles) and filtering */
  category: 'vulkan' | 'cuda' | 'articles';
  /** Displayed text inside the badge */
  source: 'Vulkan Spec' | 'CUDA Guide' | 'Article';
  date: string; // YYYY-MM-DD
}
```

**Step 2: 빌드 확인**

Run: `npm run build`
Expected: 성공 (기존 항목은 모두 vulkan이므로 타입 에러 없음)

**Step 3: Commit**

```bash
git add src/data/updates.ts
git commit -m "feat: updates.ts에 articles 카테고리 타입 추가"
```

---

### Task 2: Articles 배지 CSS 추가

**Files:**
- Modify: `src/styles/custom.css:307-329` (배지 영역 뒤에 추가)

**Step 1: badge-articles 스타일 추가 (dark + light)**

dark 모드 (`.badge-cuda` 뒤에 추가):
```css
.badge-articles {
  background: rgba(96, 165, 250, 0.1);
  color: #60a5fa;
  border: 1px solid rgba(96, 165, 250, 0.3);
}
```

light 모드 (`:root[data-theme='light'] .badge-cuda` 뒤에 추가):
```css
:root[data-theme='light'] .badge-articles {
  background: rgba(37, 99, 235, 0.08);
  color: #2563eb;
  border: 1px solid rgba(37, 99, 235, 0.2);
}
```

**Step 2: 빌드 확인**

Run: `npm run build`
Expected: 성공

**Step 3: Commit**

```bash
git add src/styles/custom.css
git commit -m "feat: Articles 배지 CSS 추가 (blue, dark/light)"
```

---

### Task 3: 헤더에 Articles 네비게이션 추가

**Files:**
- Modify: `src/components/Header.astro:17-29`

**Step 1: CUDA nav-item 뒤에 Articles nav-item 추가**

```html
<div class="nav-item">
  <a href={`${base}articles/`} class="nav-top" aria-current={currentPath.startsWith('/articles') ? 'page' : undefined}>Articles</a>
</div>
```

Note: Articles는 드롭다운 하위 메뉴가 없으므로 `nav-dropdown`, `aria-expanded`, `aria-controls` 불필요. 단순 링크로 처리.

**Step 2: 빌드 확인**

Run: `npm run build`
Expected: 성공

**Step 3: Commit**

```bash
git add src/components/Header.astro
git commit -m "feat: 헤더에 Articles 네비게이션 링크 추가"
```

---

### Task 4: Articles 허브 페이지 생성

**Files:**
- Create: `src/content/docs/articles/index.mdx`

**Step 1: Vulkan/CUDA 허브와 동일 구조로 Articles 허브 생성**

```mdx
---
title: Articles
description: GPU 프로그래밍 관련 단편 글 모음
---

import RecentUpdates from '../../../../src/components/RecentUpdates.astro';

<RecentUpdates category="articles" />
```

**Step 2: 빌드 확인**

Run: `npm run build`
Expected: 성공. `/articles/` 페이지 생성됨. 아직 articles 항목이 없으므로 "준비 중입니다." 표시.

**Step 3: dev 서버로 시각적 확인**

Run: `npm run dev`
확인: `http://localhost:4321/articles/` 접속 시 "준비 중입니다." 표시, 헤더에 Articles 링크 활성 상태

**Step 4: Commit**

```bash
git add src/content/docs/articles/index.mdx
git commit -m "feat: Articles 허브 페이지 생성"
```

---

### Task 5: 통합 확인 및 최종 커밋

**Step 1: 전체 빌드 확인**

Run: `npm run build`
Expected: 성공

**Step 2: dev 서버로 전체 확인**

Run: `npm run dev`
확인 항목:
- 메인 페이지(`/`): RecentUpdates에 기존 Vulkan 항목 정상 표시
- Vulkan 허브(`/vulkan/`): 기존과 동일
- CUDA 허브(`/cuda/`): 기존과 동일
- Articles 허브(`/articles/`): "준비 중입니다." 표시
- 헤더: Vulkan / CUDA / Articles 세 개 링크 표시
