import JSZip from 'jszip';
import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { decompress as zstdDecompress } from 'fzstd';
import { sanitizeRichHtml } from '../lib/sanitize';
import {
  createSanitizeContext,
  sanitizeMediaRef,
  type SanitizeContext,
} from '../lib/media';
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

const extractRich = (input: string, ctx: SanitizeContext): RichExtract => {
  if (!input) {
    return { html: '', text: '', audioRefs: [], imageRefs: [] };
  }

  // Inline cloze contents for non-cloze rendering
  const decloze = input.replace(CLOZE_RE, '$2');

  const audioRefs: string[] = [];
  let firstAudio: string | undefined;
  const withAudio = decloze.replace(SOUND_RE, (_m, fname: string) => {
    const original = fname.trim();
    const safe = sanitizeMediaRef(original, ctx);
    if (!audioRefs.includes(safe)) audioRefs.push(safe);
    if (!firstAudio) firstAudio = safe;
    return `<audio controls src="media://${safe}"></audio>`;
  });

  const imageRefs: string[] = [];
  const withImages = withAudio.replace(IMG_TAG_RE, (full, attrs: string) => {
    const m = attrs.match(SRC_ATTR_RE);
    if (!m) return full;
    const rawSrc = (m[1] ?? m[2] ?? m[3] ?? '').trim();
    if (!rawSrc) return full;
    if (/^(https?:|data:|media:\/\/)/i.test(rawSrc)) return full;
    let original = rawSrc.replace(/^\.\//, '');
    try {
      original = decodeURIComponent(original);
    } catch {
      // keep raw if malformed
    }
    const safe = sanitizeMediaRef(original, ctx);
    if (!imageRefs.includes(safe)) imageRefs.push(safe);
    const newAttrs = attrs.replace(SRC_ATTR_RE, `src="media://${safe}"`);
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

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const audioTagsHtml = (refs: string[]): string =>
  refs.map((r) => `<audio controls src="media://${r}"></audio>`).join('');

const collectAllAudioRefs = (
  parts: string[],
  ctx: SanitizeContext
): { perField: string[][]; all: string[] } => {
  const all: string[] = [];
  const seen = new Set<string>();
  const perField: string[][] = parts.map(() => []);
  for (let i = 0; i < parts.length; i++) {
    const r = extractRich(parts[i] ?? '', ctx);
    perField[i] = r.audioRefs;
    for (const a of r.audioRefs) {
      if (!seen.has(a)) {
        seen.add(a);
        all.push(a);
      }
    }
  }
  return { perField, all };
};

export interface ModelInfo {
  fieldNames: string[];
  /** Field ords that appear in any template's qfmt (front side). */
  frontOrds: Set<number>;
  /** Field ords that appear in any template's afmt (back side), excluding those already on front via {{FrontSide}}. */
  backOnlyOrds: Set<number>;
}

const escapeRegex = (s: string): string =>
  s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const fieldsReferenced = (
  template: string,
  fieldNames: string[]
): Set<number> => {
  const ords = new Set<number>();
  fieldNames.forEach((name, ord) => {
    if (!name) return;
    const re = new RegExp(`\\{\\{[^}]*?\\b${escapeRegex(name)}\\b[^}]*?\\}\\}`);
    if (re.test(template)) ords.add(ord);
  });
  return ords;
};

const buildModelInfo = (
  fieldNames: string[],
  tmpls: Array<{ qfmt: string; afmt: string }>
): ModelInfo => {
  const frontOrds = new Set<number>();
  const backAllOrds = new Set<number>();
  for (const t of tmpls) {
    const qOrds = fieldsReferenced(t.qfmt, fieldNames);
    const aOrds = fieldsReferenced(t.afmt, fieldNames);
    qOrds.forEach((o) => frontOrds.add(o));
    aOrds.forEach((o) => backAllOrds.add(o));
    if (/\{\{FrontSide\}\}/.test(t.afmt)) {
      qOrds.forEach((o) => backAllOrds.add(o));
    }
  }
  const backOnlyOrds = new Set<number>();
  backAllOrds.forEach((o) => {
    if (!frontOrds.has(o)) backOnlyOrds.add(o);
  });
  return { fieldNames, frontOrds, backOnlyOrds };
};

const fieldsToCard = (
  parts: string[],
  ctx: SanitizeContext,
  model: ModelInfo | null
): ParsedCard | null => {
  const cloze = splitClozeFields(parts.join('\n'));
  if (cloze) {
    const seen = new Set<string>();
    const allAudios: string[] = [];
    for (const p of parts) {
      const r = extractRich(p ?? '', ctx);
      for (const a of r.audioRefs) {
        if (!seen.has(a)) {
          seen.add(a);
          allAudios.push(a);
        }
      }
    }
    const audioBlock = audioTagsHtml(allAudios);
    const frontHtml = sanitizeRichHtml(`<p>${escapeHtml(cloze.front)}</p>${audioBlock}`);
    const backHtml = sanitizeRichHtml(`<p>${escapeHtml(cloze.back)}</p>${audioBlock}`);
    return { front: cloze.front, back: cloze.back, frontHtml, backHtml };
  }

  // Model-driven routing — accurate per Anki template.
  // Skip when there are no back-only fields (e.g. multi-template reverse notes),
  // where the heuristic gives better results than a front-only card.
  if (model && model.frontOrds.size > 0 && model.backOnlyOrds.size > 0) {
    const frontHtmlParts: string[] = [];
    const backHtmlParts: string[] = [];
    const frontTexts: string[] = [];
    const backTexts: string[] = [];
    for (let ord = 0; ord < parts.length; ord++) {
      const raw = parts[ord] ?? '';
      if (!raw) continue;
      const r = extractRich(raw, ctx);
      if (model.frontOrds.has(ord)) {
        if (r.html) frontHtmlParts.push(r.html);
        if (r.text) frontTexts.push(r.text);
      } else if (model.backOnlyOrds.has(ord)) {
        if (r.html) backHtmlParts.push(r.html);
        if (r.text) backTexts.push(r.text);
      }
    }
    const frontHtml = sanitizeRichHtml(frontHtmlParts.join(''));
    const backHtml = sanitizeRichHtml(backHtmlParts.join(''));
    const front = frontTexts.join(' ').trim();
    const back = backTexts.join(' ').trim();
    if (!front && !frontHtml && !back && !backHtml) return null;
    return { front, back, frontHtml, backHtml };
  }

  // Fallback heuristic (when model info is missing):
  //   parts[0] = front, first non-empty parts[i>=1] = back,
  //   extras (audios in other fields) go to FRONT — most Anki vocab decks
  //   keep audio with the term on front.
  const { perField, all: allAudios } = collectAllAudioRefs(parts, ctx);
  const rawFront = parts[0] ?? '';
  const frontRich = extractRich(rawFront, ctx);
  if (!frontRich.text && !frontRich.firstAudio && frontRich.imageRefs.length === 0) {
    return null;
  }

  let backIdx = -1;
  let backRichResult: ReturnType<typeof extractRich> | null = null;
  for (let i = 1; i < parts.length; i++) {
    const r = extractRich(parts[i] ?? '', ctx);
    if (r.text || r.firstAudio || r.imageRefs.length > 0) {
      backIdx = i;
      backRichResult = r;
      break;
    }
  }

  const audiosUsed = new Set<string>([
    ...perField[0],
    ...(backIdx >= 0 ? perField[backIdx] : []),
  ]);
  const extraAudios = allAudios.filter((a) => !audiosUsed.has(a));
  const extraTags = audioTagsHtml(extraAudios);

  if (backRichResult) {
    const frontHtml = extraTags
      ? sanitizeRichHtml(frontRich.html + extraTags)
      : frontRich.html;
    return {
      front: frontRich.text,
      back: backRichResult.text,
      frontHtml,
      backHtml: backRichResult.html,
    };
  }

  if (frontRich.firstAudio || frontRich.imageRefs.length > 0) {
    return {
      front: frontRich.text,
      back: '',
      frontHtml: frontRich.html,
    };
  }
  return null;
};

// CardTemplateConfig proto: field 1 = q_format (string), field 2 = a_format (string)
const readTemplateConfig = (buf: Uint8Array): { qfmt: string; afmt: string } => {
  const out = { qfmt: '', afmt: '' };
  const decoder = new TextDecoder('utf-8');
  let p = 0;
  while (p < buf.length) {
    const [tag, p1] = readVarint(buf, p);
    p = p1;
    const wireType = tag & 0x07;
    const fieldNum = tag >>> 3;
    if (wireType === 2) {
      const [len, p2] = readVarint(buf, p);
      p = p2;
      const slice = buf.subarray(p, p + len);
      p += len;
      if (fieldNum === 1) out.qfmt = decoder.decode(slice);
      else if (fieldNum === 2) out.afmt = decoder.decode(slice);
    } else if (wireType === 0) {
      const [, p2] = readVarint(buf, p);
      p = p2;
    } else if (wireType === 1) {
      p += 8;
    } else if (wireType === 5) {
      p += 4;
    } else {
      break;
    }
  }
  return out;
};

const loadModels = (db: Database): Map<string, ModelInfo> => {
  const result = new Map<string, ModelInfo>();

  // V2: col.models JSON
  try {
    const res = db.exec('SELECT models FROM col LIMIT 1');
    const json = String(res[0]?.values?.[0]?.[0] ?? '');
    if (json && json !== '{}') {
      const models = JSON.parse(json) as Record<string, any>;
      for (const [id, m] of Object.entries(models)) {
        const fieldNames: string[] = ((m.flds ?? []) as any[])
          .slice()
          .sort((a, b) => (a?.ord ?? 0) - (b?.ord ?? 0))
          .map((f) => String(f?.name ?? ''));
        const tmpls = ((m.tmpls ?? []) as any[]).map((t) => ({
          qfmt: String(t?.qfmt ?? ''),
          afmt: String(t?.afmt ?? ''),
        }));
        result.set(id, buildModelInfo(fieldNames, tmpls));
      }
    }
  } catch (err) {
    console.warn('[AnkiImport] could not parse col.models JSON:', err);
  }
  if (result.size > 0) return result;

  // V3: notetypes + fields + templates tables
  try {
    const fieldsByNt = new Map<string, Array<{ ord: number; name: string }>>();
    const fres = db.exec('SELECT ntid, ord, name FROM fields');
    if (fres.length) {
      for (const row of fres[0].values) {
        const ntid = String(row[0]);
        const ord = Number(row[1]);
        const name = String(row[2] ?? '');
        const arr = fieldsByNt.get(ntid) ?? [];
        arr.push({ ord, name });
        fieldsByNt.set(ntid, arr);
      }
    }
    const tmplsByNt = new Map<string, Array<{ qfmt: string; afmt: string }>>();
    const tres = db.exec('SELECT ntid, ord, config FROM templates');
    if (tres.length) {
      for (const row of tres[0].values) {
        const ntid = String(row[0]);
        const cfg = row[2];
        if (!(cfg instanceof Uint8Array)) continue;
        const arr = tmplsByNt.get(ntid) ?? [];
        arr.push(readTemplateConfig(cfg));
        tmplsByNt.set(ntid, arr);
      }
    }
    for (const [ntid, flds] of fieldsByNt) {
      flds.sort((a, b) => a.ord - b.ord);
      const fieldNames = flds.map((f) => f.name);
      const tmpls = tmplsByNt.get(ntid) ?? [];
      result.set(ntid, buildModelInfo(fieldNames, tmpls));
    }
  } catch (err) {
    console.warn('[AnkiImport] could not parse V3 notetypes tables:', err);
  }

  return result;
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

const ZSTD_MAGIC = [0x28, 0xb5, 0x2f, 0xfd];

const hasZstdMagic = (b: Uint8Array): boolean =>
  b.length >= 4 &&
  b[0] === ZSTD_MAGIC[0] &&
  b[1] === ZSTD_MAGIC[1] &&
  b[2] === ZSTD_MAGIC[2] &&
  b[3] === ZSTD_MAGIC[3];

const mimeFromName = (name: string): string => {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  switch (ext) {
    case 'mp3': return 'audio/mpeg';
    case 'ogg': case 'opus': return 'audio/ogg';
    case 'wav': return 'audio/wav';
    case 'm4a': case 'mp4': return 'audio/mp4';
    case 'webm': return 'audio/webm';
    case 'aac': return 'audio/aac';
    case 'flac': return 'audio/flac';
    case 'png': return 'image/png';
    case 'jpg': case 'jpeg': return 'image/jpeg';
    case 'gif': return 'image/gif';
    case 'webp': return 'image/webp';
    case 'svg': return 'image/svg+xml';
    case 'bmp': return 'image/bmp';
    case 'avif': return 'image/avif';
    default: return 'application/octet-stream';
  }
};

const readMediaEntry = async (
  zip: JSZip,
  key: string
): Promise<Uint8Array | null> => {
  let entry = zip.file(key);
  let forceDecompress = false;
  if (!entry) {
    entry = zip.file(`${key}.zst`);
    if (entry) forceDecompress = true;
  } else if (entry.name.endsWith('.zst')) {
    forceDecompress = true;
  }
  if (!entry) return null;
  const bytes = await entry.async('uint8array');
  if (forceDecompress || hasZstdMagic(bytes)) {
    try {
      return zstdDecompress(bytes);
    } catch (err) {
      console.warn('[AnkiImport] zstd decompress failed for', key, err);
      return null;
    }
  }
  return bytes;
};

/**
 * Modern .apkg (V3 / anki21b) stores the `media` index as protobuf
 * `MediaEntries { repeated MediaEntry entries = 1 }` where
 * `MediaEntry { string name = 1; uint32 size = 2; bytes sha1 = 3 }`.
 * The zip filename for each entry is its zero-based index.
 */
const readVarint = (buf: Uint8Array, pos: number): [number, number] => {
  let value = 0;
  let shift = 0;
  let p = pos;
  while (p < buf.length) {
    const b = buf[p++];
    value += (b & 0x7f) * Math.pow(2, shift);
    if ((b & 0x80) === 0) return [value, p];
    shift += 7;
    if (shift > 49) break;
  }
  return [value, p];
};

const decodeMediaEntriesProto = (buf: Uint8Array): string[] => {
  const out: string[] = [];
  const decoder = new TextDecoder('utf-8');
  let p = 0;
  while (p < buf.length) {
    const [tag, p1] = readVarint(buf, p);
    p = p1;
    const wireType = tag & 0x07;
    const fieldNum = tag >>> 3;
    if (fieldNum === 1 && wireType === 2) {
      const [len, p2] = readVarint(buf, p);
      p = p2;
      const entry = buf.subarray(p, p + len);
      p += len;
      let ep = 0;
      let name = '';
      while (ep < entry.length) {
        const [etag, ep1] = readVarint(entry, ep);
        ep = ep1;
        const ewire = etag & 0x07;
        const efield = etag >>> 3;
        if (efield === 1 && ewire === 2) {
          const [elen, ep2] = readVarint(entry, ep);
          ep = ep2;
          name = decoder.decode(entry.subarray(ep, ep + elen));
          ep += elen;
        } else if (ewire === 0) {
          const [, ep2] = readVarint(entry, ep);
          ep = ep2;
        } else if (ewire === 2) {
          const [elen, ep2] = readVarint(entry, ep);
          ep = ep2 + elen;
        } else if (ewire === 1) {
          ep += 8;
        } else if (ewire === 5) {
          ep += 4;
        } else {
          break;
        }
      }
      out.push(name);
    } else if (wireType === 0) {
      const [, p2] = readVarint(buf, p);
      p = p2;
    } else if (wireType === 2) {
      const [len, p2] = readVarint(buf, p);
      p = p2 + len;
    } else if (wireType === 1) {
      p += 8;
    } else if (wireType === 5) {
      p += 4;
    } else {
      break;
    }
  }
  return out;
};

const buildNameToKey = async (
  mediaIndex: JSZip.JSZipObject
): Promise<Record<string, string>> => {
  const bytes = await mediaIndex.async('uint8array');
  // Legacy: JSON {key: filename}
  try {
    const text = new TextDecoder('utf-8').decode(bytes);
    const map = JSON.parse(text) as Record<string, string>;
    const nameToKey: Record<string, string> = {};
    for (const [k, v] of Object.entries(map)) {
      if (typeof v === 'string') nameToKey[v] = k;
    }
    return nameToKey;
  } catch {
    // fall through to proto
  }
  // Modern: protobuf MediaEntries (optionally zstd-compressed)
  const protoBytes = hasZstdMagic(bytes) ? zstdDecompress(bytes) : bytes;
  try {
    const names = decodeMediaEntriesProto(protoBytes);
    const nameToKey: Record<string, string> = {};
    names.forEach((name, idx) => {
      if (name) nameToKey[name] = String(idx);
    });
    return nameToKey;
  } catch (err) {
    console.warn('[AnkiImport] could not parse media index as proto:', err);
    return {};
  }
};

const loadMediaBlobs = async (
  zip: JSZip,
  neededRefs: Map<string, MediaKind>,
  ctx: SanitizeContext
): Promise<Map<string, MediaBlobEntry>> => {
  const result = new Map<string, MediaBlobEntry>();
  if (neededRefs.size === 0) return result;

  const mediaIndex = zip.file('media');
  if (!mediaIndex) return result;

  const nameToKey = await buildNameToKey(mediaIndex);

  for (const [safeRef, kind] of neededRefs) {
    const originalRef = ctx.safeToOriginal.get(safeRef) ?? safeRef;
    const key = nameToKey[originalRef];
    if (!key) {
      console.warn(
        '[AnkiImport] media entry not found in index:',
        originalRef,
        '(safe:',
        safeRef,
        ')'
      );
      continue;
    }
    const bytes = await readMediaEntry(zip, key);
    if (!bytes) {
      console.warn('[AnkiImport] media file not found in zip:', originalRef, '→', key);
      continue;
    }
    const blob = new Blob([bytes], { type: mimeFromName(safeRef) });
    result.set(safeRef, { blob, kind });
  }
  return result;
};

const decodeRef = (raw: string): string => {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
};

const collectRefsFromHtml = (
  html: string,
  out: Map<string, MediaKind>
): void => {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  doc.querySelectorAll('img').forEach((el) => {
    const src = el.getAttribute('src') ?? '';
    const m = src.match(/^media:\/\/(.+)$/);
    if (!m) return;
    const ref = decodeRef(m[1]);
    if (!out.has(ref)) out.set(ref, 'image');
  });
  doc.querySelectorAll('audio, source').forEach((el) => {
    const src = el.getAttribute('src') ?? '';
    const m = src.match(/^media:\/\/(.+)$/);
    if (!m) return;
    const ref = decodeRef(m[1]);
    if (!out.has(ref)) out.set(ref, 'audio');
  });
};

const collectRefs = (cards: ParsedCard[]): Map<string, MediaKind> => {
  const needed = new Map<string, MediaKind>();
  const addAudio = (ref?: string) => {
    if (ref && isAudioFilename(ref)) needed.set(ref, 'audio');
  };
  for (const c of cards) {
    addAudio(c.frontAudioRef);
    addAudio(c.backAudioRef);
    if (c.frontHtml) collectRefsFromHtml(c.frontHtml, needed);
    if (c.backHtml) collectRefsFromHtml(c.backHtml, needed);
  }
  return needed;
};

export const AnkiImportService = {
  parseTextFile: async (file: File): Promise<ParsedCard[]> => {
    const text = await file.text();
    const lines = text.split(/\r?\n/);
    const delimiter = detectDelimiter(lines);
    const cards: ParsedCard[] = [];
    const ctx = createSanitizeContext();

    for (const raw of lines) {
      if (!raw || raw.startsWith('#')) continue;
      const fields = splitDelimited(raw, delimiter);
      const card = fieldsToCard(fields, ctx, null);
      if (card) cards.push(card);
    }

    return cards;
  },

  parseApkg: async (file: File): Promise<ParsedImport> => {
    const zip = await JSZip.loadAsync(file);
    const dbBytes = await loadAnkiDb(zip);
    const SQL = await getSql();
    const database: Database = new SQL.Database(dbBytes);
    const ctx = createSanitizeContext();

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

      const models = loadModels(database);
      const res = database.exec('SELECT mid, flds FROM notes');
      const cards: ParsedCard[] = [];
      let totalNotes = 0;

      if (res.length) {
        for (const row of res[0].values) {
          totalNotes++;
          const mid = String(row[0] ?? '');
          const flds = String(row[1] ?? '');
          const parts = flds.split(FIELD_SEP);
          const model = models.get(mid) ?? null;
          const card = fieldsToCard(parts, ctx, model);
          if (card) cards.push(card);
        }
      }

      const neededRefs = collectRefs(cards);
      const mediaBlobs = await loadMediaBlobs(zip, neededRefs, ctx);

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
