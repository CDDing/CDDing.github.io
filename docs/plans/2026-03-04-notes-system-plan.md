# Notes 시스템 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 토픽 단위 성장형 Q&A 노트 시스템을 커스텀 Astro 컬렉션으로 구현하고, 기존 학습 로그를 마이그레이션한다.

**Architecture:** Starlight `docs` 컬렉션과 별개로 `notes` 커스텀 컬렉션을 생성. `src/pages/notes/`에 커스텀 Astro 페이지를 만들어 인덱스(카드 그리드 + 태그 필터), 상세(StarlightPage + TOC), 태그 페이지를 구현. 기존 `log/` 파일들을 새 형식으로 마이그레이션.

**Tech Stack:** Astro 5.3, Starlight 0.32 (StarlightPage component), Zod schema, glob loader, 클라이언트 JS (태그 필터링)

**Design Doc:** `docs/plans/2026-03-04-notes-system-design.md`

---

## Task 1: Notes 컬렉션 스키마 및 샘플 파일

**Files:**
- Modify: `src/content.config.ts`
- Create: `src/content/notes/virtual-texture.md` (샘플)

**Step 1: content.config.ts에 notes 컬렉션 추가**

```typescript
// src/content.config.ts
import { defineCollection, z } from 'astro:content';
import { docsLoader, i18nLoader } from '@astrojs/starlight/loaders';
import { docsSchema, i18nSchema } from '@astrojs/starlight/schema';
import { glob } from 'astro/loaders';

const notesSchema = z.object({
  title: z.string(),
  lastUpdated: z.coerce.date(),
  tags: z.array(z.string()), // "graphics/virtual-texture" 형태
});

export const collections = {
  docs: defineCollection({ loader: docsLoader(), schema: docsSchema() }),
  i18n: defineCollection({ loader: i18nLoader(), schema: i18nSchema() }),
  notes: defineCollection({
    loader: glob({ pattern: '**/*.md', base: './src/content/notes' }),
    schema: notesSchema,
  }),
};
```

**Step 2: 샘플 노트 파일 생성**

```markdown
<!-- src/content/notes/virtual-texture.md -->
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
```

**Step 3: 빌드 검증**

Run: `npm run build 2>&1 | head -20`
Expected: 빌드 성공 (notes 컬렉션이 인식됨). 페이지 생성은 아직 없으므로 notes 관련 경고 없음.

**Step 4: 커밋**

```bash
git add src/content.config.ts src/content/notes/virtual-texture.md
git commit -m "feat: notes 컬렉션 스키마 및 샘플 파일 추가"
```

---

## Task 2: 노트 상세 페이지

**Files:**
- Create: `src/pages/notes/[slug].astro`

**Step 1: 상세 페이지 생성**

```astro
---
// src/pages/notes/[slug].astro
import StarlightPage from '@astrojs/starlight/components/StarlightPage.astro';
import { getCollection, render } from 'astro:content';

export async function getStaticPaths() {
  const notes = await getCollection('notes');
  return notes.map((note) => ({
    params: { slug: note.id },
    props: { note },
  }));
}

const { note } = Astro.props;
const { Content, headings } = await render(note);

const tagBadges = note.data.tags
  .map((tag: string) => {
    const category = tag.split('/')[0];
    return `<a href="/notes/tags/${tag}/" class="note-tag badge-${category}">#${tag}</a>`;
  })
  .join(' ');
---

<StarlightPage
  frontmatter={{
    title: note.data.title,
    lastUpdated: note.data.lastUpdated,
    tableOfContents: { maxHeadingLevel: 2 },
  }}
  headings={headings}
>
  <div class="note-meta">
    <Fragment set:html={tagBadges} />
  </div>
  <div class="note-content">
    <Content />
  </div>
</StarlightPage>
```

**Step 2: 빌드 검증**

Run: `npm run build 2>&1 | tail -20`
Expected: 빌드 성공. `/notes/virtual-texture/` 페이지 생성됨.

**Step 3: 개발 서버에서 시각 확인**

Run: `npm run dev`
브라우저에서 `http://localhost:4321/notes/virtual-texture/` 접속.
Expected: Starlight 레이아웃 안에 노트 제목, 태그 배지, Q&A 내용, 우측 TOC 표시.

**Step 4: 커밋**

```bash
git add src/pages/notes/[slug].astro
git commit -m "feat: 노트 상세 페이지 (StarlightPage + TOC)"
```

---

