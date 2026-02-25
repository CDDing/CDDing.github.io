---
title: "GPU 아키텍처 학습 로그"
sidebar:
  label: "GPU 아키텍처"
---

## GPU 내부 구조

> **Q.** 행렬곱에 효율적인 아키텍처잖아. 반면에 그래픽스 컴퓨팅 코어는 래스터화라던지 클리핑 이런 거에 특화되도록 만든 아키텍처라는 거 맞나?

반은 맞고 반은 좀 정리가 필요해. GPU 안에는 **두 종류**가 섞여있거든:

| 유닛               | 성격                               | 예시                               |
| ---------------- | -------------------------------- | -------------------------------- |
| **고정 함수 유닛**     | 특정 단계에 특화된 전용 하드웨어. 프로그래밍 불가.    | 래스터라이저, 클리핑, ROP, 텍스처 샘플러        |
| **셰이더 코어 (ALU)** | **범용 연산기**. 부동소수점 연산을 대량 병렬로 실행. | 버텍스 셰이더, 컴퓨트 셰이더, CUDA 전부 여기서 실행 |

셰이더 코어는 "그래픽스 전용"이 아니야. 범용 병렬 연산기이기 때문에 GPU 컴퓨팅이 가능한 거야.

```
GPU
├─ 셰이더 코어: 범용 병렬 연산기 (그래픽스 + 컴퓨트 겸용)
├─ 고정 함수 유닛: 래스터라이저, ROP 등 (그래픽스 전용)
├─ Tensor Core: 행렬곱 특화 (NVIDIA GPU 안에 존재)
└─ 비디오 엔진: 코덱 전용
```

---

## NPU vs GPU vs Tensor Core

> **Q.** NPU 같은 개념 이해가 나한테 필요한가? 안다면 어디까지 알아야 해?

GPU 프로그래머 지망이면 깊게 알 필요는 없고, **개념과 경계만** 알면 돼.

| | GPU 셰이더 코어 | Tensor Core | NPU |
|--|----------------|-------------|-----|
| 위치 | GPU 안 | GPU 안 | GPU 밖 (별도 칩) |
| 성격 | 범용 병렬 연산 | 행렬곱 특화 | 행렬곱 특화 (추론) |
| 장점 | 유연성 | GPU 내부라 데이터 교환 빠름 | 전력 효율이 좋음 |
| 용도 | 그래픽스, 컴퓨트 전반 | 학습/추론, 혼합 정밀도 연산 | 모바일 온디바이스 추론 |

NVIDIA 방향이면 **Tensor Core**가 더 관련 있음 — GPU 안에 있어서 셰이더 코어와 데이터를 빠르게 주고받을 수 있고, CUDA와 직접 연계됨.

---

## 언리얼 엔진 드로우콜 흐름

> **Q.** 진짜 딴 질문인데 언리얼 엔진은 드로우콜이 어떻게 일어나? 큰 틀만.

앱 레벨에서는 드로우콜을 직접 안 해. 액터를 월드에 배치하고 머티리얼 붙이면 엔진이 알아서 처리.

```
1. 씬 순회 → 렌더링 가능한 액터 수집
2. 컬링 → Frustum Culling + Occlusion Culling
3. 소팅 & 배칭 → 같은 머티리얼 묶기, Instancing, Nanite 분기
4. 렌더링 패스 실행 → Depth Prepass → Base Pass → Lighting → Post Process
5. 각 패스 안에서 실제 드로우콜 발생
   └─ RHI 레이어가 Vulkan이면 vkCmdDraw, DX12면 DrawInstanced로 변환
```

핵심은 **RHI(Rendering Hardware Interface) 레이어**. 그래픽스 API를 추상화해서 같은 게임 코드가 Vulkan, DX12, Metal 위에서 동작.

Nanite는 전통적인 드로우콜 대신 **컴퓨트 셰이더로 소프트웨어 래스터라이징**을 해서 드로우콜 자체를 우회하는 구조.

---

## Precise Exception — CPU vs GPU

> **Q.** CPU에서 "정확한 예외 처리(precise exception)를 우선시한다"는 게 무슨 뜻이야? GPU는 왜 이를 우선시하지 않아?

