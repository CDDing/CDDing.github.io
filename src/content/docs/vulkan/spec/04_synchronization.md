---
title: "Synchronization (동기화) — 한글 요약"
sidebar:
  label: "04. Synchronization"
---

> 원본: [Synchronization and Cache Control](https://docs.vulkan.org/spec/latest/chapters/synchronization.html)

Vulkan에서 **리소스 접근 동기화는 앱의 책임**이다. 동기화를 빼먹으면 데이터 레이스, 이미지 깨짐, 정의되지 않은 동작이 발생한다. 이 챕터는 Vulkan에서 가장 어렵고 가장 중요한 챕터다.

---

## 1. 동기화의 핵심 개념

### 1.1 왜 동기화가 필요한가

GPU는 커맨드를 **병렬로, 순서 없이** 실행할 수 있다. 예를 들어:

- 이미지에 렌더링 → 그 이미지를 텍스처로 샘플링 (순서가 보장되지 않으면 깨진 이미지를 읽음)
- 버퍼에 데이터 쓰기 → 그 버퍼를 버텍스 데이터로 사용 (쓰기 전에 읽을 수 있음)

Vulkan은 이런 순서를 **자동으로 보장하지 않는다**. 앱이 명시적으로 동기화를 걸어야 한다.

### 1.2 다섯 가지 동기화 메커니즘

| 메커니즘 | 용도 | 세밀도 |
|----------|------|--------|
| **Fence** | GPU → CPU 완료 통보 | 큐 제출 단위 |
| **Semaphore** | 큐 ↔ 큐 순서 제어 | 큐 제출 단위 |
| **Event** | 커맨드 버퍼 내부의 세밀한 동기화 | 커맨드 단위 |
| **Pipeline Barrier** | 커맨드 버퍼 내 파이프라인 스테이지 간 동기화 | 스테이지 단위 |
| **Render Pass** | 서브패스 간 어태치먼트 의존성 | 서브패스 단위 |

<img src="/vk_spec_ko/images/04_synchronization/synchronization_overview.png" alt="동기화 프리미티브 개요" class="light-bg" />

> 출처: [Vulkan Guide — Synchronization](https://docs.vulkan.org/guide/latest/synchronization.html). Event는 커맨드 버퍼 내부, Semaphore는 큐 간, Fence는 GPU↔CPU 간 동기화를 담당한다.

---

## 2. Execution Dependencies (실행 의존성)

### 2.1 기본 개념

**실행 의존성**은 "A 작업이 끝난 후에 B 작업이 시작된다"는 **순서 보장**이다.

동기화 커맨드는 두 가지 **동기화 범위(Synchronization Scope)**를 정의한다:

- **첫 번째 동기화 범위 (Src)**: "이 작업들이 끝나면..."
- **두 번째 동기화 범위 (Dst)**: "...이 작업들을 시작해도 된다"

```
[Src 범위의 작업들] ──완료──▶ [동기화 지점] ──시작──▶ [Dst 범위의 작업들]
```

### 2.2 데이터 해저드 (Data Hazards)

| 해저드 유형 | 설명 | 필요한 의존성 |
|------------|------|-------------|
| **Read-After-Write (RAW)** | 쓰기 전에 읽기 시작 | **메모리 의존성** 필요 |
| **Write-After-Read (WAR)** | 읽기 전에 덮어쓰기 | 실행 의존성만으로 충분 |
| **Write-After-Write (WAW)** | 쓰기 순서가 바뀜 | **메모리 의존성** 필요 |

> **핵심**: RAW와 WAW는 단순 실행 순서만으로는 부족하다. **캐시 플러시/무효화**까지 해줘야 올바른 값을 읽을 수 있다. 이것이 메모리 의존성이다.

---

## 3. Memory Dependencies (메모리 의존성)

### 3.1 실행 의존성 vs 메모리 의존성

실행 의존성은 "A가 B 전에 실행된다"만 보장한다. 하지만 GPU에는 **L1/L2 캐시**가 있어서, A가 쓴 값이 캐시에만 남아있고 B가 접근하는 메모리에는 아직 반영 안 됐을 수 있다.

**메모리 의존성** = 실행 의존성 + **가용성(Availability)** + **가시성(Visibility)** 연산

```
A가 캐시에 쓰기
    ↓
[가용성 연산] → 캐시에서 메인 메모리로 플러시 (make available)
    ↓
[가시성 연산] → 메인 메모리에서 B의 캐시로 로드 (make visible)
    ↓
B가 올바른 값 읽기
```

### 3.2 접근 유형 (Access Types)

동기화 커맨드에서 **어떤 종류의 메모리 접근**을 동기화할지 지정한다.

#### VkAccessFlagBits2 — 주요 플래그

**읽기 접근:**

| 플래그 | 설명 | 대응 파이프라인 스테이지 |
|--------|------|----------------------|
| `INDIRECT_COMMAND_READ` | 인다이렉트 버퍼 읽기 | `DRAW_INDIRECT` |
| `INDEX_READ` | 인덱스 버퍼 읽기 | `INDEX_INPUT` |
| `VERTEX_ATTRIBUTE_READ` | 버텍스 버퍼 읽기 | `VERTEX_ATTRIBUTE_INPUT` |
| `UNIFORM_READ` | 유니폼 버퍼 읽기 | 셰이더 스테이지 |
| `INPUT_ATTACHMENT_READ` | 인풋 어태치먼트 읽기 | `FRAGMENT_SHADER` |
| `SHADER_SAMPLED_READ` | 샘플드 이미지/유니폼 텍셀 버퍼 읽기 | 셰이더 스테이지 |
| `SHADER_STORAGE_READ` | 스토리지 버퍼/이미지/텍셀 버퍼 읽기 | 셰이더 스테이지 |
| `COLOR_ATTACHMENT_READ` | 컬러 어태치먼트 읽기 | `COLOR_ATTACHMENT_OUTPUT` |
| `DEPTH_STENCIL_ATTACHMENT_READ` | 깊이/스텐실 읽기 | `EARLY/LATE_FRAGMENT_TESTS` |
| `TRANSFER_READ` | 전송 소스 읽기 | `COPY` \| `BLIT` \| `RESOLVE` |
| `HOST_READ` | 호스트(CPU) 읽기 | `HOST` |

**쓰기 접근:**

| 플래그 | 설명 | 대응 파이프라인 스테이지 |
|--------|------|----------------------|
| `SHADER_STORAGE_WRITE` | 스토리지 버퍼/이미지 쓰기 | 셰이더 스테이지 |
| `COLOR_ATTACHMENT_WRITE` | 컬러 어태치먼트 쓰기 | `COLOR_ATTACHMENT_OUTPUT` |
| `DEPTH_STENCIL_ATTACHMENT_WRITE` | 깊이/스텐실 쓰기 | `EARLY/LATE_FRAGMENT_TESTS` |
| `TRANSFER_WRITE` | 전송 대상 쓰기 | `COPY` \| `BLIT` \| `CLEAR` \| `RESOLVE` |
| `HOST_WRITE` | 호스트(CPU) 쓰기 | `HOST` |

**범용 플래그:**

| 플래그 | 설명 |
|--------|------|
| `MEMORY_READ` | 모든 읽기 접근 (구체적 플래그 대신 사용 가능) |
| `MEMORY_WRITE` | 모든 쓰기 접근 (구체적 플래그 대신 사용 가능) |

> **실무 팁**: `MEMORY_READ`/`MEMORY_WRITE`는 편리하지만, 구체적인 플래그를 쓰면 드라이버가 더 정밀한 최적화를 할 수 있다.

---

## 4. Pipeline Stages (파이프라인 스테이지)

### 4.1 그래픽스 파이프라인 스테이지 순서

동기화에서 "어디까지 기다리고, 어디부터 시작할지"를 **파이프라인 스테이지**로 지정한다.

<img src="/vk_spec_ko/images/04_synchronization/synchronization_pipeline_barriers.png" alt="파이프라인 배리어 동작" class="light-bg" />

> 출처: [Vulkan Guide — Synchronization](https://docs.vulkan.org/guide/latest/synchronization.html). Shadow 렌더 패스의 프래그먼트 테스트 이후 → Main 렌더 패스의 프래그먼트 셰이더 시작 전으로 배리어를 설정한 예시.

```
▼ 그래픽스 파이프라인 (위에서 아래로 실행)
┌─────────────────────────────────────┐
│ TOP_OF_PIPE (레거시, 사용 비권장)     │
├─────────────────────────────────────┤
│ DRAW_INDIRECT                       │ ← 인다이렉트 버퍼 읽기
├─────────────────────────────────────┤
│ VERTEX_INPUT                        │ ← 인덱스/버텍스 버퍼 읽기
│   ├ INDEX_INPUT                     │
│   └ VERTEX_ATTRIBUTE_INPUT          │
├─────────────────────────────────────┤
│ VERTEX_SHADER                       │
├─────────────────────────────────────┤
│ TESSELLATION_CONTROL_SHADER         │
├─────────────────────────────────────┤
│ TESSELLATION_EVALUATION_SHADER      │
├─────────────────────────────────────┤
│ GEOMETRY_SHADER                     │
├─────────────────────────────────────┤
│ EARLY_FRAGMENT_TESTS                │ ← 초기 깊이/스텐실 테스트
├─────────────────────────────────────┤
│ FRAGMENT_SHADER                     │
├─────────────────────────────────────┤
│ LATE_FRAGMENT_TESTS                 │ ← 후기 깊이/스텐실 테스트
├─────────────────────────────────────┤
│ COLOR_ATTACHMENT_OUTPUT             │ ← 컬러 블렌딩/쓰기
├─────────────────────────────────────┤
│ BOTTOM_OF_PIPE (레거시, 사용 비권장)  │
└─────────────────────────────────────┘
```

**컴퓨트 파이프라인:**
```
DRAW_INDIRECT → COMPUTE_SHADER
```

**전송 파이프라인:**
```
ALL_TRANSFER (= COPY | RESOLVE | BLIT | CLEAR)
```

### 4.2 스테이지 마스크 규칙

- **Src 스테이지 마스크**: 지정한 스테이지 + **논리적으로 이전** 스테이지를 포함
- **Dst 스테이지 마스크**: 지정한 스테이지 + **논리적으로 이후** 스테이지를 포함
- 접근 범위는 **명시적으로 지정한 스테이지만** 적용 (암시적 확장 없음)

```c
// 예시: 버텍스 셰이더에서 쓴 스토리지 버퍼를 프래그먼트 셰이더에서 읽기
srcStageMask  = VK_PIPELINE_STAGE_2_VERTEX_SHADER_BIT;   // 여기서 쓰기 끝나면
srcAccessMask = VK_ACCESS_2_SHADER_STORAGE_WRITE_BIT;     // 스토리지 쓰기를 플러시
dstStageMask  = VK_PIPELINE_STAGE_2_FRAGMENT_SHADER_BIT;  // 여기서 읽기 전에
dstAccessMask = VK_ACCESS_2_SHADER_STORAGE_READ_BIT;      // 스토리지 읽기를 가시화
```

### 4.3 주요 편의 스테이지

| 스테이지 | 동등한 의미 |
|----------|-----------|
| `ALL_COMMANDS` | 모든 파이프라인 스테이지 |
| `ALL_GRAPHICS` | 그래픽스 파이프라인의 모든 스테이지 |
| `ALL_TRANSFER` | `COPY` \| `BLIT` \| `RESOLVE` \| `CLEAR` (+ 확장: `ACCELERATION_STRUCTURE_COPY`) |
| `PRE_RASTERIZATION_SHADERS` | 래스터화 이전의 모든 셰이더 스테이지 |
| `NONE` | 아무 스테이지도 아님 (Src에서 "즉시", Dst에서 "없음") |

> **레거시 주의**: `TOP_OF_PIPE`와 `BOTTOM_OF_PIPE`는 레거시다. `NONE`과 `ALL_COMMANDS`를 대신 사용하라.

---

## 5. Fences (펜스)

### 5.1 개념

펜스는 **GPU 작업 완료를 CPU에 알리는** 동기화 프리미티브다. 큐에 작업을 제출할 때 펜스를 같이 넘기면, 작업이 완료될 때 펜스가 시그널된다.

```c
VK_DEFINE_NON_DISPATCHABLE_HANDLE(VkFence)
```

### 5.2 펜스 생성

```c
VkResult vkCreateFence(
    VkDevice                     device,
    const VkFenceCreateInfo*     pCreateInfo,
    const VkAllocationCallbacks* pAllocator,
    VkFence*                     pFence);

typedef struct VkFenceCreateInfo {
    VkStructureType      sType;    // VK_STRUCTURE_TYPE_FENCE_CREATE_INFO
    const void*          pNext;
    VkFenceCreateFlags   flags;    // 0 또는 VK_FENCE_CREATE_SIGNALED_BIT
} VkFenceCreateInfo;
```

- `VK_FENCE_CREATE_SIGNALED_BIT`: 생성 시 **이미 시그널 상태**로 만듦. 첫 프레임에서 "이전 프레임 완료 대기"를 할 때 유용

### 5.3 펜스 대기

```c
VkResult vkWaitForFences(
    VkDevice     device,
    uint32_t     fenceCount,      // 대기할 펜스 수
    const VkFence* pFences,       // 펜스 배열
    VkBool32     waitAll,         // VK_TRUE: 전부 대기, VK_FALSE: 하나만
    uint64_t     timeout);        // 타임아웃 (나노초, UINT64_MAX = 무한)
```

**반환 코드:**

| 성공 | 실패 |
|------|------|
| `VK_SUCCESS` (모두/하나 시그널됨) | `VK_ERROR_OUT_OF_HOST_MEMORY` |
| `VK_TIMEOUT` (시간 초과) | `VK_ERROR_OUT_OF_DEVICE_MEMORY` |
| | `VK_ERROR_DEVICE_LOST` |

### 5.4 펜스 리셋

```c
VkResult vkResetFences(
    VkDevice       device,
    uint32_t       fenceCount,
    const VkFence* pFences);
```

> **핵심 규칙**: 큐에 제출된 상태(pending)인 펜스를 리셋하면 **정의되지 않은 동작**이다. 반드시 시그널된 후에 리셋하라.

### 5.5 펜스 상태 조회

```c
VkResult vkGetFenceStatus(VkDevice device, VkFence fence);
// VK_SUCCESS → 시그널됨
// VK_NOT_READY → 아직 시그널 안 됨
```

### 5.6 일반적인 사용 패턴

```c
// 프레임 동기화 (더블 버퍼링)
VkFence frameFences[2];
// 생성 시 SIGNALED_BIT로 만듦 (첫 프레임에서 대기 가능하도록)

for (int frame = 0; ; frame++) {
    int i = frame % 2;

    // 이전 프레임이 GPU에서 끝날 때까지 대기
    vkWaitForFences(device, 1, &frameFences[i], VK_TRUE, UINT64_MAX);
    vkResetFences(device, 1, &frameFences[i]);

    // 커맨드 버퍼 기록 및 제출
    vkQueueSubmit(queue, 1, &submitInfo, frameFences[i]);
}
```

---

## 6. Semaphores (세마포어)

### 6.1 개념

세마포어는 **큐 간 작업 순서를 제어**하는 동기화 프리미티브다. 큐 A에서 시그널하고 큐 B에서 대기하면, A의 작업이 끝난 후 B가 시작된다.

```c
VK_DEFINE_NON_DISPATCHABLE_HANDLE(VkSemaphore)
```

### 6.2 두 가지 종류

| 종류 | 값 | 시그널/대기 위치 | 용도 |
|------|---|---------------|------|
| **Binary** | 시그널/비시그널 | 큐 제출 시에만 | 프레임 내 큐 간 순서 |
| **Timeline** | 단조 증가하는 uint64 | 큐 제출 + 호스트에서도 가능 | 복잡한 의존성 그래프 |

### 6.3 바이너리 세마포어

```c
typedef struct VkSemaphoreCreateInfo {
    VkStructureType      sType;
    const void*          pNext;
    VkSemaphoreCreateFlags flags;  // 예약됨 (0)
} VkSemaphoreCreateInfo;
```

바이너리 세마포어는 **시그널 → 대기**가 반드시 1:1이어야 한다. 시그널 없이 대기하거나, 이미 시그널된 세마포어를 다시 시그널하면 안 된다.

**일반적인 사용 — 렌더링 → 프레젠트:**

```c
// 큐 제출 시
VkSubmitInfo submitInfo = {
    .waitSemaphoreCount = 1,
    .pWaitSemaphores = &imageAvailableSemaphore,   // 이미지 획득 대기
    .pWaitDstStageMask = &waitStage,
    .signalSemaphoreCount = 1,
    .pSignalSemaphores = &renderFinishedSemaphore,  // 렌더링 완료 시그널
};
vkQueueSubmit(graphicsQueue, 1, &submitInfo, fence);

// 프레젠트 시
VkPresentInfoKHR presentInfo = {
    .waitSemaphoreCount = 1,
    .pWaitSemaphores = &renderFinishedSemaphore,    // 렌더링 완료 대기
};
vkQueuePresentKHR(presentQueue, &presentInfo);
```

### 6.4 타임라인 세마포어 (Vulkan 1.2+)

```c
typedef struct VkSemaphoreTypeCreateInfo {
    VkStructureType  sType;
    const void*      pNext;
    VkSemaphoreType  semaphoreType;   // VK_SEMAPHORE_TYPE_BINARY 또는 TIMELINE
    uint64_t         initialValue;    // 타임라인 초기값
} VkSemaphoreTypeCreateInfo;
```

타임라인 세마포어의 장점:
- **호스트에서도 시그널/대기 가능** → CPU-GPU 간 유연한 동기화
- **값 기반** → 1:1 매칭 불필요, 여러 대기자가 다른 값을 기다릴 수 있음
- **단조 증가** → 값이 N에 도달하면 ≤ N을 기다리는 모든 대기자가 풀림

```c
// 호스트에서 현재 값 조회
VkResult vkGetSemaphoreCounterValue(
    VkDevice device, VkSemaphore semaphore, uint64_t* pValue);

// 호스트에서 대기
VkResult vkWaitSemaphores(
    VkDevice device, const VkSemaphoreWaitInfo* pWaitInfo, uint64_t timeout);

// 호스트에서 시그널
VkResult vkSignalSemaphore(
    VkDevice device, const VkSemaphoreSignalInfo* pSignalInfo);
```

---

## 7. Events (이벤트)

### 7.1 개념

이벤트는 **커맨드 버퍼 내부**에서 세밀한 동기화를 할 수 있는 프리미티브다. 한 지점에서 시그널하고 다른 지점에서 대기한다. 파이프라인 배리어와 비슷하지만, 시그널과 대기를 **분리**할 수 있다.

```c
VK_DEFINE_NON_DISPATCHABLE_HANDLE(VkEvent)
```

### 7.2 커맨드 버퍼에서 사용 (Vulkan 1.3+)

```c
// 시그널
void vkCmdSetEvent2(
    VkCommandBuffer        commandBuffer,
    VkEvent                event,
    const VkDependencyInfo* pDependencyInfo);  // Src 범위 정의

// 대기
void vkCmdWaitEvents2(
    VkCommandBuffer        commandBuffer,
    uint32_t               eventCount,
    const VkEvent*         pEvents,
    const VkDependencyInfo* pDependencyInfos); // Dst 범위 정의

// 리셋
void vkCmdResetEvent2(
    VkCommandBuffer        commandBuffer,
    VkEvent                event,
    VkPipelineStageFlags2  stageMask);
```

> **파이프라인 배리어 vs 이벤트**: 배리어는 시그널과 대기가 **같은 지점**이다. 이벤트는 시그널과 대기 사이에 **다른 커맨드를 끼울 수 있어서** GPU가 그 사이에 다른 일을 할 수 있다. 성능이 더 좋을 수 있다.

> **중요 제약**: 이벤트는 **같은 큐** 내에서만 사용 가능하다. 큐 간 동기화에는 세마포어를 써야 한다.

---

## 8. Pipeline Barriers (파이프라인 배리어)

### 8.1 개념

파이프라인 배리어는 커맨드 버퍼에 삽입하는 **동기화 지점**이다. 배리어 이전의 작업이 완료되고 메모리가 가용/가시 상태가 된 후에 배리어 이후의 작업이 시작된다.

### 8.2 vkCmdPipelineBarrier2 (Vulkan 1.3+)

```c
void vkCmdPipelineBarrier2(
    VkCommandBuffer          commandBuffer,
    const VkDependencyInfo*  pDependencyInfo);
```

### 8.3 VkDependencyInfo — 의존성 정보

```c
typedef struct VkDependencyInfo {
    VkStructureType                sType;
    const void*                    pNext;
    VkDependencyFlags              dependencyFlags;
    uint32_t                       memoryBarrierCount;       // 글로벌 메모리 배리어 수
    const VkMemoryBarrier2*        pMemoryBarriers;          // 글로벌 메모리 배리어
    uint32_t                       bufferMemoryBarrierCount; // 버퍼 메모리 배리어 수
    const VkBufferMemoryBarrier2*  pBufferMemoryBarriers;    // 버퍼 메모리 배리어
    uint32_t                       imageMemoryBarrierCount;  // 이미지 메모리 배리어 수
    const VkImageMemoryBarrier2*   pImageMemoryBarriers;     // 이미지 메모리 배리어
} VkDependencyInfo;
```

### 8.4 세 종류의 메모리 배리어

#### 글로벌 메모리 배리어 — VkMemoryBarrier2

```c
typedef struct VkMemoryBarrier2 {
    VkStructureType          sType;
    const void*              pNext;
    VkPipelineStageFlags2    srcStageMask;    // Src 파이프라인 스테이지
    VkAccessFlags2           srcAccessMask;   // Src 접근 유형 (flush 대상)
    VkPipelineStageFlags2    dstStageMask;    // Dst 파이프라인 스테이지
    VkAccessFlags2           dstAccessMask;   // Dst 접근 유형 (invalidate 대상)
} VkMemoryBarrier2;
```

모든 리소스에 대한 메모리 접근을 동기화한다. 가장 간단하지만 범위가 넓다.

#### 버퍼 메모리 배리어 — VkBufferMemoryBarrier2

```c
typedef struct VkBufferMemoryBarrier2 {
    VkStructureType          sType;
    const void*              pNext;
    VkPipelineStageFlags2    srcStageMask;
    VkAccessFlags2           srcAccessMask;
    VkPipelineStageFlags2    dstStageMask;
    VkAccessFlags2           dstAccessMask;
    uint32_t                 srcQueueFamilyIndex;  // 소유권 이전 소스 큐 패밀리
    uint32_t                 dstQueueFamilyIndex;  // 소유권 이전 대상 큐 패밀리
    VkBuffer                 buffer;               // 대상 버퍼
    VkDeviceSize             offset;               // 오프셋
    VkDeviceSize             size;                  // 크기 (VK_WHOLE_SIZE 가능)
} VkBufferMemoryBarrier2;
```

특정 버퍼(의 특정 범위)에 대한 메모리 접근을 동기화한다. **큐 패밀리 소유권 이전**에도 사용된다.

#### 이미지 메모리 배리어 — VkImageMemoryBarrier2

```c
typedef struct VkImageMemoryBarrier2 {
    VkStructureType          sType;
    const void*              pNext;
    VkPipelineStageFlags2    srcStageMask;
    VkAccessFlags2           srcAccessMask;
    VkPipelineStageFlags2    dstStageMask;
    VkAccessFlags2           dstAccessMask;
    VkImageLayout            oldLayout;            // 현재 레이아웃
    VkImageLayout            newLayout;             // 전환할 레이아웃
    uint32_t                 srcQueueFamilyIndex;
    uint32_t                 dstQueueFamilyIndex;
    VkImage                  image;                 // 대상 이미지
    VkImageSubresourceRange  subresourceRange;      // 밉 레벨/레이어 범위
} VkImageMemoryBarrier2;
```

이미지에 대한 메모리 접근 동기화 + **이미지 레이아웃 전환**을 수행한다. Vulkan 동기화에서 가장 자주 사용되는 배리어다.

---

## 9. Image Layout Transitions (이미지 레이아웃 전환)

### 9.1 왜 레이아웃이 필요한가

GPU는 이미지를 용도에 따라 **다른 내부 형식**으로 저장한다. 예를 들어 렌더 타겟용과 텍스처 샘플링용은 메모리 배치가 다를 수 있다. 레이아웃 전환은 GPU에게 "이제 이 이미지를 다른 용도로 쓸 거야"라고 알려주는 것이다.

### 9.2 주요 이미지 레이아웃

| 레이아웃 | 용도 |
|----------|------|
| `VK_IMAGE_LAYOUT_UNDEFINED` | 초기/무관심 상태 (내용 보존 안 됨) |
| `VK_IMAGE_LAYOUT_GENERAL` | 범용 (모든 용도, 최적은 아님) |
| `VK_IMAGE_LAYOUT_COLOR_ATTACHMENT_OPTIMAL` | 컬러 어태치먼트로 쓰기 최적 |
| `VK_IMAGE_LAYOUT_DEPTH_STENCIL_ATTACHMENT_OPTIMAL` | 깊이/스텐실 어태치먼트 최적 |
| `VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL` | 셰이더에서 읽기 최적 |
| `VK_IMAGE_LAYOUT_TRANSFER_SRC_OPTIMAL` | 전송 소스 최적 |
| `VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL` | 전송 대상 최적 |
| `VK_IMAGE_LAYOUT_PRESENT_SRC_KHR` | 프레젠트(화면 출력)용 |

### 9.3 레이아웃 전환 규칙

- `oldLayout`은 `UNDEFINED` 또는 **현재 실제 레이아웃**이어야 한다
- `oldLayout = UNDEFINED`로 하면 **이전 내용이 파괴**됨 (성능 이점)
- 같은 이미지/서브리소스의 레이아웃 전환은 **제출 순서대로** 실행된다

```c
// 예시: 이미지를 전송 대상 → 셰이더 읽기로 전환
VkImageMemoryBarrier2 barrier = {
    .sType = VK_STRUCTURE_TYPE_IMAGE_MEMORY_BARRIER_2,
    .srcStageMask  = VK_PIPELINE_STAGE_2_ALL_TRANSFER_BIT,
    .srcAccessMask = VK_ACCESS_2_TRANSFER_WRITE_BIT,
    .dstStageMask  = VK_PIPELINE_STAGE_2_FRAGMENT_SHADER_BIT,
    .dstAccessMask = VK_ACCESS_2_SHADER_SAMPLED_READ_BIT,
    .oldLayout     = VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL,
    .newLayout     = VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL,
    .image         = texture,
    .subresourceRange = { VK_IMAGE_ASPECT_COLOR_BIT, 0, 1, 0, 1 },
};
```

---

## 10. Queue Family Ownership Transfer (큐 패밀리 소유권 이전)

### 10.1 왜 필요한가

큐 패밀리가 다른 큐에서 리소스를 사용하려면 **소유권 이전**이 필요하다. 이는 서로 다른 큐 패밀리가 **다른 캐시 계층**을 사용할 수 있기 때문이다.

### 10.2 이전 과정

소유권 이전은 **두 단계**로 이루어진다:

1. **릴리스 (소스 큐에서)**: 버퍼/이미지 배리어에 `srcQueueFamilyIndex = 현재`, `dstQueueFamilyIndex = 대상`
2. **어콰이어 (대상 큐에서)**: 같은 배리어를 다시 기록. 두 큐 간 세마포어로 순서 보장

```c
// 큐 A (그래픽스)에서 릴리스
barrier.srcQueueFamilyIndex = graphicsFamily;
barrier.dstQueueFamilyIndex = transferFamily;
vkCmdPipelineBarrier2(cmdA, &depInfo);

// 세마포어로 A → B 순서 보장

// 큐 B (전송)에서 어콰이어
barrier.srcQueueFamilyIndex = graphicsFamily;
barrier.dstQueueFamilyIndex = transferFamily;
vkCmdPipelineBarrier2(cmdB, &depInfo);
```

> **같은 큐 패밀리면 불필요**: `srcQueueFamilyIndex == dstQueueFamilyIndex`이거나 `VK_QUEUE_FAMILY_IGNORED`를 쓰면 소유권 이전 없이 메모리 배리어만 수행한다.

---

## 동기화 흐름 요약

```
1. 프레임 시작
   └─ vkWaitForFences → 이전 프레임 GPU 완료 대기 (CPU↔GPU)

2. 이미지 획득
   └─ vkAcquireNextImageKHR → imageAvailableSemaphore 시그널

3. 커맨드 버퍼 기록
   ├─ 이미지 레이아웃 전환 (UNDEFINED → COLOR_ATTACHMENT_OPTIMAL)
   │   └─ vkCmdPipelineBarrier2 (이미지 배리어)
   ├─ 렌더링
   │   └─ vkCmdDraw* 등
   ├─ 이미지 레이아웃 전환 (COLOR_ATTACHMENT → PRESENT_SRC)
   │   └─ vkCmdPipelineBarrier2 (이미지 배리어)
   └─ 필요 시 추가 배리어

4. 큐 제출
   ├─ Wait: imageAvailableSemaphore (이미지 준비 대기)
   ├─ Signal: renderFinishedSemaphore (렌더링 완료 알림)
   └─ Signal: frameFence (CPU에게 완료 알림)

5. 프레젠트
   └─ vkQueuePresentKHR → renderFinishedSemaphore 대기 후 화면 출력
```

---

## 이 챕터에서 기억할 것

1. **동기화는 앱의 책임** — Vulkan은 자동으로 아무것도 보장하지 않는다
2. **실행 의존성 vs 메모리 의존성** — 실행 순서만으로는 부족하고, 캐시 플러시/무효화(메모리 의존성)까지 필요하다
3. **Fence = GPU→CPU**, **Semaphore = 큐↔큐**, **Barrier = 커맨드 내부**
4. **이미지 레이아웃 전환**은 이미지 메모리 배리어로 수행한다
5. **Src/Dst 스테이지+접근 마스크를 정확히 지정**하면 드라이버가 최적화할 수 있다
6. **타임라인 세마포어(1.2+)**는 바이너리 세마포어보다 유연하다 — 호스트에서도 시그널/대기 가능

---

*이 문서는 Vulkan 명세의 Synchronization and Cache Control 챕터를 한글로 요약한 것입니다.*
*세부 사항은 원본 명세를 참조하세요.*