## Task 3: 노트 CSS (날짜 구분선, 태그 배지, 카드)

**Files:**
- Modify: `src/styles/custom.css` (파일 끝에 추가)

**Step 1: CSS 추가**

```css
/* ===== Notes System ===== */

/* Date separator */
.note-date {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 32px 0 24px;
  font-size: var(--sl-text-xs);
  font-family: var(--sl-font-mono);
  color: var(--cd-text-secondary);
  font-weight: 500;
}

.note-date::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--cd-border-subtle);
}

/* 첫 번째 날짜 구분선은 상단 마진 줄임 */
.note-content .note-date:first-child {
  margin-top: 8px;
}

/* Note meta (tags area) */
.note-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 24px;
}

/* Note tag badges */
.note-tag {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 0.68rem;
  font-family: var(--sl-font-mono);
  font-weight: 500;
  text-decoration: none;
  white-space: nowrap;
  transition: opacity 0.15s;
}

.note-tag:hover {
  opacity: 0.8;
  text-decoration: none;
}

/* Tag category colors */
.badge-graphics {
  background: rgba(167, 139, 250, 0.1);
  color: var(--cd-accent);
  border: 1px solid rgba(167, 139, 250, 0.3);
}

.badge-vulkan {
  background: rgba(239, 68, 68, 0.1);
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.badge-mobile {
  background: rgba(251, 191, 36, 0.1);
  color: #fbbf24;
  border: 1px solid rgba(251, 191, 36, 0.3);
}

.badge-unreal-engine {
  background: rgba(96, 165, 250, 0.1);
  color: #60a5fa;
  border: 1px solid rgba(96, 165, 250, 0.3);
}

.badge-cuda {
  background: rgba(34, 197, 94, 0.1);
  color: #4ade80;
  border: 1px solid rgba(34, 197, 94, 0.3);
}

/* Light theme tag variants */
:root[data-theme='light'] .badge-graphics {
  background: rgba(124, 58, 237, 0.08);
  color: var(--cd-accent);
  border: 1px solid rgba(124, 58, 237, 0.2);
}

:root[data-theme='light'] .badge-mobile {
  background: rgba(217, 119, 6, 0.08);
  color: #d97706;
  border: 1px solid rgba(217, 119, 6, 0.2);
}

:root[data-theme='light'] .badge-unreal-engine {
  background: rgba(37, 99, 235, 0.08);
  color: #2563eb;
  border: 1px solid rgba(37, 99, 235, 0.2);
}

/* Note index cards */
.notes-grid {
  display: grid;
  gap: 12px;
  margin-top: 20px;
}

.note-card {
  display: block;
  padding: 16px 20px;
  background: var(--cd-bg-card);
  border: 1px solid var(--cd-border-color);
  border-radius: 8px;
  text-decoration: none;
  transition: border-color 0.15s, background 0.15s;
}

.note-card:hover {
  border-color: var(--cd-accent);
  background: var(--cd-accent-bg);
  text-decoration: none;
}

.note-card-title {
  font-size: var(--sl-text-base);
  font-weight: 600;
  color: var(--cd-text-heading);
  margin: 0 0 8px;
}

.note-card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 8px;
}

.note-card-info {
  font-size: var(--sl-text-xs);
  color: var(--cd-text-secondary);
  font-family: var(--sl-font-mono);
}

/* Tag filter chips */
.tag-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 16px;
}

.tag-filter {
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 0.72rem;
  font-family: var(--sl-font-mono);
  font-weight: 500;
  background: var(--cd-bg-card);
  border: 1px solid var(--cd-border-color);
  color: var(--cd-text-secondary);
  cursor: pointer;
  transition: all 0.15s;
}

.tag-filter:hover {
  border-color: var(--cd-accent);
  color: var(--cd-text-primary);
}

.tag-filter.active {
  background: var(--cd-accent-bg);
  border-color: var(--cd-accent);
  color: var(--cd-accent);
}
```

**Step 2: 빌드 검증 및 시각 확인**

Run: `npm run dev`
Expected: `/notes/virtual-texture/` 페이지에서 날짜 구분선, 태그 배지 스타일 적용 확인.

**Step 3: 커밋**

```bash
git add src/styles/custom.css
git commit -m "feat: 노트 시스템 CSS (날짜 구분선, 태그 배지, 카드)"
```

---

## Task 4: 노트 인덱스 페이지 (카드 그리드 + 태그 필터링)

**Files:**
- Create: `src/pages/notes/index.astro`

