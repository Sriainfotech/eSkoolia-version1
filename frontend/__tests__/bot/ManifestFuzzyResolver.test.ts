/**
 * Tests — ManifestFuzzyResolver
 * ==============================
 * Each pilot manifest (students, attendance, fees) resolving its intended
 * sample queries. fetch is mocked — these are unit tests of the resolver's
 * routing/extraction logic, not integration tests against a live backend.
 */
import { ManifestFuzzyResolver } from '@/lib/bot/resolvers/ManifestFuzzyResolver';
import type { BotContext } from '@/types/bot';

function allowAllContext(overrides: Partial<BotContext> = {}): BotContext {
  return {
    can: () => true,
    hasFeature: () => true,
    lastViewedEntity: null,
    setLastViewedEntity: jest.fn(),
    ...overrides,
  };
}

function mockFetchOnce(students: Array<{ id: number; first_name: string; last_name: string }>) {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => students,
  });
}

describe('ManifestFuzzyResolver — students manifest (pure lookup)', () => {
  beforeEach(() => { global.fetch = jest.fn(); });

  it('resolves "find rahul" to the students manifest with search results', async () => {
    mockFetchOnce([{ id: 1, first_name: 'Rahul', last_name: 'Sharma' }]);
    const resolver = new ManifestFuzzyResolver();
    const result = await resolver.resolve('find rahul', allowAllContext());

    expect(result?.kind).toBe('resolved');
    if (result?.kind === 'resolved') {
      expect(result.manifest.id).toBe('students');
      expect(result.action).toBeUndefined();
      expect(result.entityResults?.[0].displayLabel).toBe('Rahul Sharma');
    }
    const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(calledUrl).toContain('/api/v1/students/students/');
    expect(calledUrl).toContain('search=rahul');
  });

  it('returns null for an unrelated query (falls through to FAQ/page search)', async () => {
    const resolver = new ManifestFuzzyResolver();
    const result = await resolver.resolve('what time does the school open', allowAllContext());
    // "school time" isn't a manifest keyword for any of the 3 pilots.
    expect(result).toBeNull();
  });
});

describe('ManifestFuzzyResolver — attendance manifest (action)', () => {
  beforeEach(() => { global.fetch = jest.fn(); });

  it('resolves "mark rahul absent" to a pending mark-absent action when exactly one student matches', async () => {
    mockFetchOnce([{ id: 7, first_name: 'Rahul', last_name: 'Sharma' }]);
    const resolver = new ManifestFuzzyResolver();
    const result = await resolver.resolve('mark rahul absent', allowAllContext());

    expect(result?.kind).toBe('resolved');
    if (result?.kind === 'resolved') {
      expect(result.manifest.id).toBe('attendance');
      expect(result.action?.id).toBe('mark-absent');
      expect(result.params?.student_id).toBe(7);
      expect(result.params?.attendance_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('extracts "sick" as the reason from natural phrasing', async () => {
    mockFetchOnce([{ id: 7, first_name: 'Rahul', last_name: 'Sharma' }]);
    const resolver = new ManifestFuzzyResolver();
    const result = await resolver.resolve('rahul is sick today', allowAllContext());

    expect(result?.kind).toBe('resolved');
    if (result?.kind === 'resolved') {
      expect(result.action?.id).toBe('mark-absent');
      expect(result.params?.notes).toBe('Sick');
    }
    const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(calledUrl).toContain('search=rahul');
  });

  it('returns a disambiguation when multiple students match an absence trigger', async () => {
    mockFetchOnce([
      { id: 1, first_name: 'Rahul', last_name: 'Sharma' },
      { id: 2, first_name: 'Rahul', last_name: 'Verma' },
    ]);
    const resolver = new ManifestFuzzyResolver();
    const result = await resolver.resolve('mark rahul absent', allowAllContext());

    expect(result?.kind).toBe('disambiguation');
    if (result?.kind === 'disambiguation') {
      expect(result.options).toHaveLength(2);
    }
  });

  it('falls back to lastViewedEntity when "mark absent" has no name in the query', async () => {
    const resolver = new ManifestFuzzyResolver();
    const result = await resolver.resolve('mark absent', allowAllContext({
      lastViewedEntity: { type: 'student', id: 42, label: 'Priya Nair' },
    }));

    expect(result?.kind).toBe('resolved');
    if (result?.kind === 'resolved') {
      expect(result.action?.id).toBe('mark-absent');
      expect(result.params?.student_id).toBe(42);
    }
    // No name to search for — searchEntities should never be called.
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns null for "mark absent" with no name and no lastViewedEntity', async () => {
    const resolver = new ManifestFuzzyResolver();
    const result = await resolver.resolve('mark absent', allowAllContext());
    expect(result).toBeNull();
  });
});

describe('ManifestFuzzyResolver — fees manifest (id-keyed lookup)', () => {
  beforeEach(() => { global.fetch = jest.fn(); });

  it('resolves "fees due" against lastViewedEntity when one is set', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [{ id: 5, fees_type_name: 'Tuition', amount: '5000.00', status: 'unpaid' }],
    });
    const resolver = new ManifestFuzzyResolver();
    const result = await resolver.resolve('fees due', allowAllContext({
      lastViewedEntity: { type: 'student', id: 42, label: 'Priya Nair' },
    }));

    expect(result?.kind).toBe('resolved');
    if (result?.kind === 'resolved') {
      expect(result.manifest.id).toBe('fees');
      expect(result.entityResults).toHaveLength(1);
    }
    const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(calledUrl).toContain('/api/v1/fees/assignments/');
    expect(calledUrl).toContain('student=42');
  });

  it('returns null for "fees due" with no lastViewedEntity (lets the FAQ answer generically)', async () => {
    const resolver = new ManifestFuzzyResolver();
    const result = await resolver.resolve('fees due', allowAllContext());
    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('ManifestFuzzyResolver — RBAC/ABAC respected', () => {
  beforeEach(() => { global.fetch = jest.fn(); });

  it('never proposes mark-absent when can() denies the permission code', async () => {
    mockFetchOnce([{ id: 7, first_name: 'Rahul', last_name: 'Sharma' }]);
    const resolver = new ManifestFuzzyResolver();
    const result = await resolver.resolve('mark rahul absent', allowAllContext({ can: () => false }));

    // Action stripped by getFilteredManifests() → attendance manifest has
    // no actions left → isActionTrigger path can't fire an action, so this
    // degrades to a plain (denied-of-action) entity lookup or null.
    if (result?.kind === 'resolved') {
      expect(result.action).toBeUndefined();
    }
  });

  it('never returns the fees manifest when hasFeature("fees_enabled") is false', async () => {
    const resolver = new ManifestFuzzyResolver();
    const result = await resolver.resolve('fees due', allowAllContext({
      hasFeature: (flag) => flag !== 'fees_enabled',
      lastViewedEntity: { type: 'student', id: 42, label: 'Priya Nair' },
    }));
    expect(result).toBeNull();
  });
});
