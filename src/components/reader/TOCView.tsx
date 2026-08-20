import React, { useState } from 'react';
import { TOCItem } from '../../types/reader';
import { ChevronRight, ChevronDown } from 'lucide-react';

interface TOCViewProps {
  toc: TOCItem[];
  currentHref: string | null;
  onSelect: (href: string) => void;
}

interface TOCNodeProps {
  item: TOCItem;
  currentHref: string | null;
  onSelect: (href: string) => void;
  depth: number;
}

const TOCNode: React.FC<TOCNodeProps> = ({ item, currentHref, onSelect, depth }) => {
  const hasSubitems = item.subitems && item.subitems.length > 0;
  const [expanded, setExpanded] = useState<boolean>(true);

  const isCurrent = currentHref && (item.href === currentHref || (item.href && currentHref.startsWith(item.href)));

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(!expanded);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (item.href) {
      onSelect(item.href);
    } else if (hasSubitems) {
      setExpanded(!expanded);
    }
  };

  return (
    <li className="toc-item-node" role="none">
      <div
        className={`toc-item-row ${isCurrent ? 'active' : ''}`}
        style={{ paddingLeft: `${depth * 18 + 12}px` }}
        onClick={handleClick}
        role="treeitem"
        aria-selected={isCurrent ? 'true' : 'false'}
      >
        {hasSubitems ? (
          <button
            type="button"
            className="toc-expander-btn"
            onClick={handleToggle}
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        ) : (
          <span className="toc-expander-placeholder" />
        )}
        <span className="toc-item-label" title={item.label}>
          {item.label}
        </span>
      </div>

      {hasSubitems && expanded && (
        <ol className="toc-sublist" role="group">
          {item.subitems!.map((sub, idx) => (
            <TOCNode
              key={`${sub.href || sub.label}-${idx}`}
              item={sub}
              currentHref={currentHref}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}
        </ol>
      )}
    </li>
  );
};

export const TOCView: React.FC<TOCViewProps> = ({ toc, currentHref, onSelect }) => {
  if (!toc || toc.length === 0) {
    return (
      <div className="sidebar-empty-state">
        <p>No table of contents available.</p>
      </div>
    );
  }

  return (
    <nav className="toc-container" aria-label="Table of contents">
      <ol className="toc-list" role="tree">
        {toc.map((item, idx) => (
          <TOCNode
            key={`${item.href || item.label}-${idx}`}
            item={item}
            currentHref={currentHref}
            onSelect={onSelect}
            depth={0}
          />
        ))}
      </ol>
    </nav>
  );
};