**Step 1: 인덱스 페이지 생성**

```astro
---
// src/pages/notes/index.astro
import StarlightPage from '@astrojs/starlight/components/StarlightPage.astro';
import { getCollection } from 'astro:content';

const notes = await getCollection('notes');

// 최종 업데이트순 정렬
const sorted = notes.sort(
  (a, b) => new Date(b.data.lastUpdated).getTime() - new Date(a.data.lastUpdated).getTime()
);

// 모든 카테고리 추출 (태그의 첫 번째 세그먼트)
const categories = [...new Set(
  notes.flatMap((n) => n.data.tags.map((t: string) => t.split('/')[0]))
)].sort();

// Q&A 카운트 (## Q: 패턴)
function countQA(body: string): number {
  return (body.match(/^## Q[.:]/gm) || []).length;
}
---

<StarlightPage frontmatter={{ title: 'Notes', description: '자유로운 Q&A 학습 노트' }}>
  <div class="tag-filters" id="tag-filters">
    {categories.map((cat) => (
      <button class="tag-filter" data-category={cat}>{cat}</button>
    ))}
  </div>

  <div class="notes-grid" id="notes-grid">
    {sorted.map((note) => {
      const qaCount = countQA(note.body ?? '');
      const cats = [...new Set(note.data.tags.map((t: string) => t.split('/')[0]))];
      const dateStr = note.data.lastUpdated.toISOString().slice(0, 10);
      return (
        <a
          href={`/notes/${note.id}/`}
          class="note-card"
          data-categories={cats.join(',')}
        >
          <h3 class="note-card-title">{note.data.title}</h3>
          <div class="note-card-tags">
            {note.data.tags.map((tag: string) => {
              const category = tag.split('/')[0];
              return <span class={`note-tag badge-${category}`}>#{tag}</span>;
            })}
          </div>
          <span class="note-card-info">
            Q&A {qaCount}개 · 최종 업데이트 {dateStr}
          </span>
        </a>
      );
    })}
  </div>

  <script>
    const filters = document.querySelectorAll<HTMLButtonElement>('.tag-filter');
    const cards = document.querySelectorAll<HTMLAnchorElement>('.note-card');
    let activeCategory: string | null = null;

    filters.forEach((btn) => {
      btn.addEventListener('click', () => {
        const cat = btn.dataset.category!;
        if (activeCategory === cat) {
          activeCategory = null;
          btn.classList.remove('active');
        } else {
          filters.forEach((b) => b.classList.remove('active'));
          activeCategory = cat;
          btn.classList.add('active');
        }

        cards.forEach((card) => {
          const cats = (card.dataset.categories || '').split(',');
          if (!activeCategory || cats.includes(activeCategory)) {
            card.style.display = '';
          } else {
            card.style.display = 'none';
          }
        });
      });
    });
  </script>
</StarlightPage>
```

**Step 2: 빌드 검증**

Run: `npm run build 2>&1 | tail -20`
Expected: 빌드 성공. `/notes/` 및 `/notes/virtual-texture/` 페이지 생성.

**Step 3: 개발 서버에서 시각 확인**

Run: `npm run dev`
브라우저에서 `http://localhost:4321/notes/` 접속.
Expected:
- 태그 필터 버튼 (graphics, unreal-engine)
- 가상 텍스처 카드 (태그 배지, Q&A 개수, 날짜)
- 카드 클릭 시 상세 페이지로 이동
- 태그 필터 클릭 시 카드 필터링 동작

**Step 4: 커밋**

```bash
git add src/pages/notes/index.astro
git commit -m "feat: 노트 인덱스 페이지 (카드 그리드 + 태그 필터링)"
```

---

## Task 5: 태그 페이지

**Files:**
- Create: `src/pages/notes/tags/[...tag].astro`

**Step 1: 태그 페이지 생성**

