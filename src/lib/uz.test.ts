import { describe, expect, it } from 'vitest';
import { matchUtterance } from './uz';

const options = [
  { id: 'ask-period', text: 'Qaysi yillarda va qayerda ishlagansiz?' },
  { id: 'ask-docs', text: 'Qoʻlingizda qanday hujjatlar bor? Mehnat daftarchangiz saqlanganmi?' },
  { id: 'dismiss', text: 'Nafaqa masalasi bizda emas. Boshqa idoraga boring.' },
  { id: 'bribe-refuse', text: 'Rustam aka, rahmat, lekin buni ololmayman. Xizmat bepul va belgilangan tartibda koʻrsatiladi. Pulingizni oling.' },
];

describe('matchUtterance', () => {
  it('maps a paraphrase onto the offered reply', () => {
    expect(matchUtterance('qaysi yili qayerda ishlagan edingiz', options)?.option.id).toBe('ask-period');
    expect(matchUtterance('mehnat daftarchangiz bormi, qanday hujjatlaringiz bor', options)?.option.id).toBe('ask-docs');
    expect(matchUtterance('yoʻq, pulingizni oling, xizmat bepul', options)?.option.id).toBe('bribe-refuse');
  });
  it('works on Cyrillic speech recognition output', () => {
    expect(matchUtterance('Қайси йилларда ишлагансиз', options)?.option.id).toBe('ask-period');
  });
  it('refuses to guess when nothing fits', () => {
    expect(matchUtterance('bugun ob-havo yaxshi ekan', options)).toBeNull();
    expect(matchUtterance('', options)).toBeNull();
  });
});
