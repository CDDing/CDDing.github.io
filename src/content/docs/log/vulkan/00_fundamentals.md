---
title: "Fundamentals 학습 로그"
sidebar:
  label: "00. Fundamentals"
---

## 호스트와 디바이스의 엔디언이 동일해야 하는 이유

> **Q.** Fundamentals에서 호스트와 물리 디바이스의 데이터 및 엔디언이 동일해야 한다는데 다른 사례가 있어?

현실적으로는 거의 없지만, 역사적으로는 있었어.

**현재 상황**: x86 CPU, ARM CPU, NVIDIA/AMD/Intel GPU 전부 **리틀 엔디언**이라 사실상 항상 일치해.

| 시스템 | CPU (호스트) | GPU (디바이스) | 엔디언 |
|--------|-------------|---------------|--------|
| 일반 PC | x86 (리틀) | NVIDIA/AMD (리틀) | 일치 |
| **PS3** | **Cell/PowerPC (빅)** | **RSX/NVIDIA (리틀)** | **불일치** |
| 과거 Mac | PowerPC (빅) | ATI (리틀) | **불일치** |

PS3가 대표적이야. Cell 프로세서는 빅 엔디언, RSX GPU는 리틀 엔디언이라 데이터를 넘길 때마다 **바이트 스와핑**이 필요했고, 개발자들한테 큰 고통이었어:

```c
// PS3 시절 — CPU에서 GPU로 데이터 넘길 때
uint32_t value = 0x12345678;
// CPU(빅): [12][34][56][78]
// GPU(리틀): [78][56][34][12]  ← 바이트 순서가 뒤집힘
// 매번 수동으로 스왑하거나 드라이버가 처리해야 했음
```

Vulkan이 "호스트와 디바이스의 엔디언이 동일해야 한다"고 **명시적으로 요구**하는 건, 이런 복잡성을 API에서 아예 배제하겠다는 뜻이야. 바이트 스와핑 로직을 API 전체에 넣으면 성능도 떨어지고 복잡성이 폭발하니까.

> **결과적으로**: 빅 엔디언 CPU + 리틀 엔디언 GPU 조합에서는 Vulkan을 쓸 수 없어. 하지만 현재 GPU가 탑재되는 모든 플랫폼(PC, 모바일, 콘솔)이 리틀 엔디언이라 실질적 제약은 없어.

---

## 그래픽스 큐에서 비디오 디코딩

> **Q.** Vulkan의 큐가 지원하는 기능이 다른데, 그래픽스 큐에서는 비디오 디코딩 못해?

기본적으로 큐 패밀리마다 지원하는 기능이 다르고, 그래픽스 큐 패밀리가 비디오 디코드를 지원한다는 보장은 없어.

실제로 어떤 큐 패밀리가 뭘 지원하는지는 `vkGetPhysicalDeviceQueueFamilyProperties`로 조회해야 하는데, 각 `VkQueueFamilyProperties`에 `queueFlags` 비트마스크로 알려줘:

```
VK_QUEUE_GRAPHICS_BIT
VK_QUEUE_COMPUTE_BIT
VK_QUEUE_TRANSFER_BIT
VK_QUEUE_VIDEO_DECODE_BIT_KHR
VK_QUEUE_VIDEO_ENCODE_BIT_KHR
```

실제 GPU에서 보면 보통 이런 구성:

| 큐 패밀리 | 기능 |
|-----------|------|
| 0 | Graphics + Compute + Transfer (범용) |
| 1 | Transfer only (DMA 전용) |
| 2 | Video Decode |
| 3 | Video Encode |

비디오 디코딩 결과를 그래픽스에서 쓰고 싶으면 — 예를 들어 디코딩한 프레임을 텍스처로 렌더링 — **세마포어로 비디오 디코드 큐와 그래픽스 큐 사이를 동기화**해서 넘기는 게 일반적인 패턴이야.

---

## 큐가 왜 나뉘어져 있는가

> **Q.** 감이 안 오는데, graphics 디코딩 컴퓨트 같은 거 하나의 큐에서 작업하게 해놓으면 안 돼? 큐라는 개념만 있게.

직관적으로는 "하나의 만능 큐"가 깔끔해 보이는데, 나뉘어진 이유는 **하드웨어 구조** 때문이야.

GPU 내부에는 물리적으로 **다른 엔진(하드웨어 유닛)**이 존재해:

