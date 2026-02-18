export interface Update {
  title: string;
  href: string;
  category: 'vulkan' | 'cuda';
  date: string; // YYYY-MM-DD
}

export const updates: Update[] = [
  {
    title: 'Image Operations (이미지 연산) 해설',
    href: 'https://cdding.github.io/vk_spec_ko/spec/10_images/',
    category: 'vulkan',
    date: '2026-02-17',
  },
  {
    title: 'Resource Creation (리소스 생성) 해설',
    href: 'https://cdding.github.io/vk_spec_ko/spec/09_resources/',
    category: 'vulkan',
    date: '2026-02-17',
  },
  {
    title: 'Memory Allocation (메모리 할당) 해설',
    href: 'https://cdding.github.io/vk_spec_ko/spec/08_memory/',
    category: 'vulkan',
    date: '2026-02-17',
  },
  {
    title: 'Pipelines (파이프라인) 해설',
    href: 'https://cdding.github.io/vk_spec_ko/spec/07_pipelines/',
    category: 'vulkan',
    date: '2026-02-17',
  },
  {
    title: 'Shaders (셰이더) 해설',
    href: 'https://cdding.github.io/vk_spec_ko/spec/06_shaders/',
    category: 'vulkan',
    date: '2026-02-17',
  },
  {
    title: 'Synchronization (동기화) 해설',
    href: 'https://cdding.github.io/vk_spec_ko/spec/04_synchronization/',
    category: 'vulkan',
    date: '2026-02-16',
  },
  {
    title: 'Command Buffers (커맨드 버퍼) 해설',
    href: 'https://cdding.github.io/vk_spec_ko/spec/03_cmdbuffers/',
    category: 'vulkan',
    date: '2026-02-16',
  },
  {
    title: 'Devices and Queues (디바이스와 큐) 해설',
    href: 'https://cdding.github.io/vk_spec_ko/spec/02_devsandqueues/',
    category: 'vulkan',
    date: '2026-02-16',
  },
  {
    title: 'Initialization (초기화) 해설',
    href: 'https://cdding.github.io/vk_spec_ko/spec/01_initialization/',
    category: 'vulkan',
    date: '2026-02-16',
  },
  {
    title: 'Fundamentals (기초) 해설',
    href: 'https://cdding.github.io/vk_spec_ko/spec/00_fundamentals/',
    category: 'vulkan',
    date: '2026-02-16',
  },
];
