export type PostLike = {
  id: string;
  data: {
    title: string;
    date: Date;
    tags: string[];
    summary: string;
    order?: number;
  };
};

/** 시리즈 = posts/ 바로 아래 첫 번째 폴더. 그 아래는 전부 URL 경로일 뿐이다. */
export function getSeriesId(id: string): string | null {
  const i = id.indexOf('/');
  return i === -1 ? null : id.slice(0, i);
}

/**
 * 홈 목록 정렬: date 내림차순 → order 내림차순 → id 오름차순.
 * 마이그레이션에서 시리즈마다 다른 시각을 부여하므로 실제로는 date 하나로 결정된다.
 * order가 없는 글은 -1로 취급되어 같은 날짜의 시리즈 글 뒤에 온다.
 */
function compareForList(a: PostLike, b: PostLike): number {
  const byDate = b.data.date.getTime() - a.data.date.getTime();
  if (byDate !== 0) return byDate;

  const ao = a.data.order ?? -1;
  const bo = b.data.order ?? -1;
  if (ao !== bo) return bo - ao;

  return a.id.localeCompare(b.id);
}

export function sortForList<T extends PostLike>(posts: T[]): T[] {
  return [...posts].sort(compareForList);
}

/** 시리즈 내부 정렬: order 오름차순 → order가 없으면 id 오름차순. */
function compareInSeries(a: PostLike, b: PostLike): number {
  const ao = a.data.order ?? Number.MAX_SAFE_INTEGER;
  const bo = b.data.order ?? Number.MAX_SAFE_INTEGER;
  if (ao !== bo) return ao - bo;
  return a.id.localeCompare(b.id);
}

export function getSeriesPosts<T extends PostLike>(
  all: T[],
  seriesId: string
): T[] {
  return all
    .filter((p) => getSeriesId(p.id) === seriesId)
    .sort(compareInSeries);
}

export function getSeriesPosition<T extends PostLike>(
  all: T[],
  current: T
): { prev: T | null; next: T | null; index: number; total: number } | null {
  const seriesId = getSeriesId(current.id);
  if (seriesId === null) return null;

  const siblings = getSeriesPosts(all, seriesId);
  const index = siblings.findIndex((p) => p.id === current.id);
  if (index === -1) return null;

  return {
    prev: siblings[index - 1] ?? null,
    next: siblings[index + 1] ?? null,
    index,
    total: siblings.length,
  };
}

/** 계층 태그 `vulkan/spec`의 대분류는 `vulkan`. 평면 태그는 그대로. */
export function topCategory(tag: string): string {
  const i = tag.indexOf('/');
  return i === -1 ? tag : tag.slice(0, i);
}

export function collectCategories(posts: PostLike[]): string[] {
  const set = new Set<string>();
  for (const p of posts) {
    for (const t of p.data.tags) set.add(topCategory(t));
  }
  return [...set].sort();
}

export function collectAllTags(posts: PostLike[]): string[] {
  const set = new Set<string>();
  for (const p of posts) {
    for (const t of p.data.tags) {
      set.add(t);
      set.add(topCategory(t));
    }
  }
  return [...set].sort();
}

export function matchesTag(post: PostLike, tag: string): boolean {
  const isCategory = !tag.includes('/');
  return post.data.tags.some((t) =>
    isCategory ? t === tag || t.startsWith(tag + '/') : t === tag
  );
}

export function filterByTag<T extends PostLike>(posts: T[], tag: string): T[] {
  return posts.filter((p) => matchesTag(p, tag));
}

/**
 * 표시용 날짜는 항상 KST 기준으로 만든다.
 * `toISOString()`은 UTC로 변환하므로 KST 09:00 이전에 발행된 글이 하루 앞당겨 표시된다.
 * 자동 발행 로그는 시각을 가리지 않으므로 반드시 이 함수를 쓴다.
 */
export function formatKstDate(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(d)
    .replace(/-/g, '.');
}