| 엔진 | 역할 |
|------|------|
| Graphics Engine | 래스터라이저, ROP, 고정 함수 파이프라인 |
| Compute Engine | ALU/셰이더 코어만 사용하는 범용 연산 |
| Copy/DMA Engine | 메모리 복사 전담 (셰이더 코어 안 씀) |
| Video Engine (NVDEC/NVENC, VCN 등) | 비디오 코덱 전용 ASIC |

이게 소프트웨어 추상화가 아니라 **칩 위에 물리적으로 다른 회로**야. 분리하면 생기는 이점:

1. **동시 실행**: 하나의 큐에 직렬로 넣으면 그래픽스 렌더링하는 동안 DMA 전송이 멈춰. 큐를 분리해서 이 병렬성을 앱에 노출하는 거야.
2. **불필요한 오버헤드 제거**: 비디오 디코드 전용 ASIC한테 그래픽스 파이프라인 상태를 추적하라고 하면 의미 없는 낭비.
3. **드라이버 최적화**: 큐 타입이 명확하면 해당 엔진에 최적화된 스케줄링 가능. 만능 큐 하나면 드라이버가 매번 "이 커맨드는 어느 엔진으로 보내지?" 판단해야 하고, 그게 OpenGL 시절의 문제였어.

> Vulkan의 철학: **"하드웨어를 있는 그대로 노출하고, 추상화 비용은 앱이 판단"**

---

## 같은 큐 내에서 커맨드 버퍼 간 실행 순서

> **Q.** 서로 다른 큐 간에는 암묵적 순서 보장이 없다는데, 같은 큐 내에 여러 커맨드 버퍼가 삽입됐을 때는 삽입 순으로 처리되는 게 보장되는 건가?

좀 미묘한 부분이야. **"시작 순서"는 보장되지만 "완료 순서"는 보장 안 돼.**

같은 큐에 커맨드 버퍼 A, B를 순서대로 제출하면, submission order에 의해 A의 커맨드가 B보다 먼저 **시작**되는 건 보장돼. 근데 A가 B보다 먼저 **끝난다는 보장은 없어**. GPU 내부에서 파이프라이닝되면서 겹칠 수 있거든.

```c
vkQueueSubmit(queue, A);  // 드로우콜 100개
vkQueueSubmit(queue, B);  // 컴퓨트 디스패치 1개
// A가 프래그먼트 스테이지에 있는 동안 B가 버텍스 스테이지에 진입 가능
```

| 보장됨 | 보장 안 됨 |
|--------|-----------|
| submission order (시작 순서) | 완료 순서 |
| 같은 서브패스 내 프리미티브 순서 | 서로 다른 커맨드 버퍼 간 메모리 가시성 |
| 커맨드 버퍼 내 상태 설정 → 액션 순서 | 액션 커맨드 간 실행 완료 순서 |

A가 렌더타겟에 쓰고 B가 그걸 읽어야 한다면, **같은 큐여도 파이프라인 배리어가 필수**:

```c
// A: 렌더타겟에 렌더링
vkCmdPipelineBarrier(...)  // 이게 있어야 A 완료 후 B 시작 보장
// B: 그 렌더타겟을 텍스처로 샘플링
```

> **Vulkan 원칙: 명시적으로 동기화하지 않으면 아무것도 가정하지 마라. 같은 큐 안에서도 마찬가지.**

---

## 제출 후 즉시 반환 (Fire-and-Forget)

> **Q.** "제출 후 즉시 반환 — 작업 완료를 기다리지 않음" 이건 뭔 말이야?

`vkQueueSubmit`을 호출하면 CPU 측에서는 "GPU야 이 작업 해"라고 던져놓고 **바로 다음 코드로 넘어간다**는 뜻이야. GPU가 실제로 그 작업을 끝냈는지는 신경 안 쓰고.

```c
vkQueueSubmit(queue, ..., fence);  // GPU한테 던지고 즉시 반환
// CPU는 여기서 다른 일 가능
DoGameLogic();
PrepareNextFrame();

// GPU 결과가 필요한 시점에서 비로소 대기
vkWaitForFences(device, 1, &fence, ...);
```

CPU가 GPU 작업 끝날 때까지 멍하니 기다리면 그 시간 동안 CPU가 놀잖아. OpenGL은 드라이버가 내부적으로 이런 비동기 처리를 숨겨서 해줬고, Vulkan은 그걸 앱한테 직접 제어하게 넘긴 거지.

---

## Vulkan 힙 vs CS에서의 힙

> **Q.** 디바이스 메모리에서 "하나 이상의 힙"이라는 건 무슨 의미야? 내가 컴퓨터공학에서 아는 사용자가 직접 할당하는 힙과 다른 거야?

