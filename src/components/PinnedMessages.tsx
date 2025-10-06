import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useState } from "react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface PinnedMessagesProps {
  channelId?: Id<"channels"> | null;
  dmId?: Id<"directMessages"> | null;
}

export function PinnedMessages({ channelId, dmId }: PinnedMessagesProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const pinnedMessages = useQuery(
    api.messages.getPinned,
    channelId || dmId ? { channelId: channelId || undefined, dmId: dmId || undefined } : "skip"
  );

  if (!pinnedMessages || pinnedMessages.length === 0) {
    return null;
  }

  return (
    <div className="border-b border-border bg-accent/30">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-2 flex items-center justify-between hover:bg-accent/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
          <span className="font-medium text-sm">
            {pinnedMessages.length} {pinnedMessages.length === 1 ? 'Pinned Message' : 'Pinned Messages'}
          </span>
        </div>
        <svg
          className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {isExpanded && (
        <div className="px-4 pb-3 space-y-2 max-h-64 overflow-y-auto">
          {pinnedMessages.map((message) => (
            <div key={message._id} className="p-2 bg-background rounded border border-border">
              <div className="flex items-start gap-2">
                {message.sender?.image ? (
                  <img
                    src={message.sender.image}
                    alt={message.sender.name || message.sender.email}
                    className="w-6 h-6 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-semibold text-xs flex-shrink-0">
                    {message.sender?.name?.[0] || message.sender?.email?.[0] || '?'}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm">
                      {message.sender?.name || message.sender?.email || 'Unknown User'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(message._creationTime).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="text-sm text-foreground break-words line-clamp-3 prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.text}</ReactMarkdown>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
