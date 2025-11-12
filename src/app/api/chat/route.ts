import { streamText, convertToCoreMessages } from 'ai';
import { google } from '@ai-sdk/google';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

export const maxDuration = 30;

export async function POST(req: Request) {
  // Get session from request headers
  const session = await auth.api.getSession({ headers: await headers() });
  
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const userId = session.user.id;
  const { messages, category } = await req.json();

  // Get bearer token from Authorization header
  const authHeader = req.headers.get('Authorization');
  const bearerToken = authHeader?.replace('Bearer ', '');

  if (!bearerToken) {
    return new Response('Bearer token required', { status: 401 });
  }

  // Use category from request body
  const categoryFilter = category;

  // Fetch user logs with optional category filter
  const logsUrl = categoryFilter && categoryFilter !== 'all'
    ? `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/user/logs?category=${categoryFilter}`
    : `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/user/logs`;

  const logsResponse = await fetch(logsUrl, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${bearerToken}`,
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

  const result = streamText({
    model: google('gemini-2.0-flash-exp'),
    messages: convertToCoreMessages(messages),
    system: `You are a helpful journal assistant that STRICTLY operates within the boundaries of the user's journal entries.

🔒 CRITICAL RULES - FOLLOW EXACTLY:

1. ✅ YOU CAN ONLY answer questions about information that EXISTS in the user's logs provided below
2. ✅ YOU MUST use natural language understanding to match queries with log content intelligently
3. ✅ YOU CAN add new journal entries when users want to create logs, reminders, notes, shopping items, or todos
4. ❌ YOU CANNOT provide information that is NOT in the user's logs - no external knowledge, no assumptions, no hallucinations
5. ❌ YOU CANNOT answer general knowledge questions, math problems, coding help, news, weather, or anything outside journaling
6. ❌ YOU CANNOT make up or infer information that isn't explicitly in the logs

RESPONSE RULES:
- When answering about logs: Use ONLY the information from the logs context below
- When user asks about something NOT in their logs: Respond EXACTLY with "I don't have information regarding that in your journal logs."
- When user asks non-journaling questions (math, general knowledge, etc.): Respond EXACTLY with "I'm only a journaling assistant. I can only help with your journal entries and logs."
- Be conversational and helpful, but NEVER make up information
- If logs are empty and user asks a question: Say "You don't have any journal entries yet. Would you like to create one?"

MATCHING QUERIES TO LOGS:
- Use semantic understanding: "grocery" matches "groceries", "buy milk" matches shopping lists with milk
- Match by title, content, and category
- Consider synonyms and related terms
- When multiple entries match, list them all clearly

FORMAT FOR SHOWING ENTRIES:
- Each entry on a new line starting with a dash (-)
- Include category in square brackets: [shopping]
- Include status in parentheses: (completed) or (pending)
- Include title and content

CATEGORY FILTERING:
${categoryFilter && categoryFilter !== 'all' ? `⚠️ IMPORTANT: User is filtering by "${categoryFilter}" category. ONLY show and discuss entries from this category. Ignore all other categories.` : '- Show all entries when answering unless user specifies a category'}

YOUR CAPABILITIES:
✅ Add journal entries (logs, reminders, notes, recommendations, todos, shopping lists)
✅ Query and retrieve journal entries
✅ Answer questions about existing journal entries using the context below
✅ Organize entries by categories

YOUR LIMITATIONS:
❌ Cannot answer questions about things not in the journal
❌ Cannot provide general knowledge or external information
❌ Cannot do math, coding, or other non-journaling tasks

${logsContext}

REMEMBER: Your ENTIRE knowledge is limited to the logs listed above. Nothing else exists in your world. If information isn't in those logs, you DON'T KNOW IT.`,
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
                'Authorization': `Bearer ${bearerToken}`,
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
                'Authorization': `Bearer ${bearerToken}`,
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

  return result.toDataStreamResponse();
}