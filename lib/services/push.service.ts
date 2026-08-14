import webpush from "web-push";

import { pushSubscriptionRepository } from "@/lib/repositories/push-subscription.repository";
import {
  PushSubscriptionInput,
  PushSubscriptionRecord,
} from "@/lib/db/models/push-subscription.model";
import { logger } from "@/lib/logger";

/**
 * What a service worker receives and turns into an OS notification.
 *
 * Kept small on purpose: a push payload has a size limit, and everything here
 * is already stored as a notification row — this is the copy that pops up, not
 * the record.
 */
export interface PushPayload {
  title: string;
  body: string;
  href?: string | null;
  tag?: string;
}

/**
 * Whether push is configured at all.
 *
 * Both keys or neither: signing with half a pair fails at the push service
 * with an error that reads like a subscription problem. Exported so the UI can
 * say "not configured" rather than offering a switch that cannot work.
 */
export function isPushConfigured(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

let configured = false;

/**
 * Applies the VAPID details once, lazily.
 *
 * `web-push` holds them in module state, and setting them at import time would
 * throw during the build, where the environment is not necessarily present.
 */
function ensureConfigured(): boolean {
  if (configured) {
    return true;
  }

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!publicKey || !privateKey) {
    return false;
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:noreply@financeflow.app",
    publicKey,
    privateKey,
  );

  configured = true;

  return true;
}

/**
 * A subscription the push service says is gone for good.
 *
 * 404 and 410 mean the browser has discarded it — permission revoked, the app
 * uninstalled, the profile wiped. Anything else (a timeout, a 500 at Apple or
 * Google) is transient and must **not** delete the row, or one bad afternoon
 * would silently unsubscribe the household.
 */
function isGone(error: unknown): boolean {
  const status = (error as { statusCode?: number })?.statusCode;

  return status === 404 || status === 410;
}

export class PushService {
  async subscribe(
    userId: string,
    subscription: PushSubscriptionInput,
    userAgent?: string,
  ): Promise<void> {
    await pushSubscriptionRepository.upsert({
      userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      userAgent: userAgent?.slice(0, 255) ?? null,
    });
  }

  async unsubscribe(endpoint: string): Promise<void> {
    await pushSubscriptionRepository.deleteByEndpoint(endpoint);
  }

  async hasSubscription(userId: string): Promise<boolean> {
    const subscriptions = await pushSubscriptionRepository.listForUser(userId);

    return subscriptions.length > 0;
  }

  /**
   * Pushes a payload to every device the given people have registered.
   *
   * **Never throws.** It is called after notifications have already been
   * written, and those are the record — a push that fails is a missed pop-up,
   * not lost information. That is the whole reason the rows exist.
   *
   * Dead subscriptions are pruned as they are discovered, which is the only
   * way they ever get cleaned up: nothing tells the server that somebody
   * uninstalled the app.
   */
  async sendToUsers(userIds: string[], payload: PushPayload): Promise<number> {
    if (userIds.length === 0 || !ensureConfigured()) {
      return 0;
    }

    let delivered = 0;

    try {
      const subscriptions = await pushSubscriptionRepository.listForUsers(userIds);
      const gone: string[] = [];

      await Promise.all(
        subscriptions.map(async (subscription) => {
          try {
            await this.send(subscription, payload);
            delivered += 1;
          } catch (error) {
            if (isGone(error)) {
              gone.push(subscription.endpoint);
              return;
            }

            logger.warn("Push delivery failed", {
              endpoint: subscription.endpoint.slice(0, 60),
              statusCode: (error as { statusCode?: number })?.statusCode,
            });
          }
        }),
      );

      if (gone.length > 0) {
        await pushSubscriptionRepository.deleteByEndpoints(gone);
        logger.info("Pruned expired push subscriptions", { count: gone.length });
      }
    } catch (error) {
      logger.error("Push dispatch failed", error);
    }

    return delivered;
  }

  private async send(subscription: PushSubscriptionRecord, payload: PushPayload): Promise<void> {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload),
      { TTL: 60 * 60 * 24 },
    );
  }
}

export const pushService = new PushService();
