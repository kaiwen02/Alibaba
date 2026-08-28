import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  getUnreadNotifications,
  markNotificationRead,
  markAllRead,
} from '@/lib/services/notification';

/**
 * GET /api/notifications
 * 
 * Get unread notifications for the current user.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as any).id;
  const notifications = await getUnreadNotifications(userId);

  return NextResponse.json({ notifications });
}

/**
 * POST /api/notifications
 * 
 * Mark notifications as read.
 * Body: { notificationId?: string } - if provided, mark specific; else mark all
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as any).id;
  const body = await req.json().catch(() => ({}));

  if (body.notificationId) {
    const success = await markNotificationRead(body.notificationId, userId);
    return NextResponse.json({ success });
  }

  const count = await markAllRead(userId);
  return NextResponse.json({ marked: count });
}
