---
title: "Fundamentals (기초) — 한글 요약"
sidebar:
  label: "00. Fundamentals"
---

> 원본: [Fundamentals](https://docs.vulkan.org/spec/latest/chapters/fundamentals.html)

이 챕터는 Vulkan의 핵심 아키텍처와 실행 모델, API 문법, 큐, 파이프라인 구성, 수치 표현, 상태/쿼리,
오브젝트와 셰이더 타입 등 **근본적인 개념**을 소개한다. 나머지 명세를 읽기 위한 프레임워크 역할.

---

## 1. Host and Device Environment (호스트 및 디바이스 환경)

Vulkan 구현체가 호스트(CPU 측)에 요구하는 사항:

- **정수**: 8, 16, 32, 64비트 부호 있는/없는 2의 보수 정수를 지원해야 함
- **부동소수점**: 32비트, 64비트 부동소수점 지원 필수
- **엔디언**: 호스트와 물리 디바이스의 데이터 표현 및 엔디언이 **동일해야** 함

> **핵심**: 호스트와 디바이스 양쪽에서 접근 가능한 데이터가 많으므로, 양쪽에서 효율적으로 접근할 수 있어야 한다.

---

## 2. Execution Model (실행 모델)

### 2.1 디바이스와 큐

- Vulkan은 하나 이상의 **디바이스(Device)** 를 노출함
- 각 디바이스는 하나 이상의 **큐(Queue)** 를 가짐 → 비동기 처리 가능 <sup class="fn-ref"><a href="/vk_spec_ko/log/00_fundamentals/#큐가-왜-나뉘어져-있는가">[1]</a><span class="fn-tooltip"><span class="fn-title"><a href="/vk_spec_ko/log/00_fundamentals/#큐가-왜-나뉘어져-있는가">큐가 왜 나뉘어져 있는가</a></span><span class="fn-desc">GPU 내부에 물리적으로 다른 엔진(Graphics, Compute, DMA, Video)이 존재하기 때문. 분리하면 동시 실행, 오버헤드 제거, 드라이버 최적화 이점.</span></span></sup>
- 큐는 **큐 패밀리(Queue Family)** 로 분류됨
  - 같은 패밀리 내의 큐는 **호환 가능** (어떤 큐에서든 실행 가능)
- 큐가 지원하는 기능 종류:
  - **Graphics** (그래픽스)
  - **Compute** (컴퓨트)
  - **Transfer** (전송)
  - **Video Decode / Encode** (비디오 디코드/인코드)
  - **Protected Memory Management** (보호 메모리)
  - **Sparse Memory Management** (희소 메모리)

### 2.2 디바이스 메모리

- 애플리케이션이 **명시적으로 관리**해야 함 (OpenGL과 다른 핵심 차이점!)
- 하나 이상의 **힙(Heap)** 으로 광고됨 <sup class="fn-ref"><a href="/vk_spec_ko/log/00_fundamentals/#vulkan-힙-vs-cs에서의-힙">[2]</a><span class="fn-tooltip"><span class="fn-title"><a href="/vk_spec_ko/log/00_fundamentals/#vulkan-힙-vs-cs에서의-힙">Vulkan 힙 vs CS에서의 힙</a></span><span class="fn-desc">유래는 같다. 둘 다 '큰 메모리 풀에서 원하는 만큼 떼어 쓴다'는 개념. 차이는 Vulkan 힙이 물리적으로 다른 여러 메모리 영역을 구분해서 노출한다는 점.</span></span></sup>
- 메모리 종류 예시:
  - **Device-local**: GPU에 물리적으로 연결된 메모리 (가장 빠름)
  - **Device-local, Host visible**: GPU 메모리인데 CPU에서도 접근 가능
  - **Host-local, Host visible**: CPU 메모리인데 GPU에서도 접근 가능
- 통합 메모리 아키텍처에서는 힙이 하나만 있을 수도 있음

### 2.3 큐 동작 (Queue Operation)

**제출(Submission):**
- `vkQueueSubmit` 등의 명령으로 작업을 큐에 제출
- 제출 후 **즉시 반환** — 작업 완료를 기다리지 않음! <sup class="fn-ref"><a href="/vk_spec_ko/log/00_fundamentals/#제출-후-즉시-반환-fire-and-forget">[3]</a><span class="fn-tooltip"><span class="fn-title"><a href="/vk_spec_ko/log/00_fundamentals/#제출-후-즉시-반환-fire-and-forget">제출 후 즉시 반환 (Fire-and-Forget)</a></span><span class="fn-desc">vkQueueSubmit은 GPU에 작업을 던지고 바로 반환. CPU는 다른 일을 하다가 결과가 필요한 시점에 vkWaitForFences로 대기.</span></span></sup>

**순서 보장:**
- 서로 다른 큐 간에는 **암묵적 순서 보장 없음**
- 명시적 동기화가 필요:
  - **Semaphore**: 큐 간 순서 제어
  - **Fence**: CPU와 GPU 간 동기화

**커맨드 버퍼(Command Buffer):**
- 대부분의 GPU 명령은 커맨드 버퍼에 **먼저 기록(Record)** 한 후 큐에 제출
- 같은 큐에 제출된 커맨드 버퍼는 제출 순서를 존중하지만, 내부 명령은 **겹치거나 순서가 바뀔 수 있음**
- 커맨드 버퍼 경계는 추가 순서 제약을 만들지 않음 (마치 하나의 큰 커맨드 버퍼처럼 동작)

**커맨드 분류 (4가지 역할):**

| 분류 | 설명 | 예시 |
|------|------|------|
| **Action** | 메모리 값을 업데이트하는 동작 | Draw, Dispatch |
| **State** | 커맨드 버퍼의 현재 상태를 변경 | Bind Pipeline |
| **Synchronization** | 액션 커맨드 간 순서 제약 부여 | Pipeline Barrier |
| **Indirection** | 같은 커맨드 버퍼에 직접 기록되지 않은 다른 커맨드를 실행 | Execute Commands |

> **중요**: 명시적 동기화 없이는 액션 커맨드가 겹치거나 순서 바뀔 수 있음.
> 하지만 각 액션 커맨드는 커맨드 버퍼에 기록된 시점의 상태를 사용함 (실행 시점이 아님!).

---

## 3. Object Model (오브젝트 모델)

### 3.1 핸들 타입

Vulkan의 모든 엔티티는 **핸들(Handle)** 로 참조됨. 두 가지 종류:

| 타입 | 설명 | 예시 |
|------|------|------|
| **Dispatchable** | 불투명 타입 포인터. 레이어가 인터셉트에 사용. 라이프타임 동안 **고유값 보장** | VkInstance, VkPhysicalDevice, VkDevice, VkQueue, VkCommandBuffer |
| **Non-dispatchable** | 64비트 정수. 구현체가 정보를 직접 인코딩할 수도 있음. `privateData` 기능 활성화 시 고유값 보장 | VkBuffer, VkImage, VkPipeline, VkFence 등 |

- `VkDevice`로 생성된 모든 오브젝트는 해당 디바이스에 **프라이빗** → 다른 디바이스에서 사용 불가

### 3.2 오브젝트 라이프타임

**생성/파괴 패턴:**

| 패턴 | 생성 | 파괴 | 특징 |
|------|------|------|------|
| Create/Destroy | `vkCreate*` | `vkDestroy*` | 일반 오브젝트 |
| Allocate/Free | `vkAllocate*` | `vkFree*` | 풀에서 할당. 고빈도 할당/해제에 적합 <sup class="fn-ref"><a href="/vk_spec_ko/log/00_fundamentals/#vkallocate-패턴">[4]</a><span class="fn-tooltip"><span class="fn-title"><a href="/vk_spec_ko/log/00_fundamentals/#vkallocate-패턴">vkAllocate* 패턴</a></span><span class="fn-desc">vkAllocateMemory, vkAllocateCommandBuffers, vkAllocateDescriptorSets 딱 3개. 풀/힙에서 떼어오는 구조라 Allocate/Free 패턴.</span></span></sup> |

**핵심 규칙:**
- 오브젝트의 "구조"는 생성 후 **불변(immutable)** — 콘텐츠는 변경 가능
- 부모 오브젝트는 **자식이 모두 해제된 후에만** 파괴 가능
- 파괴된 오브젝트는 **다시 접근하면 안 됨**
- 오브젝트가 접근되는 동안에는 **파괴하면 안 됨**
- `vkCmd*` 명령에 전달된 오브젝트는 커맨드 버퍼가 **pending 상태인 동안 계속 유효**해야 함

### 3.3 외부 오브젝트 핸들 (External Object Handles)

- `VkDevice`로 생성된 오브젝트의 범위는 해당 논리 디바이스로 제한
- 범위 밖의 오브젝트를 사용하려면 **export → import** 과정 필요
- 프로세스 간, API 간 공유 가능

---

## 4. Application Binary Interface (ABI)

- Vulkan은 보통 **공유 라이브러리(shared library)** 로 제공됨
- 표준 C 컴파일러의 기본 ABI를 사용해야 함
- `vk` + 숫자/대문자로 시작하는 심볼은 **구현체가 예약** → 앱에서 정의하면 안 됨
- 앱은 최소 요구 코어 버전의 심볼만 의존하고, 그 이상은 `vkGetInstanceProcAddr` / `vkGetDeviceProcAddr`로 함수 포인터를 얻어야 함

---

## 5. Command Syntax and Duration (커맨드 문법과 지속시간)

### 5.1 기본 타입

```c
typedef uint32_t VkBool32;      // VK_TRUE(1) 또는 VK_FALSE(0)만 사용!
typedef uint64_t VkDeviceSize;  // 디바이스 메모리 크기/오프셋
typedef uint64_t VkDeviceAddress; // 디바이스 버퍼 주소
```

**VkBool32 규칙**: 반드시 `VK_TRUE` 또는 `VK_FALSE`만 전달해야 함. 다른 값 금지.

**VkDeviceAddress 규칙**: `vkGetBufferDeviceAddress`로 얻은 주소 + [0, size) 범위 오프셋이어야 함.

### 5.2 커맨드 네이밍 규칙

| 접두사 | 용도 | 파라미터 |
|--------|------|----------|
| `vkCreate*` | 오브젝트 생성 | `Vk*CreateInfo` + `pAllocator` |
| `vkDestroy*` | 오브젝트 파괴 | `pAllocator` |
| `vkAllocate*` | 풀에서 할당 | `Vk*AllocateInfo` (allocator 없음) |
| `vkFree*` | 풀로 반환 | (allocator 없음) |
| `vkCmd*` | 커맨드 버퍼에 기록 | 사용 제한이 문서화됨 |
| `vkGet*` / `vkEnumerate*` | 정보 조회 | 아래 참고 |

- **Duration**: 커맨드 호출 시점부터 반환까지의 구간

### 5.3 배열 결과 조회 패턴 (2-call idiom)

`vkGet*` / `vkEnumerate*`로 배열을 조회하는 표준 패턴:

```
// 1단계: 개수 조회
vkEnumerate*(params, &count, NULL);

// 2단계: 실제 데이터 조회
array = malloc(count * sizeof(...));
vkEnumerate*(params, &count, array);
```

- 배열 포인터가 `NULL`이면 → 개수만 반환
- 배열 크기가 실제보다 작으면 → `VK_INCOMPLETE` 반환 (에러 아님!)
- 결과는 **invariant** (동일 파라미터면 동일 결과)

### 5.4 바이너리 데이터 조회

- 크기가 부족하면 → `VK_ERROR_NOT_ENOUGH_SPACE_KHR` 반환
- 데이터를 전혀 쓰지 않음 (배열과 다르게 부분 기록하지 않음)

---

## 6. Threading Behavior (스레딩 동작)

### 6.1 핵심 원칙

- Vulkan은 **멀티스레드 확장성**을 위해 설계됨
- 모든 커맨드를 동시에 여러 스레드에서 호출 가능
- **단, 일부 파라미터는 "Externally Synchronized"로 표시됨**
  - 해당 파라미터는 한 번에 **하나의 스레드만** 접근해야 함
  - 동시 접근 금지 + 적절한 **메모리 배리어**도 필요

### 6.2 왜 메모리 배리어가 중요한가?

- ARM CPU는 x86보다 **약한 메모리 순서(weakly ordered)** 를 사용
- `pthread`같은 상위 동기화 프리미티브는 내부적으로 메모리 배리어를 수행하므로 대부분 안전
- 직접 lock-free 코드를 작성할 때 주의 필요

### 6.3 Externally Synchronized 파라미터 예시

실제 명세에는 매우 긴 목록이 있음. 대표적인 것들:

- `vkDestroyInstance` → `instance`
- `vkDestroyDevice` → `device`
- `vkQueueSubmit` → `queue`, `fence`
- `vkFreeMemory` → `memory`
- `vkMapMemory` / `vkUnmapMemory` → `memory`
- `vkDestroyCommandPool` / `vkResetCommandPool` → `commandPool`
- 모든 `vkCmd*` → `commandBuffer`
- `vkDestroyPipeline` → `pipeline`
- `vkResetDescriptorPool` → `descriptorPool`

> **실무 팁**: 보통 커맨드 버퍼는 스레드당 하나, 디스크립터 풀도 스레드별로 분리하면 대부분의 동기화 문제를 피할 수 있다.

---

## 빠른 참조 표

### Vulkan vs OpenGL 핵심 차이 (이 챕터 기준)

| 항목 | OpenGL | Vulkan |
|------|--------|--------|
| 메모리 관리 | 드라이버가 알아서 | **앱이 명시적으로** |
| 스레딩 | 기본적으로 싱글스레드 | **멀티스레드 설계** |
| 커맨드 실행 | 즉시 실행 | **커맨드 버퍼에 기록 → 나중에 제출** |
| 동기화 | 대부분 암묵적 | **앱이 명시적으로 (Semaphore, Fence, Barrier)** |
| 오브젝트 생성 | 간단한 API | **CreateInfo 구조체 + 명시적 파괴** |
| 에러 체크 | 드라이버 내부 | **Validation Layer로 분리** |

---

## 이 챕터에서 기억할 것

1. **큐는 비동기** — 제출 후 즉시 반환되고, 완료는 Fence/Semaphore로 확인
2. **메모리는 앱 책임** — 힙 선택, 할당, 바인딩 모두 직접 해야 함
3. **커맨드는 기록 후 제출** — `vkCmd*`로 기록, `vkQueueSubmit`으로 제출
4. **동기화는 명시적** — 암묵적 보장이 거의 없음. 직접 배리어/세마포어 걸어야 함
5. **Externally Synchronized 주의** — 멀티스레드에서 같은 오브젝트 동시 접근 금지

---

*이 문서는 Vulkan 명세의 Fundamentals 챕터를 한글로 요약한 것입니다.*
*세부 사항은 원본 명세를 참조하세요.*
