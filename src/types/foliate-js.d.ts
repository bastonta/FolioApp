declare module '*/foliate-js/view.js' {
  export class View extends HTMLElement {
    book: any;
    renderer: any;
    open(file: any): Promise<any>;
    close(): void;
    init(opts: { lastLocation?: any; showTextStart?: boolean }): Promise<void>;
    goTo(target: any): Promise<any>;
    goToFraction(frac: number): Promise<void>;
    prev(distance?: number): Promise<void>;
    next(distance?: number): Promise<void>;
    goLeft(): Promise<void>;
    goRight(): Promise<void>;
    addAnnotation(annotation: any, remove?: boolean): Promise<any>;
    deleteAnnotation(annotation: any): Promise<any>;
    showAnnotation(annotation: any): Promise<void>;
    getCFI(index: number, range: Range): string;
    resolveCFI(cfi: string): { index: number; anchor: (doc: Document) => any };
    getSectionFractions(): number[];
    search(opts: { query: string; draw?: any; drawOptions?: any; index?: number }): AsyncGenerator<any, void, unknown>;
    clearSearch(): void;
  }
  export function makeBook(file: any): Promise<any>;
}

declare module '*/foliate-js/footnotes.js' {
  export class FootnoteHandler extends EventTarget {
    detectFootnotes: boolean;
    handle(book: any, e: any): Promise<any>;
  }
}

declare module '*/foliate-js/overlayer.js' {
  export class Overlayer {
    element: SVGElement;
    add(key: string, range: Range | ((root: Node) => Range), draw: Function, options?: any): void;
    remove(key: string): void;
    redraw(): void;
    hitTest(pt: { x: number; y: number }): [string, Range];
    static underline(rects: DOMRectList | DOMRect[], options?: any): SVGElement;
    static strikethrough(rects: DOMRectList | DOMRect[], options?: any): SVGElement;
    static squiggly(rects: DOMRectList | DOMRect[], options?: any): SVGElement;
    static highlight(rects: DOMRectList | DOMRect[], options?: any): SVGElement;
    static outline(rects: DOMRectList | DOMRect[], options?: any): SVGElement;
  }
}

declare module '*/foliate-js/epubcfi.js' {
  export function fromRange(range: Range): string;
  export function toRange(doc: Document, parts: any): Range;
  export function parse(cfi: string): any;
  export function joinIndir(base: string, path: string): string;
}
