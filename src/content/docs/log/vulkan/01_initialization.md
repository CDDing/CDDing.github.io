---
title: "Initialization 학습 로그"
sidebar:
  label: "01. Initialization"
---

## PFN 접두사의 의미

> **Q.** `vkGetInstanceProcAddr`에서 앞의 PFN은 뭐야? `PFN_vkVoidFunction`은 Vulkan의 커스텀 자료형 같은 거야? PFN의 맨 앞은 pointer function 어쩌구 같은데 맞나?

맞아. **PFN = Pointer to FunctioN**이야.

Vulkan 스펙에서 쓰는 함수 포인터 타입 네이밍 컨벤션이야. C에서 함수 포인터 타입을 `typedef`로 정의할 때 `PFN_` 접두사를 붙이는 거지.

```c
// 이게 실제 정의
typedef void (*PFN_vkVoidFunction)(void);
```

풀어 쓰면 "아무 인자 안 받고 아무것도 안 반환하는 함수에 대한 포인터 타입"이야. 모든 Vulkan 함수 포인터의 범용 타입으로 쓰이고, 실제 사용할 때는 캐스팅해야 해:

```c
PFN_vkVoidFunction rawPtr = vkGetInstanceProcAddr(instance, "vkCreateDevice");
PFN_vkCreateDevice createDevice = (PFN_vkCreateDevice)rawPtr;
```

Vulkan 헤더에는 모든 커맨드에 대해 `PFN_` 타입이 미리 정의되어 있음:

```c
typedef VkResult (*PFN_vkCreateDevice)(...);
typedef void     (*PFN_vkDestroyDevice)(...);
typedef void     (*PFN_vkCmdDraw)(...);
```

Vulkan만의 방식이 아니라 C의 일반적 관례. Win32 API의 `WNDPROC`, `FARPROC` 등도 같은 맥락.

---

## Vulkan이 C API 스타일을 쓰는 이유

> **Q.** C 스타일이 뭔가 함수의 반환형 없이 함수의 결과를 파라미터로 전달하는 느낌인데 맞나? C++에서는 객체지향적으로 작업한 결과물을 바로 리턴하는 느낌이던데. C에서도 반환은 되지 않나? 왜 이런 스타일이 생긴 거지?

오해는 아니고, 실제로 Vulkan API에서 그런 패턴이 두드러지게 보이는 게 맞아.

```c
// Vulkan 스타일 — 결과를 포인터 파라미터로 받음
VkResult vkCreateInstance(
    const VkInstanceCreateInfo* pCreateInfo,
    const VkAllocationCallbacks* pAllocator,
    VkInstance* pInstance);    // ← 결과가 여기로 나옴

// C++스러운 스타일이었다면
VkInstance createInstance(const VkInstanceCreateInfo& createInfo);
```

C에서도 당연히 반환은 돼. Vulkan이 이 패턴을 쓰는 이유:

1. **반환값을 에러 코드로 쓰고 싶으니까**. C에는 예외가 없어서 에러를 알려줄 방법이 반환값뿐. 반환값은 `VkResult`가 차지하고 실제 결과물은 포인터 파라미터로 빼는 거지.
2. **여러 결과 반환**. C 함수는 반환값이 하나뿐. `vkAllocateCommandBuffers`처럼 배열로 돌려줘야 하는 경우 포인터 파라미터가 필수.
3. **ABI 호환성**. 큰 구조체를 값으로 반환하면 컴파일러/플랫폼마다 호출 규약이 달라질 수 있음. 포인터로 전달하면 모호함이 없음.

Vulkan이 C API로 설계된 이유: **C ABI는 사실상 모든 언어에서 FFI로 호출 가능** (C++, Rust, Python, Java). C++ 래퍼인 Vulkan-Hpp를 쓰면 익숙한 스타일로 바뀜:

```cpp
vk::Instance instance = vk::createInstance(createInfo);
// 실패하면 자동으로 예외 throw
```

---

> **Q.** C++도 사실상 C의 래핑이지? 객체지향적으로.

역사적으로는 맞아. C++의 초기 이름이 "C with Classes"였을 정도로, 초기 C++ 컴파일러(Cfront)는 C++ 코드를 C로 변환한 다음 C 컴파일러로 컴파일했어.

```cpp
// C++ 클래스
class Dog {
    int age;
public:
    void bark() { printf("woof %d\n", age); }
};
Dog d;
d.bark();

// 컴파일러가 내부적으로 하는 일 (C 수준)
struct Dog { int age; };
void Dog_bark(Dog* this) { printf("woof %d\n", this->age); }
Dog d;
Dog_bark(&d);
```

근데 "래핑"이라고만 하기엔 현대 C++은 많이 달라졌어. C에는 대응 개념이 없는 것들 — `constexpr`, RAII, move semantics, concepts, coroutines. 지금은 "C의 래핑"보다는 **C와 뿌리를 공유하는 별개 언어**에 가까워.

---

## 디스패치(Dispatch)란?

> **Q.** 디스패치를 한다는 건 뭐지? 함수 포인터는 디스패치 코드를 거칠 수 있다는 게 무슨 말이지?

여기서 디스패치는 **"어디로 보낼지 판단해서 라우팅하는 것"**이야.

시스템에 GPU가 여러 개 있을 수 있잖아. `vkGetInstanceProcAddr`로 얻은 함수 포인터는 호출 시 디스패치 코드를 거침:

