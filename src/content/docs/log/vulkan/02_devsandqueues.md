---
title: "Devices and Queues 학습 로그"
sidebar:
  label: "02. Devices and Queues"
---

## 디스패처블 핸들(Dispatchable Handle)이란?

> **Q.** VkPhysicalDevice가 VkInstance로부터 열거되는 "디스패처블 핸들"이라는데, 디스패처블 메서드처럼 뭔가 중간에 거치는 게 있다는 거야?

맞아, "디스패처블"이라는 이름은 **내부에 디스패치 테이블(함수 포인터 테이블)을 가지고 있다**는 뜻이야.

Vulkan에서 핸들은 두 종류가 있어:

| 종류 | 내부 구조 | 예시 |
|------|----------|------|
| **Dispatchable** | 내부에 **함수 포인터 테이블(dispatch table)** 을 가짐 | `VkInstance`, `VkPhysicalDevice`, `VkDevice`, `VkQueue`, `VkCommandBuffer` |
| **Non-dispatchable** | 단순한 64비트 정수 핸들 (포인터 아님) | `VkBuffer`, `VkImage`, `VkFence`, `VkSemaphore` 등 나머지 전부 |

디스패치가 필요한 이유를 보면:

```c
// vkEnumeratePhysicalDevices(instance, ...) 호출 시 내부적으로:
// 1. instance 핸들 내부의 dispatch table을 참조
// 2. 해당 테이블에서 vkEnumeratePhysicalDevices의 실제 구현 함수 포인터를 찾음
// 3. 그 포인터를 호출 (ICD 드라이버의 실제 함수)
```

ICD(Installable Client Driver)와 연결되는 개념이야:

```
앱 → Vulkan Loader → dispatch table 참조 → 올바른 ICD 드라이버 호출
```

- `VkInstance`의 dispatch table → **인스턴스 레벨 함수들** (vkEnumeratePhysicalDevices 등)
- `VkPhysicalDevice`도 dispatch table을 가짐 → 어떤 GPU(ICD)의 함수를 호출할지 결정
- `VkDevice`의 dispatch table → **디바이스 레벨 함수들** (vkCreateBuffer 등)

**핵심**: 멀티 GPU 시스템에서 `VkPhysicalDevice` 핸들 내부의 dispatch table이 **"이 물리 디바이스에 대한 API 호출을 NVIDIA 드라이버로 보낼지, AMD 드라이버로 보낼지"** 를 결정해.

Non-dispatchable 핸들(VkBuffer 등)은 이미 특정 VkDevice에 종속되므로 별도 dispatch가 필요 없어.

---

## dispatch 어원 — vkCmdDispatch와 dispatch table의 관계

> **Q.** 컴퓨트 셰이더 호출할 때 나오는 dispatch랑 같은 의미야? dispatch라는 단어는 어떻게 유래된 거야?

같은 단어인데 **맥락이 다를 뿐**이야. 둘 다 "보내다(send off)"라는 핵심 의미에서 파생됐어.

**dispatch의 어원:**
- 이탈리아어 `dispacciare` (보내다, 발송하다) → 스페인어 `despachar` → 영어 `dispatch`
- 핵심 의미: **"적절한 곳으로 보내다"**

| 맥락 | 의미 | 비유 |
|------|------|------|
| **Vulkan Dispatch Table** | API 호출을 **올바른 드라이버로 라우팅** | 우체국: 편지를 주소에 맞는 배달부에게 배분 |
| **vkCmdDispatch (컴퓨트)** | 워크그룹을 **GPU에 보내서 실행시킴** | 사령부: 병사들을 전장에 파견 |
| **OS Dispatch (디스패처)** | 프로세스를 **CPU에 스케줄링** | 택시 배차: 손님을 차량에 배정 |

```
Vulkan Loader의 dispatch:
  앱 → "이 함수 호출을 어느 드라이버로 보낼까?" → dispatch table 참조 → NVIDIA ICD

vkCmdDispatch의 dispatch:
  앱 → "이 컴퓨트 작업을 GPU에 보내!" → 커맨드 버퍼에 기록 → GPU 실행
```

요약하면, 둘 다 "보내다"이지만:
- **Dispatch table** = 함수 호출을 **올바른 구현체로 라우팅**
- **vkCmdDispatch** = 컴퓨트 워크를 **GPU로 발송/실행**

---

## VK_INCOMPLETE vs 에러, OUT_OF_HOST/DEVICE_MEMORY

> **Q.** INCOMPLETE랑 ERROR랑 뭐가 다른 거야? 그리고 OUT_OF_HOST_MEMORY는 PhysicalDevice라는 래핑 객체 만들 때 CPU 측에서 공간 모자라다는 거야? 실제로는 거의 발생할 일 없을 것 같은데. OUT_OF_DEVICE_MEMORY는 디바이스 자체를 추상화한 것뿐인데 디바이스 메모리가 부족한 경우는 뭐야?

Vulkan의 반환 코드는 **부호로 성공/실패를 구분**해:

