/// <reference lib="webworker" />

import ImageTracer from 'imagetracerjs';

type TraceMessage = {
  buffer: ArrayBuffer;
  width: number;
  height: number;
  options: {
    ltres: number;
    qtres: number;
    pathomit: number;
    numberofcolors: number;
    blurradius: number;
  };
};

self.onmessage = (event: MessageEvent<TraceMessage>) => {
  try {
    const { buffer, width, height, options } = event.data;
    const svg = ImageTracer.imagedataToSVG(
      { width, height, data: new Uint8ClampedArray(buffer) },
      {
        ...options,
        scale: 1,
        viewbox: true,
        strokewidth: 0,
        linefilter: true,
        colorsampling: 2,
        colorquantcycles: 3,
        layering: 0,
        roundcoords: 2,
        desc: false,
      },
    );
    self.postMessage({ ok: true, svg });
  } catch (error) {
    self.postMessage({
      ok: false,
      message: error instanceof Error ? error.message : 'Vectorization failed.',
    });
  }
};

export {};
