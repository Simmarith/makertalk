import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";
import { MessageComposer } from "./MessageComposer";
import { Message } from "./Message";

interface ThreadPanelProps {
  messageId: Id<"messages">;
  workspaceId: Id<"workspaces">;
  onClose: () => void;
}

export function ThreadPanel({ messageId, workspaceId, onClose }: ThreadPanelProps) {
  const parentMessage = useQuery(api.messages.get, { messageId });
  const threadMessages = useQuery(
    api.messages.getThreadMessages,
    { 
      parentMessageId: messageId,
      paginationOpts: { numItems: 50, cursor: null }
    }
  );

  const sendMessage = useMutation(api.messages.send);

  const handleSendReply = async (text: string, attachments?: any[], linkPreviews?: any[]) => {
    if (!text.trim() && (!attachments || attachments.length === 0)) return;
    if (!parentMessage) return;

    try {
      await sendMessage({
        workspaceId,
        channelId: parentMessage.channelId || undefined,
        dmId: parentMessage.dmId || undefined,
        text: text.trim(),
        attachments,
        linkPreviews,
        parentMessageId: messageId,
      });
    } catch (error) {
      toast.error("Failed to send reply");
    }
  };

  return (
    <div className="thread-panel flex flex-col h-full w-full">
      {/* Header */}
      <div className="p-4 border-b border-border bg-card">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground">Thread</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-accent rounded text-muted-foreground"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Thread Messages */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
        {/* Parent Message */}
        <div className="pb-4 border-b border-border">
          <div className="text-xs text-muted-foreground mb-2">Original message</div>
          {/* Parent message would be rendered here */}
        </div>

        {/* Thread Replies */}
        {threadMessages?.page && threadMessages.page.length > 0 ? (
          threadMessages.page.map((message, index) => {
            const prevMessage = threadMessages.page[index - 1];
            const showAvatar = !prevMessage || 
              prevMessage.senderId !== message.senderId ||
              message._creationTime - prevMessage._creationTime > 5 * 60 * 1000;

            return (
              <Message
                key={message._id}
                message={message}
                workspaceId={workspaceId}
                showAvatar={showAvatar}
                onReply={() => {}}
                isInThread={true}
              />
            );
          })
        ) : (
          <div className="text-center text-muted-foreground py-8">
            <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p>No replies yet</p>
            <p className="text-sm">Be the first to reply!</p>
          </div>
        )}
      </div>

      {/* Reply Composer */}
      <div className="border-t border-border">
        <MessageComposer 
          workspaceId={workspaceId}
          onSendMessage={(text, attachments, linkPreviews) => void handleSendReply(text, attachments, linkPreviews)}
          placeholder="Reply to thread..."
        />
      </div>
    </div>
  );
}