```astro
---
// src/pages/notes/tags/[...tag].astro
import StarlightPage from '@astrojs/starlight/components/StarlightPage.astro';
import { getCollection } from 'astro:content';

export async function getStaticPaths() {
  const notes = await getCollection('notes');

  // 모든 고유 태그 수집 (풀 태그 + 카테고리)
  const tagSet = new Set<string>();
  notes.forEach((note) => {
    note.data.tags.forEach((tag: string) => {
      tagSet.add(tag);                  // "graphics/virtual-texture"
      tagSet.add(tag.split('/')[0]);    // "graphics"
    });
  });

  return [...tagSet].map((tag) => ({
    params: { tag },
    props: { tag },
  }));
}

const { tag } = Astro.props;
const notes = await getCollection('notes');
const isCategory = !tag.includes('/');

// 해당 태그를 가진 노트 필터링
const filtered = notes.filter((note) =>
  note.data.tags.some((t: string) =>
    isCategory ? t.startsWith(tag + '/') || t === tag : t === tag
  )
);

const sorted = filtered.sort(
  (a, b) => new Date(b.data.lastUpdated).getTime() - new Date(a.data.lastUpdated).getTime()
);

// 카테고리 페이지인 경우 하위 태그 수집
const subTags = isCategory
  ? [...new Set(
      notes
        .flatMap((n) => n.data.tags)
        .filter((t: string) => t.startsWith(tag + '/'))
    )].sort()
  : [];

function countQA(body: string): number {
  return (body.match(/^## Q[.:]/gm) || []).length;
}

function countByTag(t: string): number {
  return notes.filter((n) => n.data.tags.includes(t)).length;
}
---

<StarlightPage frontmatter={{ title: `#${tag}`, description: `${tag} 태그 노트 목록` }}>
  {isCategory && subTags.length > 0 && (
    <div class="tag-filters">
      {subTags.map((st) => (
        <a href={`/notes/tags/${st}/`} class="tag-filter">
          {st.split('/')[1]} ({countByTag(st)})
        </a>
      ))}
    </div>
  )}

  <div class="notes-grid">
    {sorted.map((note) => {
      const qaCount = countQA(note.body ?? '');
      const dateStr = note.data.lastUpdated.toISOString().slice(0, 10);
      return (
        <a href={`/notes/${note.id}/`} class="note-card">
          <h3 class="note-card-title">{note.data.title}</h3>
          <div class="note-card-tags">
            {note.data.tags.map((t: string) => {
              const category = t.split('/')[0];
              return <span class={`note-tag badge-${category}`}>#{t}</span>;
            })}
          </div>
          <span class="note-card-info">
            Q&A {qaCount}개 · 최종 업데이트 {dateStr}
          </span>
        </a>
      );
    })}
  </div>

  <p style="margin-top: 24px;">
    <a href="/notes/">← 전체 노트</a>
  </p>
</StarlightPage>
```

**Step 2: 빌드 및 확인**

Run: `npm run build 2>&1 | tail -20`
Expected: `/notes/tags/graphics/`, `/notes/tags/graphics/virtual-texture/` 등 페이지 생성.

**Step 3: 커밋**

```bash
git add src/pages/notes/tags/
git commit -m "feat: 노트 태그 페이지 (카테고리 + 세부 태그)"
```

---

## Task 6: 헤더 & 사이드바 통합

**Files:**
- Modify: `src/components/Header.astro` (Notes 네비게이션 추가)
- Modify: `src/components/Sidebar.astro` (sectionMap에 `/notes/` 추가)
- Modify: `astro.config.mjs` (사이드바에 Notes 섹션 추가)

**Step 1: Header.astro에 Notes 메뉴 추가**

Articles nav-item 다음에 추가 (line 37 뒤):

```astro
    <div class="nav-item">
      <a href={`${base}notes/`} class="nav-top" aria-current={currentPath.startsWith(`${base}notes`) ? 'page' : undefined}>Notes</a>
    </div>