직감이 맞아, **유래는 같아**. 둘 다 "큰 메모리 풀에서 원하는 만큼 떼어 쓴다"는 개념에서 온 거야.

| | C/C++ 힙 | Vulkan 힙 |
|--|----------|-----------|
| 대상 | CPU 메모리 (RAM) | GPU가 접근 가능한 메모리 영역 |
| 할당 | `malloc` / `new` | `vkAllocateMemory` |
| 해제 | `free` / `delete` | `vkFreeMemory` |
| 관리자 | OS + C 런타임 | Vulkan 드라이버 + 앱 |

차이는 Vulkan 힙이 **물리적으로 다른 여러 메모리 영역**을 구분해서 노출한다는 점이야. 예를 들어 디스크리트 GPU가 있는 PC라면:

- **힙 0**: VRAM 8GB (GPU에 물리적으로 붙어있는 메모리)
- **힙 1**: RAM 16GB (CPU 메모리)

각 힙 위에 메모리 타입이 있어서 속성을 알려줘 (`DEVICE_LOCAL`, `HOST_VISIBLE`, `HOST_COHERENT` 등). 앱이 "이 텍스처는 GPU만 쓰니까 힙 0에서, 이 스테이징 버퍼는 CPU가 써야 하니까 힙 1에서 HOST_VISIBLE로" 직접 판단하는 거지.

결국 "큰 메모리 덩어리에서 필요한 만큼 동적으로 떼어 쓴다"는 핵심 개념은 동일하고, Vulkan은 그 덩어리가 물리적으로 여러 곳에 존재할 수 있으니까 복수형으로 노출하는 거야.

---

## GPU에는 스택이 없다

> **Q.** CPU에서는 스택과 힙이 메모리를 양분하잖아. Vulkan에서는 스택 같은 개념이 없나? shared memory가 떠오르긴 하는데 딱히 스택 느낌은 아니던데.

결론부터 말하면 GPU에는 CPU 같은 범용 스택이 **사실상 없어**. 이유는 GPU 아키텍처의 근본적인 차이.

CPU는 소수의 스레드를 **깊게(deep)** 실행 → 스레드당 스택 하나 할당해도 감당 가능.
GPU는 수천~수만 스레드를 **넓게(wide)** 실행 → 스레드당 스택을 줬다가 재귀라도 타면 메모리가 터져.

그래서 GPU는 아예 다른 전략을 써:

| CPU 개념 | GPU 대응 |
|----------|----------|
| 로컬 변수 → 스택 | 셰이더 컴파일러가 **컴파일 타임에 레지스터 수를 정적 결정**. 레지스터를 많이 쓰면 occupancy가 줄어드는 이유. |
| 함수 호출 → call stack | 대부분 **인라이닝**으로 해결 |
| 재귀 | 일반 셰이더에서는 **금지**. 레이트레이싱의 `TraceRay`만 `maxPipelineRayRecursionDepth`로 깊이 제한 후 허용 |

> GPU 메모리 모델: **레지스터(정적)** + **shared memory(워크그룹 스크래치패드)** + **global memory(힙)**
>
> 스택이 빠진 자리를 컴파일러의 정적 분석이 대신한다.

---

## vkAllocate* 패턴

> **Q.** `vkAllocate`는 memory 말고 또 뭐가 있지? 커맨드 버퍼?

딱 세 개야:

- `vkAllocateMemory` — 디바이스 메모리 할당
- `vkAllocateCommandBuffers` — 커맨드 풀에서 커맨드 버퍼 할당
- `vkAllocateDescriptorSets` — 디스크립터 풀에서 디스크립터 셋 할당

세 개 다 공통점이 있는데, **풀(Pool) 또는 힙에서 떼어오는 구조**라서 `Allocate`/`Free` 패턴이야. 반면 `vkCreate*` (Pipeline, RenderPass, ImageView 등)은 생성 비용이 크고 빈도가 낮아서 `Create`/`Destroy` 패턴.

---

## 커맨드 버퍼와 디스크립터 셋에 풀이 필요한 이유

> **Q.** 메모리야 바로 공감되는데, 커맨드 버퍼랑 디스크립터 셋은 왜 풀이란 개념이 필요한 거야? VkImage는 이미지풀이란 개념이 없잖아. 어떤 간단한 구조체일 뿐이라 생각이 드는데.

핵심은 **할당 빈도**야.

