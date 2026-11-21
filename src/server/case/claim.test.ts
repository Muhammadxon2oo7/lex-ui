import { describe, expect, it } from 'vitest';
import { ClaimDraftSchema, type ClaimDraft } from '@/contracts/case';
import { checkClaim, checkOrder, factsWritten, filingRuling } from './claim';
import { PREPARED } from './ishga-tiklash';

const good: ClaimDraft = PREPARED.draft;
const knowsAll = () => true;
const grounds = (d: ClaimDraft) => checkClaim(d, knowsAll).filter((x) => x.ground);

describe('«Hujjatlar»: the written claim (FPK 189-191, 195)', () => {
  it('a complete claim is accepted with no remarks', () => {
    expect(checkClaim(good, knowsAll)).toEqual([]);
    expect(filingRuling([], 1).kind).toBe('accepted');
  });

  it('the wrong court returns the claim: economic (26), regional (28), another district (33)', () => {
    expect(grounds({ ...good, court: { type: 'economic', district: 'Namuna' } })[0]).toMatchObject({ ground: '195-modda 1-qism 3-band', article: '26-modda' });
    expect(grounds({ ...good, court: { type: 'regional', district: 'Namuna' } })[0]).toMatchObject({ article: '28-modda' });
    expect(grounds({ ...good, court: { type: 'civil', district: 'Sohil' } })[0]).toMatchObject({ article: '33-modda' });
  });

  it('reads what was typed: an incomplete name or address is a defect of FPK 189', () => {
    const g = grounds({ ...good, claimant: { name: 'Sardor', address: 'Namuna' } });
    expect(g.map((x) => x.message).join(' ')).toMatch(/otasining ismi/);
    expect(g.map((x) => x.message).join(' ')).toMatch(/yashash joyi/);
  });

  it('the director instead of the company and a wrong demand only weaken the claim', () => {
    const d = checkClaim({ ...good, respondent: { name: 'Karimov Anvar', address: '' }, demand: 'Direktorni javobgarlikka tortishni soʻrayman' }, knowsAll);
    expect(d.filter((x) => x.ground)).toEqual([]);
    expect(d.map((x) => x.message).join(' ')).toMatch(/direktor shaxsan emas/);
    expect(d.map((x) => x.message).join(' ')).toMatch(/tiklash soʻralmagan/);
  });

  it('finds the facts in the student’s own words', () => {
    expect(factsWritten('U kasal edi, boshligʻiga qoʻngʻiroq qildi; undan tushuntirish soʻralmadi')).toEqual(['sick', 'notified', 'explanation']);
    const missing = checkClaim({ ...good, circumstances: 'Daʼvogar 47-k buyruq bilan 14-oktabrda ishdan boʻshatildi, ammo bu notoʻgʻri va noqonuniy deb hisoblaymiz.' }, knowsAll);
    expect(missing.map((x) => x.message).join(' ')).toMatch(/kasal/);
  });

  it('an incomplete advocate’s order is not valid (1-mh-son buyruq, izoh 6) - FPK 195 p.2', () => {
    expect(checkOrder(good.order)).toEqual([]);
    const g = grounds({ ...good, order: { ...good.order!, specialty: 'admin-criminal', number: '' } });
    expect(g[0]).toMatchObject({ ground: '195-modda 1-qism 2-band' });
    expect(g[0].message).toMatch(/1-band|6-band/);
  });

  it('missing postage receipt returns it (191 p.3); a duty receipt is not needed (Davlat boji 8-modda 1-band)', () => {
    expect(grounds({ ...good, attachments: good.attachments.filter((a) => a !== 'receipt') })[0]).toMatchObject({ ground: '195-modda 1-qism 7-band' });
    expect(checkClaim({ ...good, attachments: [...good.attachments, 'duty'] }, knowsAll).map((x) => x.message).join(' ')).toMatch(/8-modda 1-band/);
  });

  it('a date past the three months of MK 560 is noted, not a ground to return', () => {
    const d = checkClaim({ ...good, date: '2027-02-01' }, knowsAll);
    expect(d.find((x) => x.article === 'MK 560-modda')?.ground).toBeNull();
  });

  it('reads drafts saved before the room asked students to write', () => {
    const old = { court: 'district', representative: true, respondent: 'company', demand: 'reinstate', facts: ['sick', 'notified'], evidence: ['order'], pretrial: false, email: true, attachments: ['order'], copies: 1, signed: true };
    const d = ClaimDraftSchema.parse(old);
    expect(d.court).toEqual({ type: 'civil', district: 'Namuna' });
    expect(factsWritten(d.circumstances)).toEqual(['sick', 'notified']);
  });
});
