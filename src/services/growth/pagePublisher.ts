/**
 * pagePublisher — actually posts to the Facebook page, and reads back what it earned.
 *
 * WHY THIS EXISTS NOW. `pagePostWriter` has drafted posts since July, and every one of them had to
 * be published by hand. That was correct while the token had no rights; it stopped being correct on
 * 28 Aug 2026 when the owner added the "Manage everything on your Page" use case and regenerated the
 * system-user token with `pages_manage_posts` + `pages_read_user_content`. Verified the same day: a
 * deliberately empty POST to /feed came back `(#197) The post is empty` — a content complaint, not a
 * permission one.
 *
 * It matters more than convenience. The page's failure mode is not bad posts, it is NO posts: 17 in
 * six years, and nothing at all since 27 June 2024. The manual step is the step that keeps failing,
 * so leaving it manual would be designing around the known break.
 *
 * TWO CALLS, NOT ONE. A Facebook photo album is not a single request: each photo is uploaded to
 * /photos with `published:false`, which returns a media id, and then ONE /feed post carries the
 * caption plus `attached_media`. Doing it the other way — a caption with several photo urls — is
 * what produces a single-photo post, and single photos are precisely the weak format this page's own
 * record argues against (its five best posts are all albums; every single-photo post sits at four
 * reactions or below).
 *
 * PAGE TOKEN, NOT THE SYSTEM-USER TOKEN. /feed and /photos both refuse the system-user token with
 * `(#190) This method must be called with a Page Access Token`. The page token is derived per call
 * from me/accounts — never stored, so nothing goes stale.
 *
 * Never throws: a Graph failure comes back as `{ok:false,error}`, same discipline as the rest of the
 * Meta client. Server-only.
 */
import { loggers } from '@/lib/logger';
import { resolveAdContext } from './metaAds/adContext';

const logger = loggers.ads;
const GRAPH = 'https://graph.facebook.com/v25.0';

export interface PublishResult {
  ok: boolean;
  postId?: string;
  error?: string;
}

export interface PostEngagement {
  postId: string;
  reactions: number;
  comments: number;
  shares: number;
  createdTime?: string;
  permalink?: string;
  /**
   * The caption as it stands ON FACEBOOK, which is not always what we published. The owner edited
   * the first real post directly on the page after publishing, leaving our record holding the draft
   * text while the page showed his. Any loop that learns which captions worked has to read the words
   * that actually ran.
   */
  message?: string;
}

/**
 * The page token for a property's page, derived fresh from the system-user token.
 * Returns undefined when the property has no page, or the system user cannot act on it.
 */
async function pageToken(propertyId: string): Promise<{ token: string; pageId: string } | undefined> {
  const ctx = await resolveAdContext(propertyId);
  if (!ctx?.pageId) {
    logger.warn('pagePublisher: no page configured', { propertyId });
    return undefined;
  }
  try {
    const res = await fetch(
      `${GRAPH}/me/accounts?fields=id,access_token&access_token=${encodeURIComponent(ctx.token)}`
    );
    const json = (await res.json()) as { data?: Array<{ id: string; access_token: string }> };
    const match = (json.data ?? []).find((a) => a.id === String(ctx.pageId));
    if (!match) {
      logger.warn('pagePublisher: system user cannot act on this page', { propertyId, pageId: ctx.pageId });
      return undefined;
    }
    return { token: match.access_token, pageId: String(ctx.pageId) };
  } catch (error) {
    logger.error('pagePublisher: deriving page token failed', error as Error, { propertyId });
    return undefined;
  }
}

/**
 * Publish one post: N photos as an album, plus the caption.
 *
 * `photoUrls` must be publicly fetchable — Meta pulls them itself, so a signed or short-lived URL
 * that expires between our call and theirs produces a post with missing images. Firebase Storage
 * download URLs are stable and fine.
 *
 * Partial upload is treated as fatal on purpose: publishing three of five photos would silently
 * produce a worse post than the one that was reviewed and approved.
 */
