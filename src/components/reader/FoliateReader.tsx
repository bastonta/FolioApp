import React, { useEffect, useRef, useState, useCallback } from 'react';
import '../../foliate-js/view.js';
import { Overlayer } from '../../foliate-js/overlayer.js';
import {
  BookMetadata,
  TOCItem,
  Annotation,
  Bookmark,
  ReaderSettings,
  SearchResultGroup,
  FootnoteData,
} from '../../types/reader';
import { Sidebar } from './Sidebar';
import { HeaderBar } from './HeaderBar';
import { ProgressScrubber } from './ProgressScrubber';
import { FootnoteModal } from './FootnoteModal';
import { AnnotationPopover, SelectionInfo } from './AnnotationPopover';
import { BookInfoModal } from './BookInfoModal';
import { setStatusBarVisible } from '../../services/systemUi';
import {
  saveLastLocation,
  saveAnnotation,
  deleteAnnotation as removeStoredAnnotation,
  saveBookmark,
  deleteBookmark as removeStoredBookmark,
  loadAnnotations,
  loadBookmarks,
  loadLastLocation,
  storeBookCover,
  blobToThumbnailDataUrl,
  updateRecentBookMetadata,
} from '../../services/storage';

interface FoliateReaderProps {
  bookId: string;
  bookSource: File | Blob | string;
  settings: ReaderSettings;
  onUpdateSettings: (newSettings: Partial<ReaderSettings>) => void;
  onBackToLibrary: () => void;
}

const formatLanguageMap = (x: any): string => {
  if (!x) return '';
  if (typeof x === 'string') return x;
  const keys = Object.keys(x);
  return x[keys[0]] || '';
};

const formatContributor = (contributor: any): string => {
  if (!contributor) return '';
  if (typeof contributor === 'string') return contributor;
  if (Array.isArray(contributor)) {
    return contributor
      .map((c) => (typeof c === 'string' ? c : formatLanguageMap(c?.name || c)))
      .join(', ');
  }
  return formatLanguageMap(contributor?.name || contributor);
};

export const isFootnoteOrEndnoteLink = (a: Element | null, href: string): boolean => {
  if (!a && !href) return false;
  const typeAttr =
    a?.getAttributeNS?.('http://www.idpf.org/2007/ops', 'type') ||
    a?.getAttribute?.('epub:type') ||
    '';
  const roleAttr = a?.getAttribute?.('role') || '';
  const classAttr = a?.getAttribute?.('class') || '';

  const isNoteRefType = /\b(noteref|footnote|endnote|rearnote|note|biblioref|glossref|annotation)\b/i.test(typeAttr);
  const isNoteRefRole = /\b(doc-noteref|doc-footnote|doc-endnote|doc-biblioentry|doc-glossref)\b/i.test(roleAttr);
  const isNoteClass = /\b(footnote|endnote|noteref|footnote-ref|fn-ref|duokan-footnote|sdfootnoteanc|reference)\b/i.test(classAttr);

  if (isNoteRefType || isNoteRefRole || isNoteClass) return true;

  const isSup =
    a?.matches?.('sup, sub') ||
    a?.closest?.('sup, sub') !== null ||
    a?.querySelector?.('sup, sub') !== null;

  const hash = href.includes('#') ? href.split('#')[1] : '';
  if (hash) {
    const isNoteHash = /^(note|fn|footnote|endnote|rearnote|comment|n_|fn_|c_|ref_|annotation|sdfootnote|\d+)/i.test(hash);
    if (isNoteHash) return true;
  }

  const text = a?.textContent?.trim() || '';
  const isShortNoteText = /^(\[?\d+\]?|\(\d+\)|\*+|†|‡|\[[a-zA-Z]\]|\([a-zA-Z]\))$/i.test(text);

  if (isSup && (hash || isShortNoteText)) return true;
  if (isShortNoteText && hash) return true;

  return false;
};

