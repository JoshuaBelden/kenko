declare global {
  interface DetectedBarcode {
    rawValue: string
    format: string
    boundingBox: DOMRectReadOnly
    cornerPoints: { x: number; y: number }[]
  }

  class BarcodeDetector {
    constructor(options?: { formats?: string[] })
    static getSupportedFormats(): Promise<string[]>
    detect(source: ImageBitmapSource): Promise<DetectedBarcode[]>
  }

  namespace App {
    interface Locals {
      userId?: string
    }
    interface PageData {
      user: {
        id: string
        email: string
        profileComplete: boolean
        profile: {
          firstName: string
          lastName: string
          weight?: number
          height?: number
          sex?: "male" | "female"
          bmi?: number
          bodyFatPercent?: number
        } | null
      } | null
      activeJourneys: Array<{
        id: string
        name: string
        startDate: string
        endDate: string
      }>
    }
  }
}

export {}
