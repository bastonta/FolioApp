import React, { useEffect, useRef, useState, useCallback } from 'react';
import '../../foliate-js/view.js';
import { FootnoteHandler } from '../../foliate-js/footnotes.js';
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
import { SettingsPopover } from './SettingsPopover';
import { BookInfoModal } from './BookInfoModal';
import {
  saveLastLocation,
  saveAnnotation,
  deleteAnnotation as removeStoredAnnotation,
  saveBookmark,
  deleteBookmark as removeStoredBookmark,
  loadAnnotations,
  loadBookmarks,
  loadLastLocation,
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
  const settingsBtnRef = useRef<HTMLButtonElement>(null);

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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isBookInfoOpen, setIsBookInfoOpen] = useState(false);

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

      const footnoteHandler = new FootnoteHandler();
      footnoteHandler.addEventListener('render', (e: any) => {
        const { target, href, type } = e.detail;
        if (target) {
          setFootnote({
            title: type === 'endnote' ? 'Endnote' : 'Footnote',
            contentHtml: target.innerHTML || target.textContent || '',
            href,
            target,
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
        try {
          const coverBlob = await Promise.resolve(book.getCover?.());
          if (coverBlob) {
            coverUrl = URL.createObjectURL(coverBlob);
          }
        } catch (e) {
          console.warn('Cover extraction failed:', e);
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

        // Listen for section load to attach selection and keyboard handlers
        view.addEventListener('load', (e: any) => {
          const { doc, index } = e.detail;

          // Keyboard navigation inside iframe
          doc.addEventListener('keydown', (ev: KeyboardEvent) => {
            if (ev.key === 'ArrowLeft' || ev.key === 'h') {
              view.goLeft();
            } else if (ev.key === 'ArrowRight' || ev.key === 'l' || ev.key === ' ') {
              view.goRight();
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

          // Footnote link interception
          doc.addEventListener('click', (ev: MouseEvent) => {
            const a = (ev.target as Element)?.closest('a[href]');
            if (a) {
              const href = a.getAttribute('href') || '';
              footnoteHandler.handle(book, {
                detail: { a, href },
                preventDefault: () => ev.preventDefault(),
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
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        viewRef.current?.goRight();
      } else if (e.key === 'Escape') {
        setSelection(null);
        setIsSettingsOpen(false);
        setIsBookInfoOpen(false);
        setFootnote(null);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

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
    <div className={`foliate-reader-root theme-${settings.theme}`}>
      {/* Top Header Bar matching Screenshots 1 & 3 */}
      <HeaderBar
        onBackToLibrary={onBackToLibrary}
        onToggleSearch={() => {
          const nextTab = settings.activeTab === 'search' ? 'contents' : 'search';
          onUpdateSettings({
            activeTab: nextTab,
            sidebarOpen: true,
          });
        }}
        isSearchActive={settings.sidebarOpen && settings.activeTab === 'search'}
        onToggleSettings={() => setIsSettingsOpen(!isSettingsOpen)}
        isSettingsOpen={isSettingsOpen}
        onTogglePin={() =>
          onUpdateSettings({
            sidebarPinned: !settings.sidebarPinned,
            sidebarOpen: true,
          })
        }
        isPinned={settings.sidebarPinned}
        chapterTitle={chapterTitle}
        settingsBtnRef={settingsBtnRef}
      />

      {/* Main Workspace: Sidebar + Reader */}
      <div className="reader-workspace">
        {/* Foliate Sidebar */}
        <Sidebar
          isOpen={settings.sidebarOpen}
          isPinned={settings.sidebarPinned}
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
          />
        </main>
      </div>

      {/* Settings Popover */}
      <SettingsPopover
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={onUpdateSettings}
        triggerRef={settingsBtnRef}
      />

      {/* Selection / Annotation Popover */}
      <AnnotationPopover
        selection={selection}
        onClose={() => setSelection(null)}
        onSave={handleSaveAnnotation}
        onDelete={handleDeleteAnnotation}
      />

      {/* Footnote / Endnote Modal matching Screenshot 2 */}
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
