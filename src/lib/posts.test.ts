import { describe, it, expect } from 'vitest';
import {
  getSeriesId,
  sortForList,
  getSeriesPosts,
  getSeriesPosition,
  topCategory,
  collectCategories,
  collectAllTags,
  matchesTag,
  filterByTag,
  formatKstDate,
  type PostLike,
} from './posts';

function post(
  id: string,
  date: string,
  opts: { order?: number; tags?: string[] } = {}
): PostLike {
  return {
    id,
    data: {
      title: id,
      date: new Date(date),
      tags: opts.tags ?? [],
      summary: 's',
      order: opts.order,
    },
  };
}

describe('getSeriesId', () => {
  it('폴더가 있으면 첫 폴더가 시리즈다', () => {
    expect(getSeriesId('vulkan-spec/00-fundamentals')).toBe('vulkan-spec');
  });

  it('3단계 이상이어도 첫 폴더가 시리즈다', () => {
    expect(getSeriesId('vulkan-spec/ch1/section-a')).toBe('vulkan-spec');
  });

  it('루트 파일은 시리즈가 없다', () => {
    expect(getSeriesId('2026-07-21-1430')).toBeNull();
  });
});

describe('sortForList', () => {
  it('날짜 내림차순으로 정렬한다', () => {
    const list = [post('a', '2026-02-22'), post('b', '2026-07-21')];
    expect(sortForList(list).map((p) => p.id)).toEqual(['b', 'a']);
  });

  it('같은 날짜면 order 내림차순으로 정렬한다', () => {
    const list = [
      post('vulkan-spec/00', '2026-02-22', { order: 0 }),
      post('vulkan-spec/10', '2026-02-22', { order: 10 }),
      post('vulkan-spec/04', '2026-02-22', { order: 4 }),
    ];
    expect(sortForList(list).map((p) => p.data.order)).toEqual([10, 4, 0]);
  });

  it('같은 날짜에서 order 없는 글은 order 있는 글보다 뒤에 온다', () => {
    const list = [
      post('log-x', '2026-02-22'),
      post('vulkan-spec/00', '2026-02-22', { order: 0 }),
    ];
    expect(sortForList(list).map((p) => p.id)).toEqual([
      'vulkan-spec/00',
      'log-x',
    ]);
  });

  it('날짜와 order가 모두 같으면 id 오름차순으로 안정화한다', () => {
    const list = [post('b', '2026-02-22'), post('a', '2026-02-22')];
    expect(sortForList(list).map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('원본 배열을 변형하지 않는다', () => {
    const list = [post('a', '2026-02-22'), post('b', '2026-07-21')];
    sortForList(list);
    expect(list.map((p) => p.id)).toEqual(['a', 'b']);
  });
});

describe('getSeriesPosts', () => {
  const all = [
    post('vulkan-spec/02', '2026-02-22', { order: 2 }),
    post('vulkan-spec/00', '2026-02-22', { order: 0 }),
    post('cuda-guide/01', '2026-02-22', { order: 1 }),
    post('2026-07-21-1430', '2026-07-21'),
  ];

  it('해당 시리즈 글만 order 오름차순으로 돌려준다', () => {
    expect(getSeriesPosts(all, 'vulkan-spec').map((p) => p.id)).toEqual([
      'vulkan-spec/00',
      'vulkan-spec/02',
    ]);
  });

  it('order가 없으면 id 오름차순으로 폴백한다', () => {
    const noOrder = [post('s/b', '2026-02-22'), post('s/a', '2026-02-22')];
    expect(getSeriesPosts(noOrder, 's').map((p) => p.id)).toEqual([
      's/a',
      's/b',
    ]);
  });
});

describe('getSeriesPosition', () => {
  const all = [
    post('vulkan-spec/00', '2026-02-22', { order: 0 }),
    post('vulkan-spec/01', '2026-02-22', { order: 1 }),
    post('vulkan-spec/02', '2026-02-22', { order: 2 }),
    post('2026-07-21-1430', '2026-07-21'),
  ];

  it('가운데 글은 앞뒤가 모두 있다', () => {
    const pos = getSeriesPosition(all, all[1])!;
    expect(pos.prev!.id).toBe('vulkan-spec/00');
    expect(pos.next!.id).toBe('vulkan-spec/02');
    expect(pos.index).toBe(1);
    expect(pos.total).toBe(3);
  });

  it('첫 글은 이전이 없다', () => {
    const pos = getSeriesPosition(all, all[0])!;
    expect(pos.prev).toBeNull();
    expect(pos.next!.id).toBe('vulkan-spec/01');
  });

  it('마지막 글은 다음이 없다', () => {
    const pos = getSeriesPosition(all, all[2])!;
    expect(pos.prev!.id).toBe('vulkan-spec/01');
    expect(pos.next).toBeNull();
  });

  it('단발 글은 null을 돌려준다', () => {
    expect(getSeriesPosition(all, all[3])).toBeNull();
  });
});

describe('태그', () => {
  const all = [
    post('a', '2026-02-22', { tags: ['vulkan/spec'] }),
    post('b', '2026-02-16', { tags: ['vulkan/fundamentals', 'qa'] }),
    post('c', '2026-08-03', { tags: ['기타'] }),
  ];

  it('topCategory는 슬래시 앞을 돌려준다', () => {
    expect(topCategory('vulkan/spec')).toBe('vulkan');
    expect(topCategory('qa')).toBe('qa');
  });

  it('collectCategories는 대분류만 중복 없이 정렬해 돌려준다', () => {
    expect(collectCategories(all)).toEqual(['qa', 'vulkan', '기타']);
  });

  it('collectAllTags는 대분류와 전체 태그를 모두 포함한다', () => {
    expect(collectAllTags(all)).toEqual([
      'qa',
      'vulkan',
      'vulkan/fundamentals',
      'vulkan/spec',
      '기타',
    ]);
  });

  it('대분류 태그는 하위 태그를 가진 글과 매칭된다', () => {
    expect(matchesTag(all[0], 'vulkan')).toBe(true);
    expect(matchesTag(all[2], 'vulkan')).toBe(false);
  });

  it('소분류 태그는 정확히 일치할 때만 매칭된다', () => {
    expect(matchesTag(all[0], 'vulkan/spec')).toBe(true);
    expect(matchesTag(all[1], 'vulkan/spec')).toBe(false);
  });

  it('평면 태그도 정확히 매칭된다', () => {
    expect(matchesTag(all[1], 'qa')).toBe(true);
    expect(matchesTag(all[0], 'qa')).toBe(false);
  });

  it('filterByTag는 매칭되는 글만 돌려준다', () => {
    expect(filterByTag(all, 'vulkan').map((p) => p.id)).toEqual(['a', 'b']);
  });
});

describe('formatKstDate', () => {
  it('KST 오전 글이 하루 앞당겨지지 않는다', () => {
    expect(formatKstDate(new Date('2026-07-22T08:45+09:00'))).toBe('2026.07.22');
  });

  it('KST 오후 글도 그대로다', () => {
    expect(formatKstDate(new Date('2026-02-22T14:00+09:00'))).toBe('2026.02.22');
  });

  it('UTC 자정 직전도 KST 기준으로 다음 날이다', () => {
    expect(formatKstDate(new Date('2026-03-05T23:30Z'))).toBe('2026.03.06');
  });
});
