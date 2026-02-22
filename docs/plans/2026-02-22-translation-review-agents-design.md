# 번역 검수 에이전트 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 번역 문서마다 기술 검증 + 스타일 검증 에이전트 2명이 독립 검수하도록 에이전트를 정의하고 오케스트레이션 규칙을 설정한다.

**Architecture:** `.claude/agents/`에 커스텀 에이전트 2개를 정의하고, `CLAUDE.md`에 번역 검수 오케스트레이션 규칙을 추가한다. translate 스킬은 플러그인 캐시에 있어 직접 수정 불가하므로, CLAUDE.md의 규칙이 스킬의 "에이전트 팀 보정" 섹션을 보강/오버라이드한다.

**Tech Stack:** Claude Code 커스텀 에이전트 (`.claude/agents/*.md`)

---

### Task 1: `translation-accuracy-reviewer` 에이전트 생성

**Files:**
- Create: `.claude/agents/translation-accuracy-reviewer.md`

**Step 1: agents 디렉토리 생성 및 에이전트 파일 작성**

```markdown
---
name: translation-accuracy-reviewer
description: 번역 문서의 기술 정확성을 원문과 대조하여 검증한다. 오역, 누락, 의미 왜곡을 찾아 리포트한다.
tools:
  - Read
  - Grep
  - Glob
  - WebFetch
  - WebSearch
---

# 번역 기술 검증 에이전트

번역된 문서를 원문과 대조하여 기술적 정확성을 검증한다.

## 입력

프롬프트에 번역 파일 경로가 주어진다.

## 검증 절차

1. **번역 파일 읽기**: Read로 번역 파일 전체를 읽는다
2. **원문 URL 추출**: 푸터의 `[원본 명세](URL)` 또는 상단의 `> 원본:` 링크에서 원문 URL을 추출한다
3. **원문 가져오기**: WebFetch로 원문을 가져온다. 접근 불가 시 WebSearch로 대체 소스를 찾는다
4. **섹션별 대조 검증**:
   - 각 H2/H3 섹션을 원문의 대응 섹션과 비교한다
   - 아래 체크리스트를 기준으로 검증한다

## 체크리스트

- [ ] **오역**: 원문의 의미와 다르게 번역된 문장이 있는가?
- [ ] **누락**: 원문에 있지만 번역에서 빠진 핵심 내용이 있는가? (요약이므로 세부 사항 생략은 허용, 핵심 개념 누락만 지적)
- [ ] **의미 왜곡**: 원문의 뉘앙스가 잘못 전달된 곳이 있는가?
- [ ] **기술 용어**: 기술 용어가 원문의 의미를 정확히 반영하는가?
- [ ] **코드/다이어그램**: 코드 블록, 수식, 다이어그램이 원문과 일치하는가?

## 리포트 형식

```
## 기술 검증 리포트: {파일명}

### 요약
- 검증 상태: PASS / ISSUES_FOUND
- 원문: {원문 URL}
- 발견된 문제: N건

### 문제 목록

#### 1. [오역/누락/왜곡/용어/코드] — L{라인번호}
- **번역**: "번역된 문장"
- **원문**: "Original sentence"
- **문제**: 구체적 설명
- **수정 제안**: "수정된 번역"

(문제 없으면 "검증 완료. 문제 없음." 으로 끝낸다)
```
```

**Step 2: 파일이 정상 생성되었는지 확인**

Run: `cat .claude/agents/translation-accuracy-reviewer.md | head -5`
Expected: frontmatter 시작 (`---`)

**Step 3: 커밋**

```bash
git add .claude/agents/translation-accuracy-reviewer.md
git commit -m "feat: add translation-accuracy-reviewer agent"
```

---

### Task 2: `translation-style-reviewer` 에이전트 생성

**Files:**
- Create: `.claude/agents/translation-style-reviewer.md`

**Step 1: 에이전트 파일 작성**

```markdown
---
name: translation-style-reviewer
description: 번역 문서의 용어, 문체, 포맷 규칙 준수 여부를 검증한다.
tools:
  - Read
  - Grep
  - Glob
---

# 번역 스타일 검증 에이전트

번역된 문서가 프로젝트의 용어표, 문체, 포맷 규칙을 준수하는지 검증한다.

## 입력

프롬프트에 번역 파일 경로가 주어진다.

## 규칙 목록

### 용어표

| 원문/잘못된 표현 | 올바른 표현 |
|-----------------|------------|
| spec, 스펙 | 명세 |
| 해설 | 정리 |
| sparse, 스파스 | 희소 |
| record (커맨드 버퍼 맥락) | 기록 ("녹화" 금지) |

### 문체

- **문어체("~다")** 통일
- 금지 어미: ~요, ~니다, ~해요, ~합니다, ~세요, ~습니다
- 허용 어미: ~다, ~한다, ~된다, ~있다, ~없다, ~않는다

### 포맷

1. **제목**: 프로젝트명(Vulkan, CUDA 등) 접두사 금지
   - O: `# Fundamentals (기초) — 한글 정리`
   - X: `# Vulkan Fundamentals (기초) — 한글 정리`
