'use server';

import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { z } from 'zod';
import { journalStore } from '@/lib/journal-store';

const addJournalEntryTool = {
  description: 'Add a new entry to the journal with a specific category',
  parameters: z.object({
    content: z.string().describe('The content of the journal entry'),
    category: z.string().describe('The category of the entry (e.g., shopping, reminder, recommendation, note)'),
  }),
};

const queryJournalEntresTool = {
  description: 'Query and retrieve journal entries by category or get all entries',
  parameters: z.object({
    category: z.string().optional().describe('Optional category to filter entries (e.g., shopping, reminder, recommendation)'),
  }),
};

export async function sendMessage(userMessage: string) {
  try {
    const result = await generateText({
      model: openai('gpt-4o-mini'),
      system: `You are a helpful journaling assistant. Your ONLY purpose is to help users manage their journal entries.

You can:
- Add new journal entries with appropriate categories (shopping, reminder, recommendation, note, etc.)
- Query and retrieve journal entries by category
- Help users organize their thoughts and reminders

You CANNOT:
- Perform mathematical calculations
- Answer general knowledge questions
- Provide information outside of journaling functionality
- Engage in conversations unrelated to journaling

When a user asks something outside your scope, politely remind them: "I'm only a journaling app. I can help you add entries to your journal or retrieve them, but I can't help with [their request]."

Categories to use:
- "shopping" for grocery lists and shopping reminders
- "reminder" for general reminders
- "recommendation" for suggestions and recommendations from others
- "note" for general notes

Always extract key information from natural language and categorize appropriately.`,
      prompt: userMessage,
      tools: {
        addJournalEntry: addJournalEntryTool,
        queryJournalEntries: queryJournalEntresTool,
      },
      maxSteps: 5,
    });

    // Execute tool calls if any
    if (result.toolCalls && result.toolCalls.length > 0) {
      for (const toolCall of result.toolCalls) {
        if (toolCall.toolName === 'addJournalEntry') {
          const { content, category } = toolCall.args as { content: string; category: string };
          journalStore.addEntry(content, category);
        } else if (toolCall.toolName === 'queryJournalEntries') {
          const { category } = toolCall.args as { category?: string };
          journalStore.queryEntries(category);
        }
      }
    }

    return {
      success: true,
      message: result.text,
      toolCalls: result.toolCalls,
    };
  } catch (error) {
    console.error('Error in sendMessage:', error);
    return {
      success: false,
      message: 'Sorry, I encountered an error processing your request.',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function getJournalEntries(category?: string) {
  return journalStore.queryEntries(category);
}