| 값 | 의미 | 예시 |
|----|------|------|
| `≥ 0` (양수/0) | **성공** | `VK_SUCCESS (0)`, `VK_INCOMPLETE (5)` |
| `< 0` (음수) | **실패** | `VK_ERROR_OUT_OF_HOST_MEMORY (-1)` |

`VK_INCOMPLETE`는 에러가 아니야. "성공했는데 **버퍼가 작아서 결과를 다 못 담았다**"는 뜻이야:

```c
uint32_t count = 1;  // 실제로 GPU가 3개인데 1개만 요청
VkPhysicalDevice devices[1];
VkResult result = vkEnumeratePhysicalDevices(instance, &count, devices);
// result == VK_INCOMPLETE (1개만 채워졌고 나머지 2개는 누락)
```

**OUT_OF_HOST_MEMORY**: 맞아, CPU 측 메모리 부족이야. 드라이버가 `VkPhysicalDevice` 핸들의 내부 메타데이터를 `malloc`으로 할당하는데, 그게 실패하면 이 에러. 시스템 RAM이 수 KB도 못 잡을 정도여야 하니까 실제로는 거의 안 일어남.

**OUT_OF_DEVICE_MEMORY**: 직감대로 `vkEnumeratePhysicalDevices`는 "정보 조회"일 뿐인데 GPU 메모리가 왜 필요하냐? 두 가지 이유야:

1. **드라이버 내부 초기화**: 일부 드라이버는 물리 디바이스를 처음 열거할 때 GPU와 통신하면서 GPU 측에 내부 상태 추적용 메모리를 소량 할당할 수 있어 (펌웨어 로딩, 내부 커맨드 버퍼 등)
2. **스펙의 보수적 설계**: Vulkan 스펙은 "이론적으로 가능한 모든 에러"를 나열해. 현재 드라이버가 안 쓰더라도 미래의 구현이 쓸 수 있으니까 스펙에는 넣어두는 거야

```
실무 현실:
├─ VK_SUCCESS          → 99.99%
├─ VK_INCOMPLETE       → 배열 크기 실수 시
├─ OUT_OF_HOST_MEMORY  → 사실상 안 일어남
├─ OUT_OF_DEVICE_MEMORY → 사실상 안 일어남
└─ INITIALIZATION_FAILED → 드라이버 설치 문제 시 가끔
```

> **실무 팁**: 대부분의 Vulkan 함수에 이 두 에러가 나열되어 있는데, "만약을 위한 것"이라고 보면 돼. 진짜 대응해야 하는 에러는 `VK_ERROR_DEVICE_LOST`나 `VK_ERROR_INITIALIZATION_FAILED` 같은 것들이야.

---

## VkBool32는 왜 32비트인가?

> **Q.** VkBool32라고 되어있는데 bool값을 왜 32비트 쓰는 거야 1비트 안 쓰고?

**1. C 언어의 `bool` 크기가 보장 안 됨**

C 표준에서 `_Bool`/`bool`은 컴파일러마다 크기가 다를 수 있어. Vulkan은 **크로스 플랫폼 C API**라서 모든 환경에서 동일한 바이너리 레이아웃이 필요해. `uint32_t`로 명시적으로 크기를 고정한 거야.

**2. CPU/GPU 레지스터와 정렬**

대부분의 CPU와 GPU는 **32비트가 자연스러운 연산 단위(natural word size)**야. 1비트나 1바이트 값을 읽으려면 오히려 마스킹/확장 연산이 추가로 필요해. 32비트로 하면 레지스터에 딱 맞아서 추가 연산 없이 바로 사용 가능.

**3. 구조체 정렬(alignment) 때문에 어차피 32비트**

Vulkan 구조체들은 멤버가 4바이트 정렬이야. bool 필드가 여러 개 있는 구조체에서 1바이트 `bool`을 써도 **패딩 때문에 4바이트를 차지**하게 돼:

```c
// 만약 bool (1바이트)을 썼다면:
typedef struct {
    bool a;     // 1바이트 + 3바이트 패딩
    bool b;     // 1바이트 + 3바이트 패딩
    bool c;     // 1바이트 + 3바이트 패딩
} Example;      // 어차피 12바이트

// VkBool32 (4바이트)를 쓰면:
typedef struct {
    VkBool32 a; // 4바이트, 패딩 없음
    VkBool32 b; // 4바이트, 패딩 없음
    VkBool32 c; // 4바이트, 패딩 없음
} Example;      // 동일하게 12바이트
```

**4. ABI 호환성**

드라이버(ICD)와 앱이 **다른 컴파일러**로 빌드될 수 있어. `bool`의 크기가 다르면 구조체 레이아웃이 달라져서 크래시나 데이터 손상이 생길 수 있거든. `uint32_t`는 모든 C/C++ 컴파일러에서 정확히 4바이트라 이 문제가 없어.

> **참고**: OpenGL의 `GLboolean`은 `unsigned char`(1바이트)인데, 이게 실제로 ABI 문제를 일으킨 사례가 있어서 Vulkan은 처음부터 32비트로 간 거야.

---

## 물리 디바이스와 논리 디바이스를 왜 분리했나?

