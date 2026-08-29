declare module 'imagetracerjs' {
  type ImageDataLike = {
    width: number;
    height: number;
    data: Uint8ClampedArray;
  };

  type TraceOptions = Record<string, string | number | boolean>;

  const ImageTracer: {
    imagedataToSVG(imageData: ImageDataLike, options?: TraceOptions | string): string;
  };

  export default ImageTracer;
}
