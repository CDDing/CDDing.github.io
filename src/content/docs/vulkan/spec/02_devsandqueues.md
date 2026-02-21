---
title: "Devices and Queues (디바이스와 큐) — 한글 요약"
sidebar:
  label: "02. Devices and Queues"
---

> 원본: [Devices and Queues](https://docs.vulkan.org/spec/latest/chapters/devsandqueues.html)

Vulkan이 초기화되면(VkInstance 생성 후), **디바이스**와 **큐**가 구현체와 상호작용하는 핵심 오브젝트가 된다.
물리 디바이스(Physical Device)를 열거하고 속성을 조회한 뒤, 논리 디바이스(Logical Device)를 생성하고 큐를 획득하는 것이 이 챕터의 핵심 흐름이다.

---

## 1. Physical Devices (물리 디바이스)

물리 디바이스는 시스템에 설치된 **실제 GPU 하드웨어**(또는 소프트웨어 구현)를 나타낸다. 앱은 먼저 사용 가능한 물리 디바이스를 열거하고, 각 디바이스의 속성/기능/제한을 조회하여 적합한 디바이스를 선택한다.

```c
VK_DEFINE_HANDLE(VkPhysicalDevice)
```

VkPhysicalDevice는 VkInstance로부터 열거되는 **디스패처블 핸들**<sup class="fn-ref"><a href="/log/vulkan/02_devsandqueues/#디스패처블-핸들dispatchable-handle이란">[1]</a><span class="fn-tooltip"><span class="fn-title"><a href="/log/vulkan/02_devsandqueues/#디스패처블-핸들dispatchable-handle이란">디스패처블 핸들이란?</a></span><span class="fn-desc">Dispatchable 핸들은 내부에 dispatch table(함수 포인터 테이블)을 가진다. VkInstance, VkPhysicalDevice, VkDevice, VkQueue, VkCommandBuffer만 해당.</span></span></sup><sup class="fn-ref"><a href="/log/vulkan/02_devsandqueues/#dispatch-어원--vkcmddispatch와-dispatch-table의-관계">[2]</a><span class="fn-tooltip"><span class="fn-title"><a href="/log/vulkan/02_devsandqueues/#dispatch-어원--vkcmddispatch와-dispatch-table의-관계">dispatch 어원</a></span><span class="fn-desc">dispatch = '적절한 곳으로 보내다'. Dispatch table은 API 호출을 올바른 드라이버로 라우팅, vkCmdDispatch는 컴퓨트 워크를 GPU로 발송.</span></span></sup>이다. 인스턴스가 파괴되면 함께 무효화된다.

### 1.1 물리 디바이스 열거 — vkEnumeratePhysicalDevices

```c
VkResult vkEnumeratePhysicalDevices(
    VkInstance    instance,              // 인스턴스 핸들
    uint32_t*     pPhysicalDeviceCount,  // 물리 디바이스 개수 (입출력)
    VkPhysicalDevice* pPhysicalDevices); // NULL 또는 디바이스 핸들 배열
```

**사용 패턴** (2단계 호출):

1. `pPhysicalDevices = NULL`로 호출 → `pPhysicalDeviceCount`에 사용 가능한 디바이스 수 반환
2. 배열을 할당한 뒤 다시 호출 → 디바이스 핸들 채워짐

요청한 크기보다 실제 디바이스가 많으면 `VK_INCOMPLETE`를 반환한다.

**반환 코드:**

| 성공 | 실패 |
|------|------|
| `VK_SUCCESS` | `VK_ERROR_OUT_OF_HOST_MEMORY` |
| `VK_INCOMPLETE` | `VK_ERROR_OUT_OF_DEVICE_MEMORY` |
| | `VK_ERROR_INITIALIZATION_FAILED` |

> **참고**: 같은 인스턴스에 대해 여러 번 호출하면, 열거 순서와 반환되는 물리 디바이스 핸들 값은 항상 동일하다 (단, 디바이스가 물리적으로 추가/제거되지 않는 한).

### 1.2 물리 디바이스 속성 — vkGetPhysicalDeviceProperties

```c
void vkGetPhysicalDeviceProperties(
    VkPhysicalDevice             physicalDevice,
    VkPhysicalDeviceProperties*  pProperties);
```

Vulkan 1.1 이상에서는 확장 가능한 버전을 사용할 수 있다:

```c
void vkGetPhysicalDeviceProperties2(
    VkPhysicalDevice              physicalDevice,
    VkPhysicalDeviceProperties2*  pProperties);  // pNext 체인으로 확장 속성 조회
```

#### VkPhysicalDeviceProperties 구조체

```c
typedef struct VkPhysicalDeviceProperties {
    uint32_t                       apiVersion;          // 지원하는 Vulkan API 버전
    uint32_t                       driverVersion;       // 드라이버 버전 (벤더 정의 인코딩)
    uint32_t                       vendorID;            // PCI 벤더 ID 또는 Khronos 벤더 ID
    uint32_t                       deviceID;            // 벤더 내 고유 디바이스 식별자
    VkPhysicalDeviceType           deviceType;          // 디바이스 유형
    char                           deviceName[VK_MAX_PHYSICAL_DEVICE_NAME_SIZE]; // UTF-8 디바이스 이름
    uint8_t                        pipelineCacheUUID[VK_UUID_SIZE]; // 파이프라인 캐시 호환성 UUID
    VkPhysicalDeviceLimits         limits;              // 디바이스 리소스 제한
    VkPhysicalDeviceSparseProperties sparseProperties;  // 희소 메모리 속성
} VkPhysicalDeviceProperties;
```

> **주의**: `apiVersion`은 `vkEnumerateInstanceVersion`이 반환하는 값과 다를 수 있다. 인스턴스 버전과 디바이스 버전은 독립적이다.

#### VkPhysicalDeviceType — 디바이스 유형 열거

```c
typedef enum VkPhysicalDeviceType {
    VK_PHYSICAL_DEVICE_TYPE_OTHER          = 0, // 분류 불가
    VK_PHYSICAL_DEVICE_TYPE_INTEGRATED_GPU = 1, // 내장 GPU (호스트와 밀접 결합)
    VK_PHYSICAL_DEVICE_TYPE_DISCRETE_GPU   = 2, // 외장 GPU (별도 프로세서)
    VK_PHYSICAL_DEVICE_TYPE_VIRTUAL_GPU    = 3, // 가상화 환경의 가상 GPU
    VK_PHYSICAL_DEVICE_TYPE_CPU            = 4, // 호스트 CPU에서 실행
} VkPhysicalDeviceType;
```

| 유형 | 설명 | 예시 |
|------|------|------|
| `INTEGRATED_GPU` | 호스트에 내장되거나 밀접하게 결합된 GPU | Intel UHD, AMD APU |
| `DISCRETE_GPU` | 인터커넥트(PCIe 등)로 연결된 별도 프로세서 | NVIDIA RTX, AMD Radeon |
| `VIRTUAL_GPU` | 가상화 환경에서 노출되는 가상 노드 | 클라우드 GPU |
| `CPU` | 호스트 프로세서에서 실행되는 소프트웨어 구현 | Mesa lavapipe, SwiftShader |

### 1.3 디바이스 식별 — VkPhysicalDeviceIDProperties

```c
typedef struct VkPhysicalDeviceIDProperties {
    VkStructureType sType;
    void*           pNext;
    uint8_t         deviceUUID[VK_UUID_SIZE];    // 디바이스 고유 UUID
    uint8_t         driverUUID[VK_UUID_SIZE];    // 드라이버 UUID
    uint8_t         deviceLUID[VK_LUID_SIZE];    // Windows LUID (유효할 때만)
    uint32_t        deviceNodeMask;              // Direct3D 12 노드 마스크
    VkBool32        deviceLUIDValid;             // LUID 유효 여부
} VkPhysicalDeviceIDProperties;
```

- `deviceUUID`는 인스턴스, 프로세스, 드라이버 버전, 시스템 리부팅에 걸쳐 **불변**이다
- `driverUUID`는 서로 다른 API/드라이버 간에 리소스 공유 호환성을 판단하는 데 사용한다
- `pipelineCacheUUID`와는 다른 용도임에 주의 — `pipelineCacheUUID`는 파이프라인 캐시 직렬화 호환성용

### 1.4 물리 디바이스 제한 — VkPhysicalDeviceLimits

VkPhysicalDeviceLimits는 디바이스가 지원하는 리소스 제한을 정의하는 **매우 큰 구조체**이다. 주요 필드 일부:

```c
typedef struct VkPhysicalDeviceLimits {
    uint32_t maxImageDimension1D;                // 1D 이미지 최대 크기
    uint32_t maxImageDimension2D;                // 2D 이미지 최대 크기
    uint32_t maxImageDimension3D;                // 3D 이미지 최대 크기
    uint32_t maxImageDimensionCube;              // 큐브맵 최대 크기
    uint32_t maxImageArrayLayers;                // 이미지 배열 최대 레이어 수
    uint32_t maxTexelBufferElements;             // 텍셀 버퍼 최대 원소 수
    uint32_t maxUniformBufferRange;              // 유니폼 버퍼 최대 범위
    uint32_t maxStorageBufferRange;              // 스토리지 버퍼 최대 범위
    uint32_t maxPushConstantsSize;               // 푸시 상수 최대 크기
    uint32_t maxMemoryAllocationCount;           // 동시 메모리 할당 최대 수
    uint32_t maxBoundDescriptorSets;             // 바인딩 가능한 디스크립터 셋 최대 수
    uint32_t maxPerStageDescriptorSamplers;      // 스테이지당 최대 샘플러 수
    uint32_t maxPerStageDescriptorUniformBuffers;// 스테이지당 최대 유니폼 버퍼 수
    uint32_t maxPerStageDescriptorStorageBuffers;// 스테이지당 최대 스토리지 버퍼 수
    uint32_t maxPerStageResources;               // 스테이지당 최대 리소스 총 수
    uint32_t maxDescriptorSetSamplers;           // 디스크립터 셋당 최대 샘플러
    uint32_t maxVertexInputAttributes;           // 정점 입력 최대 어트리뷰트 수
    uint32_t maxVertexInputBindings;             // 정점 입력 최대 바인딩 수
    uint32_t maxFragmentOutputAttachments;       // 프래그먼트 출력 최대 어태치먼트 수
    uint32_t maxComputeWorkGroupCount[3];        // 컴퓨트 워크그룹 최대 카운트 (x,y,z)
    uint32_t maxComputeWorkGroupSize[3];         // 컴퓨트 워크그룹 최대 크기 (x,y,z)
    uint32_t maxComputeWorkGroupInvocations;     // 워크그룹당 최대 호출 수
    uint32_t maxViewports;                       // 최대 뷰포트 수
    float    maxSamplerAnisotropy;               // 최대 이방성 필터링 값
    // ... (수십 개의 필드가 더 있음)
} VkPhysicalDeviceLimits;
```

> **실무 팁**: 모든 필드를 외울 필요는 없다. 리소스를 생성하기 전에 관련 제한을 조회하여 초과하지 않는지 확인하는 습관이 중요하다.

### 1.5 희소 리소스 속성 — VkPhysicalDeviceSparseProperties

```c
typedef struct VkPhysicalDeviceSparseProperties {
    VkBool32 residencyStandard2DBlockShape;          // 표준 2D 블록 모양 지원
    VkBool32 residencyStandard2DMultisampleBlockShape;// 표준 2D 멀티샘플 블록 모양
    VkBool32 residencyStandard3DBlockShape;          // 표준 3D 블록 모양 지원
    VkBool32 residencyAlignedMipSize;                // 밉 꼬리 이전 밉이 정렬됨
    VkBool32 residencyNonResidentStrict;             // 비상주 읽기 시 확정적 값 반환
} VkPhysicalDeviceSparseProperties;
```

`VkBool32`<sup class="fn-ref"><a href="/log/vulkan/02_devsandqueues/#vkbool32는-왜-32비트인가">[3]</a><span class="fn-tooltip"><span class="fn-title"><a href="/log/vulkan/02_devsandqueues/#vkbool32는-왜-32비트인가">VkBool32는 왜 32비트인가?</a></span><span class="fn-desc">C의 bool 크기가 컴파일러마다 달라서 ABI 호환성을 위해 uint32_t로 고정. 구조체 정렬 때문에 어차피 4바이트를 차지한다.</span></span></sup> 희소 리소스는 메모리를 부분적으로 바인딩할 수 있는 기능이다. 이 속성들은 희소 이미지의 타일 레이아웃과 비상주 접근 동작을 정의한다.

### 1.6 물리 디바이스 기능 — vkGetPhysicalDeviceFeatures

```c
void vkGetPhysicalDeviceFeatures(
    VkPhysicalDevice          physicalDevice,
    VkPhysicalDeviceFeatures* pFeatures);
```

Vulkan 1.1 이상:

```c
void vkGetPhysicalDeviceFeatures2(
    VkPhysicalDevice           physicalDevice,
    VkPhysicalDeviceFeatures2* pFeatures);  // pNext로 확장 기능 조회
```

#### VkPhysicalDeviceFeatures 구조체 (주요 필드)

```c
typedef struct VkPhysicalDeviceFeatures {
    VkBool32 robustBufferAccess;           // 범위 밖 버퍼 접근 시 안전 보장
    VkBool32 fullDrawIndexUint32;          // 32비트 인덱스 전체 범위 지원
    VkBool32 imageCubeArray;               // 큐브맵 배열 지원
    VkBool32 independentBlend;             // 어태치먼트별 독립 블렌딩
    VkBool32 geometryShader;               // 지오메트리 셰이더 지원
    VkBool32 tessellationShader;           // 테셀레이션 셰이더 지원
    VkBool32 sampleRateShading;            // 샘플 레이트 셰이딩
    VkBool32 dualSrcBlend;                 // 듀얼 소스 블렌딩
    VkBool32 logicOp;                      // 논리 연산 블렌딩
    VkBool32 multiDrawIndirect;            // 멀티 드로우 인다이렉트
    VkBool32 drawIndirectFirstInstance;    // 인다이렉트 드로우에서 firstInstance 지원
    VkBool32 depthClamp;                   // 깊이 클램핑
    VkBool32 depthBiasClamp;               // 깊이 바이어스 클램핑
    VkBool32 fillModeNonSolid;             // 와이어프레임/포인트 필 모드
    VkBool32 depthBounds;                  // 깊이 바운드 테스트
    VkBool32 wideLines;                    // 1.0 이외 라인 폭
    VkBool32 largePoints;                  // 1.0 이외 포인트 크기
    VkBool32 alphaToOne;                   // 알파 투 원
    VkBool32 multiViewport;                // 다중 뷰포트
    VkBool32 samplerAnisotropy;            // 이방성 필터링
    VkBool32 textureCompressionETC2;       // ETC2 텍스처 압축
    VkBool32 textureCompressionASTC_LDR;   // ASTC LDR 텍스처 압축
    VkBool32 textureCompressionBC;         // BC 텍스처 압축
    VkBool32 occlusionQueryPrecise;        // 정밀 오클루전 쿼리
    VkBool32 pipelineStatisticsQuery;      // 파이프라인 통계 쿼리
    VkBool32 vertexPipelineStoresAndAtomics;   // 정점 파이프라인 스토어/아토믹
    VkBool32 fragmentStoresAndAtomics;     // 프래그먼트 스토어/아토믹
    VkBool32 shaderFloat64;                // 셰이더 64비트 부동소수점
    VkBool32 shaderInt64;                  // 셰이더 64비트 정수
    VkBool32 shaderInt16;                  // 셰이더 16비트 정수
    VkBool32 sparseBinding;                // 희소 바인딩
    VkBool32 sparseResidencyBuffer;        // 희소 상주 버퍼
    VkBool32 sparseResidencyImage2D;       // 희소 상주 2D 이미지
    VkBool32 sparseResidencyImage3D;       // 희소 상주 3D 이미지
    // ... (총 55개 VkBool32 필드)
} VkPhysicalDeviceFeatures;
```

> **핵심 원칙**: 기능이 `VK_FALSE`인 필드를 사용하려고 하면 **정의되지 않은 동작(undefined behavior)** 이 발생한다. 반드시 조회 후 지원되는 기능만 활성화해야 한다.

### 1.7 포맷 속성 — vkGetPhysicalDeviceFormatProperties

```c
void vkGetPhysicalDeviceFormatProperties(
    VkPhysicalDevice       physicalDevice,
    VkFormat               format,          // 조회할 포맷 (예: VK_FORMAT_R8G8B8A8_UNORM)
    VkFormatProperties*    pFormatProperties);
```

```c
typedef struct VkFormatProperties {
    VkFormatFeatureFlags linearTilingFeatures;   // 리니어 타일링에서 지원하는 기능
    VkFormatFeatureFlags optimalTilingFeatures;  // 옵티멀 타일링에서 지원하는 기능
    VkFormatFeatureFlags bufferFeatures;         // 버퍼에서 지원하는 기능
} VkFormatProperties;
```

**VkFormatFeatureFlags의 주요 비트:**

| 플래그 | 설명 |
|--------|------|
| `VK_FORMAT_FEATURE_SAMPLED_IMAGE_BIT` | 샘플링된 이미지로 사용 가능 |
| `VK_FORMAT_FEATURE_STORAGE_IMAGE_BIT` | 스토리지 이미지로 사용 가능 |
| `VK_FORMAT_FEATURE_COLOR_ATTACHMENT_BIT` | 컬러 어태치먼트로 사용 가능 |
| `VK_FORMAT_FEATURE_DEPTH_STENCIL_ATTACHMENT_BIT` | 깊이/스텐실 어태치먼트로 사용 가능 |
| `VK_FORMAT_FEATURE_BLIT_SRC_BIT` | 블릿 소스로 사용 가능 |
| `VK_FORMAT_FEATURE_BLIT_DST_BIT` | 블릿 대상으로 사용 가능 |
| `VK_FORMAT_FEATURE_VERTEX_BUFFER_BIT` | 정점 버퍼 어트리뷰트로 사용 가능 |
| `VK_FORMAT_FEATURE_TRANSFER_SRC_BIT` | 전송 소스로 사용 가능 |
| `VK_FORMAT_FEATURE_TRANSFER_DST_BIT` | 전송 대상으로 사용 가능 |

> **실무 팁**: 이미지나 버퍼를 생성하기 전에 사용하려는 포맷이 원하는 용도(컬러 어태치먼트, 샘플링 등)를 지원하는지 반드시 확인해야 한다. 포맷 지원은 디바이스마다 다르다.

### 1.8 버전별 확장 속성 구조체

Vulkan 1.1~1.4에서 추가된 주요 속성 구조체들 (vkGetPhysicalDeviceProperties2의 pNext 체인에 연결):

| 구조체 | 주요 내용 |
|--------|----------|
| VkPhysicalDeviceVulkan11Properties | 디바이스 UUID, 서브그룹 특성, 멀티뷰 제한, 보호 메모리 |
| VkPhysicalDeviceVulkan12Properties | 드라이버 식별, 부동소수점 제어, 디스크립터 인덱싱 제한, 타임라인 세마포어 |
| VkPhysicalDeviceVulkan13Properties | 서브그룹 크기 제어, 인라인 유니폼 블록 제한, 정수 내적 가속 |
| VkPhysicalDeviceVulkan14Properties | 라인 래스터화 정밀도, 정점 어트리뷰트 디바이저, 푸시 디스크립터, 동적 렌더링 |

---

## 2. Devices (논리 디바이스) <sup class="fn-ref"><a href="/log/vulkan/02_devsandqueues/#물리-디바이스와-논리-디바이스를-왜-분리했나">[4]</a><span class="fn-tooltip"><span class="fn-title"><a href="/log/vulkan/02_devsandqueues/#물리-디바이스와-논리-디바이스를-왜-분리했나">물리/논리 디바이스를 왜 분리했나?</a></span><span class="fn-desc">조회(read-only)와 사용(mutable)의 분리. 물리 디바이스로 능력을 확인하고, 논리 디바이스에서 필요한 것만 켜서 사용하는 2단계 설계.</span></span></sup>

논리 디바이스(VkDevice)는 물리 디바이스의 **논리적 표현**이다. 앱은 논리 디바이스를 통해 GPU 리소스를 사용한다. 하나의 물리 디바이스에서 **여러 논리 디바이스**를 생성할 수 있다.

```c
VK_DEFINE_HANDLE(VkDevice)
```

### 2.1 논리 디바이스 생성 — vkCreateDevice

```c
VkResult vkCreateDevice(
    VkPhysicalDevice             physicalDevice,  // 논리 디바이스를 만들 물리 디바이스
    const VkDeviceCreateInfo*    pCreateInfo,      // 생성 정보
    const VkAllocationCallbacks* pAllocator,       // 호스트 메모리 할당자 (선택)
    VkDevice*                    pDevice);         // 생성된 논리 디바이스 핸들
```

**반환 코드:**

| 성공 | 실패 |
|------|------|
| `VK_SUCCESS` | `VK_ERROR_OUT_OF_HOST_MEMORY` |
| | `VK_ERROR_OUT_OF_DEVICE_MEMORY` |
| | `VK_ERROR_INITIALIZATION_FAILED` |
| | `VK_ERROR_EXTENSION_NOT_PRESENT` |
| | `VK_ERROR_FEATURE_NOT_PRESENT` |
| | `VK_ERROR_TOO_MANY_OBJECTS` |
| | `VK_ERROR_DEVICE_LOST` |

> **핵심**: 논리 디바이스 생성은 **물리 디바이스의 상태를 변경하지 않는다**. 같은 물리 디바이스에서 여러 논리 디바이스를 만들 수 있고, 각각 독립적으로 동작한다.

#### VkDeviceCreateInfo 구조체

```c
typedef struct VkDeviceCreateInfo {
    VkStructureType                  sType;                    // VK_STRUCTURE_TYPE_DEVICE_CREATE_INFO
    const void*                      pNext;                    // 확장 체인 (기능 구조체 연결)
    VkDeviceCreateFlags              flags;                    // 예약됨 (0)
    uint32_t                         queueCreateInfoCount;     // 큐 생성 정보 수
    const VkDeviceQueueCreateInfo*   pQueueCreateInfos;        // 큐 생성 정보 배열
    uint32_t                         enabledLayerCount;        // (Vulkan 1.0 레거시, 무시됨)
    const char* const*               ppEnabledLayerNames;      // (Vulkan 1.0 레거시, 무시됨)
    uint32_t                         enabledExtensionCount;    // 활성화할 디바이스 익스텐션 수
    const char* const*               ppEnabledExtensionNames;  // 디바이스 익스텐션 이름 배열
    const VkPhysicalDeviceFeatures*  pEnabledFeatures;         // 활성화할 기능 (NULL 가능)
} VkDeviceCreateInfo;
```

**주요 포인트:**

- **큐 생성**: `pQueueCreateInfos`로 어떤 큐 패밀리에서 몇 개의 큐를 만들지 지정한다
- **디바이스 익스텐션**: 인스턴스 익스텐션과는 별도로 디바이스 레벨 익스텐션을 활성화한다 (예: `VK_KHR_swapchain`)
- **기능 활성화**: `pEnabledFeatures`에 사용할 기능만 `VK_TRUE`로 설정한다. 지원하지 않는 기능을 활성화하면 `VK_ERROR_FEATURE_NOT_PRESENT` 반환
- **레이어 필드**: `enabledLayerCount`와 `ppEnabledLayerNames`는 Vulkan 1.0 하위 호환용이며, 현재는 인스턴스 레벨 레이어 활성화만 사용한다

> **Vulkan 1.1+ 기능 활성화**: pNext 체인에 VkPhysicalDeviceFeatures2를 연결하여 코어 및 확장 기능을 한꺼번에 활성화할 수 있다. 이 경우 `pEnabledFeatures`는 반드시 `NULL`이어야 한다.

#### 디바이스 생성 흐름 예시

```c
// 1. 사용할 큐 패밀리 정보 설정
float queuePriority = 1.0f;
VkDeviceQueueCreateInfo queueCreateInfo = {
    .sType            = VK_STRUCTURE_TYPE_DEVICE_QUEUE_CREATE_INFO,
    .queueFamilyIndex = graphicsQueueFamilyIndex,  // 그래픽스 큐 패밀리
    .queueCount       = 1,                          // 큐 1개 요청
    .pQueuePriorities = &queuePriority              // 우선순위 1.0
};

// 2. 활성화할 기능 설정
VkPhysicalDeviceFeatures enabledFeatures = {0};
enabledFeatures.samplerAnisotropy = VK_TRUE;  // 이방성 필터링만 활성화

// 3. 디바이스 생성 정보 구성
const char* extensions[] = { VK_KHR_SWAPCHAIN_EXTENSION_NAME };
VkDeviceCreateInfo createInfo = {
    .sType                   = VK_STRUCTURE_TYPE_DEVICE_CREATE_INFO,
    .queueCreateInfoCount    = 1,
    .pQueueCreateInfos       = &queueCreateInfo,
    .enabledExtensionCount   = 1,
    .ppEnabledExtensionNames = extensions,
    .pEnabledFeatures        = &enabledFeatures
};

// 4. 논리 디바이스 생성
VkDevice device;
VkResult result = vkCreateDevice(physicalDevice, &createInfo, NULL, &device);
```

### 2.2 논리 디바이스 파괴 — vkDestroyDevice

```c
void vkDestroyDevice(
    VkDevice                     device,       // 파괴할 논리 디바이스 (NULL 가능)
    const VkAllocationCallbacks* pAllocator);   // 호스트 메모리 할당자 (선택)
```

**파괴 전 필수 조건:**

- 해당 디바이스로 생성한 **모든 자식 오브젝트를 먼저 파괴/해제**해야 한다
- 모든 큐가 **유휴 상태(idle)** 여야 한다 — `vkDeviceWaitIdle`을 먼저 호출하는 것이 안전하다
- 디바이스를 파괴하면 해당 디바이스의 큐도 함께 파괴된다

> **`NULL` 전달**: `device`가 `NULL`이면 아무 동작도 하지 않는다 (no-op).

### 2.3 디바이스 분실 — Device Lost

디바이스는 하드웨어 오류, 드라이버 버그, 타임아웃 등의 이유로 **분실(lost)** 상태가 될 수 있다.

```
VK_ERROR_DEVICE_LOST
```

**디바이스 분실 시 동작:**

- 이 오류를 반환하는 커맨드가 있으면, 해당 디바이스는 **분실 상태**로 전환된다
- 분실된 디바이스로는 더 이상 큐 제출이나 디바이스 대기가 **보장되지 않는다**
- 이미 제출된 커맨드 버퍼의 실행도 완료가 보장되지 않는다
- 펜스나 세마포어의 시그널도 보장되지 않는다

**복구 방법:**

1. 분실된 디바이스의 **모든 리소스를 정리** (오브젝트 파괴, 메모리 해제)
2. 논리 디바이스를 파괴한다 (`vkDestroyDevice`)
3. 새 논리 디바이스를 생성하여 재시작한다

> **주의**: 분실된 디바이스에서도 `vkDestroyDevice`, `vkFreeMemory` 등의 파괴/해제 함수는 여전히 호출할 수 있다. 리소스 누수를 방지하기 위해 반드시 정리해야 한다.

> **원인 파악**: `VK_EXT_device_fault` 익스텐션을 사용하면 디바이스 분실 원인에 대한 추가 정보를 얻을 수 있다.

---

## 3. Queues (큐)

큐는 GPU에 작업을 제출하는 **인터페이스**이다. 커맨드 버퍼를 큐에 제출(submit)하면 GPU가 이를 처리한다.

```c
VK_DEFINE_HANDLE(VkQueue)
```

> **핵심**: `vkCreateQueue`나 `vkAllocateQueue` 같은 함수는 **없다**. 큐는 논리 디바이스 생성 시 함께 만들어지고, `vkGetDeviceQueue`로 핸들을 획득한다.

### 3.1 큐 패밀리 — Queue Families

큐 패밀리(Queue Family)는 **동일한 속성과 능력을 가진 큐들의 그룹**이다. 물리 디바이스마다 하나 이상의 큐 패밀리를 지원한다.

#### 큐 패밀리 속성 조회 — vkGetPhysicalDeviceQueueFamilyProperties

```c
void vkGetPhysicalDeviceQueueFamilyProperties(
    VkPhysicalDevice          physicalDevice,
    uint32_t*                 pQueueFamilyPropertyCount,  // 큐 패밀리 수 (입출력)
    VkQueueFamilyProperties*  pQueueFamilyProperties);    // NULL 또는 속성 배열
```

2단계 호출 패턴 (vkEnumeratePhysicalDevices와 동일):

1. `pQueueFamilyProperties = NULL`로 호출 → 큐 패밀리 수 반환
2. 배열 할당 후 다시 호출 → 각 큐 패밀리의 속성 채워짐

Vulkan 1.1 이상:

```c
void vkGetPhysicalDeviceQueueFamilyProperties2(
    VkPhysicalDevice               physicalDevice,
    uint32_t*                      pQueueFamilyPropertyCount,
    VkQueueFamilyProperties2*      pQueueFamilyProperties);  // pNext 체인 지원
```

#### VkQueueFamilyProperties 구조체

```c
typedef struct VkQueueFamilyProperties {
    VkQueueFlags queueFlags;                    // 지원하는 연산 유형 (비트 플래그)
    uint32_t     queueCount;                    // 이 패밀리에서 생성 가능한 최대 큐 수
    uint32_t     timestampValidBits;            // 타임스탬프 유효 비트 수 (0이면 미지원)
    VkExtent3D   minImageTransferGranularity;   // 전송 연산의 최소 이미지 크기 단위
} VkQueueFamilyProperties;
```

#### VkQueueFlagBits — 큐 능력 플래그

```c
typedef enum VkQueueFlagBits {
    VK_QUEUE_GRAPHICS_BIT       = 0x00000001,  // 그래픽스 연산
    VK_QUEUE_COMPUTE_BIT        = 0x00000002,  // 컴퓨트 연산
    VK_QUEUE_TRANSFER_BIT       = 0x00000004,  // 전송 연산
    VK_QUEUE_SPARSE_BINDING_BIT = 0x00000008,  // 희소 리소스 바인딩
    VK_QUEUE_PROTECTED_BIT      = 0x00000010,  // 보호 메모리 연산
    VK_QUEUE_VIDEO_DECODE_BIT_KHR = 0x00000020,// 비디오 디코딩
    VK_QUEUE_VIDEO_ENCODE_BIT_KHR = 0x00000040,// 비디오 인코딩
    VK_QUEUE_OPTICAL_FLOW_BIT_NV  = 0x00000100,// 옵티컬 플로우 (NVIDIA)
} VkQueueFlagBits;
```

| 플래그 | 설명 | 용도 |
|--------|------|------|
| `GRAPHICS_BIT` | 그래픽스 파이프라인 실행 | `vkCmdDraw*`, 렌더패스 등 |
| `COMPUTE_BIT` | 컴퓨트 파이프라인 실행 | `vkCmdDispatch*` |
| `TRANSFER_BIT` | 데이터 전송 연산 | `vkCmdCopy*`, `vkCmdBlit*` 등 |
| `SPARSE_BINDING_BIT` | 희소 메모리 바인딩 | `vkQueueBindSparse` |
| `PROTECTED_BIT` | 보호 메모리 연산 | DRM 콘텐츠 처리 |
| `VIDEO_DECODE_BIT_KHR` | 비디오 디코딩 | 하드웨어 비디오 디코더 |
| `VIDEO_ENCODE_BIT_KHR` | 비디오 인코딩 | 하드웨어 비디오 인코더 |

> **암시적 전송 능력**: `GRAPHICS_BIT` 또는 `COMPUTE_BIT`를 지원하는 큐 패밀리는 `TRANSFER_BIT`도 **암시적으로 지원**한다. 전용 전송 큐(TRANSFER_BIT만 있는 큐)는 주로 외장 GPU에서 DMA를 통한 비동기 데이터 전송에 사용된다.

#### 일반적인 큐 패밀리 구성 예시

<img src="/images/02_devsandqueues/queues_hypothetical.png" alt="큐 패밀리 구조" class="light-bg" />

> 출처: [Vulkan Guide — Queues](https://docs.vulkan.org/guide/latest/queues.html). 2개의 큐 패밀리에 각각 다른 능력과 큐 수를 가진 가상의 구현 예시.

```
큐 패밀리 0: GRAPHICS | COMPUTE | TRANSFER  (범용 그래픽스 큐) - 16개
큐 패밀리 1: COMPUTE | TRANSFER              (비동기 컴퓨트 큐) - 2개
큐 패밀리 2: TRANSFER                        (전용 전송 큐, DMA) - 2개
큐 패밀리 3: VIDEO_DECODE                    (비디오 디코딩 큐) - 1개
```

### 3.2 큐 생성 — VkDeviceQueueCreateInfo

큐는 `vkCreateDevice` 호출 시 VkDeviceQueueCreateInfo를 통해 요청된다:

```c
typedef struct VkDeviceQueueCreateInfo {
    VkStructureType          sType;            // VK_STRUCTURE_TYPE_DEVICE_QUEUE_CREATE_INFO
    const void*              pNext;            // 확장 체인
    VkDeviceQueueCreateFlags flags;            // 플래그 (보호 큐 등)
    uint32_t                 queueFamilyIndex; // 큐 패밀리 인덱스
    uint32_t                 queueCount;       // 생성할 큐 수
    const float*             pQueuePriorities; // 각 큐의 우선순위 배열 [0.0, 1.0]
} VkDeviceQueueCreateInfo;
```

**큐 우선순위 규칙:** <sup class="fn-ref"><a href="/log/vulkan/02_devsandqueues/#큐-우선순위는-os-프로세스-우선순위와-비슷한가">[5]</a><span class="fn-tooltip"><span class="fn-title"><a href="/log/vulkan/02_devsandqueues/#큐-우선순위는-os-프로세스-우선순위와-비슷한가">큐 우선순위는 OS 프로세스 우선순위와 비슷한가?</a></span><span class="fn-desc">비슷하지만 GPU는 보통 실행 중인 워크를 선점하지 않는다는 핵심 차이. 실무에서는 대부분 1.0으로 통일.</span></span></sup>

- 각 큐에 `0.0`(최저) ~ `1.0`(최고) 범위의 우선순위를 지정한다
- `pQueuePriorities` 배열의 크기는 `queueCount`와 같아야 한다
- 우선순위는 **같은 디바이스 내 큐 간의 상대적 스케줄링 힌트**이다
- 구현체가 반드시 우선순위를 엄격하게 따를 의무는 없다 (구현 정의)
- **다른 프로세스의 큐와의 우선순위 관계는 정의되지 않는다**

**VkDeviceQueueCreateFlags:**

| 플래그 | 설명 |
|--------|------|
| `VK_DEVICE_QUEUE_CREATE_PROTECTED_BIT` | 보호 메모리 지원 큐 생성 |

> **유효 사용 조건**: 같은 `queueFamilyIndex`를 가진 VkDeviceQueueCreateInfo가 `pQueueCreateInfos` 배열에 중복되면 안 된다.

### 3.3 큐 핸들 획득 — vkGetDeviceQueue

디바이스가 생성된 후, 각 큐의 핸들을 획득한다:

```c
void vkGetDeviceQueue(
    VkDevice  device,           // 논리 디바이스
    uint32_t  queueFamilyIndex, // 큐 패밀리 인덱스
    uint32_t  queueIndex,       // 해당 패밀리 내 큐 인덱스 (0부터 시작)
    VkQueue*  pQueue);          // 큐 핸들 반환
```

Vulkan 1.1 이상 (flags 지정 큐에 대해):

```c
void vkGetDeviceQueue2(
    VkDevice                  device,
    const VkDeviceQueueInfo2* pQueueInfo,
    VkQueue*                  pQueue);
```

**유효 사용 조건:**

- `queueFamilyIndex`는 디바이스 생성 시 VkDeviceQueueCreateInfo에서 사용된 큐 패밀리 인덱스여야 한다
- `queueIndex`는 해당 큐 패밀리에서 생성된 큐 수보다 작아야 한다

### 3.4 큐 제출 개요

큐에 작업을 제출하는 기본 흐름:

```
1. 커맨드 버퍼 기록 (vkBeginCommandBuffer → vkCmd* → vkEndCommandBuffer)
2. 큐에 제출 (vkQueueSubmit / vkQueueSubmit2)
3. 완료 대기 (펜스 또는 vkQueueWaitIdle / vkDeviceWaitIdle)
```

```c
VkResult vkQueueSubmit(
    VkQueue                 queue,          // 제출 대상 큐
    uint32_t                submitCount,    // 제출 배치 수
    const VkSubmitInfo*     pSubmits,       // 제출 정보 배열
    VkFence                 fence);         // 완료 시 시그널할 펜스 (선택)
```

**큐 제출 동기화 규칙:**

- 같은 큐에 제출된 커맨드 버퍼는 **제출 순서대로 시작**되지만, **완료 순서는 보장되지 않는다**
- 같은 큐에 대한 제출은 반드시 **외부에서 동기화**해야 한다 (하나의 스레드에서만 제출하거나, 뮤텍스 사용)
- 서로 다른 큐에는 다른 스레드에서 **동시에 제출**할 수 있다

```c
VkResult vkQueueWaitIdle(VkQueue queue);  // 큐의 모든 작업 완료까지 대기
VkResult vkDeviceWaitIdle(VkDevice device); // 디바이스의 모든 큐 대기
```

> **성능 팁**: `vkDeviceWaitIdle`은 모든 큐를 멈추므로 프로덕션 코드에서는 펜스를 사용한 세밀한 동기화가 바람직하다.

---

## 전체 흐름 요약

```
1. 물리 디바이스 열거
   └─ vkEnumeratePhysicalDevices → VkPhysicalDevice 목록

2. 물리 디바이스 조사
   ├─ vkGetPhysicalDeviceProperties → 속성 (이름, 유형, 제한 등)
   ├─ vkGetPhysicalDeviceFeatures → 지원 기능 (지오메트리 셰이더 등)
   ├─ vkGetPhysicalDeviceQueueFamilyProperties → 큐 패밀리 정보
   ├─ vkGetPhysicalDeviceFormatProperties → 포맷별 지원 여부
   └─ vkGetPhysicalDeviceMemoryProperties → 메모리 힙/유형 (Memory 챕터)

3. 적합한 물리 디바이스 선택
   └─ 앱 요구사항에 맞는 디바이스와 큐 패밀리 결정

4. 논리 디바이스 생성
   ├─ VkDeviceQueueCreateInfo 구성 (큐 패밀리, 큐 수, 우선순위)
   ├─ VkDeviceCreateInfo 구성 (큐, 익스텐션, 기능)
   └─ vkCreateDevice 호출

5. 큐 핸들 획득
   └─ vkGetDeviceQueue(device, familyIndex, queueIndex, &queue)

6. 이제 GPU 작업 제출 준비 완료!
```

---

## 이 챕터에서 기억할 것

1. **물리 디바이스는 읽기 전용** — 열거하고 속성/기능/제한을 조회할 뿐, 직접 작업을 제출하지 않는다
2. **기능은 명시적 활성화 필수** — 조회한 기능 중 사용할 것만 VkDeviceCreateInfo에서 켜야 하며, 미지원 기능 활성화 시 디바이스 생성 실패
3. **큐는 직접 생성/파괴하지 않는다** — 논리 디바이스 생성 시 함께 만들어지고, vkGetDeviceQueue로 핸들만 획득한다
4. **큐 패밀리의 능력을 확인하라** — 그래픽스, 컴퓨트, 전송 큐가 분리되어 있을 수 있으며, 그래픽스/컴퓨트 큐는 전송을 암시적으로 지원한다
5. **디바이스 분실은 복구 가능** — `VK_ERROR_DEVICE_LOST` 발생 시 리소스 정리 후 새 논리 디바이스를 생성하여 재시작할 수 있다

---

*이 문서는 Vulkan 명세의 Devices and Queues 챕터를 한글로 요약한 것입니다.*
*세부 사항은 원본 명세를 참조하세요.*
