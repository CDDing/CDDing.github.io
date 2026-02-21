---
title: "Introduction (소개) — 한글 요약"
sidebar:
  label: "01. Introduction"
---

> 원본: https://docs.nvidia.com/cuda/cuda-programming-guide/01-introduction/introduction.html

이 챕터는 GPU가 범용 연산(General-Purpose Computing) 장치로 진화한 배경,
CPU 대비 GPU의 **구조적 이점**, 그리고 CUDA 생태계에 빠르게 진입하는 방법을 소개한다.

---

## 1. The Graphics Processing Unit (그래픽 처리 장치)

GPU는 원래 3D 그래픽 전용 프로세서로 출발했다.

- 초기에는 **고정 기능 하드웨어(Fixed-Function Hardware)** 로, 정해진 파이프라인만 실행 가능했음
- 2003년경 그래픽 파이프라인의 각 단계가 **완전히 프로그래밍 가능(Fully Programmable)** 해짐
- 이로써 그래픽 외의 **커스텀 코드를 병렬로 실행**할 수 있는 기반이 마련됨

### CUDA의 등장

- NVIDIA는 2006년 **CUDA(Compute Unified Device Architecture)** 를 출시
- 기존의 그래픽 API(OpenGL, DirectX) 없이도 GPU에서 **범용 연산(GPGPU)** 을 수행할 수 있게 됨

### 현재 GPU 컴퓨팅 활용 분야

| 분야 | 예시 |
|------|------|
| 과학 시뮬레이션 | 유체 역학(Fluid Dynamics), 에너지 전달(Energy Transfer) |
| 비즈니스 애플리케이션 | 데이터베이스(Database), 분석(Analytics) |
| AI 기술 | 이미지 분류(Image Classification), 확산 모델(Diffusion Models), 대규모 언어 모델(LLM) |

> **핵심**: GPU는 "그래픽 전용"에서 "범용 병렬 프로세서"로 진화했다. CUDA는 이 전환을 가능하게 한 핵심 플랫폼이다.

---

## 2. The Benefits of Using GPUs (GPU 사용의 이점)

### 2.1 성능 이점

GPU는 비슷한 비용과 전력 소비에서 CPU보다 훨씬 높은 성능을 제공한다:

- **명령어 처리량(Instruction Throughput)**: GPU가 동시에 처리할 수 있는 연산의 수가 압도적
- **메모리 대역폭(Memory Bandwidth)**: GPU 메모리는 CPU 메모리보다 훨씬 빠른 데이터 전송 속도를 가짐

### 2.2 CPU vs GPU — 설계 철학의 차이

| 항목 | CPU | GPU |
|------|-----|-----|
| 설계 목표 | 단일 스레드 실행 속도 극대화 | 수천 개 스레드의 **총 처리량(Throughput)** 극대화 |
| 병렬 능력 | 제한적 (수십 개 스레드) | 대규모 (수천~수만 개 스레드) |
| 개별 스레드 성능 | 높음 | 상대적으로 낮음 |
| 트랜지스터 배분 | 캐싱(Cache) + 흐름 제어(Flow Control) 중심 | **데이터 처리(ALU)** 에 집중 |

```
┌─────────────────────────────┐    ┌─────────────────────────────┐
│          CPU                │    │          GPU                │
│  ┌──────┐ ┌──────────────┐ │    │  ┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐ │
│  │ Core │ │              │ │    │  │SM││SM││SM││SM││SM││SM│ │
│  │      │ │    Cache     │ │    │  └──┘└──┘└──┘└──┘└──┘└──┘ │
│  │      │ │              │ │    │  ┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐ │
│  ├──────┤ │              │ │    │  │SM││SM││SM││SM││SM││SM│ │
│  │ Core │ │              │ │    │  └──┘└──┘└──┘└──┘└──┘└──┘ │
│  └──────┘ └──────────────┘ │    │   (데이터 처리에 집중)      │
│   (흐름 제어 + 캐시 중심)   │    └─────────────────────────────┘
└─────────────────────────────┘
```

- **CPU**: 소수의 강력한 코어 + 대용량 캐시. 복잡한 분기(Branch)와 순차 로직에 유리
- **GPU**: 다수의 SM(Streaming Multiprocessor)으로 구성. 단순하고 반복적인 대량 연산에 유리

> **핵심**: CPU는 "소수 정예", GPU는 "인해전술". 워크로드의 특성에 따라 적합한 프로세서가 다르다.

### 2.3 FPGA와의 비교

