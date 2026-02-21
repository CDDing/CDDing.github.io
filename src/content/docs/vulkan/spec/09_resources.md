---
title: "Resource Creation (리소스 생성) — 한글 요약"
sidebar:
  label: "09. Resource Creation"
---

> 원본: [Resource Creation](https://docs.vulkan.org/spec/latest/chapters/resources.html)

Vulkan에서 **리소스(Resource)**는 GPU가 읽고 쓰는 데이터의 컨테이너다. 크게 **버퍼(Buffer)**와 **이미지(Image)** 두 종류가 있으며, 리소스 자체는 메모리를 소유하지 않는다. 별도의 **디바이스 메모리(VkDeviceMemory)**를 할당하고 바인딩해야 실제로 사용할 수 있다.

---

## 1. 버퍼 (VkBuffer)

버퍼는 **선형 바이트 배열**이다. 버텍스 데이터, 인덱스 데이터, 유니폼 데이터, 스토리지 데이터 등을 담는다.

### 1.1 버퍼 생성

```c
VkResult vkCreateBuffer(
    VkDevice                        device,
    const VkBufferCreateInfo*       pCreateInfo,
    const VkAllocationCallbacks*    pAllocator,
    VkBuffer*                       pBuffer);
```

```c
typedef struct VkBufferCreateInfo {
    VkStructureType     sType;
    const void*         pNext;
    VkBufferCreateFlags flags;
    VkDeviceSize        size;           // 버퍼 크기 (바이트)
    VkBufferUsageFlags  usage;          // 용도 플래그 (필수)
    VkSharingMode       sharingMode;    // 큐 패밀리 공유 모드
    uint32_t            queueFamilyIndexCount;
    const uint32_t*     pQueueFamilyIndices;
} VkBufferCreateInfo;
```

> **핵심**: `size`는 0보다 커야 하고, `usage`는 반드시 하나 이상 지정해야 한다.

### 1.2 버퍼 사용 플래그 (VkBufferUsageFlagBits)

| 플래그 | 설명 |
|--------|------|
| `VK_BUFFER_USAGE_TRANSFER_SRC_BIT` | 전송 소스로 사용 |
| `VK_BUFFER_USAGE_TRANSFER_DST_BIT` | 전송 대상으로 사용 |
| `VK_BUFFER_USAGE_UNIFORM_TEXEL_BUFFER_BIT` | 유니폼 텍셀 버퍼 (버퍼 뷰 필요) |
| `VK_BUFFER_USAGE_STORAGE_TEXEL_BUFFER_BIT` | 스토리지 텍셀 버퍼 (버퍼 뷰 필요) |
| `VK_BUFFER_USAGE_UNIFORM_BUFFER_BIT` | 유니폼 버퍼 (디스크립터 바인딩) |
| `VK_BUFFER_USAGE_STORAGE_BUFFER_BIT` | 스토리지 버퍼 (셰이더 읽기/쓰기) |
| `VK_BUFFER_USAGE_INDEX_BUFFER_BIT` | 인덱스 버퍼 |
| `VK_BUFFER_USAGE_VERTEX_BUFFER_BIT` | 버텍스 버퍼 |
| `VK_BUFFER_USAGE_INDIRECT_BUFFER_BIT` | 간접 드로우/디스패치 파라미터 |
| `VK_BUFFER_USAGE_SHADER_DEVICE_ADDRESS_BIT` | GPU 주소로 셰이더에서 접근 |

### 1.3 버퍼 생성 플래그 (VkBufferCreateFlagBits)

```c
typedef enum VkBufferCreateFlagBits {
    VK_BUFFER_CREATE_SPARSE_BINDING_BIT                 = 0x00000001,
    VK_BUFFER_CREATE_SPARSE_RESIDENCY_BIT               = 0x00000002,
    VK_BUFFER_CREATE_SPARSE_ALIASED_BIT                 = 0x00000004,
    VK_BUFFER_CREATE_PROTECTED_BIT                      = 0x00000008,
    VK_BUFFER_CREATE_DEVICE_ADDRESS_CAPTURE_REPLAY_BIT  = 0x00000010,
} VkBufferCreateFlagBits;
```

### 1.4 버퍼 파괴

```c
void vkDestroyBuffer(
    VkDevice                        device,
    VkBuffer                        buffer,
    const VkAllocationCallbacks*    pAllocator);
```

> 버퍼를 파괴하기 전에 해당 버퍼를 참조하는 모든 커맨드 버퍼 실행이 완료되어야 한다.

---

## 2. 이미지 (VkImage)

이미지는 **다차원 배열**로, 텍스처, 렌더 타겟, 깊이/스텐실 버퍼 등에 사용된다. 버퍼와 달리 **타일링(Tiling)**, **밉맵(Mip Level)**, **배열 레이어(Array Layer)**, **멀티샘플링** 등을 지원한다.

### 2.1 이미지 생성

```c
VkResult vkCreateImage(
    VkDevice                        device,
    const VkImageCreateInfo*        pCreateInfo,
    const VkAllocationCallbacks*    pAllocator,
    VkImage*                        pImage);
```

```c
typedef struct VkImageCreateInfo {
    VkStructureType       sType;
    const void*           pNext;
    VkImageCreateFlags    flags;
    VkImageType           imageType;      // 1D, 2D, 3D
    VkFormat              format;         // 픽셀 포맷
    VkExtent3D            extent;         // 너비, 높이, 깊이
    uint32_t              mipLevels;      // 밉맵 레벨 수
    uint32_t              arrayLayers;    // 배열 레이어 수
    VkSampleCountFlagBits samples;        // 멀티샘플 수
    VkImageTiling         tiling;         // 타일링 모드
    VkImageUsageFlags     usage;          // 용도 플래그
    VkSharingMode         sharingMode;    // 큐 패밀리 공유 모드
    uint32_t              queueFamilyIndexCount;
    const uint32_t*       pQueueFamilyIndices;
    VkImageLayout         initialLayout;  // 초기 레이아웃
} VkImageCreateInfo;
```

### 2.2 이미지 타입 (VkImageType)

| 타입 | 설명 | extent 제약 |
|------|------|-------------|
| `VK_IMAGE_TYPE_1D` | 1차원 이미지 | height=1, depth=1 |
| `VK_IMAGE_TYPE_2D` | 2차원 이미지 | depth=1 |
| `VK_IMAGE_TYPE_3D` | 3차원 이미지 (볼륨 텍스처) | arrayLayers=1 |

### 2.3 이미지 타일링 (VkImageTiling)

| 타일링 | 설명 |
|--------|------|
| `VK_IMAGE_TILING_OPTIMAL` | GPU 최적화 레이아웃. **대부분의 경우 이것을 사용**. CPU에서 직접 접근 불가 |
| `VK_IMAGE_TILING_LINEAR` | 행 우선(row-major) 선형 레이아웃. CPU 매핑 가능하지만 기능 제한 많음 |

> **실무 팁**: `TILING_LINEAR`는 스테이징 이미지용으로만 쓰고, 실제 렌더링/샘플링에는 반드시 `TILING_OPTIMAL`을 사용하라. 선형 타일링은 대부분의 사용 플래그와 포맷 조합을 지원하지 않는다.

### 2.4 이미지 사용 플래그 (VkImageUsageFlagBits)

| 플래그 | 설명 |
|--------|------|
| `VK_IMAGE_USAGE_TRANSFER_SRC_BIT` | 전송 소스 |
| `VK_IMAGE_USAGE_TRANSFER_DST_BIT` | 전송 대상 |
| `VK_IMAGE_USAGE_SAMPLED_BIT` | 셰이더에서 샘플링 (텍스처) |
| `VK_IMAGE_USAGE_STORAGE_BIT` | 셰이더에서 읽기/쓰기 (스토리지 이미지) |
| `VK_IMAGE_USAGE_COLOR_ATTACHMENT_BIT` | 색상 어태치먼트 (렌더 타겟) |
| `VK_IMAGE_USAGE_DEPTH_STENCIL_ATTACHMENT_BIT` | 깊이/스텐실 어태치먼트 |
| `VK_IMAGE_USAGE_TRANSIENT_ATTACHMENT_BIT` | 임시 어태치먼트 (lazy allocation 메모리 사용 가능) |
| `VK_IMAGE_USAGE_INPUT_ATTACHMENT_BIT` | 프래그먼트 셰이더 입력 어태치먼트 |

### 2.5 이미지 생성 플래그 (VkImageCreateFlagBits)

| 플래그 | 설명 |
|--------|------|
| `VK_IMAGE_CREATE_SPARSE_BINDING_BIT` | 희소 메모리 바인딩 |
| `VK_IMAGE_CREATE_SPARSE_RESIDENCY_BIT` | 희소 레지던시 (부분 바인딩) |
| `VK_IMAGE_CREATE_SPARSE_ALIASED_BIT` | 희소 메모리 앨리어싱 |
| `VK_IMAGE_CREATE_MUTABLE_FORMAT_BIT` | 이미지 뷰에서 다른 호환 포맷 사용 가능 |
| `VK_IMAGE_CREATE_CUBE_COMPATIBLE_BIT` | 큐브맵 이미지 뷰 생성 가능 (2D, arrayLayers >= 6) |
| `VK_IMAGE_CREATE_2D_ARRAY_COMPATIBLE_BIT` | 3D 이미지에서 2D 배열 뷰 생성 가능 |

### 2.6 샘플 카운트 (VkSampleCountFlagBits)

```c
typedef enum VkSampleCountFlagBits {
    VK_SAMPLE_COUNT_1_BIT  = 0x00000001,   // 멀티샘플링 없음
    VK_SAMPLE_COUNT_2_BIT  = 0x00000002,
    VK_SAMPLE_COUNT_4_BIT  = 0x00000004,
    VK_SAMPLE_COUNT_8_BIT  = 0x00000008,
    VK_SAMPLE_COUNT_16_BIT = 0x00000010,
    VK_SAMPLE_COUNT_32_BIT = 0x00000020,
    VK_SAMPLE_COUNT_64_BIT = 0x00000040,
} VkSampleCountFlagBits;
```

> 지원되는 샘플 수는 `VkPhysicalDeviceLimits`의 `framebufferColorSampleCounts`, `framebufferDepthSampleCounts` 등으로 확인한다.

### 2.7 이미지 레이아웃 (VkImageLayout)

이미지는 사용 목적에 따라 **레이아웃 전환**이 필요하다. 레이아웃은 GPU 내부 메모리 배치 방식을 결정한다.

| 레이아웃 | 용도 |
|----------|------|
| `VK_IMAGE_LAYOUT_UNDEFINED` | 초기 상태. 내용 보존 안 됨 |
| `VK_IMAGE_LAYOUT_PREINITIALIZED` | 초기 상태. CPU가 쓴 내용 보존 (LINEAR 타일링 전용) |
| `VK_IMAGE_LAYOUT_GENERAL` | 모든 용도 가능하지만 성능 최적화 없음 |
| `VK_IMAGE_LAYOUT_COLOR_ATTACHMENT_OPTIMAL` | 색상 어태치먼트 최적 |
| `VK_IMAGE_LAYOUT_DEPTH_STENCIL_ATTACHMENT_OPTIMAL` | 깊이/스텐실 어태치먼트 최적 |
| `VK_IMAGE_LAYOUT_DEPTH_STENCIL_READ_ONLY_OPTIMAL` | 깊이/스텐실 읽기 전용 최적 |
| `VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL` | 셰이더 읽기(샘플링) 최적 |
| `VK_IMAGE_LAYOUT_TRANSFER_SRC_OPTIMAL` | 전송 소스 최적 |
| `VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL` | 전송 대상 최적 |
| `VK_IMAGE_LAYOUT_PRESENT_SRC_KHR` | 화면 표시(프레젠트) 전용 |

> **핵심 규칙**: `initialLayout`에는 `UNDEFINED` 또는 `PREINITIALIZED`만 허용된다. 이미지를 처음 사용하기 전에 반드시 파이프라인 배리어로 적절한 레이아웃으로 전환해야 한다.

### 2.8 이미지 파괴

```c
void vkDestroyImage(
    VkDevice                        device,
    VkImage                         image,
    const VkAllocationCallbacks*    pAllocator);
```

---

## 3. 버퍼 뷰 (VkBufferView)

버퍼 뷰는 버퍼의 일부 범위를 **포맷이 있는 텍셀 버퍼**로 해석할 때 사용한다. 셰이더에서 `texelFetch`로 접근하려면 버퍼 뷰가 필요하다.

### 3.1 버퍼 뷰 생성

```c
VkResult vkCreateBufferView(
    VkDevice                        device,
    const VkBufferViewCreateInfo*   pCreateInfo,
    const VkAllocationCallbacks*    pAllocator,
    VkBufferView*                   pView);
```

```c
typedef struct VkBufferViewCreateInfo {
    VkStructureType         sType;
    const void*             pNext;
    VkBufferViewCreateFlags flags;
    VkBuffer                buffer;    // 대상 버퍼
    VkFormat                format;    // 텍셀 포맷
    VkDeviceSize            offset;    // 시작 오프셋 (바이트)
    VkDeviceSize            range;     // 범위 (VK_WHOLE_SIZE 가능)
} VkBufferViewCreateInfo;
```

> **전제 조건**: 대상 버퍼는 `UNIFORM_TEXEL_BUFFER_BIT` 또는 `STORAGE_TEXEL_BUFFER_BIT` 플래그로 생성되어야 한다.

### 3.2 버퍼 뷰 파괴

```c
void vkDestroyBufferView(
    VkDevice                        device,
    VkBufferView                    bufferView,
    const VkAllocationCallbacks*    pAllocator);
```

---

## 4. 이미지 뷰 (VkImageView)

이미지 자체는 셰이더에서 직접 접근할 수 없다. **이미지 뷰**를 만들어야 셰이더가 읽거나 렌더 타겟으로 사용할 수 있다. 이미지 뷰는 이미지의 특정 서브리소스 범위를 특정 형태로 해석한다.

### 4.1 이미지 뷰 생성

```c
VkResult vkCreateImageView(
    VkDevice                        device,
    const VkImageViewCreateInfo*    pCreateInfo,
    const VkAllocationCallbacks*    pAllocator,
    VkImageView*                    pView);
```

```c
typedef struct VkImageViewCreateInfo {
    VkStructureType             sType;
    const void*                 pNext;
    VkImageViewCreateFlags      flags;
    VkImage                     image;             // 대상 이미지
    VkImageViewType             viewType;          // 뷰 타입
    VkFormat                    format;            // 해석 포맷
    VkComponentMapping          components;        // RGBA 스위즐
    VkImageSubresourceRange     subresourceRange;  // 대상 서브리소스 범위
} VkImageViewCreateInfo;
```

### 4.2 이미지 뷰 타입 (VkImageViewType)

| 뷰 타입 | 호환 이미지 타입 | 설명 |
|---------|-----------------|------|
| `VK_IMAGE_VIEW_TYPE_1D` | 1D | 1차원 텍스처 |
| `VK_IMAGE_VIEW_TYPE_2D` | 2D, 3D* | 2차원 텍스처 |
| `VK_IMAGE_VIEW_TYPE_3D` | 3D | 3차원 텍스처 |
| `VK_IMAGE_VIEW_TYPE_CUBE` | 2D | 큐브맵 (6개 레이어) |
| `VK_IMAGE_VIEW_TYPE_1D_ARRAY` | 1D | 1D 텍스처 배열 |
| `VK_IMAGE_VIEW_TYPE_2D_ARRAY` | 2D, 3D* | 2D 텍스처 배열 |
| `VK_IMAGE_VIEW_TYPE_CUBE_ARRAY` | 2D | 큐브맵 배열 (6의 배수 레이어) |

> *3D 이미지에서 2D/2D_ARRAY 뷰를 만들려면 `VK_IMAGE_CREATE_2D_ARRAY_COMPATIBLE_BIT`이 필요하다.

### 4.3 컴포넌트 매핑 (VkComponentMapping)

```c
typedef struct VkComponentMapping {
    VkComponentSwizzle r;
    VkComponentSwizzle g;
    VkComponentSwizzle b;
    VkComponentSwizzle a;
} VkComponentMapping;
```

```c
typedef enum VkComponentSwizzle {
    VK_COMPONENT_SWIZZLE_IDENTITY = 0,  // 원래 값 유지
    VK_COMPONENT_SWIZZLE_ZERO     = 1,  // 0으로 대체
    VK_COMPONENT_SWIZZLE_ONE      = 2,  // 1로 대체
    VK_COMPONENT_SWIZZLE_R        = 3,  // R 채널 값 사용
    VK_COMPONENT_SWIZZLE_G        = 4,  // G 채널 값 사용
    VK_COMPONENT_SWIZZLE_B        = 5,  // B 채널 값 사용
    VK_COMPONENT_SWIZZLE_A        = 6,  // A 채널 값 사용
} VkComponentSwizzle;
```

> **실무 팁**: 단일 채널(R8) 텍스처를 RGBA로 읽고 싶다면 스위즐을 `{R, R, R, ONE}`으로 설정하면 된다. 기본값은 `IDENTITY`이므로 보통은 모두 `IDENTITY`로 두면 된다.

### 4.4 서브리소스 범위 (VkImageSubresourceRange)

```c
typedef struct VkImageSubresourceRange {
    VkImageAspectFlags aspectMask;       // 컬러, 깊이, 스텐실 등
    uint32_t           baseMipLevel;     // 시작 밉 레벨
    uint32_t           levelCount;       // 밉 레벨 수 (VK_REMAINING_MIP_LEVELS 가능)
    uint32_t           baseArrayLayer;   // 시작 배열 레이어
    uint32_t           layerCount;       // 배열 레이어 수 (VK_REMAINING_ARRAY_LAYERS 가능)
} VkImageSubresourceRange;
```

| Aspect 플래그 | 설명 |
|--------------|------|
| `VK_IMAGE_ASPECT_COLOR_BIT` | 색상 데이터 |
| `VK_IMAGE_ASPECT_DEPTH_BIT` | 깊이 데이터 |
| `VK_IMAGE_ASPECT_STENCIL_BIT` | 스텐실 데이터 |
| `VK_IMAGE_ASPECT_METADATA_BIT` | 희소 이미지 메타데이터 |

### 4.5 이미지 뷰 파괴

```c
void vkDestroyImageView(
    VkDevice                        device,
    VkImageView                     imageView,
    const VkAllocationCallbacks*    pAllocator);
```

---

## 5. 리소스 메모리 요구사항

리소스를 생성한 후, 메모리를 바인딩하기 전에 **메모리 요구사항**을 조회해야 한다.

### 5.1 버퍼 메모리 요구사항

```c
void vkGetBufferMemoryRequirements(
    VkDevice                        device,
    VkBuffer                        buffer,
    VkMemoryRequirements*           pMemoryRequirements);
```

### 5.2 이미지 메모리 요구사항

```c
void vkGetImageMemoryRequirements(
    VkDevice                        device,
    VkImage                         image,
    VkMemoryRequirements*           pMemoryRequirements);
```

### 5.3 VkMemoryRequirements 구조체

```c
typedef struct VkMemoryRequirements {
    VkDeviceSize size;            // 필요한 메모리 크기 (바이트)
    VkDeviceSize alignment;       // 정렬 요구사항 (바이트)
    uint32_t     memoryTypeBits;  // 호환 가능한 메모리 타입 비트마스크
} VkMemoryRequirements;
```

| 필드 | 의미 |
|------|------|
| `size` | 리소스가 필요로 하는 최소 메모리 크기 |
| `alignment` | 바인딩 시 오프셋이 이 값의 배수여야 함 |
| `memoryTypeBits` | 비트 i가 1이면 메모리 타입 i를 사용할 수 있음 |

> **핵심 워크플로**:
>
> 1. `vkGetBufferMemoryRequirements` / `vkGetImageMemoryRequirements`로 요구사항 조회
> 2. `memoryTypeBits`에서 원하는 속성(DEVICE_LOCAL, HOST_VISIBLE 등)을 가진 메모리 타입 선택
> 3. `vkAllocateMemory`로 메모리 할당
> 4. `vkBindBufferMemory` / `vkBindImageMemory`로 바인딩

### 5.4 확장된 메모리 요구사항 조회 (Vulkan 1.1+)

```c
void vkGetBufferMemoryRequirements2(
    VkDevice                                device,
    const VkBufferMemoryRequirementsInfo2*  pInfo,
    VkMemoryRequirements2*                  pMemoryRequirements);

void vkGetImageMemoryRequirements2(
    VkDevice                                device,
    const VkImageMemoryRequirementsInfo2*   pInfo,
    VkMemoryRequirements2*                  pMemoryRequirements);
```

> `pNext` 체인을 통해 `VkMemoryDedicatedRequirements` 등 추가 정보를 받을 수 있다. 전용 할당(Dedicated Allocation)이 권장/필수인 리소스를 식별할 때 유용하다.

---

## 6. 리소스 메모리 바인딩

리소스와 디바이스 메모리를 연결하는 과정이다. 바인딩 후에야 리소스를 실제 GPU 연산에 사용할 수 있다.

### 6.1 버퍼 메모리 바인딩

```c
VkResult vkBindBufferMemory(
    VkDevice        device,
    VkBuffer        buffer,
    VkDeviceMemory  memory,
    VkDeviceSize    memoryOffset);
```

### 6.2 이미지 메모리 바인딩

```c
VkResult vkBindImageMemory(
    VkDevice        device,
    VkImage         image,
    VkDeviceMemory  memory,
    VkDeviceSize    memoryOffset);
```

### 6.3 바인딩 규칙

| 규칙 | 설명 |
|------|------|
| **정렬** | `memoryOffset`은 `VkMemoryRequirements.alignment`의 배수여야 함 |
| **크기** | `memoryOffset + size`가 할당된 메모리 크기를 초과하면 안 됨 |
| **타입 호환** | `memoryTypeBits`에 해당 메모리 타입의 비트가 켜져 있어야 함 |
| **일회성** | 비-희소 리소스에는 메모리를 **한 번만** 바인딩할 수 있음 (재바인딩 불가) |
| **사용 전 바인딩** | 메모리가 바인딩되지 않은 리소스를 커맨드 버퍼에서 사용하면 정의되지 않은 동작 |

### 6.4 배치 바인딩 (Vulkan 1.1+)

```c
VkResult vkBindBufferMemory2(
    VkDevice                        device,
    uint32_t                        bindInfoCount,
    const VkBindBufferMemoryInfo*   pBindInfos);

VkResult vkBindImageMemory2(
    VkDevice                        device,
    uint32_t                        bindInfoCount,
    const VkBindImageMemoryInfo*    pBindInfos);
```

여러 리소스를 한 번의 호출로 바인딩할 수 있어 오버헤드를 줄인다.

---

## 7. 리소스 공유 모드

리소스를 여러 큐 패밀리에서 사용할 때의 소유권 모델이다.

### 7.1 VkSharingMode

```c
typedef enum VkSharingMode {
    VK_SHARING_MODE_EXCLUSIVE  = 0,  // 한 번에 하나의 큐 패밀리만 소유
    VK_SHARING_MODE_CONCURRENT = 1,  // 여러 큐 패밀리가 동시 접근
} VkSharingMode;
```

| 모드 | 장점 | 단점 |
|------|------|------|
| `EXCLUSIVE` | **성능 최적** — 내부적으로 동기화 오버헤드 없음 | 다른 큐 패밀리에서 쓰려면 **소유권 전환** 필요 |
| `CONCURRENT` | 여러 큐에서 자유롭게 접근 | **성능 저하** 가능 (내부 동기화 비용) |

### 7.2 큐 패밀리 소유권 전환 (Queue Family Ownership Transfer)

`EXCLUSIVE` 모드에서 다른 큐 패밀리로 리소스를 넘기려면 **파이프라인 배리어**로 소유권을 전환해야 한다:

1. **릴리스 배리어**: 원래 큐에서 `srcQueueFamilyIndex` = 현재, `dstQueueFamilyIndex` = 대상
2. **획득 배리어**: 대상 큐에서 `srcQueueFamilyIndex` = 원래, `dstQueueFamilyIndex` = 현재
3. 두 배리어는 **세마포어 등으로 순서를 보장**해야 함

> **실무 팁**: 그래픽스 큐에서 렌더링 → 프레젠트 큐에서 표시할 때 소유권 전환이 필요하다. 같은 큐 패밀리라면 전환 불필요. 큐 패밀리가 2~3개만 쓰이는 간단한 앱이라면 `CONCURRENT`가 편할 수 있지만, 성능 민감한 상황에서는 `EXCLUSIVE` + 소유권 전환이 정석이다.

---

## 8. 희소 리소스 (Sparse Resources)

일반 리소스는 메모리를 **전체에 한 번에** 바인딩해야 하지만, 희소 리소스는 메모리를 **부분적으로, 비연속적으로** 바인딩할 수 있다.

### 8.1 세 가지 희소 기능

| 기능 | 플래그 | 설명 |
|------|--------|------|
| **희소 바인딩** | `SPARSE_BINDING_BIT` | 비연속 메모리 영역에 바인딩 가능. 런타임에 재바인딩 가능 |
| **희소 레지던시** | `SPARSE_RESIDENCY_BIT` | 메모리를 전부 바인딩하지 않아도 사용 가능. 바인딩 안 된 영역은 정의된 값(0 또는 구현 의존) 반환 |
| **희소 앨리어싱** | `SPARSE_ALIASED_BIT` | 서로 다른 리소스 영역이 같은 메모리를 공유 가능 |

### 8.2 희소 리소스의 핵심 구조체

```c
typedef struct VkSparseImageFormatProperties {
    VkImageAspectFlags      aspectMask;
    VkExtent3D              imageGranularity;   // 희소 블록 크기
    VkSparseImageFormatFlags flags;
} VkSparseImageFormatProperties;
```

```c
typedef struct VkSparseMemoryBind {
    VkDeviceSize            resourceOffset;     // 리소스 내 오프셋
    VkDeviceSize            size;               // 바인딩 크기
    VkDeviceMemory          memory;             // 바인딩할 메모리 (NULL이면 언바인딩)
    VkDeviceSize            memoryOffset;       // 메모리 내 오프셋
    VkSparseMemoryBindFlags flags;
} VkSparseMemoryBind;
```

### 8.3 희소 메모리 바인딩 연산

```c
VkResult vkQueueBindSparse(
    VkQueue                     queue,
    uint32_t                    bindInfoCount,
    const VkBindSparseInfo*     pBindInfos,
    VkFence                     fence);
```

```c
typedef struct VkBindSparseInfo {
    VkStructureType                     sType;
    const void*                         pNext;
    uint32_t                            waitSemaphoreCount;
    const VkSemaphore*                  pWaitSemaphores;
    uint32_t                            bufferBindCount;
    const VkSparseBufferMemoryBindInfo* pBufferBinds;
    uint32_t                            imageOpaqueBindCount;
    const VkSparseImageOpaqueMemoryBindInfo* pImageOpaqueBinds;
    uint32_t                            imageBindCount;
    const VkSparseImageMemoryBindInfo*  pImageBinds;
    uint32_t                            signalSemaphoreCount;
    const VkSemaphore*                  pSignalSemaphores;
} VkBindSparseInfo;
```

> 희소 바인딩은 **큐 제출**로 수행되며, 세마포어로 동기화한다. 하나의 배치 안에서 같은 리소스 범위를 중복 바인딩하면 안 된다.

### 8.4 희소 리소스 활용 사례

- **가상 텍스처링 (Virtual Texturing / Megatexture)**: 거대한 텍스처를 부분적으로만 메모리에 로드
- **LOD 기반 메모리 관리**: 카메라 거리에 따라 밉맵 레벨별로 메모리 할당/해제
- **메모리 오버커밋 방지**: 실제 필요한 영역만 물리 메모리에 매핑

---

## 9. 리소스 메모리 앨리어싱 (Memory Aliasing)

하나의 메모리 영역에 **여러 리소스를 바인딩**하는 것을 메모리 앨리어싱이라 한다.

### 9.1 앨리어싱 규칙

| 조건 | 허용 여부 |
|------|----------|
| 두 리소스가 같은 메모리 범위를 공유하지만 **동시에 사용하지 않음** | 허용 (주의 필요) |
| 두 리소스가 같은 메모리 범위를 **동시에 읽기** | 허용 (선형 리소스 간, 또는 같은 메타데이터를 사용하는 경우) |
| 두 리소스가 같은 메모리 범위에서 **동시에 읽기+쓰기** | **금지** (정의되지 않은 동작) |

### 9.2 앨리어싱 활용

앨리어싱은 **메모리 절약**에 유용하다:

- **렌더 패스 내 임시 리소스**: 서브패스 A에서만 쓰는 이미지와 서브패스 B에서만 쓰는 이미지가 같은 메모리를 공유
- **프레임 간 재사용**: 이전 프레임에서 쓴 리소스의 메모리를 다음 프레임의 다른 리소스가 사용

> **핵심 규칙**: 앨리어싱된 리소스를 사용하기 전에 반드시 **메모리 배리어**로 동기화하고, 이미지라면 **레이아웃 전환**(보통 `UNDEFINED`에서 시작)을 수행해야 한다. `UNDEFINED` 전환은 이전 내용을 버리겠다는 의미이므로 앨리어싱과 잘 맞는다.

---

## 이 챕터에서 기억할 것

1. **리소스 = 메타데이터, 메모리 = 실제 데이터** — 리소스를 생성한 후 반드시 메모리를 조회(`GetMemoryRequirements`)하고, 할당하고, 바인딩해야 사용할 수 있다.

2. **이미지 타일링은 OPTIMAL이 기본** — `LINEAR`는 CPU 접근이 필요한 스테이징 용도로만 쓰고, GPU 작업에는 반드시 `OPTIMAL`을 사용한다.

3. **이미지 레이아웃 전환은 필수** — 이미지는 용도가 바뀔 때마다 파이프라인 배리어로 레이아웃을 전환해야 한다. 전환을 빠뜨리면 정의되지 않은 동작이 발생한다.

4. **비-희소 리소스는 메모리를 한 번만 바인딩** — 재바인딩이 불가능하다. 동적 메모리 관리가 필요하면 희소 리소스를 사용해야 한다.

5. **EXCLUSIVE vs CONCURRENT** — 성능이 중요하면 `EXCLUSIVE` + 소유권 전환, 편의성이 중요하면 `CONCURRENT`. 단일 큐 패밀리만 사용하면 이 선택은 의미 없다.

---

*이 문서는 Vulkan 명세의 Resource Creation 챕터를 한글로 요약한 것입니다.*
*세부 사항은 원본 명세를 참조하세요.*
