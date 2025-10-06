import { useState, useRef, useCallback } from "react";
import { useMutation, useAction, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";

interface MessageComposerProps {
  onSendMessage: (text: string, attachments?: any[], linkPreviews?: any[]) => void;
  placeholder?: string;
  workspaceId: Id<"workspaces">;
  channelId?: Id<"channels"> | null;
  dmId?: Id<"directMessages"> | null;
}

export function MessageComposer({ onSendMessage, placeholder = "Type a message...", workspaceId, channelId, dmId }: MessageComposerProps) {
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showChannelAutocomplete, setShowChannelAutocomplete] = useState(false);
  const [showUserAutocomplete, setShowUserAutocomplete] = useState(false);
  const [channelQuery, setChannelQuery] = useState("");
  const [userQuery, setUserQuery] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const generateUploadUrl = useMutation(api.messages.generateUploadUrl);
  const fetchMetadata = useAction(api.linkPreviews.fetchMetadata);
  const channels = useQuery(api.channels.list, { workspaceId });
  const channel = useQuery(api.channels.get, channelId ? { channelId } : "skip");
  const dm = useQuery(api.directMessages.get, dmId ? { dmId } : "skip");
  const workspaceMembers = useQuery(api.workspaces.getMembers, { workspaceId });
  const channelMembers = useQuery(api.channels.getMembers, channelId ? { channelId } : "skip");
  
  const availableUsers = channelId 
    ? (channel?.isPrivate ? channelMembers : workspaceMembers)
    : (dmId ? dm?.participants : workspaceMembers);

  const extractUrls = (text: string): string[] => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.match(urlRegex) || [];
  };

  // Auto-resize textarea
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!message.trim() && attachments.length === 0) return;

    setUploading(true);
    try {
      let uploadedAttachments: any[] = [];

      // Upload files
      if (attachments.length > 0) {
        uploadedAttachments = await Promise.all(
          attachments.map(async (file) => {
            const uploadUrl = await generateUploadUrl();
            
            const result = await fetch(uploadUrl, {
              method: "POST",
              headers: { "Content-Type": file.type },
              body: file,
            });

            if (!result.ok) {
              throw new Error(`Upload failed: ${result.statusText}`);
            }

            const { storageId } = await result.json();
            
            return {
              storageId,
              filename: file.name,
              mimeType: file.type,
              size: file.size,
            };
          })
        );
      }

      // Fetch link previews
      const urls = extractUrls(message);
      const linkPreviews = await Promise.all(
        urls.map(url => fetchMetadata({ url }).catch(() => null))
      ).then(results => results.filter(Boolean));

      onSendMessage(message, uploadedAttachments, linkPreviews);
      setMessage("");
      setAttachments([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      adjustTextareaHeight();
    } catch (error) {
      toast.error("Failed to send message");
    } finally {
      setUploading(false);
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
  };

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;
    
    const fileArray = Array.from(files);
    const validFiles = fileArray.filter(file => {
      // Check file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`File ${file.name} is too large. Maximum size is 10MB.`);
        return false;
      }
      return true;
    });
    
    setAttachments(prev => [...prev, ...validFiles]);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((showChannelAutocomplete || showUserAutocomplete) && (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter")) {
      e.preventDefault();
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit(e as any);
    }
    if (e.key === "Escape") {
      setShowChannelAutocomplete(false);
      setShowUserAutocomplete(false);
    }
  };

  const insertChannel = (channelName: string) => {
    const cursorPos = textareaRef.current?.selectionStart || 0;
    const textBeforeCursor = message.slice(0, cursorPos);
    const textAfterCursor = message.slice(cursorPos);
    const lastHashIndex = textBeforeCursor.lastIndexOf('#');
    
    const newText = textBeforeCursor.slice(0, lastHashIndex) + `#${channelName} ` + textAfterCursor;
    setMessage(newText);
    setShowChannelAutocomplete(false);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const insertUser = (userEmail: string) => {
    const cursorPos = textareaRef.current?.selectionStart || 0;
    const textBeforeCursor = message.slice(0, cursorPos);
    const textAfterCursor = message.slice(cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    const newText = textBeforeCursor.slice(0, lastAtIndex) + `@${userEmail} ` + textAfterCursor;
    setMessage(newText);
    setShowUserAutocomplete(false);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="p-2 md:p-4">
      {/* Attachment Preview */}
      {attachments.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {attachments.map((file, index) => (
            <div key={index} className="flex items-center gap-2 bg-accent px-3 py-2 rounded-lg max-w-xs">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{file.name}</div>
                <div className="text-xs text-muted-foreground">{formatFileSize(file.size)}</div>
              </div>
              <button
                type="button"
                onClick={() => removeAttachment(index)}
                className="text-muted-foreground hover:text-foreground flex-shrink-0"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      <div 
        className={`flex gap-2 ${isDragOver ? 'drop-zone drag-over' : ''} ${isDragOver ? 'p-4 rounded-lg' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {isDragOver && (
          <div className="absolute inset-0 flex items-center justify-center bg-primary/10 rounded-lg border-2 border-dashed border-primary">
            <div className="text-center">
              <svg className="w-8 h-8 mx-auto mb-2 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-primary font-medium">Drop files here to upload</p>
            </div>
          </div>
        )}
        
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => {
              const value = e.target.value;
              setMessage(value);
              adjustTextareaHeight();
              
              // Check for # and @ triggers
              const cursorPos = e.target.selectionStart;
              const textBeforeCursor = value.slice(0, cursorPos);
              const channelMatch = textBeforeCursor.match(/#([a-zA-Z0-9_-]*)$/);
              const userMatch = textBeforeCursor.match(/@([a-zA-Z0-9._+-]*@?[a-zA-Z0-9.-]*)$/);
              
              if (channelMatch) {
                setChannelQuery(channelMatch[1]);
                setShowChannelAutocomplete(true);
                setShowUserAutocomplete(false);
              } else if (userMatch) {
                setUserQuery(userMatch[1]);
                setShowUserAutocomplete(true);
                setShowChannelAutocomplete(false);
              } else {
                setShowChannelAutocomplete(false);
                setShowUserAutocomplete(false);
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="w-full px-3 md:px-4 py-2 md:py-3 pr-20 md:pr-24 border border-border rounded-lg bg-background text-foreground resize-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm md:text-base"
            rows={1}
            style={{ minHeight: '40px' }}
            disabled={uploading}
          />
          
          {/* Channel Autocomplete */}
          {showChannelAutocomplete && channels && (
            <div className="absolute bottom-full left-0 mb-2 bg-card border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto z-10 w-64">
              {channels
                .filter(c => c?.name?.toLowerCase().includes(channelQuery.toLowerCase()))
                .slice(0, 5)
                .map(channel => (
                  <button
                    key={channel?._id}
                    type="button"
                    onClick={() => insertChannel(channel?.name || '')}
                    className="w-full text-left px-3 py-2 hover:bg-accent flex items-center gap-2"
                  >
                    <span className="text-muted-foreground">#</span>
                    <span>{channel?.name}</span>
                  </button>
                ))}
            </div>
          )}

          {/* User Autocomplete */}
          {showUserAutocomplete && availableUsers && (
            <div className="absolute bottom-full left-0 mb-2 bg-card border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto z-10 w-64">
              {availableUsers
                .filter((m: any) => {
                  const query = userQuery.toLowerCase();
                  return (m?.name?.toLowerCase().includes(query) || m?.email?.toLowerCase().includes(query));
                })
                .slice(0, 5)
                .map((member: any) => (
                  <button
                    key={member._id}
                    type="button"
                    onClick={() => insertUser(member?.email || '')}
                    className="w-full text-left px-3 py-2 hover:bg-accent flex items-center gap-2"
                  >
                    <span className="text-muted-foreground">@</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{member?.name || member?.email}</div>
                      {member?.name && <div className="text-xs text-muted-foreground truncate">{member?.email}</div>}
                    </div>
                  </button>
                ))}
            </div>
          )}
          
          {/* File Upload Button */}
          <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex gap-1">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 hover:bg-accent rounded-lg transition-colors"
              title="Attach file"
              disabled={uploading}
            >
              <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={(!message.trim() && attachments.length === 0) || uploading}
          className="px-3 md:px-4 py-2 md:py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
        >
          {uploading ? (
            <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin"></div>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          )}
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={(e) => handleFileSelect(e.target.files)}
        className="hidden"
        accept="image/*,video/*,application/pdf,.doc,.docx,.txt,.zip,.rar"
      />
    </form>
  );
}
