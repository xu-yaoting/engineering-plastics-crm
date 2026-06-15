declare module 'pdfkit' {
  import { EventEmitter } from 'events';

  interface TextOptions {
    width?: number;
    align?: 'left' | 'center' | 'right' | 'justify';
    lineBreak?: boolean;
    continued?: boolean;
  }

  class PDFDocument extends EventEmitter {
    constructor(options?: { size?: string | [number, number]; margin?: number; layout?: string });
    font(fontName: string): this;
    fontSize(size: number): this;
    fill(color: string): this;
    fillOpacity(opacity: number): this;
    text(text: string, x?: number, y?: number, options?: TextOptions): this;
    rect(x: number, y: number, w: number, h: number): this;
    moveTo(x: number, y: number): this;
    lineTo(x: number, y: number): this;
    stroke(): this;
    strokeColor(color: string): this;
    lineWidth(w: number): this;
    registerFont(name: string, path: string): this;
    addPage(): this;
    pipe(dest: any): this;
    end(): void;
  }

  export default PDFDocument;
}

declare namespace PDFKit {
  type PDFDocument = InstanceType<typeof import('pdfkit').default>;
}