```

Notes는 드롭다운 없이 단일 링크. (태그 탐색은 인덱스 페이지에서 처리)

**Step 2: Sidebar.astro sectionMap 업데이트**

`sectionMap`에 추가:

```typescript
const sectionMap: Record<string, string> = {
  '/notes/': 'Notes',        // 추가
  '/log/vulkan/': 'Vulkan',  // 마이그레이션 후 제거 예정
  '/log/misc/': 'Articles',  // 마이그레이션 후 제거 예정
  '/vulkan/': 'Vulkan',
  '/cuda/': 'CUDA',
  '/articles/': 'Articles',
};
```

**Step 3: astro.config.mjs 사이드바에 Notes 섹션 추가**

sidebar 배열 맨 앞에 추가:

```javascript
{
  label: 'Notes',
  items: [
    { label: '전체 노트', slug: 'notes' },
  ],
},
```

> Note: Notes 사이드바는 Starlight 기본 사이드바로는 동적 태그 트리를 만들 수 없으므로, 최소한의 링크만 넣는다. 태그 기반 탐색은 인덱스 페이지의 필터 UI가 담당한다.

**Step 4: 빌드 검증**

Run: `npm run build 2>&1 | tail -20`
Expected: 빌드 성공. 헤더에 Notes 링크, `/notes/` 진입 시 사이드바에 Notes 섹션 표시.

**Step 5: 커밋**

```bash
git add src/components/Header.astro src/components/Sidebar.astro astro.config.mjs
git commit -m "feat: 헤더/사이드바에 Notes 섹션 추가"
```

---

## Task 7: 기존 학습 로그 마이그레이션

**Files:**
- Create: `src/content/notes/vulkan-fundamentals.md`
- Create: `src/content/notes/vulkan-initialization.md`
- Create: `src/content/notes/vulkan-devsandqueues.md`
- Create: `src/content/notes/vulkan-synchronization.md`
- Create: `src/content/notes/gpu-architecture.md`
- Delete: `src/content/docs/log/` (전체 디렉토리)

**Step 1: 각 로그 파일을 notes 형식으로 변환**

변환 규칙:
1. 프론트매터에 `lastUpdated`, `tags` 추가 (기존 `sidebar` 필드 제거)
2. 파일 상단에 `<div class="note-date">YYYY-MM-DD</div>` 추가 (원본 커밋 날짜 기준)
3. 기존 Q&A 형식 (`> **Q.** ...`) 을 `## Q: ...` 형식으로 변환하지 않아도 됨 — 기존 형식도 유효. 다만 앞으로의 신규 노트는 `## Q: ...` 형식 사용.
4. 본문 내 `/log/...` 크로스링크를 `/notes/...`로 변경

**마이그레이션 매핑:**

| 원본 파일 | 새 파일 | 태그 |
|-----------|---------|------|
| `log/vulkan/00_fundamentals.md` | `notes/vulkan-fundamentals.md` | `vulkan/fundamentals` |
| `log/vulkan/01_initialization.md` | `notes/vulkan-initialization.md` | `vulkan/initialization` |
| `log/vulkan/02_devsandqueues.md` | `notes/vulkan-devsandqueues.md` | `vulkan/devices-and-queues` |
| `log/vulkan/04_synchronization.md` | `notes/vulkan-synchronization.md` | `vulkan/synchronization` |
| `log/misc/gpu_architecture.md` | `notes/gpu-architecture.md` | `graphics/gpu-architecture` |

**프론트매터 변환 예시 (vulkan-fundamentals.md):**

Before:
```yaml
---
title: "Fundamentals 학습 로그"
sidebar:
  label: "00. Fundamentals"
---
```

After:
```yaml
---
title: "Vulkan Fundamentals"
lastUpdated: 2026-02-16
tags:
  - vulkan/fundamentals
---

<div class="note-date">2026-02-16</div>
```

**Step 2: 모든 로그 파일 변환 및 이동**

각 파일에 대해:
1. 프론트매터 변환
2. `<div class="note-date">` 추가
3. 본문 내 `/log/` URL → `/notes/` URL 치환
4. `src/content/notes/`에 새 파일 생성

**Step 3: 기존 log 디렉토리 삭제**

```bash
rm -rf src/content/docs/log/
```

**Step 4: 빌드 검증**

Run: `npm run build 2>&1 | tail -30`
Expected: 빌드 성공. 기존 `/log/...` 페이지 없어지고, `/notes/...` 페이지들 생성.

**Step 5: 커밋**

```bash
git add src/content/notes/ && git rm -r src/content/docs/log/
git commit -m "feat: 기존 학습 로그를 notes 시스템으로 마이그레이션"
```

---

## Task 8: 크로스링크 및 참조 업데이트

**Files:**
- Modify: `src/content/docs/vulkan/spec/00_fundamentals.md`
- Modify: `src/content/docs/vulkan/spec/01_initialization.md`
- Modify: `src/content/docs/vulkan/spec/02_devsandqueues.md`
- Modify: `src/content/docs/vulkan/index.mdx`
- Modify: `src/content/docs/articles/gpu-hw-sw/01-introduction.mdx`
- Modify: `src/content/docs/articles/gpu-hw-sw/02-parallel-programming.mdx`
- Modify: `src/data/updates.ts`
- Modify: `astro.config.mjs` (기존 log 사이드바 항목 제거)
- Modify: `src/components/Sidebar.astro` (기존 log sectionMap 제거)

**Step 1: fn-ref 크로스링크 URL 일괄 치환**

모든 파일에서 다음 패턴을 치환:

