import { describe, it, expect } from 'vitest';
import { SERIES, getSeriesMeta } from './series';

describe('getSeriesMeta', () => {
  it('등록된 시리즈는 제목과 설명을 돌려준다', () => {
    expect(getSeriesMeta('vulkan-spec')).toEqual({
      title: 'Vulkan 명세 요약',
      desc: 'Vulkan 1.3 스펙의 핵심 챕터를 한국어로 옮깁니다.',
    });
  });

  it('등록되지 않은 시리즈는 폴더명으로 폴백한다', () => {
    expect(getSeriesMeta('unknown-series')).toEqual({
      title: 'unknown-series',
      desc: '',
    });
  });

  it('시리즈 3개가 등록되어 있다', () => {
    expect(Object.keys(SERIES).sort()).toEqual([
      'cuda-guide',
      'gpu-hw-sw',
      'vulkan-spec',
    ]);
  });
});