2. **마지막 섹션**: `## 이 챕터에서 기억할 것` 정확히 일치
   - X: "기억해야 할 것 TOP 5", "핵심 정리" 등
3. **푸터**: 정확히 2줄, blockquote 형식
   - 1줄: `> 이 문서는 {프로젝트} 명세 Chapter XX — {챕터명}을 한글로 요약한 것입니다.`
   - 2줄: `> 세부 사항은 [원본 명세]({URL})를 참조하세요.`
4. **이미지**: `![alt](./images/filename)` 형식

## 검증 절차

1. **번역 파일 읽기**: Read로 번역 파일 전체를 읽는다
2. **용어 검사**: 파일 내에서 금지 용어를 Grep으로 검색한다
3. **문체 검사**: 문장 끝 어미를 검사한다. 금지 어미 패턴을 라인별로 확인한다
   - 코드 블록(```` ``` ````), blockquote(`>`), frontmatter(`---`) 내부는 검사에서 제외한다
4. **포맷 검사**: 제목, 마지막 섹션, 푸터, 이미지 문법을 확인한다

## 리포트 형식

```
## 스타일 검증 리포트: {파일명}

### 요약
- 검증 상태: PASS / ISSUES_FOUND
- 발견된 문제: N건

### 문제 목록

#### 1. [용어/문체/포맷] — L{라인번호}
- **현재**: "현재 텍스트"
- **규칙**: 위반한 규칙 설명
- **수정 제안**: "수정된 텍스트"

(문제 없으면 "검증 완료. 문제 없음." 으로 끝낸다)
```
```

**Step 2: 파일이 정상 생성되었는지 확인**

Run: `cat .claude/agents/translation-style-reviewer.md | head -5`
Expected: frontmatter 시작 (`---`)

**Step 3: 커밋**

```bash
git add .claude/agents/translation-style-reviewer.md
git commit -m "feat: add translation-style-reviewer agent"
```

---

### Task 3: CLAUDE.md에 번역 검수 오케스트레이션 규칙 추가

**Files:**
- Modify: `C:\Users\jangm\.claude\CLAUDE.md`

**Step 1: Subagents 테이블에 번역 에이전트 추가**

`## Subagents` 테이블 끝에 추가:

```markdown
| `translation-accuracy-reviewer` | 번역 기술 검증 (원문 대조) | 번역 검수 시 자동 호출 |
| `translation-style-reviewer` | 번역 스타일 검증 (용어/문체/포맷) | 번역 검수 시 자동 호출 |
```

**Step 2: Disambiguation 테이블에 추가**

```markdown
| 번역 검수 | `translation-accuracy-reviewer` + `translation-style-reviewer` |
```

**Step 3: 번역 검수 오케스트레이션 섹션 추가**

`## Rules` 섹션 뒤에 새 섹션 추가:

```markdown
## Translation Review Orchestration

번역 문서 검수 시 아래 규칙을 따른다. `study-ko:translate` 스킬의 "에이전트 팀 보정" 섹션을 보강한다.

### 필수 규칙

- 번역 완료된 **각 문서마다** 아래 두 에이전트를 **모두** 호출한다:
  1. `translation-accuracy-reviewer` — 원문 대조 기술 검증
  2. `translation-style-reviewer` — 용어/문체/포맷 검증
- 두 에이전트는 같은 문서에 대해 **병렬 실행** 가능하다
- 문서를 에이전트별로 나누지 않는다 (문서 2개 = 에이전트 호출 4번)

### 흐름

```
번역 초안 완료
  → 각 문서마다:
      Task(translation-accuracy-reviewer, 파일경로) ‖ Task(translation-style-reviewer, 파일경로)
  → 리포트 취합
  → 문제 있으면 수정 반영
  → 완료
```

### 리포트 후 처리

- 두 리포트 모두 PASS → 커밋 진행
- ISSUES_FOUND → 수정 후 해당 에이전트만 재검증
```

**Step 4: Parallelizable 규칙에 추가**

Rules 섹션의 parallelizable 라인에 추가:
```
- Parallelizable: ..., `translation-accuracy-reviewer` + `translation-style-reviewer`
```

**Step 5: 커밋**

```bash
git add C:\Users\jangm\.claude\CLAUDE.md
git commit -m "feat: add translation review orchestration rules to CLAUDE.md"
```

---

### Task 4: 전체 검증

**Step 1: 에이전트 파일 존재 확인**

Run: `ls .claude/agents/`
Expected: `translation-accuracy-reviewer.md  translation-style-reviewer.md`

**Step 2: CLAUDE.md에 번역 관련 규칙 확인**

Run: `grep -c "translation" ~/.claude/CLAUDE.md`
Expected: 10 이상

**Step 3: 실제 번역 파일로 에이전트 테스트**

기존 번역 파일 하나로 두 에이전트를 실행하여 리포트가 정상 출력되는지 확인:
- `src/content/docs/vulkan/spec/00_fundamentals.md`를 대상으로 테스트