- `VkImage`, `VkPipeline`: 로딩 타임에 만들고 오래 씀. 프레임마다 생성/파괴하지 않아.
- **커맨드 버퍼**: 매 프레임 녹화 → 제출 → 리셋 → 재녹화. 프레임당 수십 개를 돌려쓰는 경우도 흔함.
- **디스크립터 셋**: 머티리얼마다, 오브젝트마다 필요. 씬에 오브젝트 1000개면 수천 개가 필요할 수 있음.

풀이 해결하는 문제는 **메모리 할당 오버헤드 제거**:

```cpp
// 풀 없이 (매번 OS한테 요청)
for (int i = 0; i < 1000; i++) {
    auto* obj = new Object();  // malloc → 시스템콜 가능성
    delete obj;
}

// 풀 있으면 (미리 확보한 영역에서 bump)
MemoryPool pool(sizeof(Object) * 1000);  // 한 번만 크게 할당
for (int i = 0; i < 1000; i++) {
    auto* obj = pool.alloc();  // 포인터만 밀면 끝
}
pool.reset();                   // 한방에 전부 해제
```

`vkResetCommandPool`이나 `vkResetDescriptorPool`로 개별 해제 없이 **풀 전체를 한방에 리셋** 가능.

---

## pAllocator는 CPU 측 메모리다

> **Q.** pAllocator 보기만 했지 써본 적은 없는데 예시 좀 보여줘.

`pAllocator`는 Vulkan 드라이버가 **CPU 메모리**를 할당할 때 기본 `malloc`/`free` 대신 니가 제공한 함수를 쓰게 하는 거야.

```cpp
void* VKAPI_CALL myAlloc(void* pUserData, size_t size,
                          size_t alignment, VkSystemAllocationScope scope) {
    void* ptr = _aligned_malloc(size, alignment);
    printf("[VULKAN ALLOC] %zu bytes (scope: %d) -> %p\n", size, scope, ptr);
    return ptr;
}

VkAllocationCallbacks allocator = {};
allocator.pfnAllocation   = myAlloc;
allocator.pfnFree         = myFree;
allocator.pfnReallocation = myRealloc;
allocator.pUserData       = nullptr;

vkCreateInstance(&createInfo, &allocator, &instance);
```

> **Q.** 응? CPU 메모리 할당하는 거야? GPU 메모리 관리하는 거 아니었어?

맞아, CPU 메모리야. `vkCreateImage` 호출하면 두 종류의 메모리가 필요하거든:

```cpp
// 1. CPU 측 — VkImage 핸들의 내부 메타데이터 (pAllocator가 관여)
vkCreateImage(device, &imageInfo, &allocator, &image);

// 2. GPU 측 — 실제 픽셀 데이터 (pAllocator 무관)
vkAllocateMemory(device, &allocInfo, nullptr, &memory);
vkBindImageMemory(device, image, memory, 0);
```

대부분의 프로젝트에서는 `NULL` 전달. 주로 메모리 디버깅이나 콘솔 게임처럼 메모리 예산이 빠듯한 환경에서 쓰임.

---

## pAllocator vs VMA

> **Q.** 커스텀 메모리 할당자랑 VMA랑 비슷한 건 줄 알았는데 완전 다른 거잖아. 아닌가 VMA가 CPU랑 GPU 측 둘 다 관여하고 있는 건가?

VMA(Vulkan Memory Allocator)는 **GPU 측 메모리 관리가 주 목적**이야. `pAllocator`와는 거의 관계없어.

| | pAllocator | VMA |
|--|-----------|-----|
| 대상 | CPU 메모리 (드라이버 내부 메타데이터) | GPU 메모리 (버퍼, 이미지의 실제 데이터) |
| 대체하는 것 | `malloc`/`free` | `vkAllocateMemory` 직접 호출 |
| 쓰는 이유 | 메모리 디버깅/트래킹 | 할당 횟수 제한 우회, 단편화 방지, 성능 |
| 안 쓰면? | 드라이버 기본 allocator (보통 충분) | 직접 `vkAllocateMemory` 관리 (번거로움) |

VMA가 하는 일:

```
vkAllocateMemory(64MB)  ← VMA가 한 번만 호출
  ├─ Buffer A: offset 0,     size 1MB    ← VMA가 내부적으로 쪼갬
  ├─ Image B:  offset 1MB,   size 4MB
  ├─ Buffer C: offset 5MB,   size 512KB
  └─ (나머지 여유 공간)
```

`vkAllocateMemory`를 리소스마다 매번 호출하면 드라이버마다 동시에 존재할 수 있는 할당 횟수에 제한이 있음 (보통 4096개 정도). VMA는 큰 블록을 하나 할당하고 내부에서 서브할당으로 쪼개서 이 제한을 우회한다.
