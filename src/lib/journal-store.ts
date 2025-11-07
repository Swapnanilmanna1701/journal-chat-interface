export interface JournalEntry {
  id: string;
  content: string;
  category: string;
  timestamp: number;
}

class JournalStore {
  private entries: JournalEntry[] = [];

  addEntry(content: string, category: string): JournalEntry {
    const entry: JournalEntry = {
      id: Math.random().toString(36).substring(7),
      content,
      category,
      timestamp: Date.now(),
    };
    this.entries.push(entry);
    return entry;
  }

  queryEntries(category?: string): JournalEntry[] {
    if (category) {
      return this.entries.filter(
        (entry) => entry.category.toLowerCase() === category.toLowerCase()
      );
    }
    return this.entries;
  }

  getAllEntries(): JournalEntry[] {
    return this.entries;
  }
}

// Server-side singleton
export const journalStore = new JournalStore();
