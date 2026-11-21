/**
 * The labour case ("Ishga tiklash") as the papers in the advocate's folder state it: shared by the
 * drafting room (what the student reads and writes from) and the court (what the claim is checked
 * against). Names, addresses and numbers are invented for training and stay the same in every room.
 *
 * The list of courts is the court system of the Law «Sudlar toʻgʻrisida» (28.07.2021, Oʻ RQ-703),
 * article 2 - legal/sources/SUDLAR.json.
 */

export const COURT_TYPES = [
  { id: 'civil', label: 'Fuqarolik ishlari boʻyicha tumanlararo, tuman (shahar) sudi', name: (d: string) => `Fuqarolik ishlari boʻyicha ${d} tumanlararo sudi` },
  { id: 'criminal', label: 'Jinoyat ishlari boʻyicha tuman (shahar) sudi', name: (d: string) => `Jinoyat ishlari boʻyicha ${d} tuman sudi` },
  { id: 'economic', label: 'Tumanlararo iqtisodiy sud', name: (d: string) => `${d} tumanlararo iqtisodiy sudi` },
  { id: 'administrative', label: 'Tumanlararo maʼmuriy sud', name: (d: string) => `${d} tumanlararo maʼmuriy sudi` },
  { id: 'regional', label: 'Viloyat sudi (Qoraqalpogʻiston Respublikasi, viloyat, Toshkent shahar sudi)', name: (d: string) => `${d} viloyat sudi` },
  { id: 'supreme', label: 'Oʻzbekiston Respublikasi Oliy sudi', name: () => 'Oʻzbekiston Respublikasi Oliy sudi' },
] as const;
export type CourtType = (typeof COURT_TYPES)[number]['id'];
export const COURT_TYPE_IDS = COURT_TYPES.map((c) => c.id) as [CourtType, ...CourtType[]];

/** Places in the training region (invented). The employer is registered in Namuna (FPK 33). */
export const DISTRICTS = ['Namuna', 'Yangiobod', 'Sohil', 'Bogʻiston'] as const;

export function courtName(type: CourtType | '', district: string): string {
  const t = COURT_TYPES.find((c) => c.id === type);
  return t && district ? t.name(district) : '';
}

export const PEOPLE = {
  claimant: { name: 'Nurmatov Sardor Akmal oʻgʻli', short: 'Sardor N.', address: 'Namuna tumani, Bogʻbon mahallasi, 12-uy', phone: '+998 90 000-00-12' },
  employer: { name: '«Namuna Savdo» masʼuliyati cheklangan jamiyati', short: '«Namuna Savdo» MChJ', address: 'Namuna tumani, Ipak yoʻli koʻchasi, 5-uy', director: 'Karimov Anvar', registered: 'Namuna tumani' },
  firm: { name: '«Namuna» advokatlik byurosi', address: 'Namuna tumani, Mustaqillik koʻchasi, 3-uy', phone: '+998 71 000-00-03' },
  license: { number: 'AG-0147', issued: '2024-yil 3-iyun', by: 'Oʻzbekiston Respublikasi Advokatlar palatasi' },
  agreement: { number: '12', date: '2026-yil 19-noyabr' },
} as const;

/** The papers in the folder. `requires`: what the consultation must have produced for the paper to be there. */
export interface FolderPaper {
  id: string;
  title: string;
  requires: string | null;
  lines: [string, string][];
  note?: string;
}

export const FOLDER: FolderPaper[] = [
  {
    id: 'agreement', title: 'Advokatlik shartnomasi (yuridik yordam koʻrsatish toʻgʻrisida)', requires: 'authority',
    lines: [
      ['Raqami va sanasi', `№ ${PEOPLE.agreement.number}, ${PEOPLE.agreement.date}`],
      ['Ishonch bildiruvchi', PEOPLE.claimant.name],
      ['Yashash joyi', PEOPLE.claimant.address],
      ['Telefon', PEOPLE.claimant.phone],
      ['Advokatlik tuzilmasi', `${PEOPLE.firm.name}, ${PEOPLE.firm.address}, tel. ${PEOPLE.firm.phone}`],
      ['Topshiriq', 'Ishga tiklash toʻgʻrisidagi nizo boʻyicha sudda vakillik qilish'],
    ],
  },
  {
    id: 'license', title: 'Advokat guvohnomasi (oʻzingizniki)', requires: null,
    lines: [
      ['Raqami', PEOPLE.license.number],
      ['Berilgan sana', PEOPLE.license.issued],
      ['Kim tomonidan berilgan', PEOPLE.license.by],
      ['Litsenziya boʻyicha ixtisoslik', 'Fuqarolik va iqtisodiy sud ishlarini yuritish'],
    ],
  },
  {
    id: 'order', title: 'Boʻshatish toʻgʻrisidagi buyruq nusxasi', requires: 'order',
    lines: [
      ['Raqami va sanasi', '47-k, 2026-yil 14-oktabr'],
      ['Ish beruvchi', `${PEOPLE.employer.name}, ${PEOPLE.employer.address}`],
      ['Rahbar', `Direktor ${PEOPLE.employer.director}`],
      ['Asos', '9 va 10-oktabr kunlari uzrli sababsiz ishda boʻlmagan'],
      ['Nusxa berilgan', '2026-yil 14-oktabr'],
    ],
  },
  {
    id: 'contract', title: 'Mehnat shartnomasi', requires: 'contract',
    lines: [
      ['Xodim', PEOPLE.claimant.name],
      ['Lavozim', 'Omborchi'],
      ['Oylik ish haqi', '4 200 000 soʻm'],
      ['Ish beruvchi', `${PEOPLE.employer.short}, ${PEOPLE.employer.address}`],
    ],
  },
  {
    id: 'sickleave', title: 'Mehnatga layoqatsizlik varaqasi', requires: 'sickleave',
    lines: [
      ['Kim', PEOPLE.claimant.name],
      ['Davr', '2026-yil 9-10-oktabr'],
      ['Bergan muassasa', 'Namuna tuman oilaviy poliklinikasi'],
    ],
  },
];

/** Lower-case, one kind of apostrophe, single spaces: for comparing what the student typed. */
export const norm = (t: string) => t.toLowerCase().replace(/[ʻʼ'`’‘]/g, 'ʻ').replace(/[«»"“”]/g, '').replace(/\s+/g, ' ').trim();
