export type PaginationMeta = {
  count: number;
  next?: string | null;
  previous?: string | null;
};

export type ListApiResponse<T> =
  | T[]
  | {
      count?: number;
      next?: string | null;
      previous?: string | null;
      results?: T[];
      data?: T[];
    };

export function buildPaginationQuery(
  page: number,
  pageSize: number,
  filters?: Record<string, string | number | boolean | undefined | null>,
): string {
  const params = new URLSearchParams();
  params.set("page", String(Math.max(1, Number(page) || 1)));
  params.set("page_size", String(Math.max(1, Number(pageSize) || 10)));

  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") return;
      params.set(key, String(value));
    });
  }

  return params.toString();
}

export function extractListData<T>(payload: ListApiResponse<T>): T[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.results)) return payload.results;
  if (Array.isArray(payload.data)) return payload.data;
  return [];
}

export function extractPaginationMeta<T>(payload: ListApiResponse<T>): PaginationMeta | null {
  if (Array.isArray(payload)) {
    return { count: payload.length, next: null, previous: null };
  }

  const count = typeof payload.count === "number" ? payload.count : extractListData(payload).length;
  return {
    count,
    next: payload.next ?? null,
    previous: payload.previous ?? null,
  };
}
