"use client";

import { useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2, Upload, User, ArrowLeft, Plus, Edit2, Trash2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Log = {
  id: number;
  title: string;
  content: string;
  category: string;
  isCompleted: boolean;
  createdAt: string;
  updatedAt: string;
};

export default function ProfilePage() {
  const { data: session, isPending, refetch } = useSession();
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [logs, setLogs] = useState<Log[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<Log | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    category: "todo",
  });
  const [filterCategory, setFilterCategory] = useState<string>("all");

  useEffect(() => {
    if (!isPending && !session?.user) {
      router.push("/login");
    }
  }, [session, isPending, router]);

  useEffect(() => {
    const fetchProfile = async () => {
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
        console.error("Failed to fetch profile:", error);
      } finally {
        setIsLoadingProfile(false);
      }
    };

    fetchProfile();
  }, [session]);

  const fetchLogs = async () => {
    if (!session?.user) return;
    
    try {
      const token = localStorage.getItem("bearer_token");
      const url = filterCategory === "all" 
        ? "/api/user/logs" 
        : `/api/user/logs?category=${filterCategory}`;
      
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setLogs(data);
      } else {
        toast.error("Failed to fetch logs");
      }
    } catch (error) {
      console.error("Failed to fetch logs:", error);
      toast.error("Failed to fetch logs");
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [session, filterCategory]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.match(/^image\/(jpeg|jpg|png|gif|webp)$/)) {
      toast.error("Please upload a valid image file (JPEG, PNG, GIF, or WebP)");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size must be less than 5MB");
      return;
    }

    setIsUploading(true);

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64String = event.target?.result as string;

        const token = localStorage.getItem("bearer_token");
        const response = await fetch("/api/user/profile/photo", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ imageData: base64String }),
        });

        if (response.ok) {
          const data = await response.json();
          setProfileImage(data.user.image);
          await refetch();
          toast.success("Profile photo uploaded successfully!");
        } else {
          const error = await response.json();
          toast.error(error.error || "Failed to upload photo");
        }
      };

      reader.onerror = () => {
        toast.error("Failed to read file");
      };

      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload photo");
    } finally {
      setIsUploading(false);
    }
  };

  const handleCreateLog = () => {
    setEditingLog(null);
    setFormData({ title: "", content: "", category: "todo" });
    setIsDialogOpen(true);
  };

  const handleEditLog = (log: Log) => {
    setEditingLog(log);
    setFormData({
      title: log.title,
      content: log.content,
      category: log.category,
    });
    setIsDialogOpen(true);
  };

  const handleSaveLog = async () => {
    if (!formData.title.trim() || !formData.content.trim()) {
      toast.error("Title and content are required");
      return;
    }

    try {
      const token = localStorage.getItem("bearer_token");
      const url = editingLog 
        ? `/api/user/logs/${editingLog.id}` 
        : "/api/user/logs";
      
      const response = await fetch(url, {
        method: editingLog ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        toast.success(editingLog ? "Log updated successfully!" : "Log created successfully!");
        setIsDialogOpen(false);
        fetchLogs();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to save log");
      }
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Failed to save log");
    }
  };

  const handleToggleComplete = async (log: Log) => {
    try {
      const token = localStorage.getItem("bearer_token");
      const response = await fetch(`/api/user/logs/${log.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isCompleted: !log.isCompleted }),
      });

      if (response.ok) {
        toast.success(log.isCompleted ? "Marked as incomplete" : "Marked as complete");
        fetchLogs();
      } else {
        toast.error("Failed to update log");
      }
    } catch (error) {
      console.error("Toggle error:", error);
      toast.error("Failed to update log");
    }
  };

  const handleDeleteLog = async (logId: number) => {
    if (!confirm("Are you sure you want to delete this log?")) return;

    try {
      const token = localStorage.getItem("bearer_token");
      const response = await fetch(`/api/user/logs/${logId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        toast.success("Log deleted successfully!");
        fetchLogs();
      } else {
        toast.error("Failed to delete log");
      }
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete log");
    }
  };

  if (isPending || isLoadingProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session?.user) {
    return null;
  }

  const categories = ["todo", "shopping", "reminder", "note", "recommendation"];

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Profile</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage your profile and logs
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Profile Card */}
          <div className="md:col-span-1 bg-card border border-border rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-foreground mb-6">Profile Info</h2>
            
            <div className="flex flex-col items-center gap-6">
              <div className="relative">
                <div className="w-32 h-32 rounded-full bg-secondary flex items-center justify-center overflow-hidden border-4 border-border">
                  {profileImage ? (
                    <img
                      src={profileImage}
                      alt="Profile"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-16 h-16 text-muted-foreground" />
                  )}
                </div>
                {isUploading && (
                  <div className="absolute inset-0 rounded-full bg-background/80 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                )}
              </div>

              <div className="flex flex-col items-center gap-2">
                <label htmlFor="photo-upload">
                  <Button
                    variant="outline"
                    disabled={isUploading}
                    className="cursor-pointer"
                    asChild
                  >
                    <span>
                      <Upload className="w-4 h-4 mr-2" />
                      {profileImage ? "Change Photo" : "Upload Photo"}
                    </span>
                  </Button>
                </label>
                <input
                  id="photo-upload"
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                  disabled={isUploading}
                />
                <p className="text-xs text-muted-foreground text-center">
                  JPG, PNG, GIF or WebP. Max 5MB.
                </p>
              </div>
            </div>

            <div className="border-t border-border pt-6 mt-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground">Name</label>
                <p className="mt-1 text-sm text-muted-foreground">{session.user.name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Email</label>
                <p className="mt-1 text-sm text-muted-foreground">{session.user.email}</p>
              </div>
            </div>
          </div>

          {/* Logs Section */}
          <div className="md:col-span-2 bg-card border border-border rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-foreground">My Logs</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Create and manage your journal logs
                </p>
              </div>
              <Button onClick={handleCreateLog} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                New Log
              </Button>
            </div>

            {/* Filter */}
            <div className="mb-4">
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Logs List */}
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {isLoadingLogs ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : logs.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">No logs yet. Create your first log!</p>
                </div>
              ) : (
                logs.map((log) => (
                  <div
                    key={log.id}
                    className="border border-border rounded-lg p-4 hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <button
                          onClick={() => handleToggleComplete(log)}
                          className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                            log.isCompleted
                              ? "bg-primary border-primary"
                              : "border-muted-foreground/30 hover:border-primary"
                          }`}
                        >
                          {log.isCompleted && <Check className="w-3 h-3 text-primary-foreground" />}
                        </button>
                        <div className="flex-1">
                          <h3
                            className={`font-medium text-foreground ${
                              log.isCompleted ? "line-through opacity-60" : ""
                            }`}
                          >
                            {log.title}
                          </h3>
                          <p
                            className={`text-sm text-muted-foreground mt-1 ${
                              log.isCompleted ? "line-through opacity-60" : ""
                            }`}
                          >
                            {log.content}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs bg-secondary px-2 py-1 rounded">
                              {log.category}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(log.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditLog(log)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteLog(log.id)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingLog ? "Edit Log" : "Create New Log"}</DialogTitle>
            <DialogDescription>
              {editingLog ? "Update your log details" : "Add a new log to your journal"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Title
              </label>
              <Input
                placeholder="Enter log title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Content
              </label>
              <Textarea
                placeholder="Enter log content"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                rows={4}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Category
              </label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveLog}>
              {editingLog ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}