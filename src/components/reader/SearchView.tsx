import React, { useState } from 'react';
import { SearchResultGroup, SearchResultItem } from '../../types/reader';
import { Search, Loader2, X } from 'lucide-react';

interface SearchViewProps {
  onSearch: (query: string) => void;
  onClearSearch: () => void;
  results: SearchResultGroup[];
  isSearching: boolean;
  searchProgress: number; // 0 to 1
  onSelectResult: (cfi: string) => void;
}

export const SearchView: React.FC<SearchViewProps> = ({
  onSearch,
  onClearSearch,
  results,
  isSearching,
  searchProgress,
  onSelectResult,
}) => {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim());
    }
  };

  const handleClear = () => {
    setQuery('');
    onClearSearch();
  };

  const totalMatches = results.reduce((acc, g) => acc + g.subitems.length, 0);

  return (
    <div className="search-view-container">
      <form onSubmit={handleSubmit} className="search-input-form">
        <div className="search-input-wrap">
          <Search size={16} className="search-input-icon" />
          <input
            type="text"
            className="search-text-input"
            placeholder="Search in book..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          {query && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={handleClear}
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <button
          type="submit"
          className="search-submit-btn"
          disabled={!query.trim() || isSearching}
        >
          {isSearching ? <Loader2 size={16} className="animate-spin" /> : 'Search'}
        </button>
      </form>

      {isSearching && (
        <div className="search-progress-wrap">
          <div
            className="search-progress-bar"
            style={{ width: `${Math.round(searchProgress * 100)}%` }}
          />
        </div>
      )}

      <div className="search-results-list">
        {results.length > 0 && (
          <div className="search-results-stats">
            Found {totalMatches} {totalMatches === 1 ? 'match' : 'matches'}
          </div>
        )}

        {results.map((group, gIdx) => (
          <div key={`${group.index}-${gIdx}`} className="search-group">
            {group.label && (
              <div className="search-group-header">{group.label}</div>
            )}
            {group.subitems.map((item: SearchResultItem, itemIdx: number) => (
              <div
                key={`${item.cfi}-${itemIdx}`}
                className="search-result-item"
                onClick={() => onSelectResult(item.cfi)}
              >
                <p className="search-excerpt">{item.excerpt}</p>
              </div>
            ))}
          </div>
        ))}

        {!isSearching && results.length === 0 && query.trim() && (
          <div className="sidebar-empty-state">
            <p>No results found for "{query}".</p>
          </div>
        )}
      </div>
    </div>
  );
};