**Precise exception**이란 예외 발생 시 프로세서 상태가 **프로그램 순서대로 정확히 보존**된 것을 의미한다. 구체적으로, 예외가 발생한 명령어 이전의 모든 명령어는 commit 완료, 이후의 명령어는 상태를 변경하지 않은 상태를 보장한다. 이렇게 하면 예외 핸들러가 [정확히 그 지점에서 실행을 재개](https://fiveable.me/advanced-computer-architecture/unit-3/exception-handling-pipelined-processors/study-guide/ulz8mSCscBUvbxNp)할 수 있다.

### CPU — Precise Exception이 필수인 이유

CPU는 out-of-order 실행을 하면서도 [Reorder Buffer(ROB)](https://en.wikipedia.org/wiki/Out-of-order_execution)로 프로그램 순서를 추적하여 precise exception을 보장한다.

**Page Fault 예시:**

```
명령어 1: a = b + c       ← commit 완료
명령어 2: d = memory[X]   ← Page Fault 발생 (메모리가 디스크에 있음)
명령어 3: e = f * g       ← 상태 변경 없음
```

OS가 페이지를 디스크에서 로드한 뒤, **명령어 2부터 정확히 재개**할 수 있다. 이 외에도 0으로 나누기, segfault, 디버거 브레이크포인트 등에서 정확한 위치를 알 수 있어야 프로그램 정확성과 디버깅이 가능하다.

### GPU — Imprecise Exception을 선택한 이유

GPU는 precise exception에 필요한 하드웨어 비용(ROB 등)을 **ALU를 더 넣는 데** 사용한다. 트레이드오프:

| | CPU | GPU |
|---|---|---|
| 예외 처리 | **Precise** — 정확한 지점에서 상태 보존·재개 | **Imprecise** — 대략적 위치, 비동기 보고 |
| 이유 | 디버깅, OS 가상 메모리, 프로그램 정확성 | 처리량 극대화, 하드웨어 비용 절감 |
| 디버깅 | 정확한 위치 즉시 확인 | 별도 도구([cuda-memcheck](https://docs.nvidia.com/cuda/cuda-gdb/index.html), cuda-gdb) 필요 |

GPU에서 메모리 폴트가 발생하면, [해당 폴트는 CPU로 전달](https://dl.acm.org/doi/10.1145/3123939.3123950)되어 CPU가 처리하며 그 동안 GPU 파이프라인의 해당 스레드는 정지된다. 수만 개 스레드 각각에 precise exception을 보장하는 것은 현실적으로 불가능에 가까우므로, GPU는 처리량을 위해 이를 포기한 것이다.

> 📚 **참고**
> - [Exception Handling in Pipelined Processors — Fiveable](https://fiveable.me/advanced-computer-architecture/unit-3/exception-handling-pipelined-processors/study-guide/ulz8mSCscBUvbxNp) — precise vs imprecise exception 정의
> - [Efficient Exception Handling Support for GPUs — ACM MICRO'17](https://dl.acm.org/doi/10.1145/3123939.3123950) — GPU 예외 처리의 한계와 해결 방안
> - [CUDA-GDB Documentation — NVIDIA](https://docs.nvidia.com/cuda/cuda-gdb/index.html) — GPU 디버깅 시 imprecise exception 대응
> - [Out-of-Order Execution — Wikipedia](https://en.wikipedia.org/wiki/Out-of-order_execution) — ROB와 precise exception의 관계

---

## 가속기 모드와 PTX

> **Q.** GPU에서 "가속기 모드"는 무슨 말이야? PTX는 뭐야?

### 가속기 모드(Accelerator Mode)

GPU는 **혼자서 독립적으로 프로그램을 실행할 수 없다**는 의미이다. CPU가 호스트(host), GPU가 장치(device/accelerator)로 동작하는 구조:

- **CPU**: OS 실행, 메모리 할당, I/O 관리, 프로그램 시작 — 모든 것을 스스로 수행
- **GPU**: CPU가 "이 데이터로 이 커널 실행해"라고 **지시해야만 동작**

[CUDA에서는](https://docs.nvidia.com/cuda/cuda-programming-guide/01-introduction/cuda-platform.html) CPU가 메모리를 할당하고(`cudaMalloc`), 데이터를 전송하고(`cudaMemcpy`), 커널 실행을 지시(`kernel<<<...>>>`)하는 전 과정을 주도한다. GPU에는 OS도, 파일 시스템도, I/O 처리 전용 하드웨어도 없다.

### PTX (Parallel Thread Execution)

CPU의 ISA(예: x86)는 공개되어 있고 세대가 바뀌어도 하위 호환된다. 반면 GPU는 세대마다 **실제 하드웨어 ISA(SASS)가 다르다** (sm_80, sm_90 등). 매번 재컴파일하는 문제를 해결하기 위해 NVIDIA가 도입한 **가상(virtual) ISA**가 [PTX](https://docs.nvidia.com/cuda/parallel-thread-execution/)이다.

```
CUDA C/C++  →  PTX (가상 ISA, 하드웨어 독립)  →  SASS (실제 명령어, GPU 세대별)
              컴파일 타임(nvcc)                  설치/실행 시(드라이버 JIT)
```

PTX의 설계 목표:
1. **여러 GPU 세대에 걸쳐 안정적인 ISA** 제공
2. 네이티브 GPU 성능에 비견되는 성능
3. C/C++ 컴파일러가 타겟으로 삼을 수 있는 **머신 독립 ISA**

Java 바이트코드가 JVM 위에서 플랫폼 독립적으로 실행되듯, PTX는 GPU 드라이버 위에서 GPU 세대 독립적으로 실행된다.

> 📚 **참고**
> - [PTX ISA 9.1 — NVIDIA Official Documentation](https://docs.nvidia.com/cuda/parallel-thread-execution/) — PTX 정의, 설계 목표, 컴파일 파이프라인
> - [The CUDA Platform — CUDA Programming Guide](https://docs.nvidia.com/cuda/cuda-programming-guide/01-introduction/cuda-platform.html) — CUDA → PTX → cubin 컴파일 흐름
> - [Introduction to GPU Architecture — ENCCS](https://enccs.github.io/openmp-gpu/gpu-architecture/) — CPU host / GPU device 구조

---

## SM, SP, 워프의 관계

> **Q.** SM이 여러 SP를 보유하고, SM이 SP를 운용하는 단위가 워프/웨이브프론트 — 맞나?

방향은 맞지만 한 가지 보정이 필요하다. 워프는 **SP(하드웨어)의 그룹이 아니라 스레드(소프트웨어)의 그룹**이다. <sup class="fn-ref"><a href="/log/misc/gpu_architecture/#gpu-스레드의-본질--실행-컨텍스트">[1]</a><span class="fn-tooltip"><span class="fn-title"><a href="/log/misc/gpu_architecture/#gpu-스레드의-본질--실행-컨텍스트">GPU 스레드의 본질 — 실행 컨텍스트</a></span><span class="fn-desc">스레드는 함수가 아니라 실행 인스턴스(PC + 레지스터 + ID). 레지스터 파일에 상주하므로 워프 전환 비용이 0.</span></span></sup>

### 정확한 계층 구조

- **SM (Streaming Multiprocessor)**: SP들 + 워프 스케줄러 + 레지스터 파일 + 공유 메모리를 묶은 실행 단위. CPU 코어에 대응. <sup class="fn-ref"><a href="/log/misc/gpu_architecture/#레지스터-파일-vs-sp--분할되는-것은-무엇인가">[2]</a><span class="fn-tooltip"><span class="fn-title"><a href="/log/misc/gpu_architecture/#레지스터-파일-vs-sp--분할되는-것은-무엇인가">레지스터 파일 vs SP</a></span><span class="fn-desc">레지스터 파일은 스레드마다 파티션 분할. SP는 분할하지 않고 워프가 교대로 사용하는 공유 연산 유닛.</span></span></sup>
- **SP (Stream Processor / CUDA Core)**: 하나의 ALU. 한 번에 하나의 스레드 명령어를 실행하는 하드웨어.
- **워프 (Warp)**: [32개 **스레드**의 묶음](https://docs.nvidia.com/cuda/cuda-programming-guide/01-introduction/programming-model.html). SM의 워프 스케줄러가 관리하는 최소 스케줄링 단위.

프로그래머가 1024개 스레드를 요청하면 → 32개씩 묶어 워프 32개 생성 → 워프 스케줄러가 준비된 워프를 골라 SP들에 매핑하여 실행. SM에는 SP 수보다 워프가 훨씬 많이 존재할 수 있으며, 워프 A가 메모리 대기 중이면 즉시 워프 B로 전환하여 [레이턴시를 숨긴다](https://modal.com/gpu-glossary/device-software/warp).

### 벤더별 용어 차이

| 개념 | NVIDIA | AMD | Intel (Xe) |
|------|--------|-----|------------|
| 실행 단위 묶음 | SM | CU (Compute Unit) | EU (Execution Unit) |
| ALU 유닛 | SP / CUDA Core | Stream Processor | ALU |
| 스레드 그룹 | Warp (32) | Wavefront (64, RDNA는 32도 지원) | SIMD Thread (8~16) |
| 스레드 블록 | Thread Block | Work-group | Work-group |

강의에서 "워프/웨이브프론트를 동의어로 사용한다"고 한 이유는 같은 개념의 벤더별 이름이기 때문이다. OpenCL 표준에서는 벤더 중립적으로 **sub-group**이라 부른다.

> 📚 **참고**
> - [CUDA Programming Guide — Programming Model](https://docs.nvidia.com/cuda/cuda-programming-guide/01-introduction/programming-model.html) — 스레드 → 워프 → 블록 → SM 매핑
> - [What is a Warp? — GPU Glossary (Modal)](https://modal.com/gpu-glossary/device-software/warp) — 워프 정의, SM-워프-스레드 계층 구조
> - [Understanding Warp Scheduling — NVIDIA Developer Forums](https://forums.developer.nvidia.com/t/understanding-warp-scheduling-on-a-streaming-multiprocessor/359568) — 워프 스케줄링 메커니즘

---

## GPU 스레드의 본질 — 실행 컨텍스트

> **Q.** 쓰레드는 애초에 메모리 덩어리 아닌가? 함수처럼? 그냥 그걸 하드웨어에 씌우는 거고.

방향은 맞지만, "메모리 덩어리"보다 더 정확한 표현이 있다. 스레드는 **실행 컨텍스트(execution context)** 이다.

### 스레드 ≠ 함수

커널(함수)과 스레드를 구분해야 한다:

- **커널(kernel)**: 코드 자체. 모든 스레드가 **같은 함수**를 공유한다. 메모리에 딱 한 벌 존재.
- **스레드**: 그 커널을 실행하는 **개별 인스턴스**. 각자 고유한 상태를 가진다.

스레드 하나의 상태는 이것이 전부다:

| 구성 요소 | 역할 |
|-----------|------|
| **프로그램 카운터(PC)** | 지금 어디를 실행 중인지 |
| **레지스터 세트** | 스레드 고유의 지역 변수 저장소 |
| **스레드 ID** (`threadIdx`, `blockIdx`) | 내가 어떤 데이터를 처리하는지 결정 |

즉, 1024개 스레드를 실행하면 함수는 1개, 실행 컨텍스트가 1024개인 것이다. CUDA 공식 문서는 이를 이렇게 표현한다: ["The execution context (program counters, registers, etc.) for each warp processed by an SM is maintained on-chip throughout the warp's lifetime."](https://docs.nvidia.com/cuda/cuda-programming-guide/03-advanced/advanced-kernel-programming.html)

### CPU 스레드와의 결정적 차이

직관이 맞는 부분이 여기다. GPU 스레드가 "그냥 하드웨어에 씌운다"는 느낌이 드는 이유는, SM의 레지스터 파일이 **모든 활성 스레드의 컨텍스트를 동시에 들고 있기** 때문이다.

```
CPU 스레드 전환:
  레지스터 → 메모리에 저장 → 새 스레드 레지스터를 메모리에서 로드 (비용 큼)

GPU 워프 전환:
  스케줄러가 다른 워프의 레지스터 영역을 가리킴 (비용 0)
```

SM의 [레지스터 파일은 워프 단위로 분할(partitioned)](https://docs.nvidia.com/cuda/cuda-programming-guide/03-advanced/advanced-kernel-programming.html) 되어 있어서, 워프 A가 메모리를 기다리는 동안 워프 B로 전환할 때 **아무것도 저장하거나 복원할 필요가 없다**. CUDA 문서의 표현대로 ["switching between warps incurs no cost"](https://docs.nvidia.com/cuda/cuda-programming-guide/03-advanced/advanced-kernel-programming.html)인 이유다.

### 그래서 "메모리 덩어리"라는 직관이 반쯤 맞는 이유

스레드의 본체는 결국 **레지스터 파일 안의 한 구획**이다. 커널 함수가 레지스터를 N개 쓴다고 컴파일러가 알려주면, SM이 자기 레지스터 파일을 N개씩 잘라서 스레드마다 배분한다. 스레드 = 레지스터 파일의 한 슬라이스 + PC. 이 의미에서 "데이터 덩어리를 하드웨어에 올려놓는 것"이라는 직관은 틀리지 않다.

다만 정확히는:
- 스레드는 함수가 아니라 함수의 **실행 인스턴스**
- "메모리"라기보다 **온칩 레지스터 파일의 한 파티션**
- "씌운다"라기보다 **미리 분할해서 상주시킨다** (그래서 전환 비용이 0)

> 📚 **참고**
> - [CUDA Programming Guide §3.2 — Advanced Kernel Programming](https://docs.nvidia.com/cuda/cuda-programming-guide/03-advanced/advanced-kernel-programming.html) — 실행 컨텍스트 온칩 유지, 레지스터 파일 파티셔닝, 워프 전환 비용 0
> - [Demystifying GPUs for CPU-centric Programmers — Medium](https://medium.com/@penberg/demystifying-gpus-for-cpu-centric-programmers-e24934a620f1) — CPU 스레드 vs GPU 스레드 비교, 컨텍스트 스위칭 차이
> - [CUDA Refresher: The CUDA Programming Model — NVIDIA Blog](https://developer.nvidia.com/blog/cuda-refresher-cuda-programming-model/) — 스레드 → 워프 → 블록 → 그리드 실행 모델

---

## 레지스터 파일 vs SP — 분할되는 것은 무엇인가

> **Q.** "레지스터 파일을 스레드 수만큼 잘라서 배분한다"는 건 SP를 자른다는 뜻인가?

아니다. 레지스터 파일과 SP는 SM 안의 **별개 하드웨어**이다.

```
SM 내부:
├─ 레지스터 파일 (거대한 SRAM) ← 스레드마다 파티션을 나눈다
├─ SP (CUDA Core) × N개        ← 나누지 않는다. 워프가 돌아가며 사용
├─ 워프 스케줄러
└─ 공유 메모리
```

| 하드웨어 | 역할 | 스레드와의 관계 |
|----------|------|----------------|
| **레지스터 파일** | 스레드의 상태(변수) **저장** | 스레드마다 고유 파티션 배분 |
| **SP (CUDA Core)** | 산술 **연산 수행** (ALU) | 워프 단위로 공유·교대 사용 |

비유하면 레지스터 파일은 각 직원의 **개인 책상**(자기 서류가 항상 펼쳐져 있음)이고, SP는 **공용 계산기**(차례가 오면 자기 책상의 숫자를 들고 와서 계산)이다.

스레드 1024개면 레지스터 파일은 1024개 파티션으로 나뉘지만, SP가 1024개 필요하진 않다. SM에 SP가 32개면, 워프 스케줄러가 준비된 워프(32스레드)를 골라 SP 32개에 태워 실행하고, 다음 사이클에 다른 워프를 태운다. 이것이 [점유율(occupancy)](https://docs.nvidia.com/cuda/cuda-programming-guide/03-advanced/advanced-kernel-programming.html)과 레이턴시 은닉의 핵심 메커니즘이다.

> 📚 **참고**
> - [CUDA Programming Guide §3.2 — Advanced Kernel Programming](https://docs.nvidia.com/cuda/cuda-programming-guide/03-advanced/advanced-kernel-programming.html) — SM 내부 구조, 레지스터 파일 파티셔닝, 워프 스케줄링
