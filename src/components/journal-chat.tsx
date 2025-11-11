'use client';

import { useState, useEffect } from 'react';
import { continueConversation } from '@/app/actions/journal';
import { Send, Loader2, LogOut, User, UserCircle, Filter, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { authClient, useSession } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

type Category = 'all' | 'todo' | 'shopping' | 'reminder' | 'note' | 'recommendation';

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-4 py-3">
      <div className="flex gap-1">
        <div 
          className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce"
          style={{ animationDelay: '0ms', animationDuration: '1.4s' }}
        />
        <div 
          className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce"
          style={{ animationDelay: '200ms', animationDuration: '1.4s' }}
        />
        <div 
          className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce"
          style={{ animationDelay: '400ms', animationDuration: '1.4s' }}
        />
      </div>
    </div>
  );
}

export function JournalChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category>('all');
  const { data: session, refetch } = useSession();
  const router = useRouter();

  const categories: { value: Category; label: string; color: string }[] = [
    { value: 'all', label: 'All Categories', color: 'bg-primary/10 text-primary hover:bg-primary/20' },
    { value: 'todo', label: 'To Do', color: 'bg-blue-500/10 text-blue-600 hover:bg-blue-500/20' },
    { value: 'shopping', label: 'Shopping', color: 'bg-green-500/10 text-green-600 hover:bg-green-500/20' },
    { value: 'reminder', label: 'Reminder', color: 'bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20' },
    { value: 'note', label: 'Note', color: 'bg-purple-500/10 text-purple-600 hover:bg-purple-500/20' },
    { value: 'recommendation', label: 'Recommendation', color: 'bg-pink-500/10 text-pink-600 hover:bg-pink-500/20' },
  ];

  // Fetch profile image
  useEffect(() => {
    const fetchProfileImage = async () => {
      if (!session?.user) return;
      
      try {
        const token = localStorage.getItem("bearer_token");
        const response = await fetch("/api/user/profile", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setProfileImage(data.image);
        }
      } catch (error) {
        console.error("Failed to fetch profile image:", error);
      }
    };

    fetchProfileImage();
  }, [session]);

  const handleSignOut = async () => {
    const { error } = await authClient.signOut();
    if (error?.code) {
      toast.error('Failed to sign out');
    } else {
      localStorage.removeItem('bearer_token');
      refetch();
      router.push('/login');
      toast.success('Signed out successfully');
    }
  };

  const handleCategorySelect = (category: Category) => {
    setSelectedCategory(category);
    const categoryLabel = categories.find(c => c.value === category)?.label || 'all';
    
    if (category !== 'all') {
      toast.success(`Filtering by ${categoryLabel} category`);
    } else {
      toast.success('Showing all categories');
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!input.trim() || isLoading) return;

    // Get bearer token from localStorage
    const token = localStorage.getItem("bearer_token");
    if (!token) {
      toast.error("Authentication required. Please log in again.");
      router.push("/login");
      return;
    }

    let userInput = input.trim();
    
    // Add category context if specific category is selected
    if (selectedCategory !== 'all') {
      userInput = `[Filtering by ${selectedCategory} category] ${userInput}`;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(), // Display original input without category prefix
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const newMessages = [...messages, { ...userMessage, content: userInput }]; // Send with category context
      const response = await continueConversation(newMessages, token);

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="p-[2px] rounded-lg bg-gradient-to-r from-[#808080] via-[#C0C0C0] to-[#808080] shadow-lg">
        <div className="flex flex-col h-[600px] w-full max-w-3xl bg-card rounded-lg">
          {/* Header */}
          <div className="border-b border-border px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-foreground">Journal Assistant</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Add entries like "Remind me to buy eggs" or ask "What's on my shopping list?"
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full h-10 w-10">
                  {profileImage ? (
                    <img
                      src={profileImage}
                      alt="Profile"
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <User className="h-5 w-5" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{session?.user?.name}</p>
                    <p className="text-xs text-muted-foreground">{session?.user?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push('/profile')} className="cursor-pointer">
                  <UserCircle className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Category Filter Bar */}
          <div className="border-b border-border px-6 py-3 bg-muted/30">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Filter by Category:</span>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat.value}
                    onClick={() => handleCategorySelect(cat.value)}
                    className={cn(
                      'px-3 py-1 rounded-full text-xs font-medium transition-all',
                      cat.color,
                      selectedCategory === cat.value && 'ring-2 ring-offset-1 ring-offset-card'
                    )}
                  >
                    {cat.label}
                    {selectedCategory === cat.value && cat.value !== 'all' && (
                      <X className="inline-block ml-1 w-3 h-3" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Send className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-medium text-foreground">Start Journaling</h3>
                  <p className="text-sm text-muted-foreground mt-2 max-w-md">
                    Select a category above and try saying:
                  </p>
                  <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                    <li>• "Remind me to buy eggs next time I'm at the supermarket"</li>
                    <li>• "Alice says I should check out Kritunga for their biryani"</li>
                    <li>• "What is my shopping list?"</li>
                    <li>• "I'm at the supermarket. What should I buy?"</li>
                    <li>• "What are my pending todos?"</li>
                  </ul>
                </div>
              </div>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  'flex',
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                <div
                  className={cn(
                    'max-w-[80%] rounded-lg px-4 py-3 shadow-sm',
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground'
                  )}
                >
                  <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-lg shadow-sm bg-muted text-foreground">
                  <TypingIndicator />
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-border px-6 py-4">
            {selectedCategory !== 'all' && (
              <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                <Filter className="w-3 h-3" />
                <span>
                  Asking about <span className="font-medium text-foreground">{categories.find(c => c.value === selectedCategory)?.label}</span> logs
                </span>
              </div>
            )}
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={selectedCategory !== 'all' 
                  ? `Ask about ${categories.find(c => c.value === selectedCategory)?.label.toLowerCase()} logs...`
                  : "Type your message..."}
                disabled={isLoading}
                className="flex-1 rounded-lg border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}