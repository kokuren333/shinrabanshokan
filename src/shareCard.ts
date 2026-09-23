import type { Result } from './protocol';

/** Returns the finished AI-generated card unchanged; text is baked in by the image-generation step. */
export async function renderShareCard(result: Result): Promise<Blob> {
  const assets = result.assets as Record<string, unknown>;
  const source = assets.shareImage;
  if (typeof source !== 'string' || !source.startsWith('data:image/')) {
    throw new Error('鑑定結果に完成済みのシェアカード画像がありません。鑑定結果ZIPを確認してください。');
  }
  const response = await fetch(source);
  if (!response.ok) throw new Error('シェアカード画像を読み込めませんでした。');
  const blob = await response.blob();
  if (!blob.type.startsWith('image/')) throw new Error('シェアカードが画像形式ではありません。');
  return blob;
}

export function shareCardMessage(): string {
  return '森羅万象鑑の鑑定結果カードを共有します。 #森羅万象鑑 #占い';
}
