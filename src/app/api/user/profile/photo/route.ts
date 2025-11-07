import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { db } from '@/db';
import { user } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Authentication check
    const session = await auth.api.getSession({ headers: await headers() });
    
    if (!session || !session.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { imageData } = body;

    // Validate imageData is provided
    if (!imageData) {
      return NextResponse.json(
        { error: 'Image data is required' },
        { status: 400 }
      );
    }

    // Validate imageData is a string
    if (typeof imageData !== 'string') {
      return NextResponse.json(
        { error: 'Image data must be a string' },
        { status: 400 }
      );
    }

    // Validate base64 format and allowed image types
    const base64ImageRegex = /^data:image\/(jpeg|jpg|png|gif|webp);base64,/;
    
    if (!base64ImageRegex.test(imageData)) {
      return NextResponse.json(
        { 
          error: 'Invalid image format. Must be a base64 encoded image with one of the following formats: jpeg, jpg, png, gif, webp' 
        },
        { status: 400 }
      );
    }

    // Update user's profile image
    const updatedUser = await db
      .update(user)
      .set({ 
        image: imageData,
        updatedAt: new Date()
      })
      .where(eq(user.id, session.user.id))
      .returning();

    // Check if user was found and updated
    if (updatedUser.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        message: 'Profile photo uploaded successfully',
        user: updatedUser[0]
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('POST /api/upload-profile-photo error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error: ' + (error instanceof Error ? error.message : 'Unknown error')
      },
      { status: 500 }
    );
  }
}