---
title: "Pipelines (파이프라인) — 한글 요약"
sidebar:
  label: "07. Pipelines"
---

> 원본: [Pipelines](https://docs.vulkan.org/spec/latest/chapters/pipelines.html)

파이프라인은 GPU가 실행할 **셰이더 스테이지와 고정 함수 상태를 하나로 묶은 불변(immutable) 객체**다.
Vulkan은 파이프라인을 사전에 컴파일하여 런타임 유효성 검사 비용을 제거하고,
드라이버가 셰이더 간 입출력을 기반으로 **전체 최적화**를 수행할 수 있게 한다.

---

## 1. 파이프라인 개요

### 1.1 파이프라인이란?

```c
VK_DEFINE_NON_DISPATCHABLE_HANDLE(VkPipeline)
```

- 파이프라인은 셰이더 스테이지 + 고정 함수 상태를 **단일 모놀리식 객체**로 결합한다
- 생성 후에는 상태를 변경할 수 없다 (불변) — 동적 상태(Dynamic State)로 지정한 부분만 런타임에 변경 가능
- `vkCmdBindPipeline`으로 커맨드 버퍼에 바인딩하여 사용

### 1.2 파이프라인 종류

| 종류 | 바인드 포인트 | 설명 |
|------|-------------|------|
| **그래픽스 파이프라인** | `VK_PIPELINE_BIND_POINT_GRAPHICS` | 정점 → 래스터화 → 프래그먼트의 전체 렌더링 파이프라인 |
| **컴퓨트 파이프라인** | `VK_PIPELINE_BIND_POINT_COMPUTE` | 단일 컴퓨트 셰이더로 구성된 범용 연산 파이프라인 |
| **레이 트레이싱 파이프라인** | `VK_PIPELINE_BIND_POINT_RAY_TRACING_KHR` | 레이 생성/교차/미스 셰이더 등으로 구성 (확장) |

### 1.3 파이프라인 바인딩

```c
void vkCmdBindPipeline(
    VkCommandBuffer         commandBuffer,
    VkPipelineBindPoint     pipelineBindPoint,
    VkPipeline              pipeline);
```

- 바인드 포인트별로 독립적 — 그래픽스 파이프라인을 바인딩해도 컴퓨트 파이프라인에 영향 없음
- 동적 상태로 지정된 값은 파이프라인 바인딩 시 리셋되지 않음

---

## 2. 그래픽스 파이프라인

### 2.1 파이프라인 스테이지 흐름

그래픽스 파이프라인은 다음 순서로 처리된다:

```
Input Assembler → Vertex Shader → [Tessellation] → [Geometry Shader]
    → Clipping → Rasterization → Fragment Shader → Framebuffer Operations
```

| 스테이지 | 필수 여부 | 설명 |
|----------|----------|------|
| **Input Assembler** | 필수 | 정점/인덱스 버퍼에서 정점 데이터 조립 |
| **Vertex Shader** | 필수 | 정점 변환, 위치/속성 계산 |
| **Tessellation** | 선택 | 프리미티브를 더 작은 조각으로 분할 (TCS + TES) |
| **Geometry Shader** | 선택 | 프리미티브 단위 처리, 토폴로지 변경 가능 |
| **Rasterization** | 필수 | 프리미티브를 프래그먼트로 변환 |
| **Fragment Shader** | 선택* | 프래그먼트 색상/깊이 계산 |
| **Framebuffer Ops** | 필수 | 깊이/스텐실 테스트, 컬러 블렌딩, 기록 |

> \* 래스터화가 비활성화(`rasterizerDiscardEnable = VK_TRUE`)되면 프래그먼트 셰이더 이후 스테이지가 모두 생략된다.

### 2.2 그래픽스 파이프라인 생성

```c
VkResult vkCreateGraphicsPipelines(
    VkDevice                                    device,
    VkPipelineCache                             pipelineCache,
    uint32_t                                    createInfoCount,
    const VkGraphicsPipelineCreateInfo*         pCreateInfos,
    const VkAllocationCallbacks*                pAllocator,
    VkPipeline*                                 pPipelines);
```

```c
typedef struct VkGraphicsPipelineCreateInfo {
    VkStructureType                                 sType;
    const void*                                     pNext;
    VkPipelineCreateFlags                           flags;
    uint32_t                                        stageCount;
    const VkPipelineShaderStageCreateInfo*           pStages;           // 셰이더 스테이지 배열
    const VkPipelineVertexInputStateCreateInfo*      pVertexInputState; // 정점 입력
    const VkPipelineInputAssemblyStateCreateInfo*    pInputAssemblyState; // 입력 어셈블리
    const VkPipelineTessellationStateCreateInfo*     pTessellationState;  // 테셀레이션 (선택)
    const VkPipelineViewportStateCreateInfo*         pViewportState;    // 뷰포트/시저
    const VkPipelineRasterizationStateCreateInfo*    pRasterizationState; // 래스터화
    const VkPipelineMultisampleStateCreateInfo*      pMultisampleState; // 멀티샘플링
    const VkPipelineDepthStencilStateCreateInfo*     pDepthStencilState;  // 깊이/스텐실
    const VkPipelineColorBlendStateCreateInfo*       pColorBlendState;  // 컬러 블렌딩
    const VkPipelineDynamicStateCreateInfo*           pDynamicState;     // 동적 상태
    VkPipelineLayout                                 layout;            // 파이프라인 레이아웃
    VkRenderPass                                     renderPass;        // 렌더 패스
    uint32_t                                         subpass;           // 서브패스 인덱스
    VkPipeline                                       basePipelineHandle;// 파생 파이프라인의 부모
    int32_t                                          basePipelineIndex; // 같은 배치 내 부모 인덱스
} VkGraphicsPipelineCreateInfo;
```

> **핵심**: 한 번의 `vkCreateGraphicsPipelines` 호출로 **여러 파이프라인을 일괄 생성**할 수 있다. 드라이버가 공통 부분을 재활용하여 생성 비용을 줄일 수 있다.

---

## 3. 셰이더 스테이지 (Shader Stages)

### 3.1 VkPipelineShaderStageCreateInfo

```c
typedef struct VkPipelineShaderStageCreateInfo {
    VkStructureType                     sType;
    const void*                         pNext;
    VkPipelineShaderStageCreateFlags    flags;
    VkShaderStageFlagBits               stage;      // 셰이더 스테이지 종류
    VkShaderModule                      module;     // 셰이더 모듈 (SPIR-V)
    const char*                         pName;      // 진입점 함수 이름
    const VkSpecializationInfo*         pSpecializationInfo; // 특수화 상수
} VkPipelineShaderStageCreateInfo;
```

### VkShaderStageFlagBits (주요 값)

| 플래그 | 설명 |
|--------|------|
| `VK_SHADER_STAGE_VERTEX_BIT` | 정점 셰이더 |
| `VK_SHADER_STAGE_TESSELLATION_CONTROL_BIT` | 테셀레이션 제어 셰이더 (TCS) |
| `VK_SHADER_STAGE_TESSELLATION_EVALUATION_BIT` | 테셀레이션 평가 셰이더 (TES) |
| `VK_SHADER_STAGE_GEOMETRY_BIT` | 지오메트리 셰이더 |
| `VK_SHADER_STAGE_FRAGMENT_BIT` | 프래그먼트 셰이더 |
| `VK_SHADER_STAGE_COMPUTE_BIT` | 컴퓨트 셰이더 |
| `VK_SHADER_STAGE_ALL_GRAPHICS` | 모든 그래픽스 셰이더 스테이지 |
| `VK_SHADER_STAGE_ALL` | 모든 셰이더 스테이지 |

### 3.2 특수화 상수 (Specialization Constants)

파이프라인 생성 시 셰이더의 상수 값을 **컴파일 타임에 주입**하는 메커니즘이다.
같은 SPIR-V 모듈에서 상수 값만 바꿔 여러 파이프라인 변형을 만들 수 있다.

```c
typedef struct VkSpecializationInfo {
    uint32_t                        mapEntryCount;  // 매핑 엔트리 수
    const VkSpecializationMapEntry* pMapEntries;    // 상수 ID → 데이터 매핑
    size_t                          dataSize;       // 전체 데이터 크기
    const void*                     pData;          // 상수 데이터
} VkSpecializationInfo;

typedef struct VkSpecializationMapEntry {
    uint32_t    constantID;    // SPIR-V의 specialization constant ID
    uint32_t    offset;        // pData 내 오프셋 (바이트)
    size_t      size;          // 데이터 크기 (바이트)
} VkSpecializationMapEntry;
```

> **실무 팁**: if/else 분기 대신 특수화 상수를 사용하면, 드라이버가 컴파일 시점에 dead code를 제거하여 **더 빠른 셰이더**를 생성한다.

---

## 4. 고정 함수 상태 (Fixed-Function State)

### 4.1 정점 입력 상태 (Vertex Input State)

정점 셰이더에 전달되는 정점 데이터의 **바인딩(어떤 버퍼)** 과 **속성(어떤 데이터)** 을 정의한다.

```c
typedef struct VkPipelineVertexInputStateCreateInfo {
    VkStructureType                             sType;
    const void*                                 pNext;
    VkPipelineVertexInputStateCreateFlags       flags;
    uint32_t                                    vertexBindingDescriptionCount;
    const VkVertexInputBindingDescription*      pVertexBindingDescriptions;
    uint32_t                                    vertexAttributeDescriptionCount;
    const VkVertexInputAttributeDescription*    pVertexAttributeDescriptions;
} VkPipelineVertexInputStateCreateInfo;
```

```c
typedef struct VkVertexInputBindingDescription {
    uint32_t            binding;    // 바인딩 번호 (0부터)
    uint32_t            stride;     // 정점 간 간격 (바이트)
    VkVertexInputRate   inputRate;  // 입력 속도
} VkVertexInputBindingDescription;
```

| VkVertexInputRate | 설명 |
|-------------------|------|
| `VK_VERTEX_INPUT_RATE_VERTEX` | 정점마다 데이터 진행 |
| `VK_VERTEX_INPUT_RATE_INSTANCE` | 인스턴스마다 데이터 진행 |

```c
typedef struct VkVertexInputAttributeDescription {
    uint32_t    location;   // 셰이더의 layout(location = N)과 매칭
    uint32_t    binding;    // 데이터를 가져올 바인딩 번호
    VkFormat    format;     // 데이터 포맷 (예: VK_FORMAT_R32G32B32_SFLOAT)
    uint32_t    offset;     // 바인딩 내 오프셋 (바이트)
} VkVertexInputAttributeDescription;
```

> **기억**: `binding`은 어떤 버퍼에서 가져올지, `location`은 셰이더의 어떤 입력 변수에 넣을지를 결정한다.

### 4.2 입력 어셈블리 상태 (Input Assembly State)

정점 데이터를 어떤 **프리미티브 토폴로지**로 조립할지 결정한다.

```c
typedef struct VkPipelineInputAssemblyStateCreateInfo {
    VkStructureType                             sType;
    const void*                                 pNext;
    VkPipelineInputAssemblyStateCreateFlags     flags;
    VkPrimitiveTopology                         topology;
    VkBool32                                    primitiveRestartEnable;
} VkPipelineInputAssemblyStateCreateInfo;
```

### VkPrimitiveTopology

| 토폴로지 | 설명 |
|----------|------|
| `VK_PRIMITIVE_TOPOLOGY_POINT_LIST` | 개별 점 |
| `VK_PRIMITIVE_TOPOLOGY_LINE_LIST` | 선분 리스트 (2개씩) |
| `VK_PRIMITIVE_TOPOLOGY_LINE_STRIP` | 연속 선분 |
| `VK_PRIMITIVE_TOPOLOGY_TRIANGLE_LIST` | 삼각형 리스트 (3개씩) |
| `VK_PRIMITIVE_TOPOLOGY_TRIANGLE_STRIP` | 삼각형 스트립 |
| `VK_PRIMITIVE_TOPOLOGY_TRIANGLE_FAN` | 삼각형 팬 |
| `VK_PRIMITIVE_TOPOLOGY_*_WITH_ADJACENCY` | 인접 정보 포함 변형 |
| `VK_PRIMITIVE_TOPOLOGY_PATCH_LIST` | 테셀레이션용 패치 |

- `primitiveRestartEnable`: 인덱스 버퍼에서 특수 값(0xFFFF 또는 0xFFFFFFFF)으로 프리미티브 스트립을 **중간에서 재시작**

### 4.3 뷰포트/시저 상태 (Viewport/Scissor State)

```c
typedef struct VkPipelineViewportStateCreateInfo {
    VkStructureType                         sType;
    const void*                             pNext;
    VkPipelineViewportStateCreateFlags      flags;
    uint32_t                                viewportCount;
    const VkViewport*                       pViewports;
    uint32_t                                scissorCount;
    const VkRect2D*                         pScissors;
} VkPipelineViewportStateCreateInfo;
```

```c
typedef struct VkViewport {
    float    x, y;          // 뷰포트 좌상단 좌표
    float    width, height; // 뷰포트 크기
    float    minDepth;      // 깊이 범위 최소값 (보통 0.0)
    float    maxDepth;      // 깊이 범위 최대값 (보통 1.0)
} VkViewport;
```

- 뷰포트와 시저는 보통 **동적 상태**로 지정하여 런타임에 설정한다
- `viewportCount`와 `scissorCount`는 반드시 같아야 한다

> **실무 팁**: 뷰포트/시저를 동적 상태로 지정하면, 창 크기 변경 시 파이프라인을 재생성할 필요가 없다.

### 4.4 래스터화 상태 (Rasterization State)

프리미티브를 프래그먼트로 변환하는 과정을 제어한다.

```c
typedef struct VkPipelineRasterizationStateCreateInfo {
    VkStructureType                             sType;
    const void*                                 pNext;
    VkPipelineRasterizationStateCreateFlags     flags;
    VkBool32                                    depthClampEnable;
    VkBool32                                    rasterizerDiscardEnable;
    VkPolygonMode                               polygonMode;
    VkCullModeFlags                             cullMode;
    VkFrontFace                                 frontFace;
    VkBool32                                    depthBiasEnable;
    float                                       depthBiasConstantFactor;
    float                                       depthBiasClamp;
    float                                       depthBiasSlopeFactor;
    float                                       lineWidth;
} VkPipelineRasterizationStateCreateInfo;
```

| 멤버 | 설명 |
|------|------|
| `depthClampEnable` | `VK_TRUE`이면 근/원 평면 바깥 프래그먼트를 버리지 않고 **클램프** |
| `rasterizerDiscardEnable` | `VK_TRUE`이면 래스터화를 **완전히 비활성화** (프래그먼트 생성 없음) |
| `polygonMode` | `FILL` (채우기), `LINE` (와이어프레임), `POINT` (점) |
| `cullMode` | `NONE`, `FRONT`, `BACK`, `FRONT_AND_BACK` |
| `frontFace` | `COUNTER_CLOCKWISE` 또는 `CLOCKWISE` — 전면 판정 기준 |
| `depthBiasEnable` | 깊이 바이어스 활성화 (그림자 맵의 아크네 방지에 사용) |
| `lineWidth` | 선 너비 (1.0 이외의 값은 `wideLines` 기능 필요) |

### 4.5 멀티샘플링 상태 (Multisample State)

안티에일리어싱을 위한 멀티샘플링을 제어한다.

```c
typedef struct VkPipelineMultisampleStateCreateInfo {
    VkStructureType                             sType;
    const void*                                 pNext;
    VkPipelineMultisampleStateCreateFlags       flags;
    VkSampleCountFlagBits                       rasterizationSamples;  // 샘플 수 (1, 2, 4, 8, ...)
    VkBool32                                    sampleShadingEnable;   // 샘플 셰이딩 활성화
    float                                       minSampleShading;      // 최소 샘플 셰이딩 비율
    const VkSampleMask*                         pSampleMask;           // 샘플 마스크
    VkBool32                                    alphaToCoverageEnable; // 알파→커버리지 변환
    VkBool32                                    alphaToOneEnable;      // 알파를 1.0으로 강제
} VkPipelineMultisampleStateCreateInfo;
```

| 멤버 | 설명 |
|------|------|
| `rasterizationSamples` | 프래그먼트당 샘플 수 — 렌더 패스 어태치먼트의 샘플 수와 **일치해야** 함 |
| `sampleShadingEnable` | `VK_TRUE`이면 각 샘플마다 프래그먼트 셰이더 실행 (품질 ↑, 성능 ↓) |
| `minSampleShading` | 셰이딩할 최소 비율 (0.0 ~ 1.0). 1.0이면 모든 샘플 개별 셰이딩 |
| `alphaToCoverageEnable` | 알파 값을 커버리지 마스크로 변환 (식생 렌더링 등에 유용) |

### 4.6 깊이/스텐실 상태 (Depth/Stencil State)

```c
typedef struct VkPipelineDepthStencilStateCreateInfo {
    VkStructureType                             sType;
    const void*                                 pNext;
    VkPipelineDepthStencilStateCreateFlags      flags;
    VkBool32                                    depthTestEnable;
    VkBool32                                    depthWriteEnable;
    VkCompareOp                                 depthCompareOp;
    VkBool32                                    depthBoundsTestEnable;
    VkBool32                                    stencilTestEnable;
    VkStencilOpState                            front;
    VkStencilOpState                            back;
    float                                       minDepthBounds;
    float                                       maxDepthBounds;
} VkPipelineDepthStencilStateCreateInfo;
```

| 멤버 | 설명 |
|------|------|
| `depthTestEnable` | 깊이 테스트 활성화 |
| `depthWriteEnable` | 깊이 버퍼 쓰기 활성화 |
| `depthCompareOp` | 비교 연산 (`LESS`, `LESS_OR_EQUAL`, `GREATER` 등) |
| `depthBoundsTestEnable` | 깊이 범위 테스트 (특정 깊이 구간만 통과) |
| `stencilTestEnable` | 스텐실 테스트 활성화 |
| `front` / `back` | 전면/후면의 스텐실 연산 설정 |

### VkCompareOp

| 값 | 조건 |
|----|------|
| `VK_COMPARE_OP_NEVER` | 항상 실패 |
| `VK_COMPARE_OP_LESS` | 새 값 < 기존 값 |
| `VK_COMPARE_OP_EQUAL` | 새 값 == 기존 값 |
| `VK_COMPARE_OP_LESS_OR_EQUAL` | 새 값 ≤ 기존 값 |
| `VK_COMPARE_OP_GREATER` | 새 값 > 기존 값 |
| `VK_COMPARE_OP_NOT_EQUAL` | 새 값 ≠ 기존 값 |
| `VK_COMPARE_OP_GREATER_OR_EQUAL` | 새 값 ≥ 기존 값 |
| `VK_COMPARE_OP_ALWAYS` | 항상 통과 |

### 4.7 컬러 블렌딩 상태 (Color Blend State)

프래그먼트 셰이더 출력과 프레임버퍼의 기존 색상을 **혼합**하는 방법을 정의한다.

```c
typedef struct VkPipelineColorBlendStateCreateInfo {
    VkStructureType                                 sType;
    const void*                                     pNext;
    VkPipelineColorBlendStateCreateFlags            flags;
    VkBool32                                        logicOpEnable;      // 논리 연산 사용
    VkLogicOp                                       logicOp;            // 논리 연산 종류
    uint32_t                                        attachmentCount;    // 어태치먼트 수
    const VkPipelineColorBlendAttachmentState*      pAttachments;       // 어태치먼트별 블렌딩 설정
    float                                           blendConstants[4];  // 블렌딩 상수 (RGBA)
} VkPipelineColorBlendStateCreateInfo;
```

```c
typedef struct VkPipelineColorBlendAttachmentState {
    VkBool32                blendEnable;            // 블렌딩 활성화
    VkBlendFactor           srcColorBlendFactor;    // 소스 색상 인자
    VkBlendFactor           dstColorBlendFactor;    // 대상 색상 인자
    VkBlendOp               colorBlendOp;           // 색상 블렌딩 연산
    VkBlendFactor           srcAlphaBlendFactor;    // 소스 알파 인자
    VkBlendFactor           dstAlphaBlendFactor;    // 대상 알파 인자
    VkBlendOp               alphaBlendOp;           // 알파 블렌딩 연산
    VkColorComponentFlags   colorWriteMask;         // 기록할 색상 채널 마스크
} VkPipelineColorBlendAttachmentState;
```

### 일반적인 알파 블렌딩 설정

```c
VkPipelineColorBlendAttachmentState alphaBlend = {
    .blendEnable = VK_TRUE,
    .srcColorBlendFactor = VK_BLEND_FACTOR_SRC_ALPHA,
    .dstColorBlendFactor = VK_BLEND_FACTOR_ONE_MINUS_SRC_ALPHA,
    .colorBlendOp = VK_BLEND_OP_ADD,
    .srcAlphaBlendFactor = VK_BLEND_FACTOR_ONE,
    .dstAlphaBlendFactor = VK_BLEND_FACTOR_ZERO,
    .alphaBlendOp = VK_BLEND_OP_ADD,
    .colorWriteMask = VK_COLOR_COMPONENT_R_BIT | VK_COLOR_COMPONENT_G_BIT
                    | VK_COLOR_COMPONENT_B_BIT | VK_COLOR_COMPONENT_A_BIT,
};
// 결과: finalColor = srcColor * srcAlpha + dstColor * (1 - srcAlpha)
```

> **logicOpEnable**: 논리 연산 모드를 활성화하면 블렌딩 대신 비트 단위 논리 연산(AND, OR, XOR 등)이 적용된다. 블렌딩과 동시에 사용할 수 **없다**.

---

## 5. 동적 상태 (Dynamic State)

파이프라인 생성 시 특정 상태를 **동적(Dynamic)** 으로 지정하면, 해당 상태는 파이프라인 객체에 구워지지(bake) 않고 커맨드 버퍼 기록 시 별도 명령으로 설정한다.

```c
typedef struct VkPipelineDynamicStateCreateInfo {
    VkStructureType                     sType;
    const void*                         pNext;
    VkPipelineDynamicStateCreateFlags   flags;
    uint32_t                            dynamicStateCount;
    const VkDynamicState*               pDynamicStates;
} VkPipelineDynamicStateCreateInfo;
```

### 주요 VkDynamicState 값

| 동적 상태 | 설정 명령 | 설명 |
|-----------|----------|------|
| `VK_DYNAMIC_STATE_VIEWPORT` | `vkCmdSetViewport` | 뷰포트 |
| `VK_DYNAMIC_STATE_SCISSOR` | `vkCmdSetScissor` | 시저 영역 |
| `VK_DYNAMIC_STATE_LINE_WIDTH` | `vkCmdSetLineWidth` | 선 너비 |
| `VK_DYNAMIC_STATE_DEPTH_BIAS` | `vkCmdSetDepthBias` | 깊이 바이어스 |
| `VK_DYNAMIC_STATE_BLEND_CONSTANTS` | `vkCmdSetBlendConstants` | 블렌딩 상수 |
| `VK_DYNAMIC_STATE_DEPTH_BOUNDS` | `vkCmdSetDepthBounds` | 깊이 범위 |
| `VK_DYNAMIC_STATE_STENCIL_COMPARE_MASK` | `vkCmdSetStencilCompareMask` | 스텐실 비교 마스크 |
| `VK_DYNAMIC_STATE_STENCIL_WRITE_MASK` | `vkCmdSetStencilWriteMask` | 스텐실 쓰기 마스크 |
| `VK_DYNAMIC_STATE_STENCIL_REFERENCE` | `vkCmdSetStencilReference` | 스텐실 참조 값 |
| `VK_DYNAMIC_STATE_CULL_MODE` | `vkCmdSetCullMode` | 컬링 모드 (1.3+) |
| `VK_DYNAMIC_STATE_FRONT_FACE` | `vkCmdSetFrontFace` | 전면 방향 (1.3+) |
| `VK_DYNAMIC_STATE_PRIMITIVE_TOPOLOGY` | `vkCmdSetPrimitiveTopology` | 토폴로지 (1.3+) |
| `VK_DYNAMIC_STATE_DEPTH_TEST_ENABLE` | `vkCmdSetDepthTestEnable` | 깊이 테스트 (1.3+) |
| `VK_DYNAMIC_STATE_DEPTH_WRITE_ENABLE` | `vkCmdSetDepthWriteEnable` | 깊이 쓰기 (1.3+) |
| `VK_DYNAMIC_STATE_STENCIL_TEST_ENABLE` | `vkCmdSetStencilTestEnable` | 스텐실 테스트 (1.3+) |
| `VK_DYNAMIC_STATE_RASTERIZER_DISCARD_ENABLE` | `vkCmdSetRasterizerDiscardEnable` | 래스터화 비활성화 (1.3+) |

> **실무 팁**: Vulkan 1.3에서 동적 상태가 대폭 확장되었다. 뷰포트, 시저, 컬링, 깊이 테스트 등을 동적으로 지정하면 **파이프라인 조합 폭발 문제**를 크게 줄일 수 있다.

### VK_EXT_extended_dynamic_state3 / Vulkan 1.4

Vulkan 1.4(및 `VK_EXT_extended_dynamic_state3`)에서는 거의 **모든 고정 함수 상태**를 동적으로 설정할 수 있게 되었다. `VK_EXT_shader_object`와 결합하면 파이프라인 객체 자체를 생략하는 것도 가능하다.

---

## 6. 컴퓨트 파이프라인

컴퓨트 파이프라인은 단일 컴퓨트 셰이더 스테이지만으로 구성되며, 그래픽스 파이프라인보다 **훨씬 간단**하다.

```c
VkResult vkCreateComputePipelines(
    VkDevice                                    device,
    VkPipelineCache                             pipelineCache,
    uint32_t                                    createInfoCount,
    const VkComputePipelineCreateInfo*          pCreateInfos,
    const VkAllocationCallbacks*                pAllocator,
    VkPipeline*                                 pPipelines);
```

```c
typedef struct VkComputePipelineCreateInfo {
    VkStructureType                     sType;
    const void*                         pNext;
    VkPipelineCreateFlags               flags;
    VkPipelineShaderStageCreateInfo     stage;              // 컴퓨트 셰이더 (VK_SHADER_STAGE_COMPUTE_BIT)
    VkPipelineLayout                    layout;             // 파이프라인 레이아웃
    VkPipeline                          basePipelineHandle; // 파생 파이프라인의 부모
    int32_t                             basePipelineIndex;  // 같은 배치 내 부모 인덱스
} VkComputePipelineCreateInfo;
```

- `stage.stage`는 반드시 `VK_SHADER_STAGE_COMPUTE_BIT`이어야 함
- 디바이스가 `VK_QUEUE_COMPUTE_BIT`를 지원하는 큐 패밀리를 하나 이상 가져야 함
- 컴퓨트 파이프라인은 `vkCmdDispatch` 또는 `vkCmdDispatchIndirect`로 실행

### 컴퓨트 디스패치

```c
void vkCmdDispatch(
    VkCommandBuffer commandBuffer,
    uint32_t        groupCountX,    // X축 워크그룹 수
    uint32_t        groupCountY,    // Y축 워크그룹 수
    uint32_t        groupCountZ);   // Z축 워크그룹 수

// 총 호출 수 = groupCountX × groupCountY × groupCountZ × localSizeX × localSizeY × localSizeZ
```

---

## 7. 파이프라인 레이아웃 (Pipeline Layout)

파이프라인 레이아웃은 셰이더가 접근하는 **리소스(디스크립터 셋)** 와 **푸시 상수(Push Constants)** 의 배치를 정의한다.

```c
VkResult vkCreatePipelineLayout(
    VkDevice                            device,
    const VkPipelineLayoutCreateInfo*   pCreateInfo,
    const VkAllocationCallbacks*        pAllocator,
    VkPipelineLayout*                   pPipelineLayout);
```

```c
typedef struct VkPipelineLayoutCreateInfo {
    VkStructureType                 sType;
    const void*                     pNext;
    VkPipelineLayoutCreateFlags     flags;
    uint32_t                        setLayoutCount;       // 디스크립터 셋 레이아웃 수
    const VkDescriptorSetLayout*    pSetLayouts;          // 디스크립터 셋 레이아웃 배열
    uint32_t                        pushConstantRangeCount; // 푸시 상수 범위 수
    const VkPushConstantRange*      pPushConstantRanges;    // 푸시 상수 범위 배열
} VkPipelineLayoutCreateInfo;
```

```c
typedef struct VkPushConstantRange {
    VkShaderStageFlags    stageFlags;    // 이 범위를 사용하는 셰이더 스테이지
    uint32_t              offset;        // 오프셋 (바이트, 4의 배수)
    uint32_t              size;          // 크기 (바이트, 4의 배수)
} VkPushConstantRange;
```

### 핵심 규칙

- `setLayoutCount` 최대값은 `maxBoundDescriptorSets` (최소 보장: 4)
- 푸시 상수의 총 크기는 `maxPushConstantsSize` 이하 (최소 보장: 128바이트)
- 같은 셰이더 스테이지에 대한 푸시 상수 범위는 **겹치면 안 된다**
- 호환되는 파이프라인 레이아웃끼리는 디스크립터 셋을 **공유**할 수 있다

> **실무 팁**: 푸시 상수는 디스크립터 셋 업데이트 없이 소량의 데이터(변환 행렬, 인덱스 등)를 셰이더에 빠르게 전달할 때 사용한다. 128바이트 이내로 유지하는 것이 좋다.

---

## 8. 파이프라인 캐시 (Pipeline Cache)

파이프라인 캐시는 파이프라인 컴파일 결과를 **저장하고 재사용**하여 생성 시간을 단축한다.

### 8.1 캐시 생성

```c
VkResult vkCreatePipelineCache(
    VkDevice                            device,
    const VkPipelineCacheCreateInfo*    pCreateInfo,
    const VkAllocationCallbacks*        pAllocator,
    VkPipelineCache*                    pPipelineCache);
```

```c
typedef struct VkPipelineCacheCreateInfo {
    VkStructureType                 sType;
    const void*                     pNext;
    VkPipelineCacheCreateFlags      flags;
    size_t                          initialDataSize;    // 초기 캐시 데이터 크기
    const void*                     pInitialData;       // 이전에 저장한 캐시 데이터
} VkPipelineCacheCreateInfo;
```

- `pInitialData`에 이전에 저장한 캐시 데이터를 전달하면, 같은 파이프라인을 다시 컴파일하지 않고 **즉시 복원**할 수 있다
- 캐시 데이터는 **같은 디바이스, 같은 드라이버 버전**에서만 유효 (호환되지 않으면 무시됨)
- `VK_PIPELINE_CACHE_CREATE_EXTERNALLY_SYNCHRONIZED_BIT` 플래그를 사용하면 내부 뮤텍스를 생략하여 성능 향상

### 8.2 캐시 데이터 추출

```c
VkResult vkGetPipelineCacheData(
    VkDevice            device,
    VkPipelineCache     pipelineCache,
    size_t*             pDataSize,       // [in/out] 데이터 크기
    void*               pData);          // [out] 캐시 데이터 (NULL이면 크기만 반환)
```

### 8.3 캐시 병합

```c
VkResult vkMergePipelineCaches(
    VkDevice                device,
    VkPipelineCache         dstCache,       // 병합 대상 캐시
    uint32_t                srcCacheCount,  // 소스 캐시 수
    const VkPipelineCache*  pSrcCaches);    // 소스 캐시 배열
```

- 여러 스레드에서 각각 캐시를 사용한 후, 하나로 **병합**하여 저장할 수 있다

### 8.4 캐시 파괴

```c
void vkDestroyPipelineCache(
    VkDevice                        device,
    VkPipelineCache                 pipelineCache,
    const VkAllocationCallbacks*    pAllocator);
```

### 일반적인 캐시 워크플로우

```
1. 앱 시작 → 파일에서 캐시 데이터 로드 → vkCreatePipelineCache(initialData)
2. 파이프라인 생성 시 캐시 전달 → vkCreateGraphicsPipelines(cache, ...)
3. 앱 종료 → vkGetPipelineCacheData → 파일에 저장
4. 다음 실행 시 1번으로 → 이미 컴파일된 파이프라인은 즉시 복원
```

> **실무 팁**: 파이프라인 캐시를 디스크에 저장하면 두 번째 실행부터 로딩 시간이 **크게 단축**된다. 대부분의 게임 엔진이 이 기법을 사용한다.

---

## 9. 파이프라인 파생 (Pipeline Derivatives)

유사한 파이프라인을 여러 개 생성할 때, 기존 파이프라인을 **부모**로 지정하여 생성 비용을 줄일 수 있다.

### 사용 방법

1. **부모 파이프라인**: `VK_PIPELINE_CREATE_ALLOW_DERIVATIVES_BIT` 플래그로 생성
2. **자식 파이프라인**: `VK_PIPELINE_CREATE_DERIVATIVE_BIT` 플래그 + `basePipelineHandle` 또는 `basePipelineIndex` 지정

```c
// 부모 파이프라인 생성
pipelineInfo.flags = VK_PIPELINE_CREATE_ALLOW_DERIVATIVES_BIT;
vkCreateGraphicsPipelines(device, cache, 1, &pipelineInfo, NULL, &parentPipeline);

// 자식 파이프라인 생성
pipelineInfo.flags = VK_PIPELINE_CREATE_DERIVATIVE_BIT;
pipelineInfo.basePipelineHandle = parentPipeline;
pipelineInfo.basePipelineIndex = -1;  // handle 사용 시 -1
// ... 일부 상태만 변경 ...
vkCreateGraphicsPipelines(device, cache, 1, &pipelineInfo, NULL, &childPipeline);
```

### VkPipelineCreateFlagBits (주요 플래그)

| 플래그 | 설명 |
|--------|------|
| `VK_PIPELINE_CREATE_DISABLE_OPTIMIZATION_BIT` | 최적화 생략 — 생성 속도 우선 |
| `VK_PIPELINE_CREATE_ALLOW_DERIVATIVES_BIT` | 이 파이프라인을 부모로 사용 가능 |
| `VK_PIPELINE_CREATE_DERIVATIVE_BIT` | 이 파이프라인은 다른 파이프라인의 자식 |
| `VK_PIPELINE_CREATE_FAIL_ON_PIPELINE_COMPILE_REQUIRED_BIT` | 컴파일이 필요하면 실패 반환 (캐시 히트만 허용) |
| `VK_PIPELINE_CREATE_EARLY_RETURN_ON_FAILURE_BIT` | 배치 생성 시 첫 실패에서 즉시 반환 |

> **참고**: 하나의 파이프라인이 `ALLOW_DERIVATIVES_BIT`와 `DERIVATIVE_BIT`를 **동시에** 가질 수 있다 — 부모이면서 동시에 다른 파이프라인의 자식이 될 수 있다.

---

## 10. 파이프라인 라이브러리 (Pipeline Libraries)

`VK_KHR_pipeline_library` 확장 및 `VK_EXT_graphics_pipeline_library` 확장은 파이프라인을 **모듈식으로 분할 생성**할 수 있게 한다.

### 개념

- 파이프라인의 각 부분(정점 입력, 래스터화, 프래그먼트 출력 등)을 **별도의 라이브러리 파이프라인**으로 미리 생성
- 나중에 이 라이브러리들을 **링킹(linking)** 하여 최종 파이프라인을 완성
- 파이프라인 조합이 많은 경우, 공통 부분을 재사용하여 생성 시간 단축

### VkGraphicsPipelineLibraryFlagBitsEXT

```c
typedef enum VkGraphicsPipelineLibraryFlagBitsEXT {
    VK_GRAPHICS_PIPELINE_LIBRARY_VERTEX_INPUT_INTERFACE_BIT_EXT    = 0x00000001,
    VK_GRAPHICS_PIPELINE_LIBRARY_PRE_RASTERIZATION_SHADERS_BIT_EXT = 0x00000002,
    VK_GRAPHICS_PIPELINE_LIBRARY_FRAGMENT_SHADER_BIT_EXT           = 0x00000004,
    VK_GRAPHICS_PIPELINE_LIBRARY_FRAGMENT_OUTPUT_INTERFACE_BIT_EXT = 0x00000008,
} VkGraphicsPipelineLibraryFlagBitsEXT;
```

| 라이브러리 파트 | 포함 상태 |
|----------------|----------|
| **Vertex Input Interface** | 정점 입력, 입력 어셈블리 |
| **Pre-Rasterization Shaders** | 정점/테셀레이션/지오메트리 셰이더, 뷰포트, 래스터화 |
| **Fragment Shader** | 프래그먼트 셰이더, 깊이/스텐실 |
| **Fragment Output Interface** | 컬러 블렌딩, 멀티샘플링 |

### 워크플로우

```
1. 정점 입력 라이브러리 생성     (VERTEX_INPUT_INTERFACE_BIT)
2. 프리래스터 셰이더 라이브러리 생성 (PRE_RASTERIZATION_SHADERS_BIT)
3. 프래그먼트 셰이더 라이브러리 생성 (FRAGMENT_SHADER_BIT)
4. 프래그먼트 출력 라이브러리 생성   (FRAGMENT_OUTPUT_INTERFACE_BIT)
5. 최종 파이프라인 = 1 + 2 + 3 + 4 링킹
```

- `VK_PIPELINE_CREATE_2_LINK_TIME_OPTIMIZATION_BIT_EXT` 플래그로 링킹 시 최적화 적용 가능
- `VK_PIPELINE_CREATE_2_RETAIN_LINK_TIME_OPTIMIZATION_INFO_BIT_EXT`로 라이브러리에 최적화 정보 보존

> **실무 팁**: 파이프라인 라이브러리는 대규모 프로젝트에서 **로딩 시간 감소**에 효과적이다. 정점 입력이 동일한 여러 머티리얼을 렌더링할 때, 정점 입력 라이브러리를 한 번만 만들고 프래그먼트 셰이더 부분만 바꿔 끼울 수 있다.

---

## 11. 파이프라인 파괴

```c
void vkDestroyPipeline(
    VkDevice                        device,
    VkPipeline                      pipeline,
    const VkAllocationCallbacks*    pAllocator);
```

- 사용 중인(Pending 상태의 커맨드 버퍼가 참조하는) 파이프라인은 파괴하면 **안 된다**
- 파이프라인이 파괴되어도, 이미 제출된 커맨드 버퍼의 실행에는 영향 없음 (참조 카운팅)

---

## 빠른 참조 표

### 그래픽스 파이프라인 생성 체크리스트

| 구성 요소 | 필수 여부 | 동적 상태 가능 |
|----------|----------|--------------|
| 셰이더 스테이지 (`pStages`) | 필수 | - |
| 정점 입력 (`pVertexInputState`) | 필수* | 1.3+ 일부 |
| 입력 어셈블리 (`pInputAssemblyState`) | 필수* | 1.3+ |
| 뷰포트/시저 (`pViewportState`) | 필수** | 대부분 동적 사용 |
| 래스터화 (`pRasterizationState`) | 필수 | 1.3+ 일부 |
| 멀티샘플링 (`pMultisampleState`) | 필수** | 제한적 |
| 깊이/스텐실 (`pDepthStencilState`) | 선택*** | 1.3+ |
| 컬러 블렌딩 (`pColorBlendState`) | 필수** | 제한적 |
| 동적 상태 (`pDynamicState`) | 선택 | - |
| 파이프라인 레이아웃 (`layout`) | 필수 | - |
| 렌더 패스 (`renderPass`) | 필수**** | - |
| 테셀레이션 (`pTessellationState`) | TCS/TES 사용 시 | - |

\* 메시 셰이더 파이프라인에서는 불필요
\*\* `rasterizerDiscardEnable = VK_TRUE`이면 불필요
\*\*\* 깊이/스텐실 어태치먼트가 있을 때만 필요
\*\*\*\* 동적 렌더링 사용 시 `VK_NULL_HANDLE` 가능

---

## 이 챕터에서 기억할 것

1. **파이프라인은 불변 객체다** — 생성 후 상태를 변경할 수 없으며, 동적 상태로 지정한 부분만 런타임에 설정 가능. 이 설계가 드라이버 최적화의 핵심이다.

2. **동적 상태를 적극 활용하라** — 뷰포트, 시저, 컬링, 깊이 테스트 등을 동적으로 지정하면 파이프라인 조합 폭발(combinatorial explosion)을 방지할 수 있다. Vulkan 1.3+에서는 대부분의 고정 함수 상태를 동적으로 설정 가능하다.

3. **파이프라인 캐시를 반드시 사용하라** — 파이프라인 캐시를 디스크에 저장하고 다음 실행 시 로드하면 셰이더 컴파일 시간을 극적으로 줄일 수 있다. 게임의 로딩 시간 단축에 핵심적인 기법이다.

4. **파이프라인 레이아웃이 리소스 접근 계약이다** — 셰이더가 어떤 디스크립터 셋과 푸시 상수에 접근할지를 미리 선언하는 것이 파이프라인 레이아웃이다. 호환되는 레이아웃끼리 디스크립터 셋을 공유할 수 있다.

5. **특수화 상수로 셰이더 변형을 만들어라** — 같은 SPIR-V 모듈에서 상수 값만 바꿔 여러 파이프라인을 생성하면, if/else 분기보다 **성능이 좋고** 셰이더 파일 관리가 간편해진다.

---

*이 문서는 Vulkan 명세의 Pipelines 챕터를 한글로 요약한 것입니다.*
*세부 사항은 원본 명세를 참조하세요.*
