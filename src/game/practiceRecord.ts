/**
 * The practice record: everything said in a hearing or a room, in order - the court's lines,
 * the student's answers (with the student's own voice when it was spoken) and the debrief -
 * and its downloads:
 *
 *   PDF   - a printed A4 record (the browser's "Save as PDF"), for the student's portfolio and the teacher;
 *   Word  - the same document as .doc, for a teacher who annotates;
 *   Audio - the whole session as ONE file: the actors in their voices, the student in their own,
 *           a natural pause between speakers; the page plays it with the transcript following along;
 *   xAPI  - the machine-readable statements, for an LMS (teachers only, not shown first).
 *
 * Everything is built in the browser from what the page already has; the student's voice never
 * leaves the device unless they download it.
 */
import { spokenText } from '@/lib/spoken';
import type { VoiceClip } from '@/lib/voiceStore';

export interface RecordLine {
  who: string;
  role: 'student' | 'npc' | 'system';
  text: string;
  /** Actors: the voice the line was spoken in. */
  voice?: string;
  emotion?: string;
}

export interface RecordMeta {
  /** "Iqtisodiy sud · Ijara qarzi va penya" */
  title: string;
  /** "Daʼvogar vakili · boshlangʻich daraja" */
  subtitle: string;
  student: string;
  date: Date;
  score: number | null;
  outcome: string | null;
  /** File names: lexsim-<slug>-<date>. */
  slug: string;
}

export interface RecordAnalysis {
  criteria?: { label: string; score: number; max: number; explanation: string }[];
  decisions?: { prompt: string | null; chose: string; tone: 'good' | 'bad' | 'info' | null; why: string | null; better: string | null; article: string | null }[];
  strengths?: string[];
  errors?: string[];
  /** Learning outcomes of the room and whether the decisions met them (null: not reached in this run). */
  outcomes?: { text: string; met: boolean | null }[];
  /** The student's structured reflection (What? So what? Now what?). */
  reflection?: { label: string; text: string }[];
}

const norm = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/** The student's recordings matched to their lines (same words first, then in order). */
export function attachVoices(lines: RecordLine[], clips: VoiceClip[]): (VoiceClip | null)[] {
  const free = [...clips];
  return lines.map((l) => {
    if (l.role !== 'student' || !free.length) return null;
    const i = free.findIndex((c) => norm(c.text) === norm(l.text));
    return i >= 0 ? free.splice(i, 1)[0] : null;
  });
}

