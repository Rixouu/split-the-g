/**
 * The published `inferencejs` package points `types` at a minimal `index.d.ts`
 * that does not declare object-detection prediction shapes used on the home
 * route. This shim matches how the library is used here (Roboflow worker +
 * CVImage + class labels like "G" / "glass").
 */
declare module "inferencejs" {
  export interface InferencePrediction {
    class: string;
    confidence?: number;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  }

  export class CVImage {
    /** Narrowed to DOM sources used in this app; full library accepts tensors too. */
    constructor(image: HTMLImageElement | HTMLVideoElement | ImageBitmap);
    dispose(): void;
  }

  export class InferenceEngine {
    constructor(url?: string);
    startWorker(
      modelName: string,
      modelVersion: number | string,
      publishableKey: string,
      options?: unknown[],
    ): Promise<string>;
    stopWorker(workerId: string): Promise<boolean>;
    infer(
      workerId: string,
      img: ImageBitmap | CVImage,
      options?: unknown,
    ): Promise<InferencePrediction[]>;
  }
}
