export const MAX_FILE_SIZE = 15 * 1024 * 1024;
export const MAX_DECODED_PIXELS = 24_000_000;
export const MAX_IMAGE_DIMENSION = 16_384;

const ACCEPTED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', '']);

export function detectImageType(bytes: Uint8Array): 'image/png' | 'image/jpeg' | 'image/webp' | null {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  ) return 'image/webp';
  return null;
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the image.'));
    reader.readAsDataURL(file);
  });
}

async function decodeDimensions(file: File): Promise<{ width: number; height: number }> {
  if ('createImageBitmap' in window) {
    const bitmap = await createImageBitmap(file);
    const dimensions = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return dimensions;
  }

  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => reject(new Error('The browser could not decode this image.'));
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function validateImageFile(file: File) {
  if (!ACCEPTED_TYPES.has(file.type)) {
    throw new Error(`${file.name} is not a PNG, JPEG, or WebP image.`);
  }
  if (file.size === 0) throw new Error(`${file.name} is empty.`);
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`${file.name} is larger than the 15 MB local limit.`);
  }

  const signature = detectImageType(new Uint8Array(await file.slice(0, 16).arrayBuffer()));
  if (!signature || (file.type && file.type !== signature)) {
    throw new Error(`${file.name} does not contain valid PNG, JPEG, or WebP data.`);
  }

  let dimensions: { width: number; height: number };
  try {
    dimensions = await decodeDimensions(file);
  } catch {
    throw new Error(`${file.name} could not be decoded as an image.`);
  }

  const { width, height } = dimensions;
  if (
    width <= 0 ||
    height <= 0 ||
    width > MAX_IMAGE_DIMENSION ||
    height > MAX_IMAGE_DIMENSION ||
    width * height > MAX_DECODED_PIXELS
  ) {
    throw new Error(`${file.name} is too large after decoding. Use an image under 24 megapixels.`);
  }
  return { ...dimensions, type: signature };
}