```
앱이 vkCmdDraw 호출
    │
    ▼
디스패치 코드 (로더가 삽입)
    ├─ "커맨드 버퍼가 GPU 0 소속" → GPU 0 드라이버의 vkCmdDraw
    └─ "커맨드 버퍼가 GPU 1 소속" → GPU 1 드라이버의 vkCmdDraw
```

`vkGetDeviceProcAddr`로 얻으면 이 과정을 건너뜀:

```c
// Instance 레벨 — 매 호출마다 디스패치
PFN_vkCmdDraw draw = vkGetInstanceProcAddr(instance, "vkCmdDraw");
draw(cmdBuffer, ...);  // → 디스패치 코드 → 드라이버 함수

// Device 레벨 — 직통
PFN_vkCmdDraw draw = vkGetDeviceProcAddr(device, "vkCmdDraw");
draw(cmdBuffer, ...);  // → 바로 드라이버 함수
```

> **Q.** 뭔가 함수 콜스택 한 번에다가 조건문 처리 정도의 오버헤드로 보이는데 맞아?

맞아, 대략 그 수준이야. 실제 디스패치 코드는:

```c
void vkCmdDraw(VkCommandBuffer cmdBuffer, ...) {
    VkLayerDispatchTable* table = *(VkLayerDispatchTable**)cmdBuffer;
    table->CmdDraw(cmdBuffer, ...);
}
```

포인터 역참조 두 번 + 간접 함수 호출 한 번. C++ vtable lookup과 거의 동일한 구조. 단일 호출로는 나노초 단위라 무시할 수준이지만, `vkCmd*`를 프레임당 수천~수만 번 호출하면 누적될 수 있음.

---

## 레이어 배열 순서

> **Q.** `VkInstanceCreateInfo`에서 배열의 첫 번째가 앱에 가장 가깝고 마지막이 드라이버에 가장 가깝다는 건 무슨 말이지?

레이어가 앱과 드라이버 사이에 끼어드는 미들웨어 같은 거라서 그래.

```
앱 (API 호출)
  │
  ▼
레이어 [0] — 배열 첫 번째 (앱에 가장 가까움)
  │
  ▼
레이어 [1]
  │
  ▼
레이어 [N-1] — 배열 마지막 (드라이버에 가장 가까움)
  │
  ▼
GPU 드라이버 (실제 구현)
```

> **Q.** 그걸 역순으로 두는 게 가능은 한 거 아니야? 원하는 결과가 안 나올 뿐이지.

맞아, 역순으로 두는 게 가능은 해. 에러가 나거나 하진 않아. 스펙에서 말하는 건 "이렇게 배치해야 한다"가 아니라 **"배열 순서가 이렇게 매핑된다"**는 구조 설명이야. 어떤 레이어를 어디에 넣든 앱 자유이고, 순서에 따라 호출 체인에서의 위치만 달라지는 거야.

---

## constexpr — 컴파일 타임 확정

> **Q.** `constexpr`이 뭐지?

컴파일 타임에 값을 확정시키는 키워드야.

```cpp
constexpr int b = 5 * 3;  // 컴파일 시점에 15로 확정. 바이너리에 15가 박혀있음
```

`const`와의 차이:

```cpp
const int x = getInput();      // OK — 런타임에 정해지고 변경 불가
constexpr int y = getInput();  // 컴파일 에러 — 컴파일 타임에 값을 모름
```

> **Q.** 그거 안 박았는데 계산해보니까 컴파일 타임에 안 나오는 거면 어떻게 돼? 컴파일러가 빌드 못하게 하나?

맞아, **컴파일 에러**야. 빌드 자체가 안 돼. `constexpr`은 단순한 힌트가 아니라 **컴파일러가 강제하는 계약**이야.

> **Q.** `std::string`도 안 되겠네. `std::vector` 상속받은 구현체니까. 문자열이 되는 이유는 `const char*`인 거고.

두 가지 짚어줄 게 있어. 첫째, `std::string`은 `std::vector`를 **상속받은 게 아니야**. 둘 다 내부적으로 힙 할당하는 건 맞지만 완전히 별개의 클래스야.

둘째, `constexpr`에서 문자열이 되는 이유는 맞아, `const char*` 문자열 리터럴이라서 가능한 거야. 문자열 리터럴은 바이너리의 `.rodata` 섹션에 이미 박혀있고, `const char*`는 그 주소를 가리킬 뿐이라 힙 할당이 필요 없거든.

C++20부터는 `constexpr std::string`이 제한적으로 가능해졌어. 컴파일 타임 안에서 할당하고 **해제까지 완료**되면 OK:

```cpp
constexpr int test() {
    std::string s = "hello";
    return s.size();
}  // s 소멸 → 메모리 해제 → OK
constexpr int len = test();  // 5
```

> **Q.** 컴파일 타임에 할당한 게 런타임까지 살아남으면 왜 안 되는 거야?

**컴파일 타임과 런타임은 완전히 다른 세계**라서야. 컴파일러가 `constexpr std::string`을 평가하면 컴파일러의 **가상 힙**에 데이터가 할당돼. 이걸 런타임까지 살리려면 바이너리에 구워넣어야 하는데:

- 그 메모리의 주소는? 런타임에 OS가 정하는 건데 컴파일 타임에 모름
- `std::string` 내부 포인터가 그 주소를 가리켜야 하는데 존재하지 않음
- 프로그램 끝날 때 소멸자가 `free`를 호출할 텐데, 힙에서 `malloc`으로 할당된 게 아니라 크래시

> **컴파일 타임 힙 ≠ 런타임 힙**이라서 경계를 넘길 수 없는 거야.
