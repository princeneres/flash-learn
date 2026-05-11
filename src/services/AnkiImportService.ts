import JSZip from 'jszip';
import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { decompress as zstdDecompress } from 'fzstd';
import { sanitizeRichHtml } from '../lib/sanitize';
import type { MediaKind } from './MediaStorageService';

export interface ParsedCard {
  /** Plain-text version of front (search, fallback). */
  front: string;
  /** Plain-text version of back. */
  back: string;
  /** Rich HTML (with media://refs). Preferred storage value. */
  frontHtml?: string;
  backHtml?: string;
  /** First audio ref found in front, for the standalone PlayAudioButton fallback (legacy). */
  frontAudioRef?: string;
  backAudioRef?: string;
}

export interface MediaBlobEntry {
  blob: Blob;
  kind: MediaKind;
}

export interface ParsedImport {
  deckName?: string;
  cards: ParsedCard[];
  /** Map original media filename → { blob, kind } */
  mediaBlobs: Map<string, MediaBlobEntry>;
}

const FIELD_SEP = '\x1f';
const CLOZE_RE = /\{\{c(\d+)::([^}]*?)(?:::[^}]*?)?\}\}/g;
const SOUND_RE = /\[sound:([^\]]+)\]/g;
const IMG_TAG_RE = /<img\b([^>]*)>/gi;
const SRC_ATTR_RE = /\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i;

let sqlPromise: Promise<SqlJsStatic> | null = null;

const getSql = (): Promise<SqlJsStatic> => {
  if (!sqlPromise) {
    sqlPromise = (initSqlJs as unknown as (
      opts: { locateFile: () => string }
    ) => Promise<SqlJsStatic>)({ locateFile: () => sqlWasmUrl });
  }
  return sqlPromise;
};

const decodeEntities = (s: string): string =>
  s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

const stripHtmlOnly = (input: string): string => {
  if (!input) return '';
  const withBreaks = input
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr)>/gi, '\n');
  return decodeEntities(withBreaks.replace(/<[^>]+>/g, '')).trim();
};

const stripHtml = (input: string): string => {
  if (!input) return '';
  const decloze = input.replace(CLOZE_RE, '$2');
  return stripHtmlOnly(decloze);
};

const isAudioFilename = (name: string): boolean =>
  /\.(mp3|ogg|wav|m4a|webm|aac|opus|flac)$/i.test(name);

const isImageFilename = (name: string): boolean =>
  /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(name);

interface RichExtract {
  html: string;
  text: string;
  audioRefs: string[];
  imageRefs: string[];
  firstAudio?: string;
}

const extractRich = (input: string): RichExtract => {
  if (!input) {
    return { html: '', text: '', audioRefs: [], imageRefs: [] };
  }

  // Inline cloze contents for non-cloze rendering
  const decloze = input.replace(CLOZE_RE, '$2');

  const audioRefs: string[] = [];
  let firstAudio: string | undefined;
  // Replace [sound:foo.mp3] with <audio> tag pointing to media://foo.mp3
  const withAudio = decloze.replace(SOUND_RE, (_m, fname: string) => {
    const ref = fname.trim();
    if (!audioRefs.includes(ref)) audioRefs.push(ref);
    if (!firstAudio) firstAudio = ref;
    return `<audio controls src="media://${ref}"></audio>`;
  });

  // Rewrite <img src="foo.png"> to use media:// scheme when path is a bare filename.
  const imageRefs: string[] = [];
  const withImages = withAudio.replace(IMG_TAG_RE, (full, attrs: string) => {
    const m = attrs.match(SRC_ATTR_RE);
    if (!m) return full;
    const rawSrc = (m[1] ?? m[2] ?? m[3] ?? '').trim();
    if (!rawSrc) return full;
    if (/^(https?:|data:|media:\/\/)/i.test(rawSrc)) return full;
    let ref = rawSrc.replace(/^\.\//, '');
    try {
      ref = decodeURIComponent(ref);
    } catch {
      // keep raw if malformed
    }
    if (!imageRefs.includes(ref)) imageRefs.push(ref);
    const newAttrs = attrs.replace(SRC_ATTR_RE, `src="media://${ref}"`);
    return `<img${newAttrs}>`;
  });

  const html = sanitizeRichHtml(withImages);
  const text = stripHtml(input);
  return { html, text, audioRefs, imageRefs, firstAudio };
};

const splitClozeFields = (
  raw: string
): { front: string; back: string } | null => {
  if (!CLOZE_RE.test(raw)) return null;
  CLOZE_RE.lastIndex = 0;
  const answers: string[] = [];
  const masked = raw.replace(CLOZE_RE, (_m, _n, content) => {
    answers.push(content);
    return '[...]';
  });
  const front = stripHtmlOnly(masked);
  const back = stripHtmlOnly(answers.join(' / '));
  if (!front || !back) return null;
  return { front, back };
};

const splitDelimited = (line: string, delimiter: string): string[] => {
  if (delimiter !== ',') return line.split(delimiter);
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === delimiter) {
        out.push(cur);
        cur = '';
      } else cur += ch;
    }
  }
  out.push(cur);
  return out;
};

