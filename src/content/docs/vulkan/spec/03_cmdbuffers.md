---
title: "Command Buffers (커맨드 버퍼) — 한글 요약"
sidebar:
  label: "03. Command Buffers"
---

> 원본: [Command Buffers](https://docs.vulkan.org/spec/latest/chapters/cmdbuffers.html)

커맨드 버퍼는 GPU가 실행할 명령을 **기록(Record)** 하는 객체다.
애플리케이션은 커맨드 버퍼에 명령을 기록한 후, 큐에 **제출(Submit)** 하여 GPU에서 실행시킨다.
이 챕터에서는 커맨드 풀(Command Pool), 커맨드 버퍼의 할당/기록/리셋/제출, 보조 커맨드 버퍼,
그리고 커맨드 버퍼의 **수명 주기(Lifecycle)** 를 다룬다.

---

## 1. Command Buffer Lifecycle (커맨드 버퍼 수명 주기)

커맨드 버퍼는 항상 다음 **5가지 상태** 중 하나에 있다:

| 상태 | 설명 |
|------|------|
| **Initial** (초기) | 할당 직후 또는 리셋 직후 상태. 기록 시작 가능 |
| **Recording** (기록 중) | `vkBeginCommandBuffer` 호출 후. `vkCmd*` 명령을 기록할 수 있음 |
| **Executable** (실행 가능) | `vkEndCommandBuffer` 호출 후. 큐에 제출할 수 있음 |
| **Pending** (대기 중) | 큐에 제출되어 GPU가 실행 중. **수정 불가** |
| **Invalid** (무효) | 참조하던 리소스가 파괴되었거나 오류 발생. 리셋 필요 |

### 상태 전이 다이어그램

<img src="/images/03_cmdbuffers/commandbuffer_lifecycle.svg" alt="Command Buffer Lifecycle" class="light-bg" />

> **vkAllocateCommandBuffers** → Initial 상태로 생성, **vkFreeCommandBuffers** → 어떤 상태에서든 해제 가능 (Pending 제외)

### 핵심 규칙

- **Pending 상태의 커맨드 버퍼는 절대 수정할 수 없다** — 리셋, 기록, 해제 모두 불가
- Pending 상태에서 실행이 완료되면 Executable 또는 Invalid 상태로 자동 전환됨
- ONE_TIME_SUBMIT_BIT로 제출된 경우, 실행 완료 후 Invalid 상태가 됨
- Invalid 상태의 커맨드 버퍼는 **리셋 또는 해제**만 가능

---

## 2. Command Pools (커맨드 풀)

커맨드 풀(VkCommandPool)은 커맨드 버퍼에 사용되는 **메모리를 관리**하는 객체다.
커맨드 버퍼는 반드시 커맨드 풀에서 할당되어야 한다.

### 2.1 커맨드 풀 생성

```c
VkResult vkCreateCommandPool(
    VkDevice                        device,
    const VkCommandPoolCreateInfo*  pCreateInfo,
    const VkAllocationCallbacks*    pAllocator,
    VkCommandPool*                  pCommandPool);
```

```c
typedef struct VkCommandPoolCreateInfo {
    VkStructureType             sType;          // VK_STRUCTURE_TYPE_COMMAND_POOL_CREATE_INFO
    const void*                 pNext;          // NULL 또는 확장 구조체
    VkCommandPoolCreateFlags    flags;          // 생성 플래그
    uint32_t                    queueFamilyIndex; // 이 풀에서 할당된 버퍼가 제출될 큐 패밀리
} VkCommandPoolCreateInfo;
```

### VkCommandPoolCreateFlagBits

| 플래그 | 설명 |
|--------|------|
| `VK_COMMAND_POOL_CREATE_TRANSIENT_BIT` | 커맨드 버퍼가 **수명이 짧다**는 힌트. 드라이버가 메모리 할당 전략을 최적화할 수 있음 |
| `VK_COMMAND_POOL_CREATE_RESET_COMMAND_BUFFER_BIT` | 개별 커맨드 버퍼의 **리셋을 허용**. 이 플래그 없이는 `vkResetCommandBuffer` 호출 불가 |
| `VK_COMMAND_POOL_CREATE_PROTECTED_BIT` | **보호 커맨드 버퍼**를 할당할 수 있음 (보호 메모리 기능 필요) |

> **실무 팁**: 매 프레임 재기록하는 경우 `TRANSIENT_BIT | RESET_COMMAND_BUFFER_BIT` 조합이 일반적이다.

### 2.2 커맨드 풀 리셋

```c
VkResult vkResetCommandPool(
    VkDevice                    device,
    VkCommandPool               commandPool,
    VkCommandPoolResetFlags     flags);
```

- 풀에서 할당된 **모든 커맨드 버퍼를 Initial 상태로** 되돌린다
- Pending 상태의 커맨드 버퍼가 있으면 **호출 불가**
- `VK_COMMAND_POOL_RESET_RELEASE_RESOURCES_BIT` 플래그를 주면 메모리를 풀에 반환

> 개별 커맨드 버퍼를 리셋하는 것보다 **풀 전체를 리셋하는 것이 효율적**이다.

### 2.3 커맨드 풀 트리밍 (Trimming)

```c
void vkTrimCommandPool(
    VkDevice        device,
    VkCommandPool   commandPool,
    VkCommandPoolTrimFlags flags);  // 현재 예약됨, 0 전달
```

- 사용하지 않는 메모리를 **시스템에 반환**한다
- 커맨드 버퍼를 많이 할당했다가 리셋한 후, 남는 메모리를 줄이고 싶을 때 유용
- 성능에 미치는 영향은 구현체마다 다름

### 2.4 커맨드 풀 파괴

```c
void vkDestroyCommandPool(
    VkDevice                        device,
    VkCommandPool                   commandPool,
    const VkAllocationCallbacks*    pAllocator);
```

- 풀을 파괴하면 **할당된 모든 커맨드 버퍼도 함께 해제**된다
- Pending 상태의 커맨드 버퍼가 있으면 **호출 불가**

---

## 3. Command Buffer Allocation (커맨드 버퍼 할당)

### 3.1 할당

```c
VkResult vkAllocateCommandBuffers(
    VkDevice                            device,
    const VkCommandBufferAllocateInfo*  pAllocateInfo,
    VkCommandBuffer*                    pCommandBuffers);
```

```c
typedef struct VkCommandBufferAllocateInfo {
    VkStructureType         sType;              // VK_STRUCTURE_TYPE_COMMAND_BUFFER_ALLOCATE_INFO
    const void*             pNext;              // NULL 또는 확장 구조체
    VkCommandPool           commandPool;        // 할당할 풀
    VkCommandBufferLevel    level;              // PRIMARY 또는 SECONDARY
    uint32_t                commandBufferCount; // 할당할 개수
} VkCommandBufferAllocateInfo;
```

### VkCommandBufferLevel

| 레벨 | 설명 |
|------|------|
| `VK_COMMAND_BUFFER_LEVEL_PRIMARY` | **기본 커맨드 버퍼**. 큐에 직접 제출 가능. 보조 커맨드 버퍼를 실행할 수 있음 |
| `VK_COMMAND_BUFFER_LEVEL_SECONDARY` | **보조 커맨드 버퍼**. 큐에 직접 제출 **불가**. 기본 커맨드 버퍼 안에서 실행됨 |

> **중요**: 할당 중 하나라도 실패하면 구현체는 성공적으로 할당된 모든 커맨드 버퍼를 해제하고,
> `pCommandBuffers` 배열의 모든 항목을 `NULL`로 설정한 뒤 에러를 반환해야 한다.

### 3.2 해제

```c
void vkFreeCommandBuffers(
    VkDevice                device,
    VkCommandPool           commandPool,
    uint32_t                commandBufferCount,
    const VkCommandBuffer*  pCommandBuffers);
```

- 해제된 커맨드 버퍼의 메모리는 풀에 반환된다
- Recording 또는 Executable 상태인 **기본 커맨드 버퍼**가 해제된 보조 커맨드 버퍼를 포함하고 있었다면, 해당 기본 커맨드 버퍼는 **Invalid 상태**가 된다
- `pCommandBuffers`에 `NULL` 핸들이 포함될 수 있으며, 무시된다

---

## 4. Command Buffer Recording (커맨드 버퍼 기록)

### 4.1 기록 시작

```c
VkResult vkBeginCommandBuffer(
    VkCommandBuffer                 commandBuffer,
    const VkCommandBufferBeginInfo* pBeginInfo);
```

```c
typedef struct VkCommandBufferBeginInfo {
    VkStructureType                     sType;              // VK_STRUCTURE_TYPE_COMMAND_BUFFER_BEGIN_INFO
    const void*                         pNext;              // NULL 또는 확장 구조체
    VkCommandBufferUsageFlags           flags;              // 사용 플래그
    const VkCommandBufferInheritanceInfo* pInheritanceInfo; // 보조 커맨드 버퍼용 상속 정보
} VkCommandBufferBeginInfo;
```

### VkCommandBufferUsageFlagBits

| 플래그 | 설명 |
|--------|------|
| `VK_COMMAND_BUFFER_USAGE_ONE_TIME_SUBMIT_BIT` | 이 기록는 **한 번만 제출**됨. 제출 후 다시 기록해야 사용 가능 |
| `VK_COMMAND_BUFFER_USAGE_RENDER_PASS_CONTINUE_BIT` | 보조 커맨드 버퍼가 **렌더 패스 내에서 실행**됨을 나타냄 |
| `VK_COMMAND_BUFFER_USAGE_SIMULTANEOUS_USE_BIT` | Pending 상태에서도 **다시 제출 가능**. 다른 기본 커맨드 버퍼에 여러 번 기록 가능 |

### 암묵적 리셋(Implicit Reset)

`VK_COMMAND_POOL_CREATE_RESET_COMMAND_BUFFER_BIT`으로 생성된 풀에서 할당된 커맨드 버퍼가
**Executable 또는 Invalid 상태**일 때 `vkBeginCommandBuffer`를 호출하면,
커맨드 버퍼가 **암묵적으로 리셋**된 후 기록 상태로 전환된다.

> **주의**: 이 플래그 없이 Executable 상태에서 `vkBeginCommandBuffer`를 호출하면 **오류**다.

### 4.2 기록 종료

```c
VkResult vkEndCommandBuffer(
    VkCommandBuffer commandBuffer);
```

- Recording 상태에서 **Executable 상태**로 전환
- 오류가 발생하면 **Invalid 상태**로 전환될 수 있음
- 호출 전 조건:
  - 모든 활성 쿼리가 **종료**되어야 함
  - 활성 렌더 패스 인스턴스가 **없어야** 함 (기본 커맨드 버퍼의 경우)
  - 조건부 렌더링이 **활성 상태가 아니어야** 함

### 4.3 커맨드 버퍼 리셋

```c
VkResult vkResetCommandBuffer(
    VkCommandBuffer             commandBuffer,
    VkCommandBufferResetFlags   flags);
```

| 플래그 | 설명 |
|--------|------|
| `VK_COMMAND_BUFFER_RESET_RELEASE_RESOURCES_BIT` | 커맨드 버퍼가 보유한 리소스를 **풀에 반환** |

- 커맨드 버퍼를 **Initial 상태**로 되돌린다
- 풀이 `VK_COMMAND_POOL_CREATE_RESET_COMMAND_BUFFER_BIT`으로 생성되어야만 호출 가능
- Pending 상태에서는 **호출 불가**

> **기억**: 리셋 후에는 이전에 기록된 명령이 참조하던 리소스에 구현체가 더 이상 접근하지 않는다.

---

## 5. Command Buffer Submission (커맨드 버퍼 제출)

커맨드 버퍼는 **큐에 제출**되어야 GPU에서 실행된다.

### 5.1 vkQueueSubmit

```c
VkResult vkQueueSubmit(
    VkQueue                 queue,          // 제출 대상 큐
    uint32_t                submitCount,    // pSubmits 배열의 크기
    const VkSubmitInfo*     pSubmits,       // 제출 정보 배열
    VkFence                 fence);         // 모든 제출 완료 시 시그널할 펜스 (선택)
```

```c
typedef struct VkSubmitInfo {
    VkStructureType                sType;                    // VK_STRUCTURE_TYPE_SUBMIT_INFO
    const void*                    pNext;                    // NULL 또는 확장 구조체
    uint32_t                       waitSemaphoreCount;       // 대기할 세마포어 수
    const VkSemaphore*             pWaitSemaphores;          // 대기할 세마포어 배열
    const VkPipelineStageFlags*    pWaitDstStageMask;        // 각 세마포어가 차단할 파이프라인 스테이지
    uint32_t                       commandBufferCount;       // 실행할 커맨드 버퍼 수
    const VkCommandBuffer*         pCommandBuffers;          // 실행할 커맨드 버퍼 배열
    uint32_t                       signalSemaphoreCount;     // 시그널할 세마포어 수
    const VkSemaphore*             pSignalSemaphores;        // 완료 시 시그널할 세마포어 배열
} VkSubmitInfo;
```

### 제출 동작 방식

1. **Wait Semaphores**: `pWaitSemaphores`에 지정된 세마포어들이 시그널될 때까지 `pWaitDstStageMask`에 해당하는 파이프라인 스테이지에서 대기
2. **Command Execution**: `pCommandBuffers`의 커맨드 버퍼들이 **순서대로** 실행 시작 (단, 내부 명령은 겹칠 수 있음)
3. **Signal Semaphores**: 모든 커맨드 버퍼 실행 완료 후 `pSignalSemaphores`의 세마포어를 시그널
4. **Fence**: 모든 제출(`pSubmits` 배열 전체)이 완료되면 `fence`를 시그널

### 5.2 vkQueueSubmit2 (Vulkan 1.3+)

Vulkan 1.3에서 추가된 향상된 제출 API:

```c
VkResult vkQueueSubmit2(
    VkQueue                     queue,
    uint32_t                    submitCount,
    const VkSubmitInfo2*        pSubmits,
    VkFence                     fence);
```

```c
typedef struct VkSubmitInfo2 {
    VkStructureType                     sType;                  // VK_STRUCTURE_TYPE_SUBMIT_INFO_2
    const void*                         pNext;
    VkSubmitFlags                       flags;
    uint32_t                            waitSemaphoreInfoCount;
    const VkSemaphoreSubmitInfo*        pWaitSemaphoreInfos;    // 세마포어+스테이지를 하나로 묶음
    uint32_t                            commandBufferInfoCount;
    const VkCommandBufferSubmitInfo*    pCommandBufferInfos;
    uint32_t                            signalSemaphoreInfoCount;
    const VkSemaphoreSubmitInfo*        pSignalSemaphoreInfos;
} VkSubmitInfo2;
```

```c
typedef struct VkCommandBufferSubmitInfo {
    VkStructureType     sType;              // VK_STRUCTURE_TYPE_COMMAND_BUFFER_SUBMIT_INFO
    const void*         pNext;
    VkCommandBuffer     commandBuffer;      // 실행할 커맨드 버퍼
    uint32_t            deviceMask;         // 멀티 디바이스 환경에서 실행 대상 디바이스 마스크
} VkCommandBufferSubmitInfo;
```

> `vkQueueSubmit2`는 `vkQueueSubmit`보다 **구조적으로 더 명확**하다. 특히 세마포어의 파이프라인 스테이지 정보가 세마포어 자체에 포함되어 혼동이 줄어든다.

### 제출 순서 보장

- 같은 큐에 대한 여러 `vkQueueSubmit` 호출은 **호출 순서대로** 시작됨이 보장됨
- 같은 `pSubmits` 배열 내의 제출도 **배열 순서대로** 시작됨
- 그러나 **명시적 동기화 없이는** 커맨드 버퍼 내부의 명령이 겹치거나 순서가 바뀔 수 있음
- 커맨드 버퍼 경계는 추가적인 실행 순서 제약을 **부여하지 않음**

### Fence 사용

```c
// 제출 후 CPU에서 완료 대기 예시
vkQueueSubmit(queue, 1, &submitInfo, fence);
vkWaitForFences(device, 1, &fence, VK_TRUE, UINT64_MAX);
vkResetFences(device, 1, &fence);
```

- `fence`가 `VK_NULL_HANDLE`이 아니면, 해당 배치의 **모든 제출이 완료**될 때 시그널됨
- Fence는 반드시 **unsignaled 상태**여야 함

---

## 6. Secondary Command Buffers (보조 커맨드 버퍼)

보조 커맨드 버퍼는 큐에 직접 제출할 수 없으며, **기본 커맨드 버퍼 안에서 실행**된다.
명령의 **재사용**, **멀티스레드 기록**, **렌더 패스 분할** 등에 유용하다.

### 6.1 상속 정보 (Inheritance Info)

보조 커맨드 버퍼의 기록를 시작할 때 `VkCommandBufferBeginInfo`의 `pInheritanceInfo`를 설정해야 한다:

```c
typedef struct VkCommandBufferInheritanceInfo {
    VkStructureType                 sType;              // VK_STRUCTURE_TYPE_COMMAND_BUFFER_INHERITANCE_INFO
    const void*                     pNext;              // NULL 또는 확장 구조체
    VkRenderPass                    renderPass;         // 호환 렌더 패스 (렌더 패스 내 실행 시)
    uint32_t                        subpass;            // 사용될 서브패스 인덱스
    VkFramebuffer                   framebuffer;        // 사용될 프레임버퍼 (선택, 최적화 힌트)
    VkBool32                        occlusionQueryEnable;   // 오클루전 쿼리 활성 여부
    VkQueryControlFlags             queryFlags;         // 쿼리 제어 플래그
    VkQueryPipelineStatisticFlags   pipelineStatistics; // 파이프라인 통계 쿼리 플래그
} VkCommandBufferInheritanceInfo;
```

### 동적 렌더링 상속 (Vulkan 1.3+)

동적 렌더링(`vkCmdBeginRendering`)을 사용하는 경우, `pNext` 체인에 다음 구조체를 추가한다:

```c
typedef struct VkCommandBufferInheritanceRenderingInfo {
    VkStructureType         sType;                      // VK_STRUCTURE_TYPE_COMMAND_BUFFER_INHERITANCE_RENDERING_INFO
    const void*             pNext;
    VkRenderingFlags        flags;                      // 렌더링 플래그
    uint32_t                viewMask;                   // 멀티뷰 마스크
    uint32_t                colorAttachmentCount;       // 색상 어태치먼트 수
    const VkFormat*         pColorAttachmentFormats;    // 각 색상 어태치먼트의 포맷
    VkFormat                depthAttachmentFormat;      // 깊이 어태치먼트 포맷
    VkFormat                stencilAttachmentFormat;    // 스텐실 어태치먼트 포맷
    VkSampleCountFlagBits   rasterizationSamples;      // 래스터화 샘플 수
} VkCommandBufferInheritanceRenderingInfo;
```

### 6.2 보조 커맨드 버퍼 실행

```c
void vkCmdExecuteCommands(
    VkCommandBuffer     commandBuffer,          // 기본 커맨드 버퍼
    uint32_t            commandBufferCount,     // 실행할 보조 버퍼 수
    const VkCommandBuffer* pCommandBuffers);    // 보조 커맨드 버퍼 배열
```

### 실행 규칙

- `commandBuffer`는 반드시 **기본(PRIMARY) 커맨드 버퍼**여야 한다
- `pCommandBuffers`는 반드시 **보조(SECONDARY) 커맨드 버퍼**여야 한다
- 보조 커맨드 버퍼는 **Executable 상태**여야 한다 (Pending이면 안 됨)

### 상태 상속

> **핵심**: 기본 커맨드 버퍼와 보조 커맨드 버퍼 사이에, 또는 보조 커맨드 버퍼끼리 **상태 상속이 없다**.
> 커맨드 버퍼가 기록를 시작하면 해당 버퍼의 모든 상태는 **undefined(미정의)** 이다.

예외 상황:

- **렌더 패스 상태**: 기본 커맨드 버퍼가 렌더 패스 안에 있으면, 보조 커맨드 버퍼 실행 후에도 렌더 패스/서브패스 상태는 유지됨
- **뷰포트/시저 상속**: `VkCommandBufferInheritanceViewportScissorInfoNV`로 뷰포트/시저 상태 상속 가능 (NV 확장)

### 렌더 패스 내 실행

렌더 패스 안에서 보조 커맨드 버퍼를 실행할 때:

1. 보조 커맨드 버퍼는 `VK_COMMAND_BUFFER_USAGE_RENDER_PASS_CONTINUE_BIT`으로 기록되어야 함
2. `VkCommandBufferInheritanceInfo`에 **호환 가능한 렌더 패스**와 **서브패스 인덱스**가 지정되어야 함
3. `framebuffer`을 지정하면 구현체가 최적화에 활용할 수 있음 (필수는 아님)

### 보조 커맨드 버퍼의 수명 관계

- 보조 커맨드 버퍼가 **Invalid 상태**가 되면, 이를 포함하는 기본 커맨드 버퍼도 **Invalid 상태**가 된다
- 기본 커맨드 버퍼를 리셋하거나 해제하면, 보조 커맨드 버퍼와의 **수명 연결이 해제**됨

---

## 7. 스레딩 모델과 커맨드 풀

커맨드 풀과 커맨드 버퍼는 **Externally Synchronized** 리소스다.
여러 스레드에서 동시에 같은 커맨드 풀이나 커맨드 버퍼에 접근하는 것은 **금지**된다.

### 멀티스레드 기록 패턴

```
스레드 0: CommandPool_0 → CommandBuffer_0 (기록)
스레드 1: CommandPool_1 → CommandBuffer_1 (기록)
스레드 2: CommandPool_2 → CommandBuffer_2 (기록)

         ↓ 모든 기록 완료 후

메인 스레드: vkQueueSubmit(queue, ...)  ← 모든 커맨드 버퍼를 한 번에 제출
```

> **실무 팁**: 스레드마다 별도의 커맨드 풀을 사용하면 동기화 없이 병렬 기록가 가능하다.
> 이것이 Vulkan이 멀티스레딩에 강한 핵심 이유 중 하나다.

---

## 8. 일반적인 사용 패턴

### 8.1 매 프레임 재기록 (Transient)

```c
// 1. 커맨드 풀 생성 (한 번만)
VkCommandPoolCreateInfo poolInfo = {
    .sType = VK_STRUCTURE_TYPE_COMMAND_POOL_CREATE_INFO,
    .flags = VK_COMMAND_POOL_CREATE_TRANSIENT_BIT
           | VK_COMMAND_POOL_CREATE_RESET_COMMAND_BUFFER_BIT,
    .queueFamilyIndex = graphicsQueueFamily
};
vkCreateCommandPool(device, &poolInfo, NULL, &commandPool);

// 2. 커맨드 버퍼 할당 (한 번만)
VkCommandBufferAllocateInfo allocInfo = {
    .sType = VK_STRUCTURE_TYPE_COMMAND_BUFFER_ALLOCATE_INFO,
    .commandPool = commandPool,
    .level = VK_COMMAND_BUFFER_LEVEL_PRIMARY,
    .commandBufferCount = 1
};
vkAllocateCommandBuffers(device, &allocInfo, &commandBuffer);

// 3. 매 프레임 반복
vkResetCommandBuffer(commandBuffer, 0);  // 또는 vkResetCommandPool

VkCommandBufferBeginInfo beginInfo = {
    .sType = VK_STRUCTURE_TYPE_COMMAND_BUFFER_BEGIN_INFO,
    .flags = VK_COMMAND_BUFFER_USAGE_ONE_TIME_SUBMIT_BIT
};
vkBeginCommandBuffer(commandBuffer, &beginInfo);

// ... 드로우 콜, 디스패치 등 기록 ...

vkEndCommandBuffer(commandBuffer);

VkSubmitInfo submitInfo = {
    .sType = VK_STRUCTURE_TYPE_SUBMIT_INFO,
    .commandBufferCount = 1,
    .pCommandBuffers = &commandBuffer
};
vkQueueSubmit(graphicsQueue, 1, &submitInfo, fence);
```

### 8.2 보조 커맨드 버퍼를 활용한 병렬 기록

```c
// 각 스레드에서 보조 커맨드 버퍼를 기록
VkCommandBufferBeginInfo beginInfo = {
    .sType = VK_STRUCTURE_TYPE_COMMAND_BUFFER_BEGIN_INFO,
    .flags = VK_COMMAND_BUFFER_USAGE_RENDER_PASS_CONTINUE_BIT
           | VK_COMMAND_BUFFER_USAGE_ONE_TIME_SUBMIT_BIT,
    .pInheritanceInfo = &inheritanceInfo  // 렌더 패스, 서브패스, 프레임버퍼 정보
};
vkBeginCommandBuffer(secondaryCmd, &beginInfo);
// ... 드로우 콜 기록 ...
vkEndCommandBuffer(secondaryCmd);

// 기본 커맨드 버퍼에서 보조 커맨드 버퍼들 실행
vkCmdBeginRenderPass(primaryCmd, &rpBeginInfo, VK_SUBPASS_CONTENTS_SECONDARY_COMMAND_BUFFERS);
vkCmdExecuteCommands(primaryCmd, secondaryCount, secondaryCmds);
vkCmdEndRenderPass(primaryCmd);
```

---

## 빠른 참조 표

### 커맨드 버퍼 상태별 허용 동작

| 동작 | Initial | Recording | Executable | Pending | Invalid |
|------|---------|-----------|------------|---------|---------|
| `vkBeginCommandBuffer` | O | - | O* | - | O* |
| `vkCmd*` (기록) | - | O | - | - | - |
| `vkEndCommandBuffer` | - | O | - | - | - |
| `vkResetCommandBuffer` | O | O | O | - | O |
| `vkQueueSubmit` | - | - | O | - | - |
| `vkFreeCommandBuffers` | O | O | O | - | O |

\* `RESET_COMMAND_BUFFER_BIT` 플래그로 생성된 풀에서만 가능 (암묵적 리셋)

### 주요 API 함수 요약

| 함수 | 용도 |
|------|------|
| `vkCreateCommandPool` | 커맨드 풀 생성 |
| `vkDestroyCommandPool` | 커맨드 풀 파괴 (할당된 버퍼 모두 해제) |
| `vkResetCommandPool` | 풀 내 모든 버퍼를 Initial 상태로 |
| `vkTrimCommandPool` | 미사용 메모리 반환 |
| `vkAllocateCommandBuffers` | 커맨드 버퍼 할당 |
| `vkFreeCommandBuffers` | 커맨드 버퍼 해제 |
| `vkBeginCommandBuffer` | 기록 시작 |
| `vkEndCommandBuffer` | 기록 종료 |
| `vkResetCommandBuffer` | 개별 버퍼 리셋 |
| `vkQueueSubmit` / `vkQueueSubmit2` | 큐에 제출 |
| `vkCmdExecuteCommands` | 보조 커맨드 버퍼 실행 |

---

## 이 챕터에서 기억할 것

1. **커맨드 버퍼는 5가지 상태를 가진다** — Initial, Recording, Executable, Pending, Invalid. Pending 상태에서는 아무것도 할 수 없으며, 실행 완료를 기다려야 한다.

2. **커맨드 풀은 스레드별로 분리하라** — 커맨드 풀과 커맨드 버퍼는 외부 동기화(Externally Synchronized) 대상이므로, 멀티스레드 기록 시 스레드마다 별도의 풀을 사용해야 한다.

3. **기본 vs 보조 커맨드 버퍼를 구분하라** — 기본(PRIMARY)은 큐에 직접 제출, 보조(SECONDARY)는 기본 안에서 `vkCmdExecuteCommands`로 실행. 보조 커맨드 버퍼는 병렬 기록와 명령 재사용에 핵심이다.

4. **상태 상속은 없다** — 커맨드 버퍼 간에 파이프라인, 디스크립터 셋 등의 상태가 전달되지 않는다. 각 커맨드 버퍼는 기록 시작 시 모든 상태가 미정의(undefined)이다.

5. **제출 순서 vs 실행 순서를 혼동하지 마라** — `vkQueueSubmit` 호출 순서대로 시작은 보장되지만, 내부 명령의 실행 순서는 **보장되지 않는다**. 명시적 동기화(세마포어, 배리어 등)가 반드시 필요하다.

---

*이 문서는 Vulkan 명세의 Command Buffers 챕터를 한글로 요약한 것입니다.*
*세부 사항은 원본 명세를 참조하세요.*
