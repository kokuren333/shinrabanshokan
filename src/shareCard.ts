import type { Result } from './protocol';

/** Returns the finished AI-generated card unchanged; text is baked in by the image-generation step. */
export function renderShareCard(result: Result): Blob {
  const assets = result.assets as Record<string, unknown>;
  const source = assets.shareImage;
  if (typeof source !== 'string' || !source.startsWith('data:image/')) {
    throw new Error('鑑定結果に完成済みのシェアカード画像がありません。鑑定結果ZIPを確認してください。');
  }
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/.exec(source);
  if (!match || match[1] !== 'image/png') throw new Error('シェアカード画像がPNG形式ではありません。鑑定結果ZIPを確認してください。');
  const decoded = atob(match[2]);
  const bytes = new Uint8Array(decoded.length);
  for (let index = 0; index < decoded.length; index += 1) bytes[index] = decoded.charCodeAt(index);
  return new Blob([bytes], { type: match[1] });
}

export function shareCardMessage(): string {
  return '森羅万象鑑の鑑定結果カードを共有します。 #森羅万象鑑 #占い';
}
