export const WEBHOOK_TYPES = ['discord', 'slack', 'ntfy', 'gotify', 'generic'] as const;
export type WebhookType = (typeof WEBHOOK_TYPES)[number];

type NotificationMeta = {
  year?: number;
  overview?: string;
  posterUrl?: string;
};

export type NotificationEvent = NotificationMeta &
  (
    | { type: 'tagged'; itemName: string; libraryLabel: string; days: number }
    | { type: 'untagged'; itemName: string; libraryLabel: string }
    | { type: 'keep_requested'; itemName: string; requestedBy: string }
    | { type: 'nominated'; itemName: string; libraryLabel: string; nominatedBy: string }
  );