/* ───────────────────────── the document (PDF / Word) ───────────────────────── */

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const fmtDate = (d: Date) => `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()} · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

export function recordHtml(meta: RecordMeta, lines: RecordLine[], spoken: boolean[], analysis: RecordAnalysis, word = false): string {
  const rows = lines
    .map((l, i) =>
      l.role === 'system'
        ? `<tr class="sys"><td></td><td><em>${esc(l.text)}</em></td></tr>`
        : `<tr class="${l.role}"><td class="who">${esc(l.who)}${l.role === 'student' ? `<span class="mode">${spoken[i] ? 'ovozli' : 'yozma'}</span>` : ''}</td><td>${esc(l.text)}</td></tr>`,
    )
    .join('');
  const criteria = analysis.criteria?.length
    ? `<h2>Mezonlar boʻyicha baho</h2><table class="crit"><tr><th>Mezon</th><th>Ball</th><th>Izoh</th></tr>${analysis.criteria.map((c) => `<tr><td>${esc(c.label)}</td><td class="num">${c.score} / ${c.max}</td><td>${esc(c.explanation)}</td></tr>`).join('')}</table>`
    : '';
  const decisions = analysis.decisions?.length
    ? `<h2>Har bir qaror tahlili</h2><ol class="dec">${analysis.decisions
        .map(
          (d) =>
            `<li class="${d.tone ?? 'info'}">${d.prompt ? `<div class="q">«${esc(d.prompt)}»</div>` : ''}<div><b>${d.tone === 'bad' ? '✗' : d.tone === 'good' ? '✓' : '•'}</b> ${esc(d.chose)}</div>${d.why ? `<div class="why">${esc(d.why)}</div>` : ''}${d.better ? `<div class="better"><b>Yaxshiroq:</b> ${esc(d.better)}</div>` : ''}${d.article ? `<div class="art">${esc(d.article)}</div>` : ''}</li>`,
        )
        .join('')}</ol>`
    : '';
  const outcomes = analysis.outcomes?.length
    ? `<h2>Oʻquv natijalari</h2><ul class="dec">${analysis.outcomes.map((o) => `<li class="${o.met === false ? 'bad' : o.met ? 'good' : 'info'}"><b>${o.met === false ? '✗' : o.met ? '✓' : '–'}</b> ${esc(o.text)}${o.met === null ? ' <span class="why">(bu safar tekshirilmadi)</span>' : ''}</li>`).join('')}</ul>`
    : '';
  const reflection = analysis.reflection?.some((r) => r.text.trim())
    ? `<h2>Mulohaza</h2>${analysis.reflection.filter((r) => r.text.trim()).map((r) => `<p><b>${esc(r.label)}</b> ${esc(r.text)}</p>`).join('')}`
    : '';
  const notes = [
    analysis.strengths?.length ? `<h2>Kuchli tomonlar</h2><ul>${analysis.strengths.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>` : '',
    analysis.errors?.length ? `<h2>Xatolar</h2><ul>${analysis.errors.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>` : '',
  ].join('');
  const said = lines.filter((l) => l.role === 'student').length;
  return `<!doctype html><html lang="uz"${word ? ' xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"' : ''}><head><meta charset="utf-8"><title>${esc(`LexSim - ${meta.title} - ${meta.student}`)}</title>
<style>
@page { size: A4; margin: 18mm 16mm 20mm; }
* { box-sizing: border-box; }
body { font: 10.5pt/1.5 Georgia, "Times New Roman", serif; font-variant-numeric: lining-nums tabular-nums; color: #16181d; margin: 0; }
.brand { font: 600 8pt/1 -apple-system, "Segoe UI", Roboto, Arial, sans-serif; letter-spacing: .18em; color: #1f8a5b; text-transform: uppercase; }
h1 { font: 700 17pt/1.2 -apple-system, "Segoe UI", Roboto, Arial, sans-serif; margin: 6pt 0 2pt; }
.sub { font: 10pt/1.4 -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #555; margin: 0 0 10pt; }
table.meta { border-collapse: collapse; margin: 8pt 0 12pt; font: 9.5pt/1.4 -apple-system, "Segoe UI", Roboto, Arial, sans-serif; }
table.meta td { padding: 2pt 14pt 2pt 0; vertical-align: top; } table.meta td:first-child { color: #777; }
.score { display: inline-block; font: 700 22pt/1 -apple-system, "Segoe UI", Roboto, Arial, sans-serif; margin-right: 8pt; }
h2 { font: 700 11.5pt/1.3 -apple-system, "Segoe UI", Roboto, Arial, sans-serif; margin: 16pt 0 6pt; padding-bottom: 3pt; border-bottom: 1px solid #ddd; page-break-after: avoid; }
table.tr { width: 100%; border-collapse: collapse; }
table.tr td { padding: 4pt 6pt; vertical-align: top; border-bottom: 1px solid #eee; page-break-inside: avoid; }
td.who { width: 30%; font: 600 9pt/1.35 -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #445; }
tr.student td { background: #f2f7f4; } tr.student td.who { color: #1f6b48; }
tr.sys td { color: #777; font-size: 9.5pt; }
.mode { display: block; font-weight: 400; font-size: 7.5pt; color: #888; letter-spacing: .04em; }
table.crit { width: 100%; border-collapse: collapse; font-size: 9.5pt; } table.crit th { text-align: left; font: 600 8.5pt -apple-system, Arial, sans-serif; color: #777; padding: 3pt 6pt; border-bottom: 1px solid #ccc; }
table.crit td { padding: 4pt 6pt; border-bottom: 1px solid #eee; vertical-align: top; } td.num { white-space: nowrap; font-weight: 700; }
ol.dec { padding-left: 16pt; } ol.dec li { margin: 0 0 7pt; page-break-inside: avoid; } ol.dec .q { color: #777; font-size: 9pt; }
ol.dec li.bad b { color: #b42318; } ol.dec li.good b { color: #1f8a5b; } .why { color: #8a2a1e; } .better { color: #1f4d36; } .art { font: 600 8.5pt -apple-system, Arial, sans-serif; color: #1d3557; }
.foot { margin-top: 18pt; padding-top: 6pt; border-top: 1px solid #ddd; font: 8pt/1.4 -apple-system, Arial, sans-serif; color: #888; }
</style></head><body>
<div class="brand">LexSim · Huquqiy amaliyot simulyatori</div>
<h1>Amaliyot yozuvi</h1>
<p class="sub">${esc(meta.title)} - ${esc(meta.subtitle)}</p>
<table class="meta">
<tr><td>Talaba</td><td>${esc(meta.student)}</td></tr>
<tr><td>Sana</td><td>${fmtDate(meta.date)}</td></tr>
<tr><td>Javoblar</td><td>${said} ta (${spoken.filter(Boolean).length} tasi ovozli)</td></tr>
${meta.score !== null ? `<tr><td>Natija</td><td><span class="score">${meta.score}</span>/ 100${meta.outcome ? ` - ${esc(meta.outcome)}` : ''}</td></tr>` : ''}
</table>
${criteria}
<h2>Majlis yozuvi</h2>
<table class="tr">${rows}</table>
${outcomes}${decisions}
${notes}${reflection}
<p class="foot">Oʻquv simulyatsiyasi, yuridik maslahat emas. Ish holatlari toʻqilgan; moddalar lex.uz saytidagi matnga bogʻlangan. Avtomatik baho - mentor tasdigʻi talab etilishi mumkin.</p>
</body></html>`;
}

/** Prints the record (the browser offers "Save as PDF"); the document title becomes the file name. */
export function printRecord(html: string) {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  doc.open();
  doc.write(html);
  doc.close();
  const go = () => {
    frame.contentWindow!.focus();
    frame.contentWindow!.print();
    setTimeout(() => frame.remove(), 60_000);
  };
  if (doc.readyState === 'complete') setTimeout(go, 50);
  else frame.onload = go;
}

export function download(name: string, data: BlobPart, type: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([data], { type }));
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export const fileName = (meta: RecordMeta, ext: string) => {
  const d = meta.date;
  return `lexsim-${meta.slug}-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.${ext}`;
};

/* ───────────────────────── the audio ───────────────────────── */

const RATE = 24000;
/** The breath before a line: a new speaker answers after a beat, the same one goes on. */
const gapBefore = (prev: RecordLine | undefined, line: RecordLine) => (!prev ? 0.3 : prev.who === line.who ? 0.35 : 0.75);

async function ttsAudio(line: RecordLine): Promise<ArrayBuffer | null> {
  const text = spokenText(line.text);
  if (!text || !line.voice) return null;
  for (let k = 0; k < 3; k++) {
    try {
      const r = await fetch('/api/v1/voice/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, voice: line.voice, ...(line.emotion ? { emotion: line.emotion } : {}) }), signal: AbortSignal.timeout(25_000) });
      if (r.ok) return await r.arrayBuffer();
      if (r.status === 404) return null; // no voice service: text only
    } catch {
      /* try again */
    }
    await new Promise((z) => setTimeout(z, 1200 * (k + 1)));
  }
  return null;
}

export interface BuiltAudio {
  wav: Blob;
  /** Where each line starts in the file (seconds), or null when it has no sound (a typed answer, a scene note). */
  marks: (number | null)[];
  seconds: number;
}

/** The whole session as one WAV (mono, 24 kHz). */
export async function buildAudio(lines: RecordLine[], clips: (VoiceClip | null)[], onProgress?: (done: number, total: number) => void): Promise<BuiltAudio> {
  const decoder = new OfflineAudioContext(1, 1, RATE);
  const buffers: (AudioBuffer | null)[] = [];
  for (let i = 0; i < lines.length; i++) {
    onProgress?.(i, lines.length);
    const l = lines[i];
    const raw = l.role === 'student' ? (clips[i]?.wav.slice(0) ?? null) : l.role === 'npc' ? await ttsAudio(l) : null;
    let buf: AudioBuffer | null = null;
    if (raw) {
      try {
        buf = await decoder.decodeAudioData(raw);
      } catch {
        buf = null;
      }
    }
    buffers.push(buf);
  }
  onProgress?.(lines.length, lines.length);
  const marks: (number | null)[] = [];
  let t = 0;
  let prev: RecordLine | undefined;
  buffers.forEach((b, i) => {
    if (!b) return void marks.push(null);
    t += gapBefore(prev, lines[i]);
    marks.push(t);
    t += b.duration;
    prev = lines[i];
  });
  const seconds = t + 0.6;
  const ctx = new OfflineAudioContext(1, Math.max(1, Math.ceil(seconds * RATE)), RATE);
  buffers.forEach((b, i) => {
    if (!b || marks[i] === null) return;
    const src = ctx.createBufferSource();
    src.buffer = b;
    // the student's mic is quieter than the studio voices: lift it a little
    const g = ctx.createGain();
    g.gain.value = lines[i].role === 'student' ? 1.6 : 1;
    src.connect(g).connect(ctx.destination);
    src.start(marks[i]!);
  });
  const out = await ctx.startRendering();
  return { wav: new Blob([toWav(out.getChannelData(0), RATE)], { type: 'audio/wav' }), marks, seconds };
}

function toWav(pcm: Float32Array, rate: number): ArrayBuffer {
  const buf = new ArrayBuffer(44 + pcm.length * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  v.setUint32(4, 36 + pcm.length * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) {
    const s = Math.max(-1, Math.min(1, pcm[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buf;
}
