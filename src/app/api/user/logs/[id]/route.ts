import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { db } from '@/db';
import { userLogs } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication check
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session || !session.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Extract and validate ID
    const { id } = await context.params;
    const logId = parseInt(id);

    if (isNaN(logId)) {
      return NextResponse.json(
        { error: 'Valid ID is required', code: 'INVALID_ID' },
        { status: 400 }
      );
    }

    // Fetch log by id AND userId for security
    const log = await db
      .select()
      .from(userLogs)
      .where(and(eq(userLogs.id, logId), eq(userLogs.userId, session.user.id)))
      .limit(1);

    if (log.length === 0) {
      return NextResponse.json(
        { error: 'Log not found', code: 'LOG_NOT_FOUND' },
        { status: 404 }
      );
    }

    return NextResponse.json(log[0], { status: 200 });
  } catch (error) {
    console.error('GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + (error as Error).message },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication check
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session || !session.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Extract and validate ID
    const { id } = await context.params;
    const logId = parseInt(id);

    if (isNaN(logId)) {
      return NextResponse.json(
        { error: 'Valid ID is required', code: 'INVALID_ID' },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { title, content, category, isCompleted } = body;

    // Validate updatable fields
    if (title !== undefined && (typeof title !== 'string' || title.trim() === '')) {
      return NextResponse.json(
        { error: 'Title must be a non-empty string', code: 'INVALID_TITLE' },
        { status: 400 }
      );
    }

    if (content !== undefined && (typeof content !== 'string' || content.trim() === '')) {
      return NextResponse.json(
        { error: 'Content must be a non-empty string', code: 'INVALID_CONTENT' },
        { status: 400 }
      );
    }

    if (category !== undefined && (typeof category !== 'string' || category.trim() === '')) {
      return NextResponse.json(
        { error: 'Category must be a non-empty string', code: 'INVALID_CATEGORY' },
        { status: 400 }
      );
    }

    // Build update object with only provided fields
    const updates: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (title !== undefined) updates.title = title.trim();
    if (content !== undefined) updates.content = content.trim();
    if (category !== undefined) updates.category = category.trim();
    if (isCompleted !== undefined) updates.isCompleted = Boolean(isCompleted);

    // Update log with userId filter for security
    const updated = await db
      .update(userLogs)
      .set(updates)
      .where(and(eq(userLogs.id, logId), eq(userLogs.userId, session.user.id)))
      .returning();

    if (updated.length === 0) {
      return NextResponse.json(
        { error: 'Log not found', code: 'LOG_NOT_FOUND' },
        { status: 404 }
      );
    }

    return NextResponse.json(updated[0], { status: 200 });
  } catch (error) {
    console.error('PUT error:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + (error as Error).message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication check
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session || !session.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Extract and validate ID
    const { id } = await context.params;
    const logId = parseInt(id);

    if (isNaN(logId)) {
      return NextResponse.json(
        { error: 'Valid ID is required', code: 'INVALID_ID' },
        { status: 400 }
      );
    }

    // Delete log with userId filter for security
    const deleted = await db
      .delete(userLogs)
      .where(and(eq(userLogs.id, logId), eq(userLogs.userId, session.user.id)))
      .returning();

    if (deleted.length === 0) {
      return NextResponse.json(
        { error: 'Log not found', code: 'LOG_NOT_FOUND' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        message: 'Log deleted successfully',
        deletedLog: deleted[0],
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + (error as Error).message },
      { status: 500 }
    );
  }
}