declare module 'html-pdf-node' {
  export interface File {
    content: string;
  }

  export interface Options {
    format?: string;
    margin?: {
      top?: string;
      right?: string;
      bottom?: string;
      left?: string;
    };
  }

  export function generatePdf(file: File, options?: Options): Promise<Buffer>;

  export default {
    generatePdf,
  };
}
