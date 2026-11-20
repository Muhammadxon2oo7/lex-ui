/**
 * The statement of claim as a printed page: one model, drawn both as HTML
 * (the close-up) and onto the A4 sheet lying on the 3D desk.
 */
export interface PaperLine {
  text: string;
  bold?: boolean;
  /** Placeholder for a part not filled in yet. */
  empty?: boolean;
}

export interface PaperModel {
  header: PaperLine[];
  title: string;
  subtitle: string;
  body: PaperLine[];
  demandLead: string;
  demand: PaperLine;
  attachments: PaperLine[];
  date: string;
  signer: string;
  /** data: URL of the drawn signature */
  signature: string | null;
}

const SERIF = 'Georgia, "Times New Roman", serif';

/** Word-wraps `text` into lines no wider than `width`. */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > width && line) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Draws the page at A4 proportions (w × w·√2). Returns nothing; the caller
 * owns the canvas and texture. Signature is drawn when already decoded.
 */
export function drawPaper(ctx: CanvasRenderingContext2D, w: number, h: number, p: PaperModel, signature?: HTMLImageElement | null) {
  const u = w / 1000; // layout unit
  ctx.fillStyle = '#fbfaf6';
  ctx.fillRect(0, 0, w, h);
  // a faint fibre texture so the page reads as paper under light
  ctx.fillStyle = 'rgba(0,0,0,0.018)';
  for (let i = 0; i < 900; i++) ctx.fillRect((i * 7919) % w, (i * 104729) % h, 2 * u, 1 * u);
  const left = 90 * u, right = w - 80 * u;
  let y = 110 * u;
  const font = (px: number, bold = false) => (ctx.font = `${bold ? 700 : 400} ${px * u}px ${SERIF}`);
  const ink = (empty?: boolean) => (ctx.fillStyle = empty ? 'rgba(0,0,0,0.28)' : '#1b1b1b');

  // addressee block, right-aligned column
  const colX = w * 0.42;
  for (const l of p.header) {
    font(24, l.bold);
    ink(l.empty);
    for (const s of wrap(ctx, l.text, right - colX)) {
      ctx.fillText(s, colX, y);
      y += 32 * u;
    }
    y += 8 * u;
  }
  y += 40 * u;
  ctx.textAlign = 'center';
  font(34, true);
  ink();
  ctx.fillText(p.title, w / 2, y);
  y += 36 * u;
  font(24);
  ctx.fillText(p.subtitle, w / 2, y);
  ctx.textAlign = 'left';
  y += 50 * u;

  const paragraph = (l: PaperLine, indent = 50) => {
    font(24, l.bold);
    ink(l.empty);
    const lines = wrap(ctx, l.text, right - left - indent * u);
    lines.forEach((s, i) => ctx.fillText(s, left + (i === 0 ? indent * u : 0), y + i * 33 * u));
    y += lines.length * 33 * u + 12 * u;
  };
  p.body.forEach((l) => paragraph(l));
  y += 12 * u;
  paragraph({ text: p.demandLead, bold: true }, 0);
  paragraph(p.demand);
  y += 8 * u;
  paragraph({ text: 'Ilovalar:', bold: true }, 0);
  p.attachments.forEach((l, i) => paragraph({ ...l, text: `${i + 1}. ${l.text}` }, 30));

  // date and signature at the foot of the text (or the page)
  y = Math.min(Math.max(y + 60 * u, h * 0.8), h - 120 * u);
  font(24);
  ink();
  ctx.fillText(p.date, left, y);
  const sx = right - 300 * u;
  ctx.textAlign = 'right';
  ctx.fillText(`${p.signer}:`, sx - 10 * u, y);
  ctx.textAlign = 'left';
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 1.5 * u;
  ctx.beginPath();
  ctx.moveTo(sx, y + 6 * u);
  ctx.lineTo(right, y + 6 * u);
  ctx.stroke();
  if (signature) ctx.drawImage(signature, sx, y - 70 * u, 300 * u, 80 * u);
  font(18);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.textAlign = 'center';
  ctx.fillText('Oʻquv namunasi · ish holatlari toʻqilgan', w / 2, h - 50 * u);
  ctx.textAlign = 'left';
}
