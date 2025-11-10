'use server';

import { generateText, convertToCoreMessages } from 'ai';
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
  const sessionToken = session.session.token;

  // Extract category filter from the last message if present
  let categoryFilter = null;
  const lastMessage = messages[messages.length - 1];
  if (lastMessage?.content) {
    const match = lastMessage.content.match(/\[Filtering by (\w+) category\]/);
    if (match) {
      categoryFilter = match[1];
      // Remove the filter prefix for processing
      lastMessage.content = lastMessage.content.replace(/\[Filtering by \w+ category\]\s*/, '');
    }
  }

  // Fetch user logs with optional category filter
  const logsUrl = categoryFilter && categoryFilter !== 'all'
    ? `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/user/logs?category=${categoryFilter}`
    : `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/user/logs`;

  const logsResponse = await fetch(logsUrl, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${sessionToken}`,
    },
  });

  let userLogs = [];
  if (logsResponse.ok) {
    userLogs = await logsResponse.json();
  }

  // Create context from user's logs
  const logsContext = userLogs.length > 0
    ? `\n\nUser's Current Logs${categoryFilter && categoryFilter !== 'all' ? ` (filtered by ${categoryFilter} category)` : ''}:\n${userLogs.map((log: any) => 
        `- [${log.category}] ${log.title}: ${log.content} ${log.isCompleted ? '(completed)' : '(pending)'}`
      ).join('\n')}`
    : categoryFilter && categoryFilter !== 'all'
    ? `\n\nUser has no logs in the ${categoryFilter} category yet.`
    : '\n\nUser has no logs yet.';

  const result = await generateText({
    model: google('gemini-2.0-flash-exp', {
      apiKey: 'AIzaSyAB_4BN3Peo5sfruvJIAYIZpKRIncHhZNQ',
    }),
    messages: convertToCoreMessages(messages),
    system: `You are a helpful journal assistant. You can ONLY help with journaling tasks and answer questions about the user's journal entries.

Your capabilities are LIMITED to:
1. Adding journal entries (logs, reminders, notes, recommendations, todo items, shopping lists)
2. Querying and retrieving journal entries
3. Organizing entries by categories (shopping, reminders, recommendations, todo, note, etc.)
4. Answering questions about the user's existing journal entries using natural language understanding

IMPORTANT RULES:
- ONLY answer questions related to the user's journal entries listed below
- For questions about entries, carefully analyze the title and content/description to provide accurate, helpful answers
- Use natural language understanding to match user queries with log content (e.g., "grocery" matches "groceries", "buy milk" matches shopping lists with milk)
- If the user asks about something that's NOT in their journal entries, respond EXACTLY with: "I don't have information regarding that."
- For ANY other request (math calculations, general knowledge, coding help, news, weather, jokes, etc.), respond EXACTLY with: "I don't have information regarding that."
- Stay strictly within your journaling domain - you are NOT a general-purpose assistant
- Be conversational, helpful, and concise when answering about journal entries
- When multiple entries match a query, list them all
- Respect category filters - if filtering by a category, only discuss entries from that category

When a user wants to add an entry, use the addJournalEntry function.
When a user wants to query entries, use the queryJournalEntries function.
When answering questions, use the context from the user's logs provided below.

${logsContext}${categoryFilter && categoryFilter !== 'all' ? `\n\nIMPORTANT: The user is currently filtering by the ${categoryFilter} category. Only show and discuss entries from this category.` : ''}`,
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
            const url = category 
              ? `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/user/logs?category=${encodeURIComponent(category.toLowerCase())}`
              : `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/user/logs`;
            
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

  return result.text;
}