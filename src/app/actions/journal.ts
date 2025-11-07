'use server';

import { streamText, convertToCoreMessages } from 'ai';
import { google } from '@ai-sdk/google';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

export async function continueConversation(messages: any[]) {
  // Get authenticated user session
  const session = await auth.api.getSession({ headers: await headers() });
  
  if (!session || !session.user?.id) {
    throw new Error('Authentication required');
  }

  const userId = session.user.id;

  const result = await streamText({
    model: google('gemini-2.0-flash-exp'),
    messages: convertToCoreMessages(messages),
    system: `You are a helpful journal assistant. You can ONLY help with journaling tasks.

Your capabilities are LIMITED to:
1. Adding journal entries (logs, reminders, notes, recommendations)
2. Querying and retrieving journal entries
3. Organizing entries by categories (shopping, reminders, recommendations, todo, note, etc.)

For ANY other request (math, general knowledge, coding, etc.), you MUST respond with:
"I'm only a journaling app. I can't help with [topic]. I can only help you manage your journal entries, reminders, and notes."

When a user wants to add an entry, use the addJournalEntry function.
When a user wants to query entries, use the queryJournalEntries function.

Be conversational and helpful, but stay strictly within your journaling domain.`,
    tools: {
      addJournalEntry: {
        description: 'Add a new entry to the journal. Use this when the user wants to log something, create a reminder, or save a note.',
        parameters: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: 'A short title or summary of the journal entry',
            },
            content: {
              type: 'string',
              description: 'The detailed content of the journal entry',
            },
            category: {
              type: 'string',
              description: 'Category of the entry (e.g., shopping, reminder, recommendation, note, todo)',
            },
          },
          required: ['title', 'content', 'category'],
        },
        execute: async ({ title, content, category }: { title: string; content: string; category: string }) => {
          try {
            // Get session token from the authenticated session
            const sessionToken = session.session.token;
            
            // Call the API to create a log
            const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/user/logs`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionToken}`,
              },
              body: JSON.stringify({
                title,
                content,
                category: category.toLowerCase(),
              }),
            });

            if (!response.ok) {
              const error = await response.json();
              return {
                success: false,
                message: `Failed to add entry: ${error.error || 'Unknown error'}`,
              };
            }

            const entry = await response.json();
            return {
              success: true,
              message: `Added to ${category}: ${title}`,
              entry: {
                id: entry.id,
                title: entry.title,
                content: entry.content,
                category: entry.category,
              },
            };
          } catch (error) {
            console.error('Error adding journal entry:', error);
            return {
              success: false,
              message: 'Failed to add journal entry due to an error.',
            };
          }
        },
      },
      queryJournalEntries: {
        description: 'Query journal entries by category or search all entries. Use this when the user asks about their entries.',
        parameters: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              description: 'Category to filter by (e.g., shopping, reminder, todo, note). Leave empty to get all entries.',
            },
          },
        },
        execute: async ({ category }: { category?: string }) => {
          try {
            // Get session token from the authenticated session
            const sessionToken = session.session.token;
            
            // Build API URL with optional category filter
            const url = category 
              ? `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/user/logs?category=${encodeURIComponent(category.toLowerCase())}`
              : `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/user/logs`;
            
            // Call the API to fetch logs
            const response = await fetch(url, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${sessionToken}`,
              },
            });

            if (!response.ok) {
              const error = await response.json();
              return {
                success: false,
                message: `Failed to fetch entries: ${error.error || 'Unknown error'}`,
                entries: [],
              };
            }

            const entries = await response.json();

            if (entries.length === 0) {
              return {
                success: true,
                entries: [],
                message: category 
                  ? `No entries found in the ${category} category.`
                  : 'No journal entries yet.',
              };
            }

            return {
              success: true,
              entries: entries.map((e: any) => ({
                id: e.id,
                title: e.title,
                content: e.content,
                category: e.category,
                isCompleted: e.isCompleted,
                createdAt: e.createdAt,
              })),
              count: entries.length,
            };
          } catch (error) {
            console.error('Error querying journal entries:', error);
            return {
              success: false,
              message: 'Failed to query journal entries due to an error.',
              entries: [],
            };
          }
        },
      },
    },
    maxSteps: 5,
  });

  // Return the full text response
  return result.text;
}