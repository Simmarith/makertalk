import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";
import { LinkPreview } from "./LinkPreview";
import { UserTooltip } from "./UserTooltip";

interface MessageProps {
  message: any;
  workspaceId: Id<"workspaces">;
  showAvatar: boolean;
  onReply: (messageId: string) => void;
  onOpenThread?: (messageId: string) => void;
  isInThread?: boolean;
  onChannelClick?: (channelId: string) => void;
  onUserClick?: (userId: Id<"users">) => void;
}

export function Message({ message, workspaceId, showAvatar, onReply, onOpenThread, isInThread = false, onChannelClick, onUserClick }: MessageProps) {
  const channels = useQuery(api.channels.list, { workspaceId });
  const workspaceMembers = useQuery(api.workspaces.getMembers, { workspaceId });
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.text);
  const [showActions, setShowActions] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  
  const currentUser = useQuery(api.auth.loggedInUser);
  const workspaceMembership = useQuery(
    api.workspaces.getMembership,
    currentUser && workspaceId ? { workspaceId, userId: currentUser._id } : "skip"
  );
  const threadCount = useQuery(
    api.messages.getThreadCount,
    !isInThread ? { messageId: message._id } : "skip"
  );
  const editMessage = useMutation(api.messages.edit);
  const deleteMessage = useMutation(api.messages.remove);
  const addReaction = useMutation(api.messages.addReaction);
  
  const isOwnMessage = currentUser?._id === message.senderId;
  const canDelete = isOwnMessage || workspaceMembership?.role === "owner" || workspaceMembership?.role === "admin";

  const handleEdit = async () => {
    if (!editText.trim()) return;
    
    try {
      await editMessage({
        messageId: message._id,
        text: editText.trim(),
      });
      setIsEditing(false);
      toast.success("Message updated");
    } catch (error) {
      toast.error("Failed to update message");
    }
  };

  const handleDelete = async () => {
    try {
      await deleteMessage({ messageId: message._id });
      toast.success("Message deleted");
    } catch (error) {
      toast.error("Failed to delete message");
    }
  };

  const handleReaction = async (emoji: string) => {
    try {
      await addReaction({
        messageId: message._id,
        emoji,
      });
      setShowEmojiPicker(false);
    } catch (error) {
      toast.error("Failed to add reaction");
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const isImage = (mimeType: string) => mimeType.startsWith('image/');
  const isPdf = (mimeType: string) => mimeType === 'application/pdf';
  const isVideo = (mimeType: string) => mimeType.startsWith('video/');

  const linkifyText = (text: string) => {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    const combinedRegex = /(https?:\/\/[^\s]+)|(#[a-zA-Z0-9_-]+)|(@[a-zA-Z0-9._+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
    
    let match;
    while ((match = combinedRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }
      
      if (match[1]) {
        parts.push(<a key={match.index} href={match[1]} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{match[1]}</a>);
      } else if (match[2]) {
        const channelName = match[2].slice(1);
        const channel = channels?.find(c => c?.name === channelName);
        if (channel && onChannelClick) {
          parts.push(<button key={match.index} onClick={() => onChannelClick(channel._id)} className="text-primary hover:underline font-medium">{match[2]}</button>);
        } else {
          parts.push(match[2]);
        }
      } else if (match[3]) {
        const email = match[3].slice(1);
        const member = workspaceMembers?.find(m => m?.email === email);
        if (member && onUserClick) {
          parts.push(
            <UserTooltip key={match.index} name={member.name || member.email || "unknown-user"} email={member.email || "unknonwn-email"} image={member.image}>
              <span onClick={() => onUserClick(member._id)} className="text-primary hover:underline font-medium cursor-pointer">{match[3]}</span>
            </UserTooltip>
          );
        } else {
          parts.push(match[3]);
        }
      }
      
      lastIndex = match.index + match[0].length;
    }
    
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }
    
    return parts;
  };

  const commonEmojis = ['👍', '❤️', '😂', '😮', '😢', '😡', '👏', '🎉'];

  return (
    <div
      className="group hover:bg-accent/50 px-2 md:px-4 py-2 rounded-lg transition-colors relative"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="flex gap-2 md:gap-3">
        {showAvatar && (
          message.sender?.image ? (
            <img
              src={message.sender.image}
              alt={message.sender.name || message.sender.email}
              className="w-6 h-6 md:w-8 md:h-8 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-6 h-6 md:w-8 md:h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-semibold text-xs md:text-sm flex-shrink-0">
              {message.sender?.name?.[0] || message.sender?.email?.[0] || '?'}
            </div>
          )
        )}
        
        <div className={`flex-1 min-w-0 ${!showAvatar ? 'ml-8 md:ml-11' : ''}`}>
          {showAvatar && (
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-foreground text-sm md:text-base">
                {message.sender?.name || message.sender?.email || 'Unknown User'}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatTime(message._creationTime)}
              </span>
              {message.editedAt && (
                <span className="text-xs text-muted-foreground">(edited)</span>
              )}
            </div>
          )}
          
          {isEditing ? (
            <div className="space-y-2">
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="w-full p-2 border border-border rounded bg-background text-foreground resize-none focus:ring-2 focus:ring-primary focus:border-transparent"
                rows={3}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleEdit}
                  className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditText(message.text);
                  }}
                  className="px-3 py-1 text-sm border border-border rounded hover:bg-accent"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="text-foreground whitespace-pre-wrap break-words text-sm md:text-base">
                {linkifyText(message.text)}
              </div>
              
              {/* Link Previews */}
              {message.linkPreviews && message.linkPreviews.length > 0 && (
                <div className="space-y-2">
                  {message.linkPreviews.map((preview: any, index: number) => (
                    <LinkPreview key={index} {...preview} />
                  ))}
                </div>
              )}

              {/* Attachments */}
              {message.attachments && message.attachments.length > 0 && (
                <div className="mt-2 space-y-2">
                  {message.attachments.map((attachment: any, index: number) => (
                    <div key={index} className="border border-border rounded-lg overflow-hidden max-w-full md:max-w-md">
                      {isImage(attachment.mimeType) && attachment.url ? (
                        <img
                          src={attachment.url}
                          alt={attachment.filename}
                          className="w-full max-h-64 md:max-h-96 object-contain cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => window.open(attachment.url, '_blank')}
                        />
                      ) : isVideo(attachment.mimeType) && attachment.url ? (
                        <video
                          src={attachment.url}
                          controls
                          className="w-full max-h-64 md:max-h-96"
                        >
                          Your browser does not support the video tag.
                        </video>
                      ) : isPdf(attachment.mimeType) && attachment.url ? (
                        <div className="p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 1H7a2 2 0 00-2 2v16a2 2 0 002 2z" />
                            </svg>
                            <span className="font-medium">{attachment.filename}</span>
                          </div>
                          <a
                            href={attachment.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            Open PDF
                          </a>
                        </div>
                      ) : (
                        <div className="p-4">
                          <div className="flex items-center gap-2">
                            <svg className="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <div>
                              <div className="font-medium">{attachment.filename}</div>
                              <div className="text-sm text-muted-foreground">
                                {(attachment.size / 1024 / 1024).toFixed(2)} MB
                              </div>
                            </div>
                          </div>
                          {attachment.url && (
                            <a
                              href={attachment.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline mt-2 inline-block"
                            >
                              Download
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Reactions */}
              {message.reactions && message.reactions.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {message.reactions.map((reaction: any) => (
                    <button
                      key={reaction.emoji}
                      onClick={() => handleReaction(reaction.emoji)}
                      className="reaction-button"
                    >
                      <span>{reaction.emoji}</span>
                      <span>{reaction.count}</span>
                    </button>
                  ))}
                </div>
              )}
              
              {/* Thread Indicator */}
              {!isInThread && threadCount !== undefined && threadCount > 0 && onOpenThread && (
                <button
                  onClick={() => onOpenThread(message._id)}
                  className="mt-2 flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <span>{threadCount} {threadCount === 1 ? 'reply' : 'replies'}</span>
                </button>
              )}
            </>
          )}
        </div>
        
        {/* Message Actions */}
        {showActions && !isEditing && (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="">
              <button
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="p-1 hover:bg-accent rounded text-muted-foreground hover:text-foreground h-full"
                title="Add reaction"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
              
              {showEmojiPicker && (
                <div className="absolute">
                  <div className="relative bottom-full right-0 mb-2 p-2 bg-card border border-border rounded-lg shadow-lg z-10">
                  <div className="grid grid-cols-4 gap-1">
                    {commonEmojis.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => handleReaction(emoji)}
                        className="w-10 h-10 flex items-center justify-center hover:bg-accent rounded text-lg"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                  </div>
                </div>
              )}
            </div>
            
            <button
              onClick={() => onReply(message._id)}
              className="p-1 hover:bg-accent rounded text-muted-foreground hover:text-foreground"
              title="Reply"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
            </button>
            
            {!isInThread && onOpenThread && (
              <button
                onClick={() => onOpenThread(message._id)}
                className="p-1 hover:bg-accent rounded text-muted-foreground hover:text-foreground"
                title={threadCount && threadCount > 0 ? "Show thread" : "Start thread"}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </button>
            )}
            
            {isOwnMessage && (
              <button
                onClick={() => setIsEditing(true)}
                className="p-1 hover:bg-accent rounded text-muted-foreground hover:text-foreground"
                title="Edit"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            )}
            
            {canDelete && (
              <button
                onClick={handleDelete}
                className="p-1 hover:bg-accent rounded text-muted-foreground hover:text-red-500"
                title="Delete"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
