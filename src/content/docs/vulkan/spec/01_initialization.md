---
title: "Initialization (초기화) — 한글 요약"
sidebar:
  label: "01. Initialization"
---

> 원본: [Initialization](https://docs.vulkan.org/spec/latest/chapters/initialization.html)

Vulkan을 사용하기 전에 반드시 해야 할 두 가지: **커맨드 함수 포인터 로딩** + **VkInstance 생성**.

---

## 1. Command Function Pointers (함수 포인터 로딩)

Vulkan 커맨드는 **정적 링킹으로 반드시 제공되지 않는다.** <sup class="fn-ref"><a href="/vk_spec_ko/log/01_initialization/#pfn-접두사의-의미">[1]</a><span class="fn-tooltip"><span class="fn-title"><a href="/vk_spec_ko/log/01_initialization/#pfn-접두사의-의미">PFN 접두사의 의미</a></span><span class="fn-desc">PFN = Pointer to FunctioN. C에서 함수 포인터 타입을 typedef로 정의할 때 쓰는 네이밍 컨벤션.</span></span></sup> 플랫폼에 따라 동적으로 로딩해야 할 수 있다.

### 1.1 vkGetInstanceProcAddr — 핵심 진입점

```c
PFN_vkVoidFunction vkGetInstanceProcAddr(
    VkInstance  instance,   // 인스턴스 핸들 (또는 NULL)
    const char* pName);     // 함수 이름
```

이 함수 자체는 **플랫폼/로더에 따라** 얻는 방법이 다름:
- 보통 Vulkan 로더 라이브러리가 이걸 심볼로 export함
- 앱이 로더에 링크하거나, `dlopen`/`LoadLibrary`로 동적 로딩

**instance 값에 따른 동작:**

| instance | pName | 결과 |
|----------|-------|------|
| `NULL` | 글로벌 커맨드 | 함수 포인터 반환 |
| `NULL` | `vkGetInstanceProcAddr` 자체 | 함수 포인터 반환 (Vulkan 1.2+) |
| 유효한 인스턴스 | 코어 dispatchable 커맨드 | 함수 포인터 반환 |
| 유효한 인스턴스 | 활성화된 인스턴스 익스텐션 커맨드 | 함수 포인터 반환 |
| 그 외 | | `NULL` |

**글로벌 커맨드** (instance 없이 호출 가능한 4개):
- `vkEnumerateInstanceVersion`
- `vkEnumerateInstanceExtensionProperties`
- `vkEnumerateInstanceLayerProperties`
- `vkCreateInstance`

### 1.2 vkGetDeviceProcAddr — 디바이스 전용 최적화

```c
PFN_vkVoidFunction vkGetDeviceProcAddr(
    VkDevice    device,
    const char* pName);
```

`vkGetInstanceProcAddr`로 얻은 함수 포인터는 **디스패치 코드를 거칠 수 있음** <sup class="fn-ref"><a href="/vk_spec_ko/log/01_initialization/#디스패치dispatch란">[2]</a><span class="fn-tooltip"><span class="fn-title"><a href="/vk_spec_ko/log/01_initialization/#디스패치dispatch란">디스패치(Dispatch)란?</a></span><span class="fn-desc">어디로 보낼지 판단해서 라우팅하는 것. Instance 레벨 함수 포인터는 디스패치 코드를 거치고, Device 레벨은 직통.</span></span></sup> (여러 GPU가 있을 때 어떤 디바이스로 보낼지 판단하는 레이어). `vkGetDeviceProcAddr`로 얻으면 이 오버헤드를 제거할 수 있다.

> **실무 팁**: 성능이 중요한 커맨드(vkCmdDraw 등)는 `vkGetDeviceProcAddr`로 직접 함수 포인터를 얻어서 호출하면 약간의 성능 이점이 있음.

### 1.3 Physical Device 기능 확장

- **코어 기능 확장**: `VkPhysicalDeviceProperties::apiVersion`과 `VkApplicationInfo::apiVersion`이 모두 해당 버전 이상이어야 사용 가능
- **디바이스 익스텐션의 물리 디바이스 기능**: Vulkan 1.1 이상이면 논리 디바이스 생성 전에도 물리 디바이스 레벨 기능 조회 가능

---

## 2. Instances (인스턴스)

### 2.1 핵심 개념

> **Vulkan에는 글로벌 상태가 없다.**

모든 앱별 상태는 `VkInstance` 오브젝트에 저장됨. 이건 **Vulkan 라이브러리 초기화**와 같은 의미.

```c
VK_DEFINE_HANDLE(VkInstance)
```

### 2.2 인스턴스 버전 조회

```c
VkResult vkEnumerateInstanceVersion(uint32_t* pApiVersion);
```

- 구현체가 지원하는 인스턴스 레벨 Vulkan 버전을 반환
- 메모리 할당이 필요 없어서 거의 항상 `VK_SUCCESS` 반환

### 2.3 인스턴스 생성 — vkCreateInstance

```c
VkResult vkCreateInstance(
    const VkInstanceCreateInfo* pCreateInfo,
    const VkAllocationCallbacks* pAllocator,
    VkInstance* pInstance);
```

**생성 과정:**
1. 요청된 **레이어**가 존재하는지 확인 → 없으면 `VK_ERROR_LAYER_NOT_PRESENT`
2. 요청된 **익스텐션**이 지원되는지 확인 → 없으면 `VK_ERROR_EXTENSION_NOT_PRESENT`
3. 검증 통과 후 `VkInstance` 생성 및 반환

### 2.4 VkInstanceCreateInfo 구조체

```c
typedef struct VkInstanceCreateInfo {
    VkStructureType          sType;                  // 구조체 타입 식별자
    const void*              pNext;                  // 확장 체인
    VkInstanceCreateFlags    flags;                  // 플래그
    const VkApplicationInfo* pApplicationInfo;       // 앱 정보 (선택)
    uint32_t                 enabledLayerCount;      // 활성화할 레이어 수
    const char* const*       ppEnabledLayerNames;    // 레이어 이름 배열
    uint32_t                 enabledExtensionCount;  // 활성화할 익스텐션 수
    const char* const*       ppEnabledExtensionNames;// 익스텐션 이름 배열
} VkInstanceCreateInfo;
```

**레이어 로딩 순서**: 배열의 첫 번째가 앱에 가장 가깝고, 마지막이 드라이버에 가장 가까움. <sup class="fn-ref"><a href="/vk_spec_ko/log/01_initialization/#레이어-배열-순서">[3]</a><span class="fn-tooltip"><span class="fn-title"><a href="/vk_spec_ko/log/01_initialization/#레이어-배열-순서">레이어 배열 순서</a></span><span class="fn-desc">배열 첫 번째가 앱에 가장 가깝고, 마지막이 드라이버에 가장 가까움. 순서에 따라 호출 체인 위치가 달라진다.</span></span></sup>

**pNext 체인으로 연결 가능한 것들:**
- `VkDebugUtilsMessengerCreateInfoEXT` — 인스턴스 생성/파괴 중 디버그 메시지 캡처
- `VkValidationFeaturesEXT` — 검증 기능 활성화/비활성화
- `VkValidationFlagsEXT` — 검증 체크 비활성화
- `VkLayerSettingsCreateInfoEXT` — 레이어별 세부 설정
- `VkDirectDriverLoadingListLUNARG` — 추가 드라이버 직접 로딩

### 2.5 VkApplicationInfo 구조체

```c
typedef struct VkApplicationInfo {
    VkStructureType sType;
    const void*     pNext;
    const char*     pApplicationName;    // 앱 이름 (선택)
    uint32_t        applicationVersion;  // 앱 버전 (선택)
    const char*     pEngineName;         // 엔진 이름 (선택)
    uint32_t        engineVersion;       // 엔진 버전 (선택)
    uint32_t        apiVersion;          // 사용할 Vulkan API 버전
} VkApplicationInfo;
```

**apiVersion 규칙:**
- 앱이 사용하려는 **최고 Vulkan 버전**을 지정
- 패치 버전은 무시됨
- Vulkan 1.1+ 구현체는 어떤 apiVersion 값이든 `VK_ERROR_INCOMPATIBLE_DRIVER`를 반환하지 않음
- 인스턴스와 디바이스가 **다른 Vulkan 버전**을 사용할 수 있음 (1.1 이상일 때)

> **왜 앱/엔진 이름을 넣나?**
> 드라이버가 특정 앱이나 엔진(예: Unreal Engine)에 대해 알려진 워크어라운드나 최적화를 적용할 수 있도록. 기술적으로 선택사항이지만 넣는 게 좋음.

### 2.6 인스턴스 파괴 — vkDestroyInstance <sup class="fn-ref"><a href="/vk_spec_ko/log/00_fundamentals/#pallocator는-cpu-측-메모리다">[4]</a><span class="fn-tooltip"><span class="fn-title"><a href="/vk_spec_ko/log/00_fundamentals/#pallocator는-cpu-측-메모리다">pAllocator는 CPU 측 메모리다</a></span><span class="fn-desc">pAllocator는 GPU 메모리가 아닌 CPU 메모리 할당을 커스터마이징하는 것. 드라이버 내부 메타데이터 할당에 관여.</span></span></sup>

```c
void vkDestroyInstance(
    VkInstance instance,
    const VkAllocationCallbacks* pAllocator);
```

**핵심 규칙:**
- 파괴 전에 해당 인스턴스(또는 그로부터 얻은 VkPhysicalDevice)로 생성한 **모든 자식 오브젝트를 먼저 파괴/해제**해야 함
- 생성 시 `pAllocator`를 넣었으면, 파괴 시에도 **호환 가능한 allocator**를 전달해야 함

---

## 3. Validation (검증 설정)

### 3.1 VkValidationFeaturesEXT — 검증 기능 세부 제어

**활성화 가능한 검증 기능:**

| 값 | 설명 | 기본값 |
|----|------|--------|
| `GPU_ASSISTED` | GPU 지원 검증 — 셰이더에 진단 코드 삽입 | OFF |
| `GPU_ASSISTED_RESERVE_BINDING_SLOT` | GPU 검증용 디스크립터 셋 슬롯 예약 | OFF |
| `BEST_PRACTICES` | 명세 위반은 아니지만 비권장 사용법 경고 | OFF |
| `DEBUG_PRINTF` | 셰이더에서 `debugPrintfEXT` 출력 처리 | OFF |
| `SYNCHRONIZATION_VALIDATION` | 동기화 누락/오류 검출 | OFF |

**비활성화 가능한 검증 기능:**

| 값 | 설명 | 기본값 |
|----|------|--------|
| `ALL` | 모든 검증 끔 | — |
| `SHADERS` | 셰이더 검증 끔 | ON |
| `THREAD_SAFETY` | 스레드 안전성 검증 끔 | ON |
| `API_PARAMETERS` | 파라미터 유효성 검증 끔 | ON |
| `OBJECT_LIFETIMES` | 오브젝트 수명 검증 끔 | ON |
| `CORE_CHECKS` | 코어 검증 끔 (끄면 SHADERS도 같이 꺼짐) | ON |
| `UNIQUE_HANDLES` | 핸들 중복 보호 끔 | ON |
| `SHADER_VALIDATION_CACHE` | 셰이더 검증 캐싱 끔 (매번 재검증) | ON |

> **주의**: 파라미터 검증이나 오브젝트 수명 검증을 끄면, 다른 검증 체크가 올바르게 동작하지 않거나 크래시할 수 있음.

### 3.2 VkLayerSettingsCreateInfoEXT — 레이어별 세부 설정

레이어 이름 + 설정 이름 + 값으로 개별 레이어의 동작을 세밀하게 제어할 수 있음.
중복된 설정이 있으면 **첫 번째 것이 우선**.

---

## 4. Direct Driver Loading (직접 드라이버 로딩)

`VkDirectDriverLoadingListLUNARG`로 시스템 드라이버 외에 **추가 드라이버를 직접 로딩** 가능.

| 모드 | 설명 |
|------|------|
| `EXCLUSIVE` | 제공한 드라이버**만** 사용 (시스템 드라이버 무시) |
| `INCLUSIVE` | 시스템 드라이버 + 제공한 드라이버 **함께** 사용 |

> **사용 사례**: 소프트웨어 렌더러 (Mesa lavapipe 등)를 앱에 번들링하거나, 다른 API로 변환하는 드라이버를 포함할 때. 하드웨어 드라이버에는 사용하지 말 것.

---

## 초기화 플로우 요약

<img src="/vk_spec_ko/images/01_initialization/loader_overview.png" alt="Vulkan 로더 아키텍처" class="light-bg" />

> 출처: [Vulkan Guide — Loader](https://docs.vulkan.org/guide/latest/loader.html). 앱 → 로더 → 레이어 → ICD → 물리 디바이스로 이어지는 전체 구조.

```
1. Vulkan 로더 로딩
   └─ vkGetInstanceProcAddr 획득 (dlopen/LoadLibrary)

2. 글로벌 커맨드 조회
   ├─ vkEnumerateInstanceVersion → 지원 버전 확인
   ├─ vkEnumerateInstanceLayerProperties → 사용 가능한 레이어 확인
   └─ vkEnumerateInstanceExtensionProperties → 사용 가능한 익스텐션 확인

3. VkInstance 생성
   ├─ VkApplicationInfo 작성 (앱 이름, 엔진, API 버전)
   ├─ VkInstanceCreateInfo 작성 (레이어, 익스텐션 목록)
   ├─ (선택) 디버그 메신저/검증 설정을 pNext에 연결
   └─ vkCreateInstance 호출

4. 인스턴스 레벨 함수 포인터 로딩
   └─ vkGetInstanceProcAddr(instance, "vkEnumeratePhysicalDevices") 등

5. → 다음 단계: Devices and Queues 챕터로
   ├─ 물리 디바이스 열거
   ├─ 논리 디바이스 생성
   └─ 큐 획득
```

---

## 이 챕터에서 기억할 것

1. **Vulkan에는 글로벌 상태가 없다** — 모든 것이 VkInstance에서 시작
2. **함수 포인터 두 종류**: Instance 레벨 (범용) vs Device 레벨 (오버헤드 적음)
3. **레이어와 익스텐션은 인스턴스 생성 시 명시적으로 활성화**해야 함
4. **apiVersion은 앱이 사용할 최고 버전** — 구현체 능력이 아닌 앱의 의도를 선언
5. **파괴 순서 중요**: 자식 오브젝트 먼저 파괴 → 인스턴스 마지막에 파괴

---

*이 문서는 Vulkan 명세의 Initialization 챕터를 한글로 요약한 것입니다.*
*세부 사항은 원본 명세를 참조하세요.*
