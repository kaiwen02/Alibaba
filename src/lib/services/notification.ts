/**
 * Notification Service
 * 
 * Creates in-app notifications for disruption events and recovery status.
 * Notifications include deep links to the recovery page.
 */

import prisma from '@/lib/db';
import type { NotificationType } from '@prisma/client';

export interface NotificationInput {
  userId: string;
  recoveryCaseId: string;
  type: NotificationType;
  title: string;
  message: string;
}

/**
 * Create a notification for a user
 */
export async function createNotification(input: NotificationInput): Promise<string> {
  const deepLink = `/recovery/${input.recoveryCaseId}`;

  const notification = await prisma.notification.create({
    data: {
      userId: input.userId,
      recoveryCaseId: input.recoveryCaseId,
      type: input.type,
      title: input.title,
      message: input.message,
      deepLink,
    },
  });

  return notification.id;
}

/**
 * Create disruption alert notification
 */
export async function notifyDisruption(
  userId: string,
  recoveryCaseId: string,
  bookingId: string,
  changeType: string,
  severity: string
): Promise<string> {
  const titles: Record<string, string> = {
    CANCELLED: 'Flight Cancelled',
    MATERIAL: 'Significant Schedule Change',
    MINOR: 'Minor Schedule Change',
  };

  const messages: Record<string, string> = {
    CANCELLED: 'Your flight has been cancelled. We have prepared alternative options for you.',
    MATERIAL: 'Your flight schedule has changed significantly. Please review the new options.',
    MINOR: 'Your flight has a minor schedule change. Please check the details.',
  };

  return createNotification({
    userId,
    recoveryCaseId,
    type: 'DISRUPTION_ALERT',
    title: titles[changeType] || 'Flight Disruption',
    message: messages[changeType] || 'Your flight has been disrupted. Please review alternatives.',
  });
}

/**
 * Create package ready notification
 */
export async function notifyPackagesReady(
  userId: string,
  recoveryCaseId: string,
  packageCount: number
): Promise<string> {
  return createNotification({
    userId,
    recoveryCaseId,
    type: 'PACKAGE_READY',
    title: 'Alternatives Ready',
    message: `${packageCount} alternative options have been prepared for your disrupted flight.`,
  });
}

/**
 * Create approval request notification
 */
export async function notifyApprovalRequired(
  userId: string,
  recoveryCaseId: string
): Promise<string> {
  return createNotification({
    userId,
    recoveryCaseId,
    type: 'APPROVAL_REQUEST',
    title: 'Action Required',
    message: 'Please review and confirm your selected alternative to proceed with rebooking.',
  });
}

/**
 * Create ticketing success notification
 */
export async function notifyTicketed(
  userId: string,
  recoveryCaseId: string,
  pnr?: string
): Promise<string> {
  return createNotification({
    userId,
    recoveryCaseId,
    type: 'TICKETED',
    title: 'Rebooking Confirmed',
    message: pnr
      ? `Your new flight has been confirmed. PNR: ${pnr}`
      : 'Your new flight has been confirmed and ticketed.',
  });
}

/**
 * Get unread notifications for a user
 */
export async function getUnreadNotifications(userId: string) {
  return prisma.notification.findMany({
    where: {
      userId,
      read: false,
    },
    orderBy: { sentAt: 'desc' },
    take: 20,
  });
}

/**
 * Mark notification as read
 */
export async function markNotificationRead(notificationId: string, userId: string): Promise<boolean> {
  const result = await prisma.notification.updateMany({
    where: {
      id: notificationId,
      userId,
    },
    data: { read: true },
  });

  return result.count > 0;
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllRead(userId: string): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: {
      userId,
      read: false,
    },
    data: { read: true },
  });

  return result.count;
}
