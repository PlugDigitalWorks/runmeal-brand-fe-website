import type { PaginationMeta } from './auth';

/** One entry of the signed-in customer's notifications, already in the requested language. */
export interface CustomerNotification {
  id: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationPage {
  data: CustomerNotification[];
  meta: PaginationMeta;
}
