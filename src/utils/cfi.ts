/**
 * Utilities for parsing and formatting EPUB CFI location strings.
 */

export interface LocationRange {
  locationStart: string;
  locationEnd: string;
}

/**
 * Parses a CFI range string or single location into locationStart and locationEnd.
 *
 * EPUB CFI Range format: `epubcfi(parent_path,start_subpath,end_subpath)`
 * Example: `epubcfi(/6/16!/4/2[sect_6]/24,/1:0,/1:328)`
 * -> locationStart: `epubcfi(/6/16!/4/2[sect_6]/24/1:0)`
 * -> locationEnd: `epubcfi(/6/16!/4/2[sect_6]/24/1:328)`
 */
export function parseCfiRange(cfi?: string): LocationRange {
  if (!cfi) {
    return { locationStart: '', locationEnd: '' };
  }

  const trimmed = cfi.trim();

  if (trimmed.startsWith('epubcfi(') && trimmed.endsWith(')')) {
    const inner = trimmed.slice(8, -1);

    const parts: string[] = [];
    let currentPart = '';
    let bracketDepth = 0;

    for (const char of inner) {
      if (char === '[') bracketDepth++;
      else if (char === ']') bracketDepth--;

      if (char === ',' && bracketDepth === 0) {
        parts.push(currentPart);
        currentPart = '';
      } else {
        currentPart += char;
      }
    }
    parts.push(currentPart);

    if (parts.length === 3) {
      const [parent, startRel, endRel] = parts;
      return {
        locationStart: `epubcfi(${parent}${startRel})`,
        locationEnd: `epubcfi(${parent}${endRel})`,
      };
    }
  }

  return { locationStart: trimmed, locationEnd: trimmed };
}

/**
 * Combines locationStart and locationEnd into an EPUB CFI range string if possible,
 * or returns locationStart.
 */
export function toCfiRange(locationStart?: string, locationEnd?: string): string {
  if (!locationStart) return '';
  if (!locationEnd || locationStart === locationEnd) return locationStart;

  if (locationStart.startsWith('epubcfi(') && locationStart.includes(',')) {
    return locationStart;
  }

  if (
    locationStart.startsWith('epubcfi(') &&
    locationStart.endsWith(')') &&
    locationEnd.startsWith('epubcfi(') &&
    locationEnd.endsWith(')')
  ) {
    const s1 = locationStart.slice(8, -1);
    const s2 = locationEnd.slice(8, -1);

    let lastMatchIdx = -1;
    const minLen = Math.min(s1.length, s2.length);

    for (let i = 0; i < minLen; i++) {
      if (s1[i] !== s2[i]) break;
      if (s1[i] === '/' || s1[i] === '!') {
        lastMatchIdx = i;
      }
    }

    if (lastMatchIdx > 0) {
      const parent = s1.slice(0, lastMatchIdx);
      const startRel = s1.slice(lastMatchIdx);
      const endRel = s2.slice(lastMatchIdx);
      return `epubcfi(${parent},${startRel},${endRel})`;
    }
  }

  return locationStart;
}
