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
    constructor(source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement);
  }

  export class InferenceEngine {
    startWorker(
      model: string,
      version: string,
      publishableKey: string,
    ): Promise<string>;
    infer(workerId: string, image: CVImage): Promise<InferencePrediction[]>;
  }
}
