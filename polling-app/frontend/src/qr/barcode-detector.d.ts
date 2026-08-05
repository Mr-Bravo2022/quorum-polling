/**
 * Minimal ambient types for the Barcode Detection API, which isn't in
 * TypeScript's built-in DOM lib yet. We only use QR detection.
 * https://developer.mozilla.org/en-US/docs/Web/API/Barcode_Detection_API
 */
interface DetectedBarcode {
  rawValue: string;
  format: string;
}

interface BarcodeDetectorOptions {
  formats: string[];
}

declare class BarcodeDetector {
  constructor(options?: BarcodeDetectorOptions);
  static getSupportedFormats(): Promise<string[]>;
  detect(source: CanvasImageSource | ImageBitmapSource): Promise<DetectedBarcode[]>;
}
