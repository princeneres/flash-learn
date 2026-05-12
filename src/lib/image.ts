const SUPPORTED_OUTPUT = new Set(['image/jpeg', 'image/png', 'image/webp']);

const loadImage = (file: File | Blob): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    img.src = url;
  });

const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Canvas toBlob failed'))),
      type,
      quality
    );
  });

export interface DownscaleOptions {
  maxSize?: number;
  quality?: number;
}

/**
 * Downscale and re-encode an image client-side. Returns the original file
 * if it's already small enough, an unsupported type, or a GIF/SVG (animations
 * and vectors should be preserved).
 */
export const downscaleImage = async (
  file: File,
  { maxSize = 1600, quality = 0.82 }: DownscaleOptions = {}
): Promise<Blob> => {
  if (!file.type.startsWith('image/')) return file;
  if (file.type === 'image/gif' || file.type === 'image/svg+xml') return file;

  try {
    const img = await loadImage(file);
    const longest = Math.max(img.naturalWidth, img.naturalHeight);
    const scale = longest > maxSize ? maxSize / longest : 1;

    if (scale === 1 && file.size < 400 * 1024) return file;

    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, w, h);

    const outType = SUPPORTED_OUTPUT.has(file.type)
      ? file.type === 'image/png'
        ? 'image/png'
        : 'image/jpeg'
      : 'image/jpeg';
    const blob = await canvasToBlob(canvas, outType, quality);

    return blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
};

export const extensionFromType = (type: string, fallback: string): string => {
  const m = type.match(/\/(\w+)/);
  if (!m) return fallback;
  const sub = m[1].toLowerCase();
  if (sub === 'jpeg') return '.jpg';
  if (sub === 'svg+xml') return '.svg';
  if (sub === 'mpeg') return '.mp3';
  return `.${sub}`;
};