> **Q.** 논리 디바이스랑 물리 디바이스랑 왜 나눈 거야? 객체지향적 관점에서는 디바이스가 하나로 통합되는 게 좋지 않나? 하나의 디바이스에서 여러 논리 디바이스를 생성할 일은 어떨 때 있는 거야?

핵심 이유는 **조회(read-only)와 사용(mutable)의 분리**야.

| 물리 디바이스 (VkPhysicalDevice) | 논리 디바이스 (VkDevice) |
| -------------------------- | ------------------ |
| 하드웨어의 **정보 조회용** 핸들        | 실제 **작업을 수행하는** 핸들 |
| 속성, 기능, 제한 등 읽기만           | 리소스 생성, 큐 제출 등     |
| 인스턴스에 종속                   | 물리 디바이스에서 생성       |
| 상태 변경 없음                   | 앱별 상태를 가짐          |

만약 하나로 합쳤다면, 디바이스를 "선택"하기 전에 이미 초기화가 필요하고, 기능 활성화/비활성화도 불가능해져. 물리 디바이스로 먼저 **뭘 할 수 있는지 확인**하고, 논리 디바이스에서 **필요한 것만 켜서 사용**하는 2단계 설계야.

**하나의 물리 디바이스에서 여러 논리 디바이스를 만드는 실제 사례:**

1. **리소스 격리**: 렌더링용 디바이스와 비동기 컴퓨트용 디바이스를 분리. 하나가 `VK_ERROR_DEVICE_LOST`로 죽어도 다른 건 살아있어
2. **기능 세트 분리**: 논리 디바이스 A는 `geometryShader`를 활성화하고, B는 활성화 안 하고. 각각 필요한 기능만 켜서 드라이버 오버헤드를 줄임
3. **테스팅/디버깅**: 검증 레이어가 켜진 디바이스와 꺼진 디바이스를 동시에 운용
4. **가상화/미들웨어**: VR 런타임이나 OBS 같은 캡처 소프트웨어가 자체 논리 디바이스를 만들어서 앱과 독립적으로 GPU를 사용

```
물리 디바이스 (RTX 3080)
├── 논리 디바이스 A (렌더링, 모든 기능 활성화)
│   ├── 그래픽스 큐
│   └── 전송 큐
└── 논리 디바이스 B (컴퓨트 전용, 최소 기능)
    └── 컴퓨트 큐
```

하지만 **실무에서는 99%가 물리 디바이스 1개 : 논리 디바이스 1개**야. 여러 논리 디바이스를 만들면 GPU 메모리를 서로 직접 공유할 수 없어서 오히려 복잡해지거든. 그래도 스펙이 이걸 허용하는 건 **유연성을 위한 설계**야.

> **OpenGL과의 비교**: OpenGL은 컨텍스트 하나가 디바이스 조회 + 리소스 생성 + 렌더링을 전부 담당했어. 그래서 "어떤 GPU가 뭘 지원하는지" 알려면 먼저 컨텍스트를 만들어야 했고, 컨텍스트 생성이 실패하면 이유도 모르는 경우가 많았어. Vulkan은 이 문제를 물리/논리 분리로 해결한 거야.

---

## 큐 우선순위는 OS 프로세스 우선순위와 비슷한가?

> **Q.** 큐 생성할 때 우선순위는 OS에서 프로세스 우선순위 두는 것과 비슷한 건가?

비슷한 개념이긴 한데 차이가 있어.

**공통점:**
- 둘 다 **상대적 힌트**야. "이게 더 중요하니 먼저/더 자주 실행해줘"라는 요청
- 둘 다 **반드시 지켜질 의무가 없음**. OS도 우선순위를 완벽히 보장 안 하고, Vulkan도 "구현 정의"야

**차이점:**

| | OS 프로세스 우선순위 | Vulkan 큐 우선순위 |
|---|---|---|
| **스케줄러** | OS 커널이 관리 | GPU 드라이버/하드웨어가 관리 |
| **범위** | 시스템 전체 프로세스 간 | **같은 논리 디바이스 내 큐 간**만 |
| **프로세스 간** | 다른 프로세스와 비교 가능 | 다른 프로세스의 큐와는 **관계 정의 안 됨** |
| **선점** | 높은 우선순위가 낮은 걸 선점 가능 | GPU는 보통 실행 중인 워크를 **선점하지 않음** |
| **세밀함** | nice, priority class 등 다양 | 그냥 0.0~1.0 float 하나 |

핵심 차이는 **선점(preemption)**이야. OS는 높은 우선순위 프로세스가 오면 낮은 걸 중단시킬 수 있는데, GPU는 대부분 현재 실행 중인 워크로드를 끝까지 돌리고 다음 스케줄링에서 우선순위를 반영해. 그래서 Vulkan 큐 우선순위는 "다음에 누구 먼저 실행할까"에 가깝지, "지금 당장 멈추고 이거 해"는 아니야.

> **실무 현실**: 대부분의 앱이 큐 1~2개만 쓰고 전부 우선순위 1.0으로 넣어. 우선순위 차등을 두는 경우는 비동기 컴퓨트나 백그라운드 전송 큐를 낮게 잡는 정도.
