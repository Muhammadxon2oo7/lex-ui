import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const base = {
  id: 'u_1', domain: 'supply', source: 'user', status: 'approved', mine: false, title: 'Un yetkazib berish', court: '', summary: 's',
  parties: { claimant: '«A» MChJ', respondent: '«B» MChJ' }, claim: 'c', facts: [{ id: 'f1', title: 'T', text: 'x' }], evidence: [],
  side: { claimant: { task: ['t'], confidential: ['sir A'] }, respondent: { task: ['t'], confidential: ['sir B'] } },
  legal: [{ normId: 'FK-454', label: 'FK 454-modda', url: 'https://lex.uz/docs/180550#-183361', why: 'w' }],
  balance: { claimant_strong: 'a', claimant_weak: 'b', respondent_strong: 'c', respondent_weak: 'd' }, questions: [], disclaimer: 'Oʻquv ishi.',
};
const reply = (status: number, json: unknown, headers: Record<string, string> = {}) => Promise.resolve(new Response(JSON.stringify(json), { status, headers: { 'Content-Type': 'application/json', ...headers } }));

async function load(env: Record<string, string>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  return import('./library');
}

describe('case library bridge', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()));
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('never passes someone else’s confidential facts or balance to the browser', async () => {
    const lib = await load({ LEXSIM_REMOTE_URL: 'https://api.test/api/v1', LEXSIM_REMOTE_KEY: 'k' });
    vi.mocked(fetch).mockReturnValueOnce(reply(200, { cases: [base, { ...base, id: 'u_2', mine: true }] }));
    const [other, mine] = await lib.listCases('owner-1234567890', 'supply', 'all');
    expect(other.side.claimant.confidential).toEqual([]);
    expect(other.balance).toBeNull();
    expect(mine.side.claimant.confidential).toEqual(['sir A']);
  });

  it('accepts a bare array and a bare object as well as {cases}/{case}', async () => {
    const lib = await load({ LEXSIM_REMOTE_URL: 'https://api.test/api/v1', LEXSIM_REMOTE_KEY: 'k' });
    vi.mocked(fetch).mockReturnValueOnce(reply(200, [base])).mockReturnValueOnce(reply(200, base));
    expect((await lib.listCases('owner-1234567890', 'supply', 'all')).length).toBe(1);
    expect((await lib.getCase('owner-1234567890', 'u_1')).title).toBe('Un yetkazib berish');
  });

  it('sends the key and the hashed owner, never the owner token itself', async () => {
    const lib = await load({ LEXSIM_REMOTE_URL: 'https://api.test/api/v1', LEXSIM_REMOTE_KEY: 'k' });
    vi.mocked(fetch).mockReturnValueOnce(reply(202, { draft: { id: 'd_1', status: 'working' } }, { 'Retry-After': '10' }));
    const r = await lib.startDraft('owner-secret-token-xyz', { domain: 'supply', story: 'x'.repeat(90) });
    expect(r.retryAfter).toBe(10);
    const headers = vi.mocked(fetch).mock.calls[0][1]!.headers as Record<string, string>;
    expect(headers['X-LexSim-Key']).toBe('k');
    expect(headers['X-LexSim-Owner']).toMatch(/^[0-9a-f]{32}$/);
    expect(JSON.stringify(headers)).not.toContain('owner-secret-token-xyz');
  });

  it('explains a missing key and too many drafts in Uzbek', async () => {
    const noKey = await load({ LEXSIM_REMOTE_URL: 'https://api.test/api/v1' });
    await expect(noKey.listCases('owner-1234567890', 'supply', 'all')).rejects.toMatchObject({ status: 503, code: 'no_backend_key' });
    const lib = await load({ LEXSIM_REMOTE_URL: 'https://api.test/api/v1', LEXSIM_REMOTE_KEY: 'k' });
    vi.mocked(fetch).mockReturnValueOnce(reply(429, { error: { code: 'too_many', message: 'Too many' } }));
    await expect(lib.startDraft('owner-1234567890', { domain: 'supply', story: 'x'.repeat(90) })).rejects.toMatchObject({ status: 429, message: expect.stringMatching(/2 tadan ortiq/) });
  });

  it('domains need no key', async () => {
    const lib = await load({ LEXSIM_REMOTE_URL: 'https://api.test/api/v1' });
    vi.mocked(fetch).mockReturnValueOnce(reply(200, { domains: [{ id: 'lease', group: 'iqtisodiy', title: 'Ijara', share2025: 5.1, modes: ['court', 'moot'], codes: ['FK'], note: '' }], source: 'https://stat.sud.uz/' }));
    expect((await lib.domains()).domains[0].id).toBe('lease');
  });
});
