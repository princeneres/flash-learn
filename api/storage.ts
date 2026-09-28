// Media storage on Neon object storage (S3-compatible). The browser never holds
// S3 credentials: it asks this function for short-lived presigned URLs and talks
// to the bucket directly with them. Authorization mirrors the old storage RLS:
//   * objects live under `{uid}/…` and only that user may write or delete them;
//   * `media` (private) is readable by its owner, or by anyone when the object is
//     referenced by a card in a public deck (card_media);
//   * `avatars` is a public bucket, so uploads return the object's public URL.
//
// Env:
//   S3_ENDPOINT, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY

import {
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getUser, json, readJson, sql } from './_lib/server.js';

const BUCKETS = ['media', 'avatars'] as const;
type Bucket = (typeof BUCKETS)[number];

const UPLOAD_URL_TTL_SEC = 60 * 10;
const DOWNLOAD_URL_TTL_SEC = 60 * 60 * 24 * 7; // SigV4 maximum
const MAX_DELETE = 1000;

const endpoint = (process.env.S3_ENDPOINT ?? '').replace(/\/+$/, '');

const s3 = new S3Client({
  endpoint,
  region: process.env.S3_REGION,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
  },
});

type Body =
  | { action: 'upload-url'; bucket: Bucket; path: string; contentType?: string }
  | { action: 'download-url'; bucket: 'media'; path: string }
  | { action: 'delete'; bucket: Bucket; paths: string[] };

const isBucket = (b: unknown): b is Bucket => BUCKETS.includes(b as Bucket);

// `{uid}/…` with no traversal or empty segments.
const isValidPath = (path: unknown): path is string =>
  typeof path === 'string' &&
  path.length <= 512 &&
  path.split('/').every((seg) => seg !== '' && seg !== '.' && seg !== '..');

const ownerOf = (path: string) => path.split('/')[0];

/** A `media` object of another user is readable when a public deck references it. */
async function isPublicMedia(path: string): Promise<boolean> {
  const [owner, kind, ...rest] = path.split('/');
  const ref = rest.join('/');
  const rows = await sql`
    select 1
    from public.card_media cm
    join public.cards c on c.id = cm.card_id
    join public.decks d on d.id = c.deck_id
    where d.is_public
      and cm.owner_id::text = ${owner}
      and cm.kind = ${kind}
      and cm.ref = ${ref}
    limit 1
  `;
  return rows.length > 0;
}

export async function POST(req: Request) {
  const user = await getUser(req);
  if (!user) return json({ error: 'Unauthorized' }, 401);

  const body = await readJson<Body>(req);
  if (!body || !isBucket(body.bucket)) return json({ error: 'Invalid request' }, 400);

  switch (body.action) {
    case 'upload-url': {
      if (!isValidPath(body.path) || ownerOf(body.path) !== user.id) {
        return json({ error: 'Forbidden' }, 403);
      }
      const url = await getSignedUrl(
        s3,
        new PutObjectCommand({
          Bucket: body.bucket,
          Key: body.path,
          ContentType: body.contentType || undefined,
        }),
        { expiresIn: UPLOAD_URL_TTL_SEC },
      );
      const publicUrl =
        body.bucket === 'avatars' ? `${endpoint}/${body.bucket}/${body.path}` : undefined;
      return json({ url, publicUrl });
    }

    case 'download-url': {
      if (body.bucket !== 'media' || !isValidPath(body.path)) {
        return json({ error: 'Invalid request' }, 400);
      }
      if (ownerOf(body.path) !== user.id && !(await isPublicMedia(body.path))) {
        return json({ error: 'Forbidden' }, 403);
      }
      const url = await getSignedUrl(
        s3,
        new GetObjectCommand({ Bucket: body.bucket, Key: body.path }),
        { expiresIn: DOWNLOAD_URL_TTL_SEC },
      );
      return json({ url, expiresIn: DOWNLOAD_URL_TTL_SEC });
    }

    case 'delete': {
      const paths = Array.isArray(body.paths) ? body.paths : [];
      if (
        paths.length === 0 ||
        paths.length > MAX_DELETE ||
        !paths.every((p) => isValidPath(p) && ownerOf(p) === user.id)
      ) {
        return json({ error: 'Forbidden' }, 403);
      }
      await s3.send(
        new DeleteObjectsCommand({
          Bucket: body.bucket,
          Delete: { Objects: paths.map((Key) => ({ Key })), Quiet: true },
        }),
      );
      return json({ ok: true });
    }

    default:
      return json({ error: 'Unknown action' }, 400);
  }
}
