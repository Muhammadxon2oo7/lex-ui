import { describe, expect, it } from 'vitest';
import { ScenarioPublicSchema } from '@/contracts';
import { ALL_PRESETS, courtStageFor } from './courtStage';

describe('court stage', () => {
  it('picks the stage by the kind of case', () => {
    expect(courtStageFor({ id: 'sud-ijara-davogar', title: 'Ijara qarzi va penya — daʼvogar vakili' }).kind).toBe('Ijara qarzi va penya');
    expect(courtStageFor({ id: 'sud-pudrat-1', title: 'Pudrat ishlari sifati' }).cast.witness).toBe('clerk');
    expect(courtStageFor({ id: 'x', title: 'Sugʻurta tovoni' }).kind).toBe('Sugʻurta');
    expect(courtStageFor({ id: 'x', title: 'Nomaʼlum ish' }).kind).toBe('Iqtisodiy nizo');
  });

  it('every side brings its authority and its own pleading', () => {
    for (const s of ALL_PRESETS()) {
      expect(s.papers.claimant[0].id).toBe('power');
      expect(s.papers.respondent[0].id).toBe('power');
      expect(s.papers.claimant.some((d) => d.id === 'claim')).toBe(true);
      expect(s.papers.respondent.some((d) => d.id === 'response')).toBe(true);
    }
  });

  it("the server's scene wins, field by field; unknown models fall back", () => {
    const s = courtStageFor({
      id: 'sud-ijara-davogar',
      title: 'Ijara',
      scene: { kind: 'Ijara (server)', cast: { principal: null, opponent: 'woman' }, papers: { claimant: [{ id: 'a', kind: 'sheet', name: 'A', note: 'n', pages: [{ head: 'h', title: 't', lines: [] }] }] } },
    });
    expect(s.kind).toBe('Ijara (server)');
    expect(s.cast.principal).toBeNull();
    expect(s.cast.opponent).toBe('woman');
    expect(s.papers.claimant).toHaveLength(1);
    expect(s.papers.respondent.length).toBeGreaterThan(1); // preset kept
  });

  it('a malformed scene from the server is dropped, the session still parses', () => {
    const base = { id: 's', title: 't', role: 'r', level: 'beginner', durationMinutes: '25', roomId: 'r', briefing: { workplace: 'w', position: 'p', authority: [], task: [] }, npc: { id: 'n', name: 'n', age: 40 }, disclaimer: 'd' };
    const bad = ScenarioPublicSchema.parse({ ...base, scene: { cast: { opponent: 'dragon' } } });
    expect(bad.scene).toBeUndefined();
    const good = ScenarioPublicSchema.parse({ ...base, scene: { cast: { opponent: 'woman' } } });
    expect(good.scene?.cast?.opponent).toBe('woman');
  });
});
