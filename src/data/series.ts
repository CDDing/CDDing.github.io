export type SeriesMeta = {
  title: string;
  desc: string;
};

export const SERIES: Record<string, SeriesMeta> = {
  'vulkan-spec': {
    title: 'Vulkan 명세 요약',
    desc: 'Vulkan 1.3 스펙의 핵심 챕터를 한국어로 옮깁니다.',
  },
  'cuda-guide': {
    title: 'CUDA Programming Guide',
    desc: 'NVIDIA CUDA C++ 프로그래밍 가이드를 한국어로 옮깁니다.',
  },
  'gpu-hw-sw': {
    title: 'GPU Hardware & Software',
    desc: 'Georgia Tech CS8803 강의 노트를 한국어로 정리합니다.',
  },
};

/** 미등록 시리즈는 폴더명을 제목으로 쓴다. 빌드는 통과한다. */
export function getSeriesMeta(id: string): SeriesMeta {
  return SERIES[id] ?? { title: id, desc: '' };
}