export const extractFootnoteData = async (
  book: any,
  href: string,
  a?: Element | null
): Promise<FootnoteData | null> => {
  if (!book || !href) return null;
  try {
    const target = await Promise.resolve(book.resolveHref(href));
    if (!target) return null;

    const { index, anchor } = target;
    const section = book.sections?.[index];
    if (!section) return null;

    const doc = await section.createDocument();
    if (!doc) return null;

    let targetEl: HTMLElement | null = null;
    if (typeof anchor === 'function') {
      try {
        targetEl = anchor(doc);
      } catch (e) {
        console.warn('anchor(doc) error:', e);
      }
    }

    if (!targetEl && href.includes('#')) {
      const hash = href.split('#')[1];
      if (hash) {
        targetEl =
          doc.getElementById(hash) ||
          doc.querySelector(`[name="${hash}"]`) ||
          doc.querySelector(`[id="${CSS.escape(hash)}"]`) ||
          doc.querySelector(`a[name="${hash}"]`);
      }
    }

    if (!targetEl) return null;

    // If inline element, climb up to enclosing block
    let blockEl: HTMLElement = targetEl;
    const inlineTagNames = new Set(['A', 'SPAN', 'SUP', 'SUB', 'EM', 'STRONG', 'I', 'B', 'SMALL', 'BIG', 'FONT', 'TT']);
    while (
      blockEl.parentElement &&
      blockEl.parentElement !== doc.body &&
      inlineTagNames.has(blockEl.tagName.toUpperCase())
    ) {
      blockEl = blockEl.parentElement;
    }

    // Clone to sanitize/strip backlink anchors
    const clone = blockEl.cloneNode(true) as HTMLElement;
    clone.querySelectorAll(
      'a[role*="doc-backlink"], a[epub\\:type*="backlink"], a[class*="backlink"], a[class*="return"], .footnote-back, .backlink'
    ).forEach((el) => el.remove());

    const contentHtml = clone.innerHTML.trim() || clone.textContent?.trim() || '';
    if (!contentHtml) return null;

    const linkText = a?.textContent?.trim() || '';
    const title = linkText ? `Note ${linkText}` : 'Note';

    return {
      title,
      contentHtml,
      href,
      target: targetEl,
    };
  } catch (err) {
    console.warn('Error extracting footnote data:', err);
    return null;
  }
};

const getReaderCSS = (settings: ReaderSettings) => {
  const themeColors: Record<string, { bg: string; text: string; link: string }> = {
    light: { bg: '#ffffff', text: '#2e3436', link: '#1a5fb4' },
    sepia: { bg: '#fbf0d9', text: '#5f4b32', link: '#8f6b32' },
    gray: { bg: '#2e3440', text: '#eceff4', link: '#88c0d0' },
    dark: { bg: '#1e1e1e', text: '#e0e0e0', link: '#62a0ea' },
    solarized: { bg: '#fdf6e3', text: '#657b83', link: '#268bd2' },
  };

  const colors = themeColors[settings.theme] || themeColors.light;

  return `
    @namespace epub "http://www.idpf.org/2007/ops";
    html {
      color-scheme: ${settings.theme === 'dark' || settings.theme === 'gray' ? 'dark' : 'light'};
      background-color: ${colors.bg} !important;
    }
    body {
      font-family: ${settings.fontFamily} !important;
      font-size: ${settings.fontSize}px !important;
      line-height: ${settings.spacing} !important;
      background-color: ${colors.bg} !important;
      color: ${colors.text} !important;
    }
    p, li, blockquote, dd, div {
      line-height: ${settings.spacing} !important;
      text-align: ${settings.justify ? 'justify' : 'start'} !important;
      -webkit-hyphens: ${settings.hyphenate ? 'auto' : 'manual'} !important;
      hyphens: ${settings.hyphenate ? 'auto' : 'manual'} !important;
      -webkit-hyphenate-limit-before: 3;
      -webkit-hyphenate-limit-after: 2;
      -webkit-hyphenate-limit-lines: 2;
      hanging-punctuation: allow-end last;
      widows: 2;
    }
    a:link {
      color: ${colors.link};
    }
    sup, a[epub|type~="noteref"], a[role~="doc-noteref"] {
      color: #e02424;
      text-decoration: underline;
      text-underline-offset: 2px;
      cursor: pointer;
    }
    aside[epub|type~="endnote"],
    aside[epub|type~="footnote"],
    aside[epub|type~="note"],
    aside[epub|type~="rearnote"] {
      display: none;
    }
  `;
};