const detectDelimiter = (lines: string[]): string => {
  for (const line of lines) {
    if (!line || line.startsWith('#')) continue;
    if (line.includes('\t')) return '\t';
    if (line.includes(';')) return ';';
    if (line.includes(',')) return ',';
    return '\t';
  }
  return '\t';
};

const fieldsToCard = (parts: string[]): ParsedCard | null => {
  const cloze = splitClozeFields(parts.join('\n'));
  if (cloze) {
    const frontRich = extractRich(parts[0] ?? '');
    return {
      front: cloze.front,
      back: cloze.back,
      frontAudioRef: frontRich.firstAudio,
    };
  }

  const rawFront = parts[0] ?? '';
  const frontRich = extractRich(rawFront);
  if (!frontRich.text && !frontRich.firstAudio && frontRich.imageRefs.length === 0) {
    return null;
  }

  for (let i = 1; i < parts.length; i++) {
    const rawBack = parts[i] ?? '';
    const backRich = extractRich(rawBack);
    if (backRich.text || backRich.firstAudio || backRich.imageRefs.length > 0) {
      return {
        front: frontRich.text,
        back: backRich.text,
        frontHtml: frontRich.html,
        backHtml: backRich.html,
        frontAudioRef: frontRich.firstAudio,
        backAudioRef: backRich.firstAudio,
      };
    }
  }
  // Allow front-only cards if they have audio or images
  if (frontRich.firstAudio || frontRich.imageRefs.length > 0) {
    return {
      front: frontRich.text,
      back: '',
      frontHtml: frontRich.html,
      frontAudioRef: frontRich.firstAudio,
    };
  }
  return null;
};

const loadAnkiDb = async (zip: JSZip): Promise<Uint8Array> => {
  const zstdFile = zip.file('collection.anki21b');
  if (zstdFile) {
    const compressed = await zstdFile.async('uint8array');
    return zstdDecompress(compressed);
  }
  const plainFile =
    zip.file('collection.anki21') ?? zip.file('collection.anki2');
  if (!plainFile) {
    throw new Error('Invalid .apkg: missing collection database.');
  }
  return plainFile.async('uint8array');
};

const loadMediaBlobs = async (
  zip: JSZip,
  neededRefs: Map<string, MediaKind>
): Promise<Map<string, MediaBlobEntry>> => {
  const result = new Map<string, MediaBlobEntry>();
  if (neededRefs.size === 0) return result;

  const mediaIndex = zip.file('media');
  if (!mediaIndex) return result;

  let nameToKey: Record<string, string> = {};
  try {
    const text = await mediaIndex.async('string');
    const map = JSON.parse(text) as Record<string, string>;
    for (const [k, v] of Object.entries(map)) {
      if (typeof v === 'string') nameToKey[v] = k;
    }
  } catch (err) {
    console.warn('[AnkiImport] could not parse media index as JSON:', err);
    return result;
  }

  for (const [ref, kind] of neededRefs) {
    const key = nameToKey[ref];
    if (!key) continue;
    const f = zip.file(key);
    if (!f) continue;
    const blob = await f.async('blob');
    result.set(ref, { blob, kind });
  }
  return result;
};

