import { describe, expect, it } from 'vitest';
import { attachVoices, recordHtml, type RecordLine } from './practiceRecord';

const clip = (text: string, at: number) => ({ scope: 's', text, wav: new ArrayBuffer(48), at });

describe('practice record', () => {
  const lines: RecordLine[] = [
    { who: 'Sudya', role: 'npc', text: 'Vakolatingizni tasdiqlang.', voice: 'elder_m' },
    { who: 'Madina', role: 'student', text: 'Hurmatli sud, ishonchnomani taqdim etaman.' },
    { who: '', role: 'system', text: 'Sudya zalga kirdi.' },
    { who: 'Madina', role: 'student', text: 'Hurmatli sud, rad bildirmaymiz.' },
  ];

  it("files the student's recordings under the lines they belong to (words, not order)", () => {
    const m = attachVoices(lines, [clip('hurmatli sud — rad bildirmaymiz', 2), clip('Boshqa gap', 1)]);
    expect(m[0]).toBeNull();
    expect(m[1]).toBeNull(); // typed: no recording
    expect(m[3]?.text).toContain('rad');
  });

  it('the document escapes what people said', () => {
    const html = recordHtml(
      { title: 'Ish <b>', subtitle: 'r', student: 'A & B', date: new Date(2026, 10, 21, 7, 5), score: 80, outcome: 'Yaxshi', slug: 's' },
      [{ who: 'Siz', role: 'student', text: '<script>x</script>' }],
      [true],
      {},
    );
    expect(html).not.toContain('<script>x');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('A &amp; B');
    expect(html).toContain('ovozli');
  });
});