export const FoliateReader: React.FC<FoliateReaderProps> = ({
  bookId,
  bookSource,
  settings,
  onUpdateSettings,
  onBackToLibrary,
}) => {
  const viewerContainerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<any>(null);
  const settingsRef = useRef(settings);

  // Hide system status bar (clock & battery) while reading, restore on leaving reader
  useEffect(() => {
    setStatusBarVisible(false);
    return () => {
      setStatusBarVisible(true);
    };
  }, []);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const [showControls, setShowControls] = useState<boolean>(true);
  const [metadata, setMetadata] = useState<BookMetadata | null>(null);
  const [toc, setTOC] = useState<TOCItem[]>([]);
  const [currentHref, setCurrentHref] = useState<string | null>(null);
  const [chapterTitle, setChapterTitle] = useState<string>('');
  const [locationLabel, setLocationLabel] = useState<string>('');
  const [progressFraction, setProgressFraction] = useState<number>(0);
  const [sectionFractions, setSectionFractions] = useState<number[]>([]);
  const [currentCFI, setCurrentCFI] = useState<string>('');

  const [annotations, setAnnotations] = useState<Annotation[]>(() => loadAnnotations(bookId));
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(() => loadBookmarks(bookId));

  const [footnote, setFootnote] = useState<FootnoteData | null>(null);
  const [selection, setSelection] = useState<SelectionInfo | null>(null);
  const [isBookInfoOpen, setIsBookInfoOpen] = useState(false);

  // Refs for tracking active modal/hover state inside timer callbacks
  const isBookInfoOpenRef = useRef(isBookInfoOpen);
  useEffect(() => {
    isBookInfoOpenRef.current = isBookInfoOpen;
  }, [isBookInfoOpen]);

  const footnoteRef = useRef(footnote);
  useEffect(() => {
    footnoteRef.current = footnote;
  }, [footnote]);

  const selectionRef = useRef(selection);
  useEffect(() => {
    selectionRef.current = selection;
  }, [selection]);

  const isHoveringControlsRef = useRef(false);
  const autoHideTimerRef = useRef<number | null>(null);

  const showControlsRef = useRef(showControls);
  useEffect(() => {
    showControlsRef.current = showControls;
  }, [showControls]);

  const cancelAutoHide = useCallback(() => {
    if (autoHideTimerRef.current) {
      clearTimeout(autoHideTimerRef.current);
      autoHideTimerRef.current = null;
    }
  }, []);

  const scheduleAutoHide = useCallback(() => {
    cancelAutoHide();
    autoHideTimerRef.current = window.setTimeout(() => {
      if (
        !isHoveringControlsRef.current &&
        !isBookInfoOpenRef.current &&
        !footnoteRef.current &&
        !selectionRef.current &&
        (!settingsRef.current.sidebarOpen || settingsRef.current.sidebarPinned)
      ) {
        setShowControls(false);
      }
    }, 3500);
  }, [cancelAutoHide]);

  const scheduleAutoHideRef = useRef(scheduleAutoHide);
  useEffect(() => {
    scheduleAutoHideRef.current = scheduleAutoHide;
  }, [scheduleAutoHide]);

  const cancelAutoHideRef = useRef(cancelAutoHide);
  useEffect(() => {
    cancelAutoHideRef.current = cancelAutoHide;
  }, [cancelAutoHide]);

  // Manage auto-hide timer when showControls changes
  useEffect(() => {
    if (showControls) {
      scheduleAutoHide();
    } else {
      cancelAutoHide();
    }
    return () => cancelAutoHide();
  }, [showControls, scheduleAutoHide, cancelAutoHide]);

  // Window mouse movement for top/bottom edge triggers & activity reset
  useEffect(() => {
    const handleWindowMouseMove = (e: MouseEvent) => {
      if (!showControls) {
        // User moves mouse near top or bottom edge -> reveal controls
        if (e.clientY <= 36 || e.clientY >= window.innerHeight - 36) {
          setShowControls(true);
          scheduleAutoHide();
        }
      } else {
        if (!isHoveringControlsRef.current) {
          scheduleAutoHide();
        }
      }
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    return () => window.removeEventListener('mousemove', handleWindowMouseMove);
  }, [showControls, scheduleAutoHide]);

  // Search state
  const [isSearching, setIsSearching] = useState(false);
  const [searchProgress, setSearchProgress] = useState(0);
  const [searchResults, setSearchResults] = useState<SearchResultGroup[]>([]);

  // Update styling in foliate-view
  const applyStyles = useCallback(() => {
    if (viewRef.current?.renderer) {
      viewRef.current.renderer.setStyles?.(getReaderCSS(settings));
      viewRef.current.renderer.setAttribute?.('flow', settings.flow);
      
      const colCount =
        settings.columns === 'auto'
          ? window.innerWidth > 1000
            ? '2'
            : '1'
          : String(settings.columns);
      viewRef.current.renderer.setAttribute?.('max-column-count', colCount);
      viewRef.current.renderer.setAttribute?.('margin', `${settings.margin}px`);
      viewRef.current.renderer.setAttribute?.('gap', '6%');
    }
  }, [settings]);

  useEffect(() => {
    applyStyles();
  }, [applyStyles]);

  // Initialize and load book
  useEffect(() => {
    let isCancelled = false;

    async function initBook() {
      if (!viewerContainerRef.current) return;

      // Clean up previous view
      if (viewRef.current) {
        viewRef.current.close?.();
        viewRef.current.remove();
        viewRef.current = null;
      }

      viewerContainerRef.current.replaceChildren();

      // Create new foliate-view web component
      const view = document.createElement('foliate-view') as any;
      view.classList.add('foliate-host-element');
      viewerContainerRef.current.appendChild(view);
      viewRef.current = view;

      // Register event listeners before opening/navigating to ensure initial page events are captured
      // Listen for relocate events
      view.addEventListener('relocate', (e: any) => {
        const detail = e.detail || {};
        const fraction = detail.fraction ?? 0;
        setProgressFraction(fraction);

        if (detail.cfi) {
          setCurrentCFI(detail.cfi);
          saveLastLocation(bookId, detail.cfi, fraction);
        }

        if (detail.tocItem) {
          setCurrentHref(detail.tocItem.href);
          setChapterTitle(detail.tocItem.label || '');
        }

        let locText = '';
        if (detail.pageItem) {
          locText = `Page ${detail.pageItem.label || detail.pageItem.current || ''}`;
        } else if (detail.location?.current != null && detail.location?.total != null) {
          locText = `Loc. ${detail.location.current} of ${detail.location.total}`;
        } else {
          locText = `Loc. ${Math.round(fraction * 1000)}`;
        }
        setLocationLabel(locText);
      });

      // Footnote / Endnote interception on link events
      view.addEventListener('link', async (e: any) => {
        const { a, href } = e.detail || {};
        if (isFootnoteOrEndnoteLink(a, href)) {
          e.preventDefault();
          const noteData = await extractFootnoteData(view.book, href, a);
          if (noteData) {
            setFootnote(noteData);
          } else {
            view.goTo(href);
          }
        }
      });

      // Listen for section load to attach selection and keyboard handlers
      view.addEventListener('load', (e: any) => {
        const { doc, index } = e.detail;

        // Mouse move inside iframe for edge reveal & activity reset
        doc.addEventListener('mousemove', (ev: MouseEvent) => {
          if (!showControlsRef.current) {
            const clientY = ev.clientY;
            const docHeight = doc.defaultView?.innerHeight || window.innerHeight;
            if (clientY <= 36 || clientY >= docHeight - 36) {
              setShowControls(true);
              scheduleAutoHideRef.current();
            }
          } else {
            if (!isHoveringControlsRef.current) {
              scheduleAutoHideRef.current();
            }
          }
        });

        // Keyboard navigation inside iframe
        doc.addEventListener('keydown', (ev: KeyboardEvent) => {
          if (ev.key === 'ArrowLeft' || ev.key === 'h') {
            view.goLeft();
            if (showControlsRef.current) scheduleAutoHideRef.current();
          } else if (ev.key === 'ArrowRight' || ev.key === 'l' || ev.key === ' ') {
            view.goRight();
            if (showControlsRef.current) scheduleAutoHideRef.current();
          } else if (ev.key === 'Escape') {
            if (selectionRef.current) {
              setSelection(null);
              return;
            }
            if (footnoteRef.current) {
              setFootnote(null);
              return;
            }
            if (!settingsRef.current.sidebarPinned && settingsRef.current.sidebarOpen) {
              onUpdateSettings({ sidebarOpen: false });
              return;
            }
            setShowControls((prev) => {
              const next = !prev;
              if (next) scheduleAutoHideRef.current();
              else cancelAutoHideRef.current();
              return next;
            });
          } else if (ev.key === 'm' || ev.key === 'M') {
            setShowControls((prev) => {
              const next = !prev;
              if (next) scheduleAutoHideRef.current();
              else cancelAutoHideRef.current();
              return next;
            });
          }
        });

        // Text selection for highlights & annotations
        doc.addEventListener('pointerup', () => {
          const sel = doc.defaultView?.getSelection();
          if (sel && !sel.isCollapsed && sel.toString().trim()) {
            const text = sel.toString().trim();
            if (text.length > 0) {
              const range = sel.getRangeAt(0);
              const cfi = view.getCFI(index, range);
              const rangeRect = range.getBoundingClientRect();
              const viewRect = viewerContainerRef.current?.getBoundingClientRect() || {
                top: 0,
                left: 0,
              };

              const existing = loadAnnotations(bookId).find((a) => a.value === cfi);

              setSelection({
                text,
                cfi,
                sectionIndex: index,
                rect: {
                  x: viewRect.left + rangeRect.left,
                  y: viewRect.top + rangeRect.top,
                  width: rangeRect.width,
                  height: rangeRect.height,
                },
                existingAnnotation: existing,
              });
            }
          }
        });

        // Click handler inside iframe: footnote opening, unpinned sidebar dismissal, and controls toggle
        doc.addEventListener('click', async (ev: MouseEvent) => {
          // 1. If unpinned sidebar is open, clicking dismisses it
          if (!settingsRef.current.sidebarPinned && settingsRef.current.sidebarOpen) {
            onUpdateSettings({ sidebarOpen: false });
            return;
          }

          // 2. Footnote / endnote link click
          const a = (ev.target as Element)?.closest('a[href]');
          if (a) {
            const href = a.getAttribute('href') || '';
            if (isFootnoteOrEndnoteLink(a, href)) {
              ev.preventDefault();
              ev.stopPropagation();
              const noteData = await extractFootnoteData(view.book, href, a);
              if (noteData) {
                setFootnote(noteData);
              } else {
                view.goTo(href);
              }
            }
            return;
          }

          // 3. Clean click without text selection -> toggle controls
          const sel = doc.defaultView?.getSelection();
          if (!sel || sel.isCollapsed || !sel.toString().trim()) {
            setShowControls((prev) => {
              const next = !prev;
              if (next) scheduleAutoHideRef.current();
              else cancelAutoHideRef.current();
              return next;
            });
          }
        });
      });

      // Overlay & Annotation rendering
      view.addEventListener('create-overlay', () => {
        const currentAnns = loadAnnotations(bookId);
        for (const ann of currentAnns) {
          view.addAnnotation(ann);
        }
      });

      view.addEventListener('draw-annotation', (e: any) => {
        const { draw, annotation } = e.detail;
        const { color, style } = annotation;
        if (style === 'underline') {
          draw(Overlayer.underline, { color: color || '#ff7675', width: 2 });
        } else if (style === 'squiggly') {
          draw(Overlayer.squiggly, { color: color || '#ff7675', width: 2 });
        } else if (style === 'strikethrough') {
          draw(Overlayer.strikethrough, { color: color || '#ff7675', width: 2 });
        } else {
          draw(Overlayer.highlight, { color: color || '#ff7675' });
        }
      });

      view.addEventListener('show-annotation', (e: any) => {
        const cfi = e.detail.value;
        const ann = loadAnnotations(bookId).find((a) => a.value === cfi);
        if (ann) {
          const viewRect = viewerContainerRef.current?.getBoundingClientRect() || {
            top: 0,
            left: 0,
          };
          const rangeRect = e.detail.range?.getBoundingClientRect() || {
            left: 100,
            top: 100,
            width: 100,
            height: 20,
          };

          setSelection({
            text: ann.text,
            cfi: ann.value,
            sectionIndex: e.detail.index ?? 0,
            rect: {
              x: viewRect.left + rangeRect.left,
              y: viewRect.top + rangeRect.top,
              width: rangeRect.width,
              height: rangeRect.height,
            },
            existingAnnotation: ann,
          });
        }
      });

      try {
        await view.open(bookSource);
        if (isCancelled) return;

        const { book } = view;

        // Extract metadata
        const title = formatLanguageMap(book.metadata?.title) || 'Untitled Book';
        const author = formatContributor(book.metadata?.author || book.metadata?.creator);
        const publisher = formatLanguageMap(book.metadata?.publisher);
        const language = formatLanguageMap(book.metadata?.language);
        const description = formatLanguageMap(book.metadata?.description);
        const identifier = formatLanguageMap(book.metadata?.identifier);
        const published = formatLanguageMap(book.metadata?.published || book.metadata?.date);
        const subject = book.metadata?.subject;

        let coverUrl: string | undefined;
        let coverBlob: Blob | null = null;
        try {
          coverBlob = await Promise.resolve(book.getCover?.());
          if (coverBlob) {
            coverUrl = URL.createObjectURL(coverBlob);
          }
        } catch (e) {
          console.warn('Cover extraction failed:', e);
        }

        // Persist extracted metadata & cover thumbnail to recent books
        if (coverBlob) {
          storeBookCover(bookId, coverBlob).catch(console.error);
          blobToThumbnailDataUrl(coverBlob)
            .then((thumbUrl) => {
              updateRecentBookMetadata(bookId, {
                title: title !== 'Untitled Book' ? title : undefined,
                author: author !== 'Unknown Author' ? author : undefined,
                coverUrl: thumbUrl,
              });
            })
            .catch(() => {
              updateRecentBookMetadata(bookId, {
                title: title !== 'Untitled Book' ? title : undefined,
                author: author !== 'Unknown Author' ? author : undefined,
              });
            });
        } else {
          updateRecentBookMetadata(bookId, {
            title: title !== 'Untitled Book' ? title : undefined,
            author: author !== 'Unknown Author' ? author : undefined,
          });
        }

        const metaObj: BookMetadata = {
          title,
          author,
          publisher,
          language,
          description,
          identifier,
          published,
          subject,
          coverUrl,
        };
        setMetadata(metaObj);
        document.title = `${title} — Folio`;

        // Extract TOC
        if (book.toc) {
          setTOC(book.toc);
        }

        // Apply visual styles
        applyStyles();

        // Restore saved location or text start
        const savedLoc = loadLastLocation(bookId);
        if (savedLoc?.cfi) {
          await view.goTo(savedLoc.cfi);
        } else if (savedLoc?.fraction != null) {
          await view.goToFraction(savedLoc.fraction);
        } else {
          await view.init({ showTextStart: true });
        }

        setSectionFractions(view.getSectionFractions() || []);
      } catch (err) {
        console.error('Failed to open book with foliate-js:', err);
      }
    }

    initBook();

    return () => {
      isCancelled = true;
      if (viewRef.current) {
        viewRef.current.close?.();
      }
    };
  }, [bookId, bookSource]);

  // Window resize handler for column adjustments
  useEffect(() => {
    const handleResize = () => {
      applyStyles();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [applyStyles]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Don't capture when typing in inputs/textareas
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        viewRef.current?.goLeft();
        if (showControls) scheduleAutoHide();
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        viewRef.current?.goRight();
        if (showControls) scheduleAutoHide();
      } else if (e.key === 'Escape') {
        if (selection) {
          setSelection(null);
          return;
        }
        if (isBookInfoOpen) {
          setIsBookInfoOpen(false);
          return;
        }
        if (footnote) {
          setFootnote(null);
          return;
        }
        if (!settings.sidebarPinned && settings.sidebarOpen) {
          onUpdateSettings({ sidebarOpen: false });
          return;
        }
        setShowControls((prev) => {
          const next = !prev;
          if (next) scheduleAutoHide();
          else cancelAutoHide();
          return next;
        });
      } else if (e.key === 'm' || e.key === 'M') {
        setShowControls((prev) => {
          const next = !prev;
          if (next) scheduleAutoHide();
          else cancelAutoHide();
          return next;
        });
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [selection, isBookInfoOpen, footnote, settings, onUpdateSettings, showControls, scheduleAutoHide, cancelAutoHide]);

  // TOC Navigation
  const handleSelectTOC = (href: string) => {
    viewRef.current?.goTo(href);
    if (!settings.sidebarPinned) {
      onUpdateSettings({ sidebarOpen: false });
    }
  };

  // Annotations management
  const handleSaveAnnotation = (data: {
    value: string;
    text: string;
    color: string;
    style: 'highlight' | 'underline' | 'squiggly' | 'strikethrough';
    note?: string;
    sectionIndex: number;
  }) => {
    const newAnn: Annotation = {
      id: `ann-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      bookId,
      value: data.value,
      color: data.color,
      style: data.style,
      text: data.text,
      note: data.note,
      createdAt: new Date().toISOString(),
      chapterTitle,
      sectionIndex: data.sectionIndex,
    };

    saveAnnotation(newAnn);
    setAnnotations(loadAnnotations(bookId));
    viewRef.current?.addAnnotation(newAnn);
  };

  const handleDeleteAnnotation = (value: string) => {
    removeStoredAnnotation(bookId, value);
    setAnnotations(loadAnnotations(bookId));
    viewRef.current?.deleteAnnotation({ value });
  };

  const handleSelectAnnotation = (ann: Annotation) => {
    viewRef.current?.showAnnotation(ann);
    if (!settings.sidebarPinned) {
      onUpdateSettings({ sidebarOpen: false });
    }
  };

  // Bookmarks management
  const handleAddCurrentBookmark = () => {
    if (!currentCFI) return;
    const newBm: Bookmark = {
      id: `bm-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      bookId,
      cfi: currentCFI,
      fraction: progressFraction,
      locationLabel,
      chapterTitle,
      createdAt: new Date().toISOString(),
    };
    saveBookmark(newBm);
    setBookmarks(loadBookmarks(bookId));
  };

  const handleDeleteBookmark = (id: string) => {
    removeStoredBookmark(bookId, id);
    setBookmarks(loadBookmarks(bookId));
  };

  const handleSelectBookmark = (bm: Bookmark) => {
    viewRef.current?.goTo(bm.cfi);
    if (!settings.sidebarPinned) {
      onUpdateSettings({ sidebarOpen: false });
    }
  };

  // Search management
  const handleSearch = async (query: string) => {
    if (!viewRef.current || !query.trim()) return;
    setIsSearching(true);
    setSearchProgress(0);
    setSearchResults([]);

    try {
      for await (const result of viewRef.current.search({ query })) {
        if (result === 'done') break;
        if (result.progress != null) {
          setSearchProgress(result.progress);
        }
        if (result.subitems && result.subitems.length > 0) {
          setSearchResults((prev) => [...prev, result]);
        }
      }
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleClearSearch = () => {
    viewRef.current?.clearSearch();
    setSearchResults([]);
    setIsSearching(false);
    setSearchProgress(0);
  };

  const handleSelectSearchResult = (cfi: string) => {
    viewRef.current?.goTo(cfi);
    if (!settings.sidebarPinned) {
      onUpdateSettings({ sidebarOpen: false });
    }
  };

  return (
    <div
      className={`foliate-reader-root theme-${settings.theme} ${
        showControls ? 'controls-visible' : 'controls-hidden'
      }`}
    >
      {/* Top Header Bar matching Screenshots 1 & 3 */}
      <HeaderBar
        onBackToLibrary={onBackToLibrary}
        onToggleSidebar={() =>
          onUpdateSettings({
            sidebarOpen: !settings.sidebarOpen,
          })
        }
        isSidebarOpen={settings.sidebarOpen}
        onToggleSearch={() => {
          const nextTab = settings.activeTab === 'search' ? 'contents' : 'search';
          onUpdateSettings({
            activeTab: nextTab,
            sidebarOpen: true,
          });
        }}
        isSearchActive={settings.sidebarOpen && settings.activeTab === 'search'}
        onTogglePin={() =>
          onUpdateSettings({
            sidebarPinned: !settings.sidebarPinned,
            sidebarOpen: true,
          })
        }
        isPinned={settings.sidebarPinned}
        chapterTitle={chapterTitle}
        onMouseEnter={() => {
          isHoveringControlsRef.current = true;
          cancelAutoHide();
        }}
        onMouseLeave={() => {
          isHoveringControlsRef.current = false;
          if (showControls) scheduleAutoHide();
        }}
      />

      {/* Main Workspace: Sidebar + Reader */}
      <div className="reader-workspace">
        {/* Floating backdrop for unpinned sidebar */}
        {!settings.sidebarPinned && settings.sidebarOpen && (
          <div
            className="sidebar-floating-backdrop"
            onClick={() => onUpdateSettings({ sidebarOpen: false })}
            title="Click to close sidebar"
          />
        )}

        {/* Foliate Sidebar */}
        <Sidebar
          isOpen={settings.sidebarOpen}
          isPinned={settings.sidebarPinned}
          onTogglePin={() =>
            onUpdateSettings({
              sidebarPinned: !settings.sidebarPinned,
            })
          }
          activeTab={settings.activeTab}
          onTabChange={(tab) => onUpdateSettings({ activeTab: tab })}
          metadata={metadata}
          toc={toc}
          currentHref={currentHref}
          onSelectTOC={handleSelectTOC}
          annotations={annotations}
          onSelectAnnotation={handleSelectAnnotation}
          onDeleteAnnotation={handleDeleteAnnotation}
          bookmarks={bookmarks}
          onSelectBookmark={handleSelectBookmark}
          onDeleteBookmark={handleDeleteBookmark}
          onAddCurrentBookmark={handleAddCurrentBookmark}
          searchResults={searchResults}
          isSearching={isSearching}
          searchProgress={searchProgress}
          onSearch={handleSearch}
          onClearSearch={handleClearSearch}
          onSelectSearchResult={handleSelectSearchResult}
          onOpenBookInfo={() => setIsBookInfoOpen(true)}
        />

        {/* Reader Canvas Area */}
        <main
          className="reader-canvas-area"
          onClick={() => {
            if (!settings.sidebarPinned && settings.sidebarOpen) {
              onUpdateSettings({ sidebarOpen: false });
            }
          }}
        >
          {/* Foliate-view container */}
          <div className="foliate-viewport-wrap" ref={viewerContainerRef} />

          {/* Bottom Progress Scrubber */}
          <ProgressScrubber
            fraction={progressFraction}
            locationLabel={locationLabel}
            onSeek={(frac) => viewRef.current?.goToFraction(frac)}
            onPrev={() => viewRef.current?.goLeft()}
            onNext={() => viewRef.current?.goRight()}
            sectionFractions={sectionFractions}
            onMouseEnter={() => {
              isHoveringControlsRef.current = true;
              cancelAutoHide();
            }}
            onMouseLeave={() => {
              isHoveringControlsRef.current = false;
              if (showControls) scheduleAutoHide();
            }}
          />
        </main>
      </div>

      {/* Selection / Annotation Popover */}
      <AnnotationPopover
        selection={selection}
        onClose={() => setSelection(null)}
        onSave={handleSaveAnnotation}
        onDelete={handleDeleteAnnotation}
      />

      {/* Footnote / Endnote Modal */}
      <FootnoteModal
        footnote={footnote}
        onClose={() => setFootnote(null)}
        onNavigate={(href) => viewRef.current?.goTo(href)}
      />

      {/* Book Metadata Info Modal */}
      <BookInfoModal
        isOpen={isBookInfoOpen}
        onClose={() => setIsBookInfoOpen(false)}
        metadata={metadata}
      />
    </div>
  );
};
