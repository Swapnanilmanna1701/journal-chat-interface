'use server';

import { streamText, convertToCoreMessages } from 'ai';
import { google } from '@ai-sdk/google';

// In-memory storage for journal entries
const journalEntries: Array<{
  id: string;
  content: string;
  category: string;
  timestamp: Date;
}> = [];

export async function continueConversation(messages: any[]) {
  const result = await streamText({
    model: google('gemini-2.0-flash-exp'),
    messages: convertToCoreMessages(messages),
    system: `You are a helpful journal assistant. You can ONLY help with journaling tasks.

Your capabilities are LIMITED to:
1. Adding journal entries (logs, reminders, notes, recommendations)
2. Querying and retrieving journal entries
3. Organizing entries by categories (shopping, reminders, recommendations, etc.)

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
            content: {
              type: 'string',
              description: 'The content of the journal entry',
            },
            category: {
              type: 'string',
              description: 'Category of the entry (e.g., shopping, reminder, recommendation, note)',
            },
          },
          required: ['content', 'category'],
        },
        execute: async ({ content, category }: { content: string; category: string }) => {
          const entry = {
            id: Date.now().toString(),
            content,
            category: category.toLowerCase(),
            timestamp: new Date(),
          };
          journalEntries.push(entry);
          return {
            success: true,
            message: `Added to ${category}: ${content}`,
            entry,
          };
        },
      },
      queryJournalEntries: {
        description: 'Query journal entries by category or search all entries. Use this when the user asks about their entries.',
        parameters: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              description: 'Category to filter by (e.g., shopping, reminder). Leave empty to get all entries.',
            },
          },
        },
        execute: async ({ category }: { category?: string }) => {
          let entries = journalEntries;
          
          if (category) {
            entries = journalEntries.filter(
              entry => entry.category.toLowerCase() === category.toLowerCase()
            );
          }

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
            entries: entries.map(e => ({
              content: e.content,
              category: e.category,
              timestamp: e.timestamp.toISOString(),
            })),
            count: entries.length,
          };
        },
      },
    },
    maxSteps: 5,
  });

  // Return the full text response
  return result.text;
}