const collectRefs = (cards: ParsedCard[]): Map<string, MediaKind> => {
  const needed = new Map<string, MediaKind>();
  const addAudio = (ref?: string) => {
    if (ref && isAudioFilename(ref)) needed.set(ref, 'audio');
  };
  for (const c of cards) {
    addAudio(c.frontAudioRef);
    addAudio(c.backAudioRef);
    // Scan HTML for media:// refs and classify by extension
    for (const html of [c.frontHtml, c.backHtml]) {
      if (!html) continue;
      const re = /media:\/\/([^"'\s>)]+)/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(html))) {
        const ref = m[1];
        if (needed.has(ref)) continue;
        if (isAudioFilename(ref)) needed.set(ref, 'audio');
        else if (isImageFilename(ref)) needed.set(ref, 'image');
      }
    }
  }
  return needed;
};

export const AnkiImportService = {
  parseTextFile: async (file: File): Promise<ParsedCard[]> => {
    const text = await file.text();
    const lines = text.split(/\r?\n/);
    const delimiter = detectDelimiter(lines);
    const cards: ParsedCard[] = [];

    for (const raw of lines) {
      if (!raw || raw.startsWith('#')) continue;
      const fields = splitDelimited(raw, delimiter);
      const card = fieldsToCard(fields);
      if (card) cards.push(card);
    }

    return cards;
  },

  parseApkg: async (file: File): Promise<ParsedImport> => {
    const zip = await JSZip.loadAsync(file);
    const dbBytes = await loadAnkiDb(zip);
    const SQL = await getSql();
    const database: Database = new SQL.Database(dbBytes);

    try {
      let deckName: string | undefined;
      try {
        const colRes = database.exec('SELECT decks FROM col LIMIT 1');
        const decksJson = String(colRes[0]?.values?.[0]?.[0] ?? '');
        if (decksJson) {
          const decks = JSON.parse(decksJson) as Record<string, { name?: string }>;
          const names = Object.values(decks)
            .map((d) => d?.name)
            .filter((n): n is string => typeof n === 'string' && n.length > 0)
            .filter((n) => n !== 'Default');
          deckName = names[0] ?? Object.values(decks)[0]?.name;
        }
      } catch {
        // ignore
      }
      if (!deckName) {
        try {
          const dRes = database.exec(
            "SELECT name FROM decks WHERE name != 'Default' LIMIT 1"
          );
          const n = String(dRes[0]?.values?.[0]?.[0] ?? '');
          if (n) deckName = n.replace(/\x1f/g, '::');
        } catch {
          // ignore
        }
      }

      const res = database.exec('SELECT flds FROM notes');
      const cards: ParsedCard[] = [];
      let totalNotes = 0;

      if (res.length) {
        for (const row of res[0].values) {
          totalNotes++;
          const flds = String(row[0] ?? '');
          const parts = flds.split(FIELD_SEP);
          const card = fieldsToCard(parts);
          if (card) cards.push(card);
        }
      }

      const neededRefs = collectRefs(cards);
      const mediaBlobs = await loadMediaBlobs(zip, neededRefs);

      if (totalNotes > 0 && cards.length === 0) {
        console.warn(
          `[AnkiImport] Found ${totalNotes} notes but none yielded valid cards.`
        );
      }

      return { deckName, cards, mediaBlobs };
    } finally {
      database.close();
    }
  },

  parseFile: async (file: File): Promise<ParsedImport> => {
    const name = file.name.toLowerCase();
    if (name.endsWith('.apkg') || name.endsWith('.colpkg')) {
      return AnkiImportService.parseApkg(file);
    }
    const cards = await AnkiImportService.parseTextFile(file);
    const baseName = file.name.replace(/\.[^.]+$/, '').trim();
    return {
      deckName: baseName || undefined,
      cards,
      mediaBlobs: new Map(),
    };
  },
};
