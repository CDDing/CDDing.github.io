---
title: "Memory Allocation (메모리 할당) — 한글 요약"
sidebar:
  label: "08. Memory Allocation"
---

> 원본: [Memory Allocation](https://docs.vulkan.org/spec/latest/chapters/memory.html)

Vulkan의 메모리 관리는 **앱이 직접** 해야 한다. 드라이버가 알아서 해주는 OpenGL과 달리, Vulkan은 어떤 힙에서 어떤 유형의 메모리를 얼마나 할당할지, 매핑은 어떻게 할지를 앱이 명시적으로 결정한다. 이 챕터는 호스트 메모리, 디바이스 메모리, 매핑, 외부 메모리까지 Vulkan 메모리 시스템 전체를 다룬다.

---

## 1. 호스트 메모리 (Host Memory)

### 1.1 개요

**호스트 메모리**는 GPU가 접근하는 메모리가 아니라, Vulkan 구현체(드라이버)가 **내부적으로 사용하는 CPU 측 메모리**다. `pAllocator` 콜백을 통해 앱이 직접 메모리 할당 전략을 제어할 수 있다.

### 1.2 VkAllocationCallbacks

```c
typedef struct VkAllocationCallbacks {
    void*                                   pUserData;
    PFN_vkAllocationFunction                pfnAllocation;
    PFN_vkReallocationFunction              pfnReallocation;
    PFN_vkFreeFunction                      pfnFree;
    PFN_vkInternalAllocationNotification    pfnInternalAllocation;
    PFN_vkInternalFreeNotification          pfnInternalFree;
} VkAllocationCallbacks;
```

| 콜백 | 시그니처 요약 | 역할 |
|------|-------------|------|
| `pfnAllocation` | `(pUserData, size, alignment, scope) → void*` | 메모리 할당 |
| `pfnReallocation` | `(pUserData, pOriginal, size, alignment, scope) → void*` | 재할당 |
| `pfnFree` | `(pUserData, pMemory) → void` | 해제 (NULL 안전해야 함) |
| `pfnInternalAllocation` | 알림 전용 | 내부 실행 가능 메모리 할당 통보 |
| `pfnInternalFree` | 알림 전용 | 내부 메모리 해제 통보 |

### 1.3 할당 범위 (VkSystemAllocationScope)

| 값 | 수명 |
|----|------|
| `VK_SYSTEM_ALLOCATION_SCOPE_COMMAND` | 단일 커맨드 실행 동안 |
| `VK_SYSTEM_ALLOCATION_SCOPE_OBJECT` | 연결된 Vulkan 객체 수명 동안 |
| `VK_SYSTEM_ALLOCATION_SCOPE_CACHE` | `VkPipelineCache` 수명 동안 |
| `VK_SYSTEM_ALLOCATION_SCOPE_DEVICE` | `VkDevice` 수명 동안 |
| `VK_SYSTEM_ALLOCATION_SCOPE_INSTANCE` | `VkInstance` 수명 동안 |

> **핵심 규칙**:
> - 할당 콜백 내부에서 Vulkan 커맨드를 호출하면 안 된다
> - 생성 시 `pAllocator`를 넘겼으면 파괴 시에도 **호환되는 할당자**를 넘겨야 한다
> - `pfnInternalAllocation`과 `pfnInternalFree`는 둘 다 NULL이거나 둘 다 non-NULL

---

## 2. 디바이스 메모리 속성

### 2.1 메모리 속성 조회

```c
void vkGetPhysicalDeviceMemoryProperties(
    VkPhysicalDevice                        physicalDevice,
    VkPhysicalDeviceMemoryProperties*       pMemoryProperties);
```

Vulkan 1.1부터는 `vkGetPhysicalDeviceMemoryProperties2`로 확장 구조체 체이닝이 가능하다.

### 2.2 VkPhysicalDeviceMemoryProperties

```c
typedef struct VkPhysicalDeviceMemoryProperties {
    uint32_t        memoryTypeCount;
    VkMemoryType    memoryTypes[VK_MAX_MEMORY_TYPES];   // 최대 32개
    uint32_t        memoryHeapCount;
    VkMemoryHeap    memoryHeaps[VK_MAX_MEMORY_HEAPS];   // 최대 16개
} VkPhysicalDeviceMemoryProperties;
```

```
#define VK_MAX_MEMORY_TYPES  32U
#define VK_MAX_MEMORY_HEAPS  16U
```

구조를 그림으로 보면:

```
┌─────────────────────────────────────────────────────┐
│  VkPhysicalDeviceMemoryProperties                   │
│                                                     │
│  memoryHeaps[]                 memoryTypes[]        │
│  ┌──────────────────┐         ┌──────────────────┐  │
│  │ Heap 0 (VRAM)    │◄────────│ Type 0: LOCAL    │  │
│  │ size: 8GB        │◄────────│ Type 1: LOCAL+   │  │
│  │ DEVICE_LOCAL     │         │        HOST_VIS  │  │
│  ├──────────────────┤         ├──────────────────┤  │
│  │ Heap 1 (시스템RAM)│◄────────│ Type 2: HOST_VIS │  │
│  │ size: 16GB       │◄────────│ Type 3: HOST_VIS+│  │
│  │ (플래그 없음)     │         │        COHERENT  │  │
│  └──────────────────┘         └──────────────────┘  │
│                                                     │
│  각 Type은 heapIndex로 Heap을 참조                    │
└─────────────────────────────────────────────────────┘
```

### 2.3 메모리 힙 (VkMemoryHeap)

```c
typedef struct VkMemoryHeap {
    VkDeviceSize        size;
    VkMemoryHeapFlags   flags;
} VkMemoryHeap;
```

| 플래그 | 의미 |
|--------|------|
| `VK_MEMORY_HEAP_DEVICE_LOCAL_BIT` | GPU에 물리적으로 가까운 힙 (VRAM) |
| `VK_MEMORY_HEAP_MULTI_INSTANCE_BIT` | 멀티 GPU에서 디바이스별 복사본 존재 |

### 2.4 메모리 유형 (VkMemoryType)

```c
typedef struct VkMemoryType {
    VkMemoryPropertyFlags   propertyFlags;
    uint32_t                heapIndex;
} VkMemoryType;
```

| 속성 플래그 | 의미 |
|------------|------|
| `DEVICE_LOCAL_BIT` | GPU 접근에 최적 (VRAM) |
| `HOST_VISIBLE_BIT` | CPU에서 매핑 가능 |
| `HOST_COHERENT_BIT` | 매핑 시 캐시 플러시/무효화 불필요 |
| `HOST_CACHED_BIT` | CPU 캐시에 올라감 (읽기 빠름) |
| `LAZILY_ALLOCATED_BIT` | 실제 사용 시에만 물리 메모리 할당 |
| `PROTECTED_BIT` | 보호된 큐에서만 접근 가능 |

> **실무 팁**: 일반적인 데스크탑 GPU(디스크리트)에서 흔히 보이는 조합:
>
> | 유형 | 용도 |
> |------|------|
> | `DEVICE_LOCAL` | GPU 전용 버퍼/이미지 (가장 빠름) |
> | `HOST_VISIBLE + HOST_COHERENT` | 스테이징 버퍼 (CPU→GPU 업로드) |
> | `DEVICE_LOCAL + HOST_VISIBLE + HOST_COHERENT` | ReBAR / SAM (CPU에서 직접 VRAM 접근) |
> | `HOST_VISIBLE + HOST_CACHED` | GPU→CPU 리드백 (비일관적, invalidate 필요) |

### 2.5 명세가 보장하는 것

- `HOST_VISIBLE_BIT | HOST_COHERENT_BIT` 조합의 메모리 유형이 **최소 하나** 존재
- `DEVICE_LOCAL_BIT` 메모리 유형이 **최소 하나** 존재
- 메모리 유형은 속성 부분 집합 관계로 정렬되어 있음 (낮은 인덱스가 더 적은 플래그)

---

## 3. 디바이스 메모리 할당

### 3.1 vkAllocateMemory

```c
VkResult vkAllocateMemory(
    VkDevice                        device,
    const VkMemoryAllocateInfo*     pAllocateInfo,
    const VkAllocationCallbacks*    pAllocator,
    VkDeviceMemory*                 pMemory);
```

```c
typedef struct VkMemoryAllocateInfo {
    VkStructureType     sType;
    const void*         pNext;
    VkDeviceSize        allocationSize;
    uint32_t            memoryTypeIndex;
} VkMemoryAllocateInfo;
```

| 반환값 | 의미 |
|--------|------|
| `VK_SUCCESS` | 성공 |
| `VK_ERROR_OUT_OF_DEVICE_MEMORY` | VRAM 부족 |
| `VK_ERROR_OUT_OF_HOST_MEMORY` | 시스템 RAM 부족 |
| `VK_ERROR_INVALID_EXTERNAL_HANDLE` | 외부 핸들 잘못됨 |

> **핵심 제약**:
> - `allocationSize` ≤ 해당 힙의 `size`
> - `memoryTypeIndex` < `memoryTypeCount`
> - 동시 할당 수는 `maxMemoryAllocationCount` 이하 (보통 4096)
> - 단일 할당 최대 크기: `VkPhysicalDeviceMaintenance3Properties::maxMemoryAllocationSize`

### 3.2 vkFreeMemory

```c
void vkFreeMemory(
    VkDevice                        device,
    VkDeviceMemory                  memory,
    const VkAllocationCallbacks*    pAllocator);
```

- 해제 전에 해당 메모리를 사용하는 모든 리소스를 먼저 **언바인딩/파괴**해야 한다
- 매핑된 상태에서 해제하면 자동으로 언맵된다
- 할당 시 `pAllocator`를 넘겼으면 해제 시에도 호환 가능한 할당자를 넘겨야 한다

### 3.3 메모리 할당 횟수를 최소화하라

> **실무 팁**: `maxMemoryAllocationCount`가 4096인 GPU가 많다. 리소스마다 개별 할당하면 금방 한계에 도달한다. **큰 덩어리를 할당하고 서브 할당(sub-allocation)하는 것이 정석**이다. [Vulkan Memory Allocator (VMA)](https://github.com/GPUOpen-LibrariesAndSDKs/VulkanMemoryAllocator) 라이브러리 사용을 강력 추천한다.

---

## 4. 메모리 유형 선택 전략

### 4.1 선택 알고리즘

```c
// 명세에서 제공하는 예제 알고리즘
int32_t findMemoryType(
    const VkPhysicalDeviceMemoryProperties* props,
    uint32_t                                memoryTypeBits,
    VkMemoryPropertyFlags                   requiredFlags)
{
    for (uint32_t i = 0; i < props->memoryTypeCount; ++i) {
        if ((memoryTypeBits & (1 << i)) &&
            (props->memoryTypes[i].propertyFlags & requiredFlags) == requiredFlags)
            return i;
    }
    return -1;  // 적합한 메모리 유형 없음
}
```

### 4.2 사용 흐름

```
1. vkCreateBuffer / vkCreateImage
   ↓
2. vkGetBufferMemoryRequirements / vkGetImageMemoryRequirements
   → memoryTypeBits (사용 가능한 메모리 유형 비트마스크)
   → size, alignment
   ↓
3. findMemoryType(props, memoryTypeBits, 원하는 속성 플래그)
   → memoryTypeIndex
   ↓
4. vkAllocateMemory(device, &allocInfo, ...)
   ↓
5. vkBindBufferMemory / vkBindImageMemory
```

> **실무 팁**: 원하는 속성을 **한 번에 다 요구하지 말고 폴백 전략**을 쓰자:
>
> 1. 먼저 `DEVICE_LOCAL | HOST_VISIBLE | HOST_COHERENT` 시도 (ReBAR)
> 2. 실패하면 `DEVICE_LOCAL`만 시도 + 별도 스테이징 버퍼

---

## 5. 디바이스 메모리 매핑

### 5.1 vkMapMemory

```c
VkResult vkMapMemory(
    VkDevice            device,
    VkDeviceMemory      memory,
    VkDeviceSize        offset,
    VkDeviceSize        size,       // VK_WHOLE_SIZE 가능
    VkMemoryMapFlags    flags,
    void**              ppData);
```

- `HOST_VISIBLE_BIT`이 있는 메모리만 매핑 가능
- **하나의 메모리 객체에 동시에 하나의 매핑만** 가능 (같은 메모리를 두 번 매핑 불가)
- `VK_WHOLE_SIZE`를 쓰면 `offset`부터 할당 끝까지 전체 매핑

> **Persistent Mapping**: `vkMapMemory`로 매핑한 뒤 `vkUnmapMemory`를 호출하지 않고 **앱 전체 수명 동안 유지**할 수 있다. 매핑된 상태에서도 GPU가 해당 메모리를 사용할 수 있다 (적절한 동기화 필요).

### 5.2 vkUnmapMemory

```c
void vkUnmapMemory(
    VkDevice        device,
    VkDeviceMemory  memory);
```

### 5.3 일관성(Coherency)과 캐시 관리

`HOST_COHERENT_BIT`이 **있는** 메모리는 CPU가 쓴 값이 자동으로 GPU에 보이고, GPU가 쓴 값이 자동으로 CPU에 보인다. 플러시/무효화 불필요.

`HOST_COHERENT_BIT`이 **없는** 메모리는 수동으로 캐시를 관리해야 한다:

```c
// CPU → GPU: 쓴 후 플러시
VkResult vkFlushMappedMemoryRanges(
    VkDevice                    device,
    uint32_t                    memoryRangeCount,
    const VkMappedMemoryRange*  pMemoryRanges);

// GPU → CPU: 읽기 전 무효화
VkResult vkInvalidateMappedMemoryRanges(
    VkDevice                    device,
    uint32_t                    memoryRangeCount,
    const VkMappedMemoryRange*  pMemoryRanges);
```

```c
typedef struct VkMappedMemoryRange {
    VkStructureType     sType;
    const void*         pNext;
    VkDeviceMemory      memory;
    VkDeviceSize        offset;
    VkDeviceSize        size;       // VK_WHOLE_SIZE 가능
} VkMappedMemoryRange;
```

### 5.4 비일관적 원자 크기 (Non-Coherent Atom Size)

`vkFlushMappedMemoryRanges`와 `vkInvalidateMappedMemoryRanges`에서 `offset`과 `size`는 `nonCoherentAtomSize`의 **배수**여야 한다 (단, `offset + size`가 할당 끝에 도달하면 예외).

```
nonCoherentAtomSize = 보통 64~256 바이트
offset: nonCoherentAtomSize의 배수
size:   nonCoherentAtomSize의 배수 (또는 VK_WHOLE_SIZE)
```

> **실무 팁**: `HOST_COHERENT_BIT` 메모리를 쓰면 플러시/무효화를 신경 쓸 필요가 없어 코드가 단순해진다. 성능상 큰 차이가 없다면 coherent 메모리를 선호하자.

### 5.5 매핑 흐름 요약

```
┌──────────────────────────────────────────────────┐
│  HOST_COHERENT 메모리                             │
│                                                  │
│  vkMapMemory → memcpy → (자동 동기화) → GPU 사용  │
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  비일관적(non-coherent) 메모리                                │
│                                                              │
│  [CPU→GPU] vkMapMemory → memcpy → vkFlush → GPU 사용        │
│  [GPU→CPU] GPU 완료 → vkInvalidate → memcpy(읽기)           │
└──────────────────────────────────────────────────────────────┘
```

---

## 6. 게으른 할당 (Lazily Allocated Memory)

`LAZILY_ALLOCATED_BIT` 메모리는 실제로 GPU가 접근할 때까지 **물리 메모리가 할당되지 않는다**. 주로 타일 기반 렌더러(모바일 GPU)에서 **프레임버퍼 어태치먼트**에 사용된다.

```c
void vkGetDeviceMemoryCommitment(
    VkDevice        device,
    VkDeviceMemory  memory,
    VkDeviceSize*   pCommittedMemoryInBytes);
```

- lazily allocated 메모리에서 실제로 커밋된(물리적으로 할당된) 바이트 수를 조회
- `LAZILY_ALLOCATED_BIT`이 아닌 메모리에서 호출하면 항상 `allocationSize` 반환
- 반환값은 근사치일 수 있다

> **실무 팁**: 모바일에서 `VK_IMAGE_USAGE_TRANSIENT_ATTACHMENT_BIT`와 `LAZILY_ALLOCATED_BIT`을 조합하면 실제 메모리 사용량을 크게 줄일 수 있다. 데스크탑에서는 이 메모리 유형이 없는 경우가 많다.

---

## 7. 메모리 힙 예산 (VK_EXT_memory_budget)

### 7.1 왜 필요한가

`VkMemoryHeap::size`는 힙의 **물리적 크기**일 뿐이다. 다른 앱이 VRAM을 사용 중이면 실제로 할당 가능한 양은 더 적다. `VK_EXT_memory_budget` 확장은 **현재 사용량과 예산**을 실시간으로 알려준다.

### 7.2 사용법

```c
typedef struct VkPhysicalDeviceMemoryBudgetPropertiesEXT {
    VkStructureType     sType;
    void*               pNext;
    VkDeviceSize        heapBudget[VK_MAX_MEMORY_HEAPS];
    VkDeviceSize        heapUsage[VK_MAX_MEMORY_HEAPS];
} VkPhysicalDeviceMemoryBudgetPropertiesEXT;
```

`vkGetPhysicalDeviceMemoryProperties2` 호출 시 `pNext`에 체이닝하면 각 힙의 예산과 현재 사용량을 얻을 수 있다.

```
heapBudget[i]: 힙 i에서 앱이 사용할 수 있는 최대 바이트
heapUsage[i]:  힙 i에서 앱이 현재 사용 중인 바이트
```

> **핵심 규칙**: `heapBudget[i]`는 시간에 따라 변한다. 프레임마다 조회하여 OOM을 방지하는 것이 좋다. `heapUsage[i] < heapBudget[i]`를 유지하도록 하자.

---

## 8. 전용 할당 (Dedicated Allocation)

### 8.1 개념

특정 리소스(이미지/버퍼)를 위한 **전용 메모리 할당**. 드라이버가 내부적으로 최적화할 수 있는 힌트를 제공한다.

### 8.2 사용법

```c
typedef struct VkMemoryDedicatedAllocateInfo {
    VkStructureType     sType;
    const void*         pNext;
    VkImage             image;      // 둘 중 하나만 non-null
    VkBuffer            buffer;     // 둘 중 하나만 non-null
} VkMemoryDedicatedAllocateInfo;
```

`VkMemoryAllocateInfo::pNext`에 체이닝하여 사용한다.

### 8.3 필요 여부 확인

```c
typedef struct VkMemoryDedicatedRequirements {
    VkStructureType     sType;
    void*               pNext;
    VkBool32            prefersDedicatedAllocation;     // 전용 할당이 더 좋을 수 있음
    VkBool32            requiresDedicatedAllocation;    // 전용 할당 필수
} VkMemoryDedicatedRequirements;
```

`vkGetBufferMemoryRequirements2` / `vkGetImageMemoryRequirements2` 호출 시 `pNext`에 체이닝하면, 해당 리소스에 전용 할당이 필요한지/권장되는지 확인할 수 있다.

> **핵심 규칙**:
> - `requiresDedicatedAllocation == VK_TRUE`이면 **반드시** 전용 할당해야 한다
> - 일부 외부 메모리 핸들 유형은 전용 할당을 **강제**한다
> - `image`와 `buffer` 중 하나만 설정해야 한다 (둘 다 `VK_NULL_HANDLE`이면 비전용)

---

## 9. 외부 메모리 (VK_KHR_external_memory)

### 9.1 개념

프로세스 간 또는 API 간에 **디바이스 메모리를 공유**하기 위한 메커니즘이다. 예: Vulkan ↔ OpenGL, Vulkan ↔ DirectX, 또는 두 Vulkan 앱 사이.

### 9.2 핸들 유형

| 핸들 유형 | 플랫폼 | 용도 |
|-----------|--------|------|
| `OPAQUE_FD` | Linux/Android | Vulkan 간 공유 |
| `OPAQUE_WIN32` | Windows | Vulkan 간 공유 |
| `D3D11_TEXTURE` | Windows | Vulkan ↔ D3D11 |
| `D3D12_HEAP` / `D3D12_RESOURCE` | Windows | Vulkan ↔ D3D12 |
| `DMA_BUF` | Linux | DRM/KMS 공유 |
| `ANDROID_HARDWARE_BUFFER` | Android | 네이티브 버퍼 공유 |
| `HOST_ALLOCATION` / `HOST_MAPPED_FOREIGN_MEMORY` | 범용 | 호스트 포인터 임포트 |

### 9.3 내보내기 (Export)

```c
typedef struct VkExportMemoryAllocateInfo {
    VkStructureType                 sType;
    const void*                     pNext;
    VkExternalMemoryHandleTypeFlags handleTypes;
} VkExportMemoryAllocateInfo;
```

`VkMemoryAllocateInfo::pNext`에 체이닝하여 할당 시 내보내기 가능하도록 설정한다.

### 9.4 가져오기 (Import)

플랫폼별 임포트 구조체를 `VkMemoryAllocateInfo::pNext`에 체이닝한다:

- `VkImportMemoryFdInfoKHR` (Linux)
- `VkImportMemoryWin32HandleInfoKHR` (Windows)
- `VkImportMemoryHostPointerInfoEXT` (호스트 포인터)
- `VkImportAndroidHardwareBufferInfoANDROID` (Android)

> **핵심 규칙**: 외부 메모리를 임포트할 때 `allocationSize`와 `memoryTypeIndex`가 원본 할당과 호환되어야 한다. 일부 핸들 유형(D3D11, D3D12)은 `allocationSize`를 무시한다.

---

## 10. 메모리 우선순위 (VK_EXT_pageable_device_local_memory)

페이지 가능한 디바이스 로컬 메모리가 지원되면, 메모리 부족 시 우선순위가 낮은 할당이 시스템 메모리로 이동될 수 있다.

```c
typedef struct VkMemoryPriorityAllocateInfoEXT {
    VkStructureType     sType;
    const void*         pNext;
    float               priority;   // 0.0 ~ 1.0
} VkMemoryPriorityAllocateInfoEXT;
```

- `priority`가 높을수록 VRAM에 남아있을 가능성이 높다
- 할당 후에도 `vkSetDeviceMemoryPriorityEXT`로 우선순위 변경 가능

---

## 이 챕터에서 기억할 것

1. **메모리 유형 선택이 핵심**: `vkGetBufferMemoryRequirements`로 가능한 유형을 확인하고, 원하는 속성 플래그를 만족하는 첫 번째 유형을 선택한다. 폴백 전략을 반드시 구현하자.

2. **할당 횟수를 최소화하라**: `maxMemoryAllocationCount`(보통 4096)를 넘기지 않도록 큰 덩어리를 할당하고 서브 할당한다. VMA 라이브러리 사용을 권장한다.

3. **HOST_COHERENT vs 비일관적 메모리**: coherent 메모리는 플러시/무효화 불필요로 간편하다. 비일관적 메모리를 쓸 때는 `nonCoherentAtomSize` 정렬을 지키고 반드시 `vkFlush`/`vkInvalidate`를 호출해야 한다.

4. **메모리 예산을 모니터링하라**: `VK_EXT_memory_budget`으로 실제 사용 가능한 VRAM을 확인하고, `heapUsage < heapBudget`을 유지하여 OOM을 방지한다.

5. **전용 할당 확인은 필수**: `VkMemoryDedicatedRequirements`를 조회하여 `requiresDedicatedAllocation`이 true이면 반드시 전용 할당해야 한다. 외부 메모리 공유 시 특히 주의.

---

*이 문서는 Vulkan 명세의 Memory Allocation 챕터를 한글로 요약한 것입니다.*
*세부 사항은 원본 명세를 참조하세요.*