export async function publishPagePost(
  propertyId: string,
  input: {
    message: string;
    photoUrls: string[];
    /**
     * Unix seconds. When set, Meta holds the post and publishes it itself — 10 minutes to 6 months
     * ahead. Deliberately Meta's scheduler rather than our own cron: it survives our infrastructure
     * being down, and the queue is visible in Meta's Publishing Tools as a second pair of eyes on
     * what is about to go out in the owner's name.
     */
    scheduledPublishTime?: number;
  }
): Promise<PublishResult> {
  const page = await pageToken(propertyId);
  if (!page) return { ok: false, error: 'no-page-token' };
  if (!input.photoUrls.length) return { ok: false, error: 'no-photos' };
  if (!input.message.trim()) return { ok: false, error: 'empty-message' };

  try {
    // 1. Upload each photo UNPUBLISHED. Each returns a media id, not a visible post.
    const mediaIds: string[] = [];
    for (const url of input.photoUrls) {
      const res = await fetch(`${GRAPH}/${page.pageId}/photos`, {
        method: 'POST',
        body: new URLSearchParams({ url, published: 'false', access_token: page.token }),
      });
      const json = (await res.json()) as { id?: string; error?: { message?: string } };
      if (!res.ok || !json.id) {
        logger.error('pagePublisher: photo upload failed', undefined, {
          propertyId,
          url,
          error: json.error?.message,
        });
        return { ok: false, error: `photo-upload-failed: ${json.error?.message ?? res.status}` };
      }
      mediaIds.push(json.id);
    }

    // 2. ONE feed post carrying the caption and every uploaded photo.
    const body = new URLSearchParams({ message: input.message, access_token: page.token });
    mediaIds.forEach((id, i) => body.append(`attached_media[${i}]`, JSON.stringify({ media_fbid: id })));
    if (input.scheduledPublishTime) {
      // `published=false` WITH a time means scheduled. Without the time it would mean a hidden draft
      // that never goes out on its own — a silent failure that looks exactly like success.
      body.set('published', 'false');
      body.set('scheduled_publish_time', String(input.scheduledPublishTime));
    }

    const res = await fetch(`${GRAPH}/${page.pageId}/feed`, { method: 'POST', body });
    const json = (await res.json()) as { id?: string; error?: { message?: string } };
    if (!res.ok || !json.id) {
      logger.error('pagePublisher: feed post failed', undefined, { propertyId, error: json.error?.message });
      return { ok: false, error: `feed-post-failed: ${json.error?.message ?? res.status}` };
    }

    logger.info('pagePublisher: published', {
      propertyId, postId: json.id, photos: mediaIds.length,
      scheduledFor: input.scheduledPublishTime ?? null,
    });
    return { ok: true, postId: json.id };
  } catch (error) {
    logger.error('pagePublisher: publish threw', error as Error, { propertyId });
    return { ok: false, error: 'internal-error' };
  }
}

/**
 * Read reactions/comments/shares for posts we published.
 *
 * This is the half that makes the strategy self-correcting rather than a guess. The page has earned
 * exactly ONE comment in six years, and it landed on the one caption that spoke to a person instead
 * of describing a property — a fact nobody could act on until the API could be read at all.
 *
 * Batched into a single Graph call by id; a post deleted on the page simply comes back absent rather
 * than failing the batch.
 */
export async function fetchPostEngagement(
  propertyId: string,
  postIds: string[]
): Promise<{ ok: boolean; data?: PostEngagement[]; error?: string }> {
  if (!postIds.length) return { ok: true, data: [] };
  const page = await pageToken(propertyId);
  if (!page) return { ok: false, error: 'no-page-token' };

  try {
    const url = new URL(`${GRAPH}/`);
    url.searchParams.set('ids', postIds.join(','));
    url.searchParams.set(
      'fields',
      'created_time,permalink_url,message,reactions.summary(true),comments.summary(true),shares'
    );
    url.searchParams.set('access_token', page.token);

    const res = await fetch(url.toString());
    const json = (await res.json()) as Record<string, unknown> & { error?: { message?: string } };
    if (!res.ok) {
      logger.warn('pagePublisher: engagement read failed', { propertyId, error: json.error?.message });
      return { ok: false, error: json.error?.message ?? `status-${res.status}` };
    }

    const data: PostEngagement[] = [];
    for (const id of postIds) {
      const row = json[id] as
        | {
            created_time?: string;
            permalink_url?: string;
            message?: string;
            reactions?: { summary?: { total_count?: number } };
            comments?: { summary?: { total_count?: number } };
            shares?: { count?: number };
          }
        | undefined;
      if (!row) continue;
      data.push({
        postId: id,
        reactions: row.reactions?.summary?.total_count ?? 0,
        comments: row.comments?.summary?.total_count ?? 0,
        shares: row.shares?.count ?? 0,
        createdTime: row.created_time,
        permalink: row.permalink_url,
        message: row.message,
      });
    }
    return { ok: true, data };
  } catch (error) {
    logger.error('pagePublisher: engagement read threw', error as Error, { propertyId });
    return { ok: false, error: 'internal-error' };
  }
}
