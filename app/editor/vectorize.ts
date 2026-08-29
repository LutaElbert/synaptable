import DOMPurify from 'dompurify';
import VectorizerWorker from './vectorize.worker?worker';
import type {
  ConversionOptions,
  VectorPathLayer,
  VectorizationResult,
} from './types';

const MAX_TRACE_DIMENSION = 1400;

async function decodeImage(dataUrl: string): Promise<ImageBitmap | HTMLImageElement> {
  const blob = await fetch(dataUrl).then((response) => response.blob());
  if ('createImageBitmap' in window) {
    return createImageBitmap(blob);
  }

  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('The browser could not decode this image.'));
    image.src = dataUrl;
  });
}

function traceSettings(options: ConversionOptions) {
  const preset = {
    balanced: { ltres: 1, qtres: 1, pathomit: 8 },
    detailed: { ltres: 0.5, qtres: 0.5, pathomit: 2 },
    poster: { ltres: 1.5, qtres: 1.5, pathomit: 12 },
  }[options.preset];

  return {
    ...preset,
    numberofcolors: options.colors,
    blurradius: options.despeckle,
  };
}

function runTraceWorker(
  imageData: ImageData,
  options: ConversionOptions,
  signal: AbortSignal,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const worker = new VectorizerWorker({
      name: 'synaptable-vectorizer',
    });

    const stop = () => {
      worker.terminate();
      reject(new DOMException('Vectorization cancelled.', 'AbortError'));
    };

    signal.addEventListener('abort', stop, { once: true });
    worker.onerror = () => {
      signal.removeEventListener('abort', stop);
      worker.terminate();
      reject(new Error('The local vectorization worker stopped unexpectedly.'));
    };
    worker.onmessage = (
      event: MessageEvent<{ ok: true; svg: string } | { ok: false; message: string }>,
    ) => {
      signal.removeEventListener('abort', stop);
      worker.terminate();
      if (event.data.ok) resolve(event.data.svg);
      else reject(new Error(event.data.message));
    };

    const buffer = imageData.data.slice().buffer;
    worker.postMessage(
      {
        buffer,
        width: imageData.width,
        height: imageData.height,
        options: traceSettings(options),
      },
      [buffer],
    );
  });
}

function parseSvg(svgString: string): VectorizationResult {
  const cleanSvg = DOMPurify.sanitize(svgString, {
    USE_PROFILES: { svg: true, svgFilters: false },
    FORBID_TAGS: ['script', 'foreignObject'],
    FORBID_ATTR: ['onload', 'onclick', 'onerror'],
  });
  const document = new DOMParser().parseFromString(String(cleanSvg), 'image/svg+xml');
  const svg = document.documentElement;
  if (svg.nodeName.toLowerCase() !== 'svg') {
    throw new Error('The vectorizer returned an invalid SVG document.');
  }

  const width = Number.parseFloat(svg.getAttribute('width') ?? '') || 1;
  const height = Number.parseFloat(svg.getAttribute('height') ?? '') || 1;
  const viewBoxParts = (svg.getAttribute('viewBox') ?? `0 0 ${width} ${height}`)
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  const viewBox: [number, number, number, number] =
    viewBoxParts.length === 4 && viewBoxParts.every(Number.isFinite)
      ? [viewBoxParts[0], viewBoxParts[1], viewBoxParts[2], viewBoxParts[3]]
      : [0, 0, width, height];

  const paths: VectorPathLayer[] = Array.from(document.querySelectorAll('path'))
    .map((path, index) => ({
      id: crypto.randomUUID(),
      name: `Path ${index + 1}`,
      d: path.getAttribute('d') ?? '',
      fill: path.getAttribute('fill') ?? path.style.fill ?? '#111827',
      stroke: path.getAttribute('stroke') ?? path.style.stroke ?? 'none',
      strokeWidth:
        Number.parseFloat(path.getAttribute('stroke-width') ?? path.style.strokeWidth) || 0,
      opacity: Number.parseFloat(path.getAttribute('opacity') ?? path.style.opacity) || 1,
      visible: true,
    }))
    .filter((path) => path.d.length > 0);

  if (paths.length === 0) {
    throw new Error('No vector paths could be extracted from this image.');
  }

  return { viewBox, width: viewBox[2], height: viewBox[3], paths };
}

export async function vectorizeDataUrl(
  dataUrl: string,
  options: ConversionOptions,
  signal: AbortSignal,
): Promise<VectorizationResult> {
  const decoded = await decodeImage(dataUrl);
  if (signal.aborted) throw new DOMException('Vectorization cancelled.', 'AbortError');

  const sourceWidth = decoded.width;
  const sourceHeight = decoded.height;
  const scale = Math.min(1, MAX_TRACE_DIMENSION / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('This browser does not support image tracing.');
  context.drawImage(decoded, 0, 0, width, height);
  if ('close' in decoded && typeof decoded.close === 'function') decoded.close();
  const imageData = context.getImageData(0, 0, width, height);
  const svg = await runTraceWorker(imageData, options, signal);
  return parseSvg(svg);
}
