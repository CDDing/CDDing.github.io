# 모바일에서 Claude Code 편하게 쓰기 — 조사 결과

## 문제

- 폰에서 Claude에게 기술 질문을 하고, 그 Q&A를 개인 사이트(학습 로그)에 쌓고 싶다
- Claude 웹 채팅: UI 좋지만 데이터 휘발, 개인화(훅/스킬/에이전트/CLAUDE.md) 불가
- Claude Code (Termux): 개인화 가능하지만 폰 터미널 UI 구림, 한글 입력 깨짐
- API 사용 안 함 — Claude Max 구독 범위 안에서 해결

## 핵심 요구사항

- 채팅 앱 수준의 모바일 UI + 마크다운 렌더링
- 한글 입력이 안 깨질 것 (브라우저 기반)
- Claude Code의 개인화 기능 (CLAUDE.md, 훅, 스킬, 에이전트) 동작
- AskUserQuestion, 권한 승인 같은 인터랙티브 기능 지원
- Claude Max 구독 인증 그대로 사용 (API 키 불필요)

## 결론: 이미 오픈소스가 존재한다

Claude Code CLI를 웹 브라우저로 감싸는 프로젝트들이 있다. CLI를 subprocess로 실행하는 방식이라 Max 구독 OAuth 인증을 그대로 탄다.

### 구조

```
[폰 브라우저] → VPN → [우분투 서버에서 웹 UI 서버 실행]
                            └─ claude CLI를 subprocess로 실행
                            └─ CLI가 이미 Max 인증 상태
                            └─ CLAUDE.md, 훅, 스킬 전부 인식
                            └─ stream-json 출력 → 웹 UI가 마크다운 렌더링
```

### 후보 프로젝트 3개

| 프로젝트 | GitHub | 모바일 | 권한 승인 UI | 라이선스 | 비고 |
|---------|--------|--------|------------|---------|------|
| claudecodeui | https://github.com/siteboon/claudecodeui | PWA 지원 | O | GPL v3 | 파일 탐색기, Git 통합, 가장 풍부 |
| claude-code-webui | https://github.com/sugyan/claude-code-webui | iPhone SE 최적화 | O (도구 권한 관리) | MIT | 깔끔한 채팅 UI, Deno/Node.js |
| claude-code-web | https://github.com/vultuk/claude-code-web | 반응형 | O | - | `--plan max20` 플래그로 구독 티어 명시 |

### 참고: 데스크탑 전용

- **opcode** (https://github.com/winfunc/opcode) — 15K+ 스타, Tauri 앱, 가장 완성도 높지만 모바일 미지원

### 주의사항

- SDK 경로(claude-agent-sdk)는 Max 구독 OAuth 토큰 사용이 Anthropic에 의해 공식 차단됨
- CLI subprocess 래핑 방식만 Max 구독과 호환
- stream-json 출력 포맷이 핵심 — AskUserQuestion, 도구 권한 등 인터랙티브 기능이 JSON으로 표현됨

## 다음 할 일

1. 위 프로젝트 중 하나를 우분투 서버에 설치
2. `claude` CLI가 서버에서 Max 인증 상태인지 확인 (`claude --version` 등)
3. 웹 UI 서버 실행
4. 폰에서 VPN 접속 후 브라우저로 테스트
5. 만족하면 그대로 사용, 부족하면 포크해서 커스터마이징
