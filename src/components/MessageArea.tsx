import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";
import { MessageComposer } from "./MessageComposer";
import { MessageList } from "./MessageList";
import { ThreadPanel } from "./ThreadPanel";

interface MessageAreaProps {
  workspaceId: Id<"workspaces">;
  channelId: Id<"channels"> | null;
  dmId: Id<"directMessages"> | null;
}

export function MessageArea({ workspaceId, channelId, dmId }: MessageAreaProps) {
  const channel = useQuery(api.channels.get, channelId ? { channelId } : "skip");
  
  // Use regular query for now to avoid pagination type issues
  const messages = useQuery(
    api.messages.list,
    channelId || dmId ? {
      channelId: channelId || undefined,
      dmId: dmId || undefined,
      paginationOpts: { numItems: 50, cursor: null }
    } : "skip"
  );

  const sendMessage = useMutation(api.messages.send);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [threadMessageId, setThreadMessageId] = useState<string | null>(null);
  const [showThread, setShowThread] = useState(false);

  const handleSendMessage = async (text: string, attachments?: any[]) => {
    if (!text.trim() && (!attachments || attachments.length === 0)) return;

    try {
      await sendMessage({
        workspaceId,
        channelId: channelId || undefined,
        dmId: dmId || undefined,
        text: text.trim(),
        attachments,
        parentMessageId: replyingTo ? (replyingTo as Id<"messages">) : undefined,
      });
      setReplyingTo(null);
    } catch (error) {
      toast.error("Failed to send message");
    }
  };

  const handleOpenThread = (messageId: string) => {
    setThreadMessageId(messageId);
    setShowThread(true);
  };

  const handleCloseThread = () => {
    setShowThread(false);
    setThreadMessageId(null);
  };

  if (!channelId && !dmId) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold mb-2">Welcome to TeamChat</h3>
          <p>Select a channel or start a direct message to begin chatting</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex bg-background">
      {/* Main Message Area */}
      <div className={`flex-1 flex flex-col ${showThread ? 'border-r border-border' : ''}`}>
        {/* Header */}
        <div className="border-b border-border p-4 bg-card">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground flex items-center">
                {channelId ? (
                  <>
                    {channel?.isPrivate ? (
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    ) : (
                      <span className="text-muted-foreground mr-2">#</span>
                    )}
                    {channel?.name}
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    Direct Message
                  </>
                )}
              </h2>
              {channel?.description && (
                <p className="text-sm text-muted-foreground mt-1">{channel.description}</p>
              )}
            </div>
            
            {showThread && (
              <button
                onClick={handleCloseThread}
                className="p-2 hover:bg-accent rounded-lg transition-colors"
                title="Close thread"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-hidden">
          <MessageList
            messages={messages?.page || []}
            onReply={setReplyingTo}
            onOpenThread={handleOpenThread}
            onLoadMore={() => {}}
            hasMore={false}
          />
        </div>

        {/* Reply indicator */}
        {replyingTo && (
          <div className="px-4 py-2 bg-accent border-t border-border">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Replying to message
              </span>
              <button
                onClick={() => setReplyingTo(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Message Composer */}
        <div className="border-t border-border">
          <MessageComposer onSendMessage={handleSendMessage} />
        </div>
      </div>

      {/* Thread Panel */}
      {showThread && threadMessageId && (
        <ThreadPanel
          messageId={threadMessageId as Id<"messages">}
          workspaceId={workspaceId}
          onClose={handleCloseThread}
        />
      )}
    </div>
  );
}
