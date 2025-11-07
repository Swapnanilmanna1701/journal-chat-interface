import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { db } from '@/db';
import { userLogs } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { title, content, category, isCompleted } = body;

    if ('userId' in body || 'user_id' in body) {
      return NextResponse.json({ 
        error: "User ID cannot be provided in request body",
        code: "USER_ID_NOT_ALLOWED" 
      }, { status: 400 });
    }

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json({ 
        error: "Title is required and must be a non-empty string",
        code: "MISSING_TITLE" 
      }, { status: 400 });
    }

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json({ 
        error: "Content is required and must be a non-empty string",
        code: "MISSING_CONTENT" 
      }, { status: 400 });
    }

    if (!category || typeof category !== 'string' || category.trim().length === 0) {
      return NextResponse.json({ 
        error: "Category is required and must be a non-empty string",
        code: "MISSING_CATEGORY" 
      }, { status: 400 });
    }

    const now = new Date().toISOString();
    const newLog = await db.insert(userLogs)
      .values({
        userId: session.user.id,
        title: title.trim(),
        content: content.trim(),
        category: category.trim(),
        isCompleted: isCompleted !== undefined ? isCompleted : false,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return NextResponse.json(newLog[0], { status: 201 });
  } catch (error) {
    console.error('POST error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + (error instanceof Error ? error.message : String(error))
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');
    const isCompletedParam = searchParams.get('is_completed');

    const conditions = [eq(userLogs.userId, session.user.id)];

    if (category) {
      conditions.push(eq(userLogs.category, category));
    }

    if (isCompletedParam !== null) {
      const isCompletedValue = isCompletedParam === 'true';
      conditions.push(eq(userLogs.isCompleted, isCompletedValue));
    }

    const logs = await db.select()
      .from(userLogs)
      .where(and(...conditions));

    return NextResponse.json(logs, { status: 200 });
  } catch (error) {
    console.error('GET error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + (error instanceof Error ? error.message : String(error))
    }, { status: 500 });
  }
}