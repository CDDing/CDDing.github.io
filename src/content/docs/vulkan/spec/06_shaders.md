---
title: "Shaders (셰이더) — 한글 요약"
sidebar:
  label: "06. Shaders"
---

> 원본: [Shaders](https://docs.vulkan.org/spec/latest/chapters/shaders.html)

셰이더는 그래픽스/컴퓨트 파이프라인의 각 스테이지에서 **프로그래밍 가능한 연산**을 수행하는 프로그램이다.
Vulkan 셰이더는 **SPIR-V** 바이트코드로 제공되며, 전통적인 `VkShaderModule` 방식 또는 Vulkan 1.4+의 `VkShaderEXT` (Shader Objects) 방식으로 사용할 수 있다.

---

## 1. Shader Modules (셰이더 모듈)

### 1.1 VkShaderModule — 전통적 방식

셰이더 모듈은 SPIR-V 바이트코드를 캡슐화하는 불투명 객체다. 파이프라인 생성 시 `VkPipelineShaderStageCreateInfo`를 통해 참조된다.

```c
VkResult vkCreateShaderModule(
    VkDevice                        device,
    const VkShaderModuleCreateInfo*  pCreateInfo,
    const VkAllocationCallbacks*    pAllocator,
    VkShaderModule*                 pShaderModule);
```

```c
typedef struct VkShaderModuleCreateInfo {
    VkStructureType             sType;      // VK_STRUCTURE_TYPE_SHADER_MODULE_CREATE_INFO
    const void*                 pNext;
    VkShaderModuleCreateFlags   flags;      // 예약됨, 0
    size_t                      codeSize;   // SPIR-V 바이트코드 크기 (바이트 단위, 4의 배수)
    const uint32_t*             pCode;      // SPIR-V 바이트코드 포인터
} VkShaderModuleCreateInfo;
```

> **핵심 규칙**: `codeSize`는 반드시 **4의 배수**여야 하며, `pCode`는 유효한 SPIR-V 모듈이어야 한다.

### 1.2 셰이더 모듈 파괴

```c
void vkDestroyShaderModule(
    VkDevice                        device,
    VkShaderModule                  shaderModule,
    const VkAllocationCallbacks*    pAllocator);
```

파이프라인이 생성된 후에는 셰이더 모듈을 즉시 파괴해도 된다 — 파이프라인은 모듈의 복사본을 이미 가지고 있다.

### 1.3 파이프라인 셰이더 스테이지

파이프라인 생성 시 각 셰이더 스테이지를 `VkPipelineShaderStageCreateInfo`로 지정한다:

```c
typedef struct VkPipelineShaderStageCreateInfo {
    VkStructureType                     sType;
    const void*                         pNext;
    VkPipelineShaderStageCreateFlags    flags;
    VkShaderStageFlagBits               stage;              // 이 스테이지의 셰이더 종류
    VkShaderModule                      module;             // 셰이더 모듈 (또는 VK_NULL_HANDLE)
    const char*                         pName;              // 진입점(Entry Point) 이름
    const VkSpecializationInfo*         pSpecializationInfo; // 특수화 상수 (선택)
} VkPipelineShaderStageCreateInfo;
```

> `module`이 `VK_NULL_HANDLE`이면 `pNext` 체인에 `VkShaderModuleCreateInfo`를 직접 연결할 수 있다 (인라인 방식).

---

## 2. Shader Stages (셰이더 스테이지)

Vulkan은 다양한 셰이더 스테이지를 지원한다. 각 스테이지는 파이프라인의 특정 단계에서 실행된다.

### 2.1 셰이더 스테이지 플래그

```c
typedef enum VkShaderStageFlagBits {
    VK_SHADER_STAGE_VERTEX_BIT                  = 0x00000001,
    VK_SHADER_STAGE_TESSELLATION_CONTROL_BIT    = 0x00000002,
    VK_SHADER_STAGE_TESSELLATION_EVALUATION_BIT = 0x00000004,
    VK_SHADER_STAGE_GEOMETRY_BIT                = 0x00000008,
    VK_SHADER_STAGE_FRAGMENT_BIT                = 0x00000010,
    VK_SHADER_STAGE_COMPUTE_BIT                 = 0x00000020,
    VK_SHADER_STAGE_TASK_BIT_EXT                = 0x00000040,
    VK_SHADER_STAGE_MESH_BIT_EXT                = 0x00000080,
    VK_SHADER_STAGE_ALL_GRAPHICS                = 0x0000001F,
    VK_SHADER_STAGE_ALL                         = 0x7FFFFFFF,
} VkShaderStageFlagBits;
```

### 2.2 그래픽스 파이프라인 스테이지 순서

| 순서 | 스테이지 | 설명 | 필수 여부 |
|------|---------|------|----------|
| 1 | **Vertex** | 버텍스별 변환 (위치, 법선 등) | **필수** |
| 2 | **Tessellation Control** | 패치 단위 제어점 처리, 테셀레이션 레벨 결정 | 선택 |
| 3 | **Tessellation Evaluation** | 테셀레이션된 버텍스의 최종 위치 계산 | 선택 (Control과 쌍) |
| 4 | **Geometry** | 프리미티브 단위 처리, 프리미티브 생성/제거 가능 | 선택 |
| 5 | **Fragment** | 프래그먼트별 색상/깊이 계산 | 선택 (래스터화 시 필요) |

### 2.3 메시 셰이더 파이프라인 (대안 경로)

| 순서 | 스테이지 | 설명 |
|------|---------|------|
| 1 | **Task** (선택) | 워크그룹 단위로 메시 셰이더 디스패치 결정 |
| 2 | **Mesh** | 버텍스 + 프리미티브를 직접 생성 (버텍스 입력 스테이지 대체) |
| 3 | **Fragment** | 프래그먼트별 처리 |

> **실무 팁**: 메시 셰이더는 전통적인 Vertex → Tessellation → Geometry 경로를 **완전히 대체**한다. 같은 파이프라인에서 두 경로를 혼용할 수 없다.

### 2.4 컴퓨트 셰이더

컴퓨트 셰이더는 그래픽스와 독립적으로 **워크그룹(Workgroup)** 단위로 실행된다. 범용 병렬 연산에 사용한다.

- 컴퓨트 파이프라인에는 셰이더 스테이지가 **하나뿐** (Compute)
- `VK_QUEUE_COMPUTE_BIT`를 지원하는 큐에서 실행

---

## 3. Shader Objects (셰이더 오브젝트, VK_EXT_shader_object)

`VK_EXT_shader_object` 확장으로 제공되는 기능. 파이프라인 없이 **개별 셰이더 스테이지를 독립적으로 컴파일/바인딩**할 수 있다.

### 3.1 왜 Shader Objects인가?

| 비교 항목 | VkShaderModule + Pipeline | VkShaderEXT (Shader Objects) |
|-----------|--------------------------|------------------------------|
| 상태 관리 | 파이프라인에 고정 | **동적 상태**로 커맨드 버퍼에서 설정 |
| 조합 폭발 | 스테이트 조합마다 별도 파이프라인 필요 | 셰이더를 자유롭게 교체 |
| 컴파일 시점 | 파이프라인 생성 시 | 셰이더 오브젝트 생성 시 |
| 캐싱 | Pipeline Cache | 바이너리 데이터로 직접 캐싱 가능 |

### 3.2 셰이더 오브젝트 생성

```c
VkResult vkCreateShadersEXT(
    VkDevice                            device,
    uint32_t                            createInfoCount,
    const VkShaderCreateInfoEXT*        pCreateInfos,
    const VkAllocationCallbacks*        pAllocator,
    VkShaderEXT*                        pShaders);
```

```c
typedef struct VkShaderCreateInfoEXT {
    VkStructureType                 sType;
    const void*                     pNext;
    VkShaderCreateFlagsEXT          flags;                  // 생성 플래그
    VkShaderStageFlagBits           stage;                  // 셰이더 스테이지 (단일)
    VkShaderStageFlags              nextStage;              // 이 셰이더 다음에 올 수 있는 스테이지들
    VkShaderCodeTypeEXT             codeType;               // SPIRV 또는 BINARY
    size_t                          codeSize;               // 바이트코드 크기
    const void*                     pCode;                  // 바이트코드 포인터
    const char*                     pName;                  // 진입점 이름
    uint32_t                        setLayoutCount;         // 디스크립터 셋 레이아웃 수
    const VkDescriptorSetLayout*    pSetLayouts;            // 디스크립터 셋 레이아웃 배열
    uint32_t                        pushConstantRangeCount; // 푸시 상수 범위 수
    const VkPushConstantRange*      pPushConstantRanges;    // 푸시 상수 범위 배열
    const VkSpecializationInfo*     pSpecializationInfo;    // 특수화 상수 (선택)
} VkShaderCreateInfoEXT;
```

### 3.3 셰이더 코드 타입

```c
typedef enum VkShaderCodeTypeEXT {
    VK_SHADER_CODE_TYPE_BINARY_EXT = 0,   // 구현체별 바이너리 (캐싱용)
    VK_SHADER_CODE_TYPE_SPIRV_EXT  = 1,   // 표준 SPIR-V 바이트코드
} VkShaderCodeTypeEXT;
```

### 3.4 셰이더 생성 플래그

| 플래그 | 설명 |
|--------|------|
| `LINK_STAGE_BIT` | 다른 스테이지와 **링크** 컴파일 (최적화 가능) |
| `ALLOW_VARYING_SUBGROUP_SIZE_BIT` | 서브그룹 크기 가변 허용 |
| `REQUIRE_FULL_SUBGROUPS_BIT` | 워크그룹 내 모든 서브그룹이 꽉 차야 함 |
| `NO_TASK_SHADER_BIT` | 메시 셰이더가 태스크 셰이더 없이 실행됨을 명시 |
| `DISPATCH_BASE_BIT` | 비제로 base offset 디스패치 허용 |
| `DESCRIPTOR_HEAP_BIT` | 디스크립터 힙 기반 접근 사용 |

### 3.5 셰이더 오브젝트 바인딩

```c
void vkCmdBindShadersEXT(
    VkCommandBuffer                 commandBuffer,
    uint32_t                        stageCount,
    const VkShaderStageFlagBits*    pStages,        // 바인딩할 스테이지 목록
    const VkShaderEXT*              pShaders);      // 셰이더 오브젝트 (또는 VK_NULL_HANDLE)
```

- `pShaders`에 `VK_NULL_HANDLE`을 넣으면 해당 스테이지 **언바인딩**
- 링크된 셰이더끼리는 순서 상관없이 바인딩 가능

### 3.6 바이너리 캐싱

```c
VkResult vkGetShaderBinaryDataEXT(
    VkDevice        device,
    VkShaderEXT     shader,
    size_t*         pDataSize,
    void*           pData);         // NULL이면 크기만 반환
```

바이너리 호환성은 `VkPhysicalDeviceShaderObjectPropertiesEXT`의 `shaderBinaryUUID`와 `shaderBinaryVersion`이 일치해야 보장된다.

> **실무 팁**: 바이너리 캐시를 디스크에 저장하면 다음 실행 시 SPIR-V → 바이너리 변환을 건너뛸 수 있다. 단, 드라이버 업데이트 시 UUID가 바뀌므로 반드시 호환성 체크가 필요하다.

---

## 4. Shader Input/Output Interface (셰이더 입출력 인터페이스)

### 4.1 스테이지 간 데이터 흐름

셰이더 스테이지 간 데이터는 **Location** 기반으로 매칭된다:

```
Vertex Out (Location=0) ──▶ Fragment In (Location=0)
Vertex Out (Location=1) ──▶ Fragment In (Location=1)
```

### 4.2 Location 슬롯 소비 규칙

| 타입 | 슬롯 소비 |
|------|----------|
| `float`, `int`, `uint` (32-bit) | Component 1개 |
| `vec2` | Component 2개 (1 Location) |
| `vec3` | Component 3개 (1 Location) |
| `vec4` | Component 4개 (1 Location) |
| `dvec2` (64-bit) | Component 4개 (1 Location) |
| `dvec4` (64-bit) | 2 Location |
| `mat4` | 4 Location |

### 4.3 인터페이스 매칭 규칙

- 출력과 입력의 `Location`/`Component`가 **동일**해야 매칭
- **타입이 호환**되어야 함 (같은 기본 타입, 같은 크기)
- 내장 변수(Built-in)는 Location 매칭이 아닌 **이름으로 매칭**
- 프래그먼트 셰이더 입력은 이전 스테이지 출력과 반드시 매칭되어야 함 (내장 변수 제외)

### 4.4 버텍스 입력 인터페이스

버텍스 셰이더의 `Input` 변수들은 `VkPipelineVertexInputStateCreateInfo`의 어트리뷰트 정의와 매칭된다:

- `location` 데코레이션 필수
- 최대 Location 수: 디바이스의 `maxVertexInputAttributes` 제한

### 4.5 프래그먼트 출력 인터페이스

프래그먼트 셰이더 출력은 **컬러 어태치먼트**와 Location으로 매칭:

| Location | 출력 | 대상 |
|----------|------|------|
| 0 | `outColor0` | Color Attachment 0 |
| 1 | `outColor1` | Color Attachment 1 |

- `Index` 데코레이션으로 **듀얼 소스 블렌딩** 지원 (Index 0, 1)
- Vulkan 1.4: `vkCmdSetRenderingAttachmentLocations()`로 동적 리매핑 가능

---

## 5. Built-in Variables (내장 변수)

내장 변수는 SPIR-V의 `BuiltIn` 데코레이션으로 선언하며, `Location` 데코레이션과 병용할 수 없다.

### 5.1 버텍스 셰이더

| 내장 변수 | 방향 | 타입 | 설명 |
|----------|------|------|------|
| `VertexIndex` | In | `int` | 현재 버텍스 인덱스 |
| `InstanceIndex` | In | `int` | 현재 인스턴스 인덱스 |
| `BaseVertex` | In | `int` | 드로 콜의 기본 버텍스 오프셋 |
| `BaseInstance` | In | `int` | 드로 콜의 기본 인스턴스 오프셋 |
| `DrawIndex` | In | `int` | 멀티드로 내 현재 드로 인덱스 |
| `Position` | Out | `vec4` | 클립 공간 위치 |
| `PointSize` | Out | `float` | 포인트 래스터화 크기 |
| `ClipDistance[]` | Out | `float[]` | 클리핑 평면 거리 |
| `CullDistance[]` | Out | `float[]` | 컬링 거리 |

### 5.2 프래그먼트 셰이더

| 내장 변수 | 방향 | 타입 | 설명 |
|----------|------|------|------|
| `FragCoord` | In | `vec4` | 프래그먼트의 윈도우 좌표 (x, y, z=깊이, w=1/w) |
| `FrontFacing` | In | `bool` | 전면(`true`) / 후면(`false`) 여부 |
| `SampleId` | In | `int` | 멀티샘플링 시 현재 샘플 인덱스 |
| `SamplePosition` | In | `vec2` | 픽셀 내 샘플 위치 |
| `SampleMaskIn[]` | In | `int[]` | 입력 샘플 마스크 |
| `FragDepth` | Out | `float` | 출력 깊이값 (기본은 `FragCoord.z`) |

> **핵심 규칙**: `FragDepth`를 쓰는 경우, 헬퍼 호출이 아닌 **모든 실행 경로**에서 값을 기록하거나 `discard`해야 한다.

### 5.3 컴퓨트 셰이더

| 내장 변수 | 방향 | 타입 | 설명 |
|----------|------|------|------|
| `NumWorkGroups` | In | `uvec3` | 디스패치된 워크그룹 수 (x, y, z) |
| `WorkGroupId` | In | `uvec3` | 현재 워크그룹의 인덱스 |
| `LocalInvocationId` | In | `uvec3` | 워크그룹 내 로컬 위치 |
| `GlobalInvocationId` | In | `uvec3` | 전역 인덱스 = WorkGroupId × WorkGroupSize + LocalInvocationId |
| `LocalInvocationIndex` | In | `uint` | 로컬 위치의 1차원 인덱스 |

### 5.4 테셀레이션 셰이더

| 내장 변수 | 스테이지 | 설명 |
|----------|---------|------|
| `PatchVertices` | Control / Eval | 패치당 버텍스 수 |
| `PrimitiveId` | Control / Eval | 프리미티브 인덱스 |
| `InvocationId` | Control | 제어점 인덱스 |
| `TessLevelOuter[4]` | Control(Out) / Eval(In) | 외부 테셀레이션 레벨 |
| `TessLevelInner[2]` | Control(Out) / Eval(In) | 내부 테셀레이션 레벨 |
| `TessCoord` | Eval(In) | 테셀레이션된 도메인 좌표 |

---

## 6. Shader Resource Interface (셰이더 리소스 인터페이스)

셰이더가 외부 리소스에 접근하는 방법은 크게 **세 가지**다.

### 6.1 디스크립터 셋 인터페이스

SPIR-V에서 `DescriptorSet`과 `Binding` 데코레이션으로 선언한다:

```glsl
layout(set = 0, binding = 0) uniform UniformBuffer { ... } ubo;
layout(set = 0, binding = 1) uniform sampler2D texSampler;
layout(set = 1, binding = 0) buffer StorageBuffer { ... } ssbo;
```

| 리소스 타입 | 스토리지 클래스 | SPIR-V 타입 | 필수 데코레이션 |
|------------|----------------|-------------|----------------|
| Sampler | UniformConstant | OpTypeSampler | DescriptorSet, Binding |
| Sampled Image | UniformConstant | OpTypeImage (Sampled=1) | DescriptorSet, Binding |
| Storage Image | UniformConstant | OpTypeImage (Sampled=2) | DescriptorSet, Binding |
| Uniform Buffer | Uniform | OpTypeStruct (Block) | DescriptorSet, Binding, Offset |
| Storage Buffer | StorageBuffer | OpTypeStruct (Block) | DescriptorSet, Binding, Offset |
| Input Attachment | UniformConstant | OpTypeImage (SubpassData) | InputAttachmentIndex |

### 6.2 푸시 상수 인터페이스

푸시 상수는 디스크립터 셋 없이 **직접 셰이더에 상수를 전달**하는 빠른 경로다:

```glsl
layout(push_constant) uniform PushConstants {
    mat4 mvp;
    vec4 color;
} pc;
```

- 스토리지 클래스: `PushConstant`
- `Block` 데코레이션 필수
- `Offset`, `ArrayStride`, `MatrixStride` 등 **명시적 레이아웃** 필요
- 진입점당 **최대 하나**의 푸시 상수 블록
- 크기 제한: `maxPushConstantsSize` (보통 128~256 바이트)

> **실무 팁**: MVP 매트릭스, 타임 값 같은 매 프레임 변하는 소규모 데이터에 적합하다. 큰 데이터는 Uniform Buffer를 사용하라.

### 6.3 디스크립터 힙 인터페이스

`VK_EXT_shader_object`의 `DESCRIPTOR_HEAP` 플래그 사용 시, 디스크립터 셋 레이아웃 없이 힙에서 직접 리소스를 인덱싱한다:

- `SamplerHeapEXT` — 샘플러 힙 포인터
- `ResourceHeapEXT` — 리소스 힙 포인터
- 비균일 인덱싱(non-uniform indexing) 별도 제한 없음

---

## 7. Specialization Constants (특수화 상수)

### 7.1 개념

특수화 상수는 **파이프라인/셰이더 오브젝트 생성 시점**에 값을 결정하는 컴파일 타임 상수다. 같은 SPIR-V 모듈로 서로 다른 동작을 만들 수 있다.

```glsl
layout(constant_id = 0) const int KERNEL_SIZE = 3;    // 기본값 3
layout(constant_id = 1) const float THRESHOLD = 0.5;  // 기본값 0.5
```

### 7.2 VkSpecializationInfo

```c
typedef struct VkSpecializationInfo {
    uint32_t                        mapEntryCount;  // 매핑 엔트리 수
    const VkSpecializationMapEntry* pMapEntries;    // 매핑 엔트리 배열
    size_t                          dataSize;       // 데이터 버퍼 크기
    const void*                     pData;          // 상수 값 데이터
} VkSpecializationInfo;
```

```c
typedef struct VkSpecializationMapEntry {
    uint32_t    constantID;     // SPIR-V constant_id 값
    uint32_t    offset;         // pData 내 오프셋
    size_t      size;           // 상수 값의 바이트 크기
} VkSpecializationMapEntry;
```

### 7.3 사용 흐름

```
SPIR-V 모듈 (constant_id = 0, default = 3)
         │
         ▼
VkSpecializationInfo { constantID=0, value=5 }
         │
         ▼
파이프라인 생성 시 KERNEL_SIZE = 5로 컴파일
```

> **실무 팁**: 특수화 상수를 활용하면 `if/else` 분기 대신 **컴파일 타임에 분기를 제거**할 수 있어 성능이 향상된다. 예: 라이트 수, 텍스처 필터 모드, 기능 on/off 등.

---

## 8. Shader Execution (셰이더 실행)

### 8.1 호출(Invocation)과 워크그룹

| 개념 | 설명 |
|------|------|
| **Invocation** | 셰이더의 단일 실행 단위. 버텍스 셰이더에서는 버텍스당, 프래그먼트 셰이더에서는 프래그먼트당 하나 |
| **Workgroup** | 컴퓨트 셰이더에서 함께 실행되는 호출의 그룹. 공유 메모리(shared memory) 접근 가능 |
| **Subgroup** | 하드웨어에서 SIMD로 병렬 실행되는 호출의 집합 |

### 8.2 각 스테이지별 호출 단위

| 스테이지 | 호출 단위 | 호출 수 결정 |
|---------|----------|-------------|
| Vertex | 버텍스당 1회 | 드로 콜의 버텍스 수 |
| Tessellation Control | 제어점당 1회 | 패치의 제어점 수 |
| Tessellation Evaluation | 테셀레이션 버텍스당 1회 | 테셀레이션 레벨에 의해 결정 |
| Geometry | 프리미티브당 N회 | `maxGeometryShaderInvocations` 이내 |
| Fragment | 프래그먼트당 1회 | 래스터화된 프래그먼트 수 |
| Compute | 워크그룹 내 스레드당 1회 | `vkCmdDispatch(x, y, z)` |

---

## 9. Dynamic State와 Shader Objects

Shader Objects 사용 시, 파이프라인에 고정되던 상태를 **커맨드 버퍼에서 동적으로 설정**해야 한다.

### 9.1 항상 필수인 동적 상태

```c
vkCmdSetViewportWithCount(...)
vkCmdSetScissorWithCount(...)
vkCmdSetRasterizerDiscardEnable(...)
```

### 9.2 스테이지별 필수 동적 상태

| 스테이지 | 필수 동적 상태 |
|---------|--------------|
| Vertex | `SetVertexInputEXT`, `SetPrimitiveTopology`, `SetPrimitiveRestartEnable` |
| Tessellation | `SetPatchControlPointsEXT`, `SetTessellationDomainOriginEXT` |
| Rasterization | `SetPolygonModeEXT`, `SetCullMode`, `SetFrontFace`, `SetLineWidth`, `SetRasterizationSamplesEXT`, `SetSampleMaskEXT` |
| Depth/Stencil | `SetDepthTestEnable`, `SetDepthWriteEnable`, `SetDepthCompareOp`, `SetStencilTestEnable`, `SetStencilOp` |
| Fragment | `SetColorBlendEnableEXT`, `SetColorWriteMaskEXT`, `SetColorBlendEquationEXT`, `SetAlphaToCoverageEnableEXT` |

> **핵심 규칙**: Shader Objects를 쓸 때 동적 상태 설정을 빠뜨리면 **검증 레이어 에러**가 발생한다. 모든 필수 상태를 드로 콜 전에 설정해야 한다.

---

## 10. 유효성 검증 규칙 요약

### SPIR-V 코드 요구사항

| 요구사항 | 설명 |
|---------|------|
| `codeSize` | 4의 배수 |
| `Shader` Capability | 반드시 선언 |
| 진입점 | 지정된 스테이지의 Execution Model과 일치 |
| 미지원 Capability | 선언 금지 |

### 스테이지별 제한

| 스테이지 | 제한 사항 |
|---------|----------|
| Tessellation | `OutputVertices` > 0 && ≤ `maxTessellationPatchSize` |
| Geometry | 출력 버텍스 ≤ `maxGeometryOutputVertices`, 호출 수 ≤ `maxGeometryShaderInvocations` |
| Fragment | `FragDepth` 기록 시 모든 경로에서 기록 또는 discard |
| 배열 제한 | `ClipDistance[]` ≤ `maxClipDistances`, `CullDistance[]` ≤ `maxCullDistances` |

### 링크된 셰이더 (Shader Objects)

- 링크된 모든 셰이더는 **같은 codeType** 사용
- 스테이지 **중복 불가**
- Task/Mesh와 Vertex를 **같은 링크에서 혼용 불가**
- 스테이지 순서 유지 필수

---

## 이 챕터에서 기억할 것

1. **VkShaderModule**은 SPIR-V 코드를 캡슐화하는 전통적 방식이고, **VkShaderEXT (Shader Objects)**는 파이프라인 없이 개별 셰이더를 동적으로 바인딩하는 새로운 방식이다. 둘 다 알아야 한다.

2. 셰이더 스테이지 간 데이터 전달은 **Location 매칭**으로 이루어진다. 출력의 Location과 입력의 Location이 일치해야 하며, 타입도 호환되어야 한다.

3. **특수화 상수(Specialization Constants)**를 활용하면 같은 SPIR-V 모듈로 서로 다른 셰이더 변형을 만들 수 있다. 런타임 분기 대신 컴파일 타임 분기 제거로 성능을 향상시킨다.

4. 셰이더 리소스 접근은 **디스크립터 셋**, **푸시 상수**, **디스크립터 힙** 세 가지 경로가 있다. 소규모 데이터는 푸시 상수, 대규모 리소스는 디스크립터 셋을 사용한다.

5. Shader Objects 사용 시 **모든 파이프라인 상태를 동적으로 설정**해야 한다. 뷰포트, 시저, 래스터화, 블렌딩 등 빠뜨리는 상태가 없는지 검증 레이어로 확인하라.

---

*이 문서는 Vulkan 명세의 Shaders 챕터를 한글로 요약한 것입니다.*
*세부 사항은 원본 명세를 참조하세요.*