- **FPGA(Field-Programmable Gate Array)** 는 에너지 효율성(Energy Efficiency)에서 우수
- 그러나 GPU에 비해 **프로그래밍 유연성(Programming Flexibility)** 이 부족
- 알고리즘이 자주 바뀌거나 빠른 개발이 필요한 경우 GPU가 더 적합

---

## 3. Getting Started Quickly (빠르게 시작하기)

GPU를 **직접 프로그래밍하지 않아도** 활용할 수 있는 방법들이 있다:

### 3.1 특화 라이브러리 (Specialized Libraries)

| 라이브러리 | 용도 |
|-----------|------|
| **cuBLAS** | 선형 대수(Linear Algebra) 연산 |
| **cuFFT** | 고속 푸리에 변환(Fast Fourier Transform) |
| **cuDNN** | 딥러닝 프리미티브(Deep Learning Primitives) |
| **CUTLASS** | 행렬 곱셈 커널(Matrix Multiplication Kernels) |

이들 라이브러리는 NVIDIA가 하드웨어에 맞게 **고도로 최적화**한 알고리즘을 제공한다.

### 3.2 AI 프레임워크 (AI Frameworks)

- PyTorch, TensorFlow 등 주요 프레임워크가 내부적으로 GPU 가속 라이브러리를 활용
- 프레임워크 수준에서 GPU를 사용하므로 CUDA 코드를 직접 작성할 필요 없음

### 3.3 도메인 특화 언어 (Domain-Specific Languages)

| 언어 | 설명 |
|------|------|
| **NVIDIA Warp** | 물리 시뮬레이션 등에 특화된 Python 기반 언어 |
| **OpenAI Triton** | GPU 커널을 Python으로 작성, CUDA로 직접 컴파일 |

### 3.4 교육 리소스 (Educational Resources)

- **NVIDIA Accelerated Computing Hub**에서 튜토리얼과 예제 제공
- 단계별 가이드로 CUDA 프로그래밍 학습 가능

> **실무 팁**: 기존 라이브러리를 활용하는 것이 알고리즘을 직접 재구현하는 것보다 **생산적이고 성능도 좋은 경우가 많다**. 커스텀 커널 작성은 라이브러리로 해결되지 않는 경우에만 고려하자.

---

## 빠른 참조 표

### CPU vs GPU 핵심 비교

| 항목 | CPU | GPU |
|------|-----|-----|
| 코어 수 | 소수 (수~수십 개) | 다수 (수천 개 CUDA 코어) |
| 스레드 성능 | 개별 스레드 성능 높음 | 개별 스레드 성능 낮음 |
| 총 처리량 | 상대적으로 낮음 | **매우 높음** |
| 적합한 워크로드 | 분기가 많고 순차적인 작업 | 단순하고 병렬화 가능한 대량 연산 |
| 메모리 대역폭 | 상대적으로 낮음 | **매우 높음** |

### GPU 활용 계층 (직접 프로그래밍 없이 → 직접 프로그래밍)

```
레벨 1: AI 프레임워크 (PyTorch, TensorFlow)
  └─ GPU를 자동으로 활용, CUDA 지식 불필요

레벨 2: 특화 라이브러리 (cuBLAS, cuFFT, cuDNN)
  └─ API 호출로 최적화된 GPU 연산 사용

레벨 3: 도메인 특화 언어 (Warp, Triton)
  └─ 높은 수준의 언어로 GPU 커널 작성

레벨 4: CUDA C/C++ 직접 프로그래밍
  └─ 최대 유연성, 최대 제어. 학습 곡선 높음
```

---

## 이 챕터에서 기억해야 할 것 TOP 5

1. **GPU는 범용 병렬 프로세서** — 그래픽 전용이 아니라, CUDA 이후 과학 연산부터 AI까지 폭넓게 활용됨
2. **CPU와 GPU는 설계 철학이 다르다** — CPU는 소수 코어의 단일 성능, GPU는 다수 코어의 총 처리량
3. **트랜지스터 배분이 핵심** — GPU는 캐시/흐름 제어 대신 데이터 처리(ALU)에 집중 투자
4. **직접 프로그래밍 없이도 GPU 활용 가능** — 라이브러리, 프레임워크, DSL을 먼저 검토하자
5. **기존 라이브러리 우선** — 커스텀 커널은 라이브러리로 해결되지 않을 때만 작성

---

*이 문서는 NVIDIA CUDA Programming Guide v13.1의 Introduction 챕터를 한글로 요약한 것입니다.*
*원본: https://docs.nvidia.com/cuda/cuda-programming-guide/01-introduction/introduction.html*
