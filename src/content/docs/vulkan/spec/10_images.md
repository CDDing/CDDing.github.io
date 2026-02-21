---
title: "Image Operations (이미지 연산) — 한글 요약"
sidebar:
  label: "10. Image Operations"
---

> 원본: [Copy Commands](https://docs.vulkan.org/spec/latest/chapters/copies.html) / [Clear Commands](https://docs.vulkan.org/spec/latest/chapters/clears.html) / [Image Operations](https://docs.vulkan.org/spec/latest/chapters/images.html)

Vulkan에서 이미지 데이터를 **복사, 블릿, 리졸브, 클리어**하는 연산과, 셰이더에서 텍셀을 **읽고 쓰는** 과정, **포맷 변환** 규칙을 다룬다.
모든 복사/클리어 연산은 **전송(transfer) 연산**으로 분류되며, 동기화 시 `VK_PIPELINE_STAGE_TRANSFER_BIT`을 사용한다.

---

## 1. 텍셀 좌표 체계

이미지는 일반 버퍼와 달리 **다차원 접근**이 가능한 리소스다. 텍셀(texel)을 식별하는 데 관여하는 파라미터는 **6가지**이다:

| 차원 | 의미 | 크기 파라미터 |
|------|------|-------------|
| x, y, z | 공간 좌표 | width, height, depth |
| layer | 배열 레이어 | layers |
| sample | 멀티샘플 인덱스 | samples |
| level | 밉맵 레벨 | levels |

각 밉맵 레벨은 이전 레벨 대비 x, y, z 각 차원의 크기가 **절반**으로 줄어든다.

### 1.1 좌표 유효성 검사

이미지 접근 전에 좌표가 범위 내인지 확인한다:

```
x < width_level, y < height_level, z < depth_level
layer < layers, sample < samples, level < levels
```

범위를 벗어난 접근은 셰이더 메모리 접근 규칙을 따른다.

---

## 2. 이미지 복사 (vkCmdCopyImage)

이미지 간 텍셀 데이터를 복사한다. 스케일링이나 포맷 변환 없이 **원본 그대로** 복사된다.

```c
void vkCmdCopyImage(
    VkCommandBuffer commandBuffer,
    VkImage         srcImage,
    VkImageLayout   srcImageLayout,
    VkImage         dstImage,
    VkImageLayout   dstImageLayout,
    uint32_t        regionCount,
    const VkImageCopy* pRegions);
```

### 2.1 VkImageCopy 구조체

```c
typedef struct VkImageCopy {
    VkImageSubresourceLayers srcSubresource;
    VkOffset3D               srcOffset;
    VkImageSubresourceLayers dstSubresource;
    VkOffset3D               dstOffset;
    VkExtent3D               extent;
} VkImageCopy;
```

### 2.2 VkImageSubresourceLayers

```c
typedef struct VkImageSubresourceLayers {
    VkImageAspectFlags aspectMask;
    uint32_t           mipLevel;
    uint32_t           baseArrayLayer;
    uint32_t           layerCount;
} VkImageSubresourceLayers;
```

### 2.3 핵심 규칙

| 규칙 | 설명 |
|------|------|
| **포맷 호환성** | src/dst 포맷이 크기 호환(size-compatible)이어야 한다 |
| **샘플 수 일치** | src/dst 이미지의 샘플 수가 동일해야 한다 |
| **레이아웃** | src는 `TRANSFER_SRC_OPTIMAL` 또는 `GENERAL`, dst는 `TRANSFER_DST_OPTIMAL` 또는 `GENERAL` |
| **Usage 플래그** | src는 `TRANSFER_SRC_BIT`, dst는 `TRANSFER_DST_BIT` 필요 |
| **영역 겹침 금지** | 같은 메모리를 공유하는 src/dst 영역은 겹칠 수 없다 |
| **3D → 2D 복사** | 3D 이미지의 슬라이스를 2D 배열 레이어로 복사 가능 |

> **Vulkan 1.3**: `vkCmdCopyImage2`와 `VkCopyImageInfo2`로 확장된 버전 사용 가능. `pNext` 체인으로 확장이 용이하다.

---

## 3. 버퍼 ↔ 이미지 복사

### 3.1 vkCmdCopyBufferToImage / vkCmdCopyImageToBuffer

버퍼의 선형 데이터와 이미지의 다차원 데이터 간 복사를 수행한다. 텍스처 로딩의 핵심 연산이다.

```c
void vkCmdCopyBufferToImage(
    VkCommandBuffer    commandBuffer,
    VkBuffer           srcBuffer,
    VkImage            dstImage,
    VkImageLayout      dstImageLayout,
    uint32_t           regionCount,
    const VkBufferImageCopy* pRegions);

void vkCmdCopyImageToBuffer(
    VkCommandBuffer    commandBuffer,
    VkImage            srcImage,
    VkImageLayout      srcImageLayout,
    VkBuffer           dstBuffer,
    uint32_t           regionCount,
    const VkBufferImageCopy* pRegions);
```

### 3.2 VkBufferImageCopy 구조체

```c
typedef struct VkBufferImageCopy {
    VkDeviceSize             bufferOffset;
    uint32_t                 bufferRowLength;
    uint32_t                 bufferImageHeight;
    VkImageSubresourceLayers imageSubresource;
    VkOffset3D               imageOffset;
    VkExtent3D               imageExtent;
} VkBufferImageCopy;
```

| 필드 | 설명 |
|------|------|
| `bufferOffset` | 버퍼 내 데이터 시작 오프셋 (바이트) |
| `bufferRowLength` | 버퍼에서 한 행의 텍셀 수 (0이면 `imageExtent.width`와 동일 = 타이트 패킹) |
| `bufferImageHeight` | 버퍼에서 한 "슬라이스"의 행 수 (0이면 `imageExtent.height`와 동일) |
| `imageSubresource` | 복사 대상 이미지의 서브리소스 |
| `imageOffset` | 이미지 내 복사 시작 위치 |
| `imageExtent` | 복사할 영역 크기 |

### 3.3 버퍼 어드레싱 규칙

버퍼 내 텍셀 `(x, y, z)` 위치의 바이트 오프셋 계산 (비압축 포맷, 단순화 공식):

```
texelOffset = (z × bufferImageHeight + y) × bufferRowLength + x
byteOffset  = bufferOffset + texelOffset × texelBlockSize
```

- `bufferRowLength`와 `bufferImageHeight`가 0이면 이미지 크기에 맞춰 **타이트 패킹**(tight packing)된 것으로 간주
- `bufferRowLength ≥ imageExtent.width`, `bufferImageHeight ≥ imageExtent.height` 이어야 함

> **실무 팁**: 스테이징 버퍼에서 GPU 이미지로 텍스처를 업로드할 때, `bufferRowLength`와 `bufferImageHeight`를 0으로 설정하면 패딩 없이 빈틈없이 채워진 데이터를 그대로 복사할 수 있다.

---

## 4. 이미지 블릿 (vkCmdBlitImage)

블릿(blit)은 이미지 복사에 **스케일링**과 **포맷 변환**을 추가한 연산이다.

```c
void vkCmdBlitImage(
    VkCommandBuffer    commandBuffer,
    VkImage            srcImage,
    VkImageLayout      srcImageLayout,
    VkImage            dstImage,
    VkImageLayout      dstImageLayout,
    uint32_t           regionCount,
    const VkImageBlit* pRegions,
    VkFilter           filter);
```

### 4.1 VkImageBlit 구조체

```c
typedef struct VkImageBlit {
    VkImageSubresourceLayers srcSubresource;
    VkOffset3D               srcOffsets[2];  // 소스 영역의 두 모서리
    VkImageSubresourceLayers dstSubresource;
    VkOffset3D               dstOffsets[2];  // 대상 영역의 두 모서리
} VkImageBlit;
```

`srcOffsets[2]`와 `dstOffsets[2]`는 각각 영역의 **두 대각 모서리**를 정의한다. 소스와 대상 크기가 다르면 **자동 스케일링**이 적용된다.

### 4.2 필터링 모드

| VkFilter | 동작 | 사용 시점 |
|----------|------|----------|
| `VK_FILTER_NEAREST` | 가장 가까운 텍셀 선택 | 픽셀아트, 정수 스케일링 |
| `VK_FILTER_LINEAR` | 주변 텍셀 보간 | 부드러운 스케일링 |

### 4.3 블릿 핵심 규칙

- src 포맷은 `VK_FORMAT_FEATURE_BLIT_SRC_BIT` 지원 필요
- dst 포맷은 `VK_FORMAT_FEATURE_BLIT_DST_BIT` 지원 필요
- `VK_FILTER_LINEAR` 사용 시 src 포맷이 `VK_FORMAT_FEATURE_SAMPLED_IMAGE_FILTER_LINEAR_BIT` 지원 필요
- src/dst 모두 **싱글 샘플**(1x)이어야 한다 (멀티샘플 블릿 불가)
- 포맷 간 변환이 가능하다 (예: `R8G8B8A8_UNORM` → `R32G32B32A32_SFLOAT`)
- 오프셋이 뒤집혀 있으면 (offsets[0] > offsets[1]) **이미지 미러링** 가능

### 4.4 밉맵 생성 패턴

블릿은 런타임에 밉맵 체인을 생성하는 핵심 기법이다:

```
밉 레벨 0 (원본)
    ↓ vkCmdBlitImage (½ 크기로 스케일링)
밉 레벨 1
    ↓ vkCmdBlitImage (½ 크기로 스케일링)
밉 레벨 2
    ↓ ...
```

각 단계에서:

1. 현재 레벨을 `TRANSFER_SRC_OPTIMAL`로 전환
2. 다음 레벨을 `TRANSFER_DST_OPTIMAL`로 전환
3. `vkCmdBlitImage`로 ½ 크기로 축소 복사
4. 다음 레벨을 `SHADER_READ_ONLY_OPTIMAL`로 전환 (사용 완료)

> **실무 팁**: 밉맵 생성은 `VK_FILTER_LINEAR`를 사용해야 부드러운 결과를 얻는다. 모든 밉 레벨을 `TRANSFER_DST_OPTIMAL`로 한번에 전환하고, 체인을 따라 내려가면서 하나씩 처리하는 것이 효율적이다.

---

## 5. 이미지 리졸브 (vkCmdResolveImage)

멀티샘플 이미지를 싱글 샘플 이미지로 변환(resolve)한다. MSAA 안티앨리어싱의 마지막 단계다.

```c
void vkCmdResolveImage(
    VkCommandBuffer       commandBuffer,
    VkImage               srcImage,
    VkImageLayout         srcImageLayout,
    VkImage               dstImage,
    VkImageLayout         dstImageLayout,
    uint32_t              regionCount,
    const VkImageResolve* pRegions);
```

### 5.1 VkImageResolve 구조체

```c
typedef struct VkImageResolve {
    VkImageSubresourceLayers srcSubresource;
    VkOffset3D               srcOffset;
    VkImageSubresourceLayers dstSubresource;
    VkOffset3D               dstOffset;
    VkExtent3D               extent;
} VkImageResolve;
```

### 5.2 리졸브 핵심 규칙

| 규칙 | 설명 |
|------|------|
| **src 샘플 수** | `VK_SAMPLE_COUNT_1_BIT` **이외**의 값 (2x, 4x, 8x 등) |
| **dst 샘플 수** | 반드시 `VK_SAMPLE_COUNT_1_BIT` |
| **포맷 일치** | src/dst 포맷이 동일해야 한다 |
| **레이아웃** | src는 `TRANSFER_SRC_OPTIMAL`/`GENERAL`, dst는 `TRANSFER_DST_OPTIMAL`/`GENERAL` |

리졸브 과정에서 각 픽셀의 여러 샘플이 **하나의 값으로 합쳐진다**. 구현에 따라 평균(box filter) 등의 방식이 사용된다.

> **실무 팁**: 렌더 패스의 `pResolveAttachments`를 사용하면 별도의 `vkCmdResolveImage` 호출 없이 서브패스 종료 시 자동 리졸브가 가능하다. 대부분의 경우 이 방법이 더 효율적이다.

---

## 6. 이미지 클리어

### 6.1 렌더 패스 외부 클리어

#### vkCmdClearColorImage

```c
void vkCmdClearColorImage(
    VkCommandBuffer                commandBuffer,
    VkImage                        image,
    VkImageLayout                  imageLayout,
    const VkClearColorValue*       pColor,
    uint32_t                       rangeCount,
    const VkImageSubresourceRange* pRanges);
```

#### vkCmdClearDepthStencilImage

```c
void vkCmdClearDepthStencilImage(
    VkCommandBuffer                    commandBuffer,
    VkImage                            image,
    VkImageLayout                      imageLayout,
    const VkClearDepthStencilValue*     pDepthStencil,
    uint32_t                           rangeCount,
    const VkImageSubresourceRange*     pRanges);
```

### 6.2 클리어 값 구조체

```c
typedef union VkClearColorValue {
    float    float32[4];
    int32_t  int32[4];
    uint32_t uint32[4];
} VkClearColorValue;

typedef struct VkClearDepthStencilValue {
    float    depth;     // [0.0, 1.0]
    uint32_t stencil;
} VkClearDepthStencilValue;

typedef union VkClearValue {
    VkClearColorValue        color;
    VkClearDepthStencilValue depthStencil;
} VkClearValue;
```

### 6.3 클리어 규칙

| 구분 | vkCmdClearColorImage | vkCmdClearDepthStencilImage |
|------|---------------------|-----------------------------|
| **레이아웃** | `TRANSFER_DST_OPTIMAL`, `GENERAL`, `SHARED_PRESENT_KHR` | `TRANSFER_DST_OPTIMAL`, `GENERAL` |
| **Usage 플래그** | `TRANSFER_DST_BIT` 필요 | `TRANSFER_DST_BIT` 필요 |
| **지원 큐** | Graphics, Compute | Graphics만 |
| **렌더 패스** | 외부에서만 호출 가능 | 외부에서만 호출 가능 |

### 6.4 렌더 패스 내부 클리어 — vkCmdClearAttachments

```c
void vkCmdClearAttachments(
    VkCommandBuffer          commandBuffer,
    uint32_t                 attachmentCount,
    const VkClearAttachment* pAttachments,
    uint32_t                 rectCount,
    const VkClearRect*       pRects);
```

```c
typedef struct VkClearAttachment {
    VkImageAspectFlags aspectMask;
    uint32_t           colorAttachment;
    VkClearValue       clearValue;
} VkClearAttachment;

typedef struct VkClearRect {
    VkRect2D rect;
    uint32_t baseArrayLayer;
    uint32_t layerCount;
} VkClearRect;
```

- 렌더 패스 **내부**에서 어태치먼트의 특정 영역만 클리어
- 전송 연산이 **아님** — 래스터화 순서로 실행됨
- 조건부 렌더링(conditional rendering)의 영향을 받음

> **실무 팁**: 대부분의 경우 렌더 패스의 `loadOp = VK_ATTACHMENT_LOAD_OP_CLEAR`가 `vkCmdClearAttachments`보다 효율적이다. 타일 기반 렌더러(모바일 GPU)에서는 특히 그렇다.

---

## 7. 버퍼 클리어 및 업데이트

### 7.1 vkCmdFillBuffer

```c
void vkCmdFillBuffer(
    VkCommandBuffer commandBuffer,
    VkBuffer        dstBuffer,
    VkDeviceSize    dstOffset,
    VkDeviceSize    size,
    uint32_t        data);    // 반복할 4바이트 패턴
```

- 오프셋과 크기는 **4바이트 정렬** 필요
- `size`에 `VK_WHOLE_SIZE`를 넣으면 버퍼 끝까지 채움
- Graphics, Compute, Transfer 큐에서 사용 가능

### 7.2 vkCmdUpdateBuffer

```c
void vkCmdUpdateBuffer(
    VkCommandBuffer commandBuffer,
    VkBuffer        dstBuffer,
    VkDeviceSize    dstOffset,
    VkDeviceSize    dataSize,
    const void*     pData);
```

- **최대 65,536 바이트** (64KB)까지만 가능
- 데이터는 커맨드 버퍼 **기록 시점**에 복사됨
- 오프셋과 크기는 4바이트 정렬 필요
- 더 큰 업데이트는 스테이징 버퍼 + `vkCmdCopyBuffer` 사용

> **핵심 규칙**: `vkCmdUpdateBuffer`는 소량의 즉각적 업데이트용이다. 유니폼 버퍼의 작은 상수값 같은 곳에 적합하고, 큰 데이터는 반드시 스테이징 버퍼를 사용해야 한다.

---

## 8. 텍셀 입력/출력 연산

셰이더에서 이미지를 읽고 쓸 때의 내부 처리 과정이다.

### 8.1 텍셀 입력 (이미지 읽기)

셰이더가 이미지에서 텍셀을 읽을 때 3단계를 거친다:

```
[이미지 메모리] → 텍셀 디코드 → 컴포넌트 치환 → 숫자 인코딩 → [셰이더 변수]
```

| 단계 | 설명 |
|------|------|
| **1. 텍셀 디코드** | 좌표 (x,y,z,layer,sample,level)의 텍셀을 포맷에 따라 디코딩 |
| **2. 컴포넌트 치환** | 포맷에 없는 RGBA 컴포넌트를 기본값으로 대체: `(0, 0, 0, 1)` |
| **3. 숫자 인코딩** | 고정소수점/부동소수점 → IEEE-754 binary32 변환, 정수는 부호 유지 |

### 8.2 텍셀 출력 (이미지 쓰기)

```
[셰이더 변수] → sRGB 변환 (해당 시) → 텍셀 인코딩 → [이미지 메모리]
```

| 단계 | 설명 |
|------|------|
| **1. sRGB 변환** | sRGB 포맷이면 RGB 컴포넌트에 선형→sRGB 감마 적용 |
| **2. 텍셀 인코딩** | 셰이더 값을 이미지 포맷에 맞게 인코딩, 미사용 컴포넌트는 버림 |

- 범위 밖 쓰기는 셰이더 메모리 접근 규칙을 따름
- 희소(sparse) 이미지의 바인딩 안 된 영역에 쓰기는 **자동 무시**됨

### 8.3 Depth/Stencil 컴포넌트 매핑

이미지 접근 시 D(depth)와 S(stencil) 컴포넌트는 다음과 같이 매핑된다:

| 이미지 컴포넌트 | 셰이더 컴포넌트 |
|----------------|----------------|
| D (깊이) | R |
| S (스텐실) | G |

---

## 9. 포맷 변환 규칙

### 9.1 클리어 값 변환

| 원본 타입 | 대상 포맷 | 변환 규칙 |
|-----------|----------|----------|
| float | UNORM/SNORM | [0,1] 또는 [-1,1] 범위로 클램프 후 변환 |
| float | UFLOAT/SFLOAT | 대상 비트 폭에 맞게 변환 |
| int32 | SINT | 작은 타입으로 캐스트 (오버플로 가능) |
| uint32 | UINT | 작은 타입으로 캐스트 (오버플로 가능) |

### 9.2 블릿 포맷 변환

`vkCmdBlitImage`에서만 포맷 변환이 가능하다:

- 부동소수점 포맷 → 정수 포맷 (또는 그 반대) 변환 가능
- sRGB와 선형 포맷 간 변환 자동 처리
- 컴포넌트 수가 다른 포맷 간 변환 시 누락 컴포넌트는 `(0, 0, 0, 1)` 대체

### 9.3 복사 포맷 호환성

`vkCmdCopyImage`에서는 포맷 변환이 없다. 대신 **크기 호환성** 규칙을 따른다:

- 텍셀 블록 크기가 동일한 포맷끼리 복사 가능
- 예: `R32G32B32A32_SFLOAT` (16바이트) ↔ `R32G32B32A32_UINT` (16바이트) — 가능
- 예: `R8G8B8A8_UNORM` (4바이트) ↔ `R32_SFLOAT` (4바이트) — 가능
- 블록 크기가 다르면 복사 불가

---

## 10. 연산별 지원 큐 요약

| 연산 | Graphics | Compute | Transfer |
|------|----------|---------|----------|
| `vkCmdCopyImage` | O | O | O |
| `vkCmdCopyBufferToImage` | O | O | O |
| `vkCmdCopyImageToBuffer` | O | O | O |
| `vkCmdBlitImage` | O | X | X |
| `vkCmdResolveImage` | O | X | X |
| `vkCmdClearColorImage` | O | O | X |
| `vkCmdClearDepthStencilImage` | O | X | X |
| `vkCmdClearAttachments` | O | X | X |
| `vkCmdFillBuffer` | O | O | O |
| `vkCmdUpdateBuffer` | O | O | O |

> **핵심**: 블릿과 리졸브는 **Graphics 큐에서만** 가능하다. 복사와 버퍼 작업은 모든 전송 지원 큐에서 가능하다.

---

## 이 챕터에서 기억할 것

1. **복사 vs 블릿**: `vkCmdCopyImage`는 포맷 변환/스케일링 없이 원본 그대로 복사, `vkCmdBlitImage`는 스케일링과 포맷 변환 지원 — 밉맵 생성은 블릿으로
2. **버퍼-이미지 복사**: `bufferRowLength`/`bufferImageHeight`를 0으로 설정하면 타이트 패킹, 텍스처 로딩의 핵심 연산
3. **리졸브**: 멀티샘플→싱글 샘플 변환, 렌더 패스의 `pResolveAttachments`가 별도 커맨드보다 효율적
4. **클리어**: 렌더 패스 `loadOp = CLEAR`가 `vkCmdClearAttachments`보다 효율적 (특히 타일 기반 GPU)
5. **큐 제한**: 블릿/리졸브는 Graphics 큐 전용, 복사/버퍼 작업은 모든 전송 큐에서 사용 가능

---

*이 문서는 Vulkan 명세의 Image Operations / Copy Commands / Clear Commands 챕터를 한글로 요약한 것입니다.*
*세부 사항은 원본 명세를 참조하세요.*