| 기존 URL | 새 URL |
|----------|--------|
| `/log/vulkan/00_fundamentals/` | `/notes/vulkan-fundamentals/` |
| `/log/vulkan/01_initialization/` | `/notes/vulkan-initialization/` |
| `/log/vulkan/02_devsandqueues/` | `/notes/vulkan-devsandqueues/` |
| `/log/vulkan/04_synchronization/` | `/notes/vulkan-synchronization/` |
| `/log/misc/gpu_architecture/` | `/notes/gpu-architecture/` |

> 중요: 앵커(`#...`)는 유지. 예: `/log/vulkan/00_fundamentals/#vkallocate-패턴` → `/notes/vulkan-fundamentals/#vkallocate-패턴`

**Step 2: vulkan/index.mdx 학습 로그 링크 업데이트**

기존 `href="/log/..."` → `href="/notes/..."` 로 변경.

**Step 3: astro.config.mjs에서 기존 log 사이드바 항목 제거**

Vulkan 섹션의 `학습 로그` items, Articles 섹션의 `학습 로그` items 제거.

**Step 4: Sidebar.astro에서 기존 log sectionMap 제거**

```typescript
const sectionMap: Record<string, string> = {
  '/notes/': 'Notes',
  '/vulkan/': 'Vulkan',
  '/cuda/': 'CUDA',
  '/articles/': 'Articles',
};
```

**Step 5: updates.ts에 notes 카테고리 추가**

```typescript
export interface Update {
  title: string;
  href: string;
  category: 'vulkan' | 'cuda' | 'articles' | 'notes';  // 'notes' 추가
  source: 'Vulkan Spec' | 'CUDA Guide' | 'Article' | 'Note';  // 'Note' 추가
  date: string;
}
```

custom.css에 `.badge-notes` 추가:

```css
.badge-notes {
  background: rgba(167, 139, 250, 0.1);
  color: #a78bfa;
  border: 1px solid rgba(167, 139, 250, 0.3);
}

:root[data-theme='light'] .badge-notes {
  background: rgba(124, 58, 237, 0.08);
  color: #7c3aed;
  border: 1px solid rgba(124, 58, 237, 0.2);
}
```

**Step 6: 빌드 검증**

Run: `npm run build 2>&1 | tail -30`
Expected: 빌드 성공. 깨진 링크 없음.

**Step 7: 개발 서버에서 크로스링크 동작 확인**

Run: `npm run dev`
- Vulkan spec 페이지에서 fn-ref 툴팁 클릭 → `/notes/...` 페이지로 이동 확인
- Articles 페이지에서 fn-ref 툴팁 클릭 → `/notes/...` 페이지로 이동 확인
- `/notes/` 인덱스에서 마이그레이션된 5개 토픽 + 샘플 1개 = 6개 카드 확인

**Step 8: 커밋**

```bash
git add -A
git commit -m "feat: 크로스링크 URL 마이그레이션 및 Notes 카테고리 추가"
```

---

## Task 9: 최종 빌드 & 배포 검증

**Step 1: 클린 빌드**

```bash
rm -rf dist/ .astro/ && npm run build
```

Expected: 에러 없이 빌드 완료.

**Step 2: 주요 페이지 확인 체크리스트**

- [ ] `/notes/` — 인덱스 페이지, 카드 그리드, 태그 필터 동작
- [ ] `/notes/virtual-texture/` — 샘플 노트 상세, TOC, 날짜 구분선
- [ ] `/notes/vulkan-fundamentals/` — 마이그레이션된 노트, 앵커 동작
- [ ] `/notes/gpu-architecture/` — 마이그레이션된 노트
- [ ] `/notes/tags/vulkan/` — 태그 페이지, 하위 태그 링크
- [ ] `/notes/tags/graphics/gpu-architecture/` — 세부 태그 페이지
- [ ] Vulkan spec 페이지 — fn-ref 크로스링크가 `/notes/...`로 정상 연결
- [ ] Articles 페이지 — fn-ref 크로스링크가 `/notes/...`로 정상 연결
- [ ] 헤더 — Notes 링크 표시 및 active 상태
- [ ] 모바일 — 반응형 레이아웃

**Step 3: 커밋 & 푸시**

```bash
git push origin main
```

**Step 4: GitHub Actions 빌드 확인**

```bash
gh run list --limit 1
```

Expected: 빌드 성공.

**Step 5: 배포 후 WebFetch 검증**

배포 완료 후 실제 사이트에서 `/notes/` 페이지 접근 확인.
