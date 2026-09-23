import type { Result } from './protocol';

const privateSubjectKeys = ['name', 'nameKana', 'romanizedName', 'oldName', 'aliases', 'birthDate', 'birthTime', 'country', 'region', 'city', 'currentLocation'];

function removeExact(source: string, term: string): string {
  const needle = term.toLocaleLowerCase();
  let output = source;
  let index = output.toLocaleLowerCase().indexOf(needle);
  while (index >= 0) {
    output = output.slice(0, index) + output.slice(index + term.length);
    index = output.toLocaleLowerCase().indexOf(needle);
  }
  return output;
}

export function shareSafeText(value: unknown, result: Result): string {
  let text = typeof value === 'string' || typeof value === 'number' ? String(value) : '';
  const subject = result.subject as Record<string, unknown>;
  for (const key of privateSubjectKeys) {
    const raw = subject[key];
    if (typeof raw !== 'string' || !raw.trim()) continue;
    const normalized = raw.trim();
    text = removeExact(text, normalized);
    const compact = normalized.replace(/[\s　]/g, '');
    if (compact && compact !== normalized) text = removeExact(text, compact);
  }
  const birthYear = typeof subject.birthDate === 'string' ? subject.birthDate.slice(0, 4) : '';
  if (birthYear.length === 4) text = removeExact(text, birthYear);
  return text
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu, '')
    .replace(/\d{4}[-/.年]\d{1,2}([-/.月]\d{1,2}日?)?/g, '')
    .replace(/\d{1,2}[:：]\d{2}/g, '')
    .replace(/\+?\d[\d\s().-]{7,}\d/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/[「」『』【】]/g, '')
    .trim();
}

function textOf(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (!value || typeof value !== 'object') return '';
  const record = value as Record<string, unknown>;
  for (const key of ['theme', 'text', 'interpretation', 'summary']) {
    if (typeof record[key] === 'string') return record[key] as string;
  }
  return '';
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const char of Array.from(text)) {
    const candidate = line + char;
    if (line && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = char;
      if (lines.length === maxLines) break;
    } else line = candidate;
  }
  if (lines.length < maxLines && line) lines.push(line);
  const rendered = lines.join('');
  if (rendered.length < Array.from(text).length && lines.length) {
    let last = lines.length - 1;
    while (lines[last] && ctx.measureText(`${lines[last]}…`).width > maxWidth) lines[last] = lines[last].slice(0, -1);
    lines[last] += '…';
  }
  return lines;
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('シェア画像を読み込めませんでした'));
    image.src = source;
  });
}

export async function renderShareCard(result: Result): Promise<Blob> {
  const width = 1200;
  const height = 675;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('シェア画像を作成できませんでした');

  const assets = result.assets as Record<string, unknown>;
  const background = typeof assets.shareImage === 'string' && assets.shareImage.startsWith('data:image/') ? assets.shareImage : '';
  if (background) {
    try {
      const image = await loadImage(background);
      const scale = Math.max(width / image.width, height / image.height);
      const drawWidth = image.width * scale;
      const drawHeight = image.height * scale;
      ctx.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
    } catch {
      // Keep the card usable when a third-party generated background is malformed.
    }
  }
  if (!background || !ctx.getImageData(0, 0, 1, 1).data[3]) {
    const base = ctx.createLinearGradient(0, 0, width, height);
    base.addColorStop(0, '#102326');
    base.addColorStop(1, '#253b3d');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, width, height);
  }

  const shade = ctx.createLinearGradient(0, 0, width, 0);
  shade.addColorStop(0, '#071316f2');
  shade.addColorStop(0.72, '#071316a8');
  shade.addColorStop(1, '#07131648');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#c5a967';
  ctx.lineWidth = 2;
  ctx.strokeRect(34, 34, width - 68, height - 68);

  const summary = typeof result.summary === 'object' && result.summary ? result.summary as Record<string, unknown> : {};
  const headline = shareSafeText(summary.headline, result) || '星と象徴が示す、あなたの輪郭';
  const description = shareSafeText(summary.short || summary.text || (typeof result.summary === 'string' ? result.summary : ''), result) || '複数の象徴から読み解く、あなただけのテーマ';
  const themes = result.crossAnalysis.strongThemes.map(item => shareSafeText(textOf(item), result)).filter(Boolean).slice(0, 3);

  ctx.textBaseline = 'top';
  ctx.fillStyle = '#d9c18a';
  ctx.font = '20px serif';
  ctx.fillText('SHINRA BANSHO KAN  /  鑑定結果', 76, 72);
  ctx.fillStyle = '#fffaf0';
  ctx.font = 'bold 48px serif';
  const titleLines = wrapText(ctx, headline, 990, 2);
  titleLines.forEach((line, index) => ctx.fillText(line, 76, 142 + index * 60));

  const descriptionY = 142 + titleLines.length * 60 + 15;
  ctx.fillStyle = '#f0eee7';
  ctx.font = '25px sans-serif';
  wrapText(ctx, description, 1000, 2).forEach((line, index) => ctx.fillText(line, 78, descriptionY + index * 39));

  const themeY = Math.max(405, descriptionY + 105);
  if (themes.length) {
    ctx.fillStyle = '#d9c18a';
    ctx.font = '18px sans-serif';
    ctx.fillText('重なって現れたテーマ', 78, themeY);
    ctx.fillStyle = '#fffaf0';
    ctx.font = '22px sans-serif';
    themes.forEach((theme, index) => {
      const line = wrapText(ctx, theme, 980, 1)[0];
      ctx.fillText(`✦  ${line}`, 82, themeY + 34 + index * 35);
    });
  }

  ctx.fillStyle = '#d6d0c1';
  ctx.font = '15px sans-serif';
  ctx.fillText('占術による象徴的な読みです。', 78, 612);
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('シェア画像をPNGに変換できませんでした');
  return blob;
}

export function shareCardMessage(): string {
  return '森羅万象鑑の鑑定結果カードを共有します。 #森羅万象鑑 #占い';
}
