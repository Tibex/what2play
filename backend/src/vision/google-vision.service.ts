import { BadRequestException, Injectable } from '@nestjs/common';
import vision from '@google-cloud/vision';

export type VisionTextBlock = {
  text: string;
  confidence?: number;
  boundingBox: { x: number; y: number; width: number; height: number };
};

@Injectable()
export class GoogleVisionService {
  private client = new vision.ImageAnnotatorClient();

  async detectTextBlocks(image: Buffer): Promise<VisionTextBlock[]> {
    const [result] = await this.client.documentTextDetection({
      image: { content: image },
    });
    const full = result.fullTextAnnotation;
    if (!full?.pages?.length) return [];

    const blocks: VisionTextBlock[] = [];
    for (const page of full.pages) {
      const pageWidth = page.width ?? 1;
      const pageHeight = page.height ?? 1;
      for (const block of page.blocks || []) {
        const paragraphs = block.paragraphs || [];
        const text = paragraphs
          .flatMap((p) => p.words || [])
          .map((word) =>
            (word.symbols || []).map((symbol) => symbol.text || '').join(''),
          )
          .join(' ')
          .trim();
        if (!text) continue;
        const vertices = block.boundingBox?.normalizedVertices?.length
          ? block.boundingBox.normalizedVertices
          : (block.boundingBox?.vertices || []).map((v) => ({
              x: (v.x || 0) / pageWidth,
              y: (v.y || 0) / pageHeight,
            }));
        if (!vertices.length) continue;
        const xs = vertices.map((v) => v.x || 0);
        const ys = vertices.map((v) => v.y || 0);
        const minX = Math.max(0, Math.min(...xs));
        const minY = Math.max(0, Math.min(...ys));
        const maxX = Math.min(1, Math.max(...xs));
        const maxY = Math.min(1, Math.max(...ys));
        blocks.push({
          text,
          confidence: block.confidence ?? undefined,
          boundingBox: {
            x: minX,
            y: minY,
            width: Math.max(0, maxX - minX),
            height: Math.max(0, maxY - minY),
          },
        });
      }
    }

    if (!blocks.length) {
      throw new BadRequestException('No readable text found in image');
    }
    return blocks;
  }
}
