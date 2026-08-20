export interface BookMetadata {
  title: string;
  author: string;
  publisher?: string;
  language?: string;
  description?: string;
  identifier?: string;
  published?: string;
  modified?: string;
  subject?: string[] | string;
  coverUrl?: string;
}

export interface TOCItem {
  label: string;
  href: string;
  subitems?: TOCItem[];
}

export interface Annotation {
  id: string;
  bookId: string;
  value: string; // CFI string
  color: string; // Hex or CSS color
  style?: 'highlight' | 'underline' | 'squiggly' | 'strikethrough';
  text: string; // Highlighted text quote
  note?: string; // User's personal note
  createdAt: string;
  chapterTitle?: string;
  sectionIndex?: number;
}

export interface Bookmark {
  id: string;
  bookId: string;
  cfi: string;
  fraction: number;
  locationLabel?: string;
  chapterTitle?: string;
  textSnippet?: string;
  createdAt: string;
}

export interface RecentBook {
  id: string;
  title: string;
  author: string;
  coverUrl?: string;
  lastLocation?: string; // CFI
  progressFraction: number;
  lastOpenedAt: string;
  fileName: string;
  fileSize: number;
}

export type ThemeName = 'light' | 'sepia' | 'gray' | 'dark' | 'solarized';

export interface ReaderSettings {
  flow: 'paginated' | 'scrolled';
  columns: 'auto' | 1 | 2;
  fontFamily: string;
  fontSize: number; // in pt or px, e.g. 18
  spacing: number; // line-height, e.g. 1.5
  margin: number; // page margin in px
  justify: boolean;
  hyphenate: boolean;
  theme: ThemeName;
  sidebarPinned: boolean;
  sidebarOpen: boolean;
  activeTab: 'contents' | 'annotations' | 'bookmarks' | 'search';
}

export interface SearchResultItem {
  cfi: string;
  excerpt: string;
}

export interface SearchResultGroup {
  index: number;
  label: string;
  subitems: SearchResultItem[];
}

export interface FootnoteData {
  title: string;
  contentHtml: string;
  href: string;
  target?: Element | null;
}
