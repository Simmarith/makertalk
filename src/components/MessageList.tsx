import { useEffect, useRef, useState } from "react";
import { Message } from "./Message";

interface MessageListProps {
  messages: any[];
  onReply: (messageId: string) => void;
  onOpenThread: (messageId: string) => void;
  onLoadMore: (numItems?: number) => void;
  hasMore: boolean;
}

export function MessageList({ messages, onReply, onOpenThread, onLoadMore, hasMore }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  // Auto-scroll to bottom on new messages if user is at bottom
  useEffect(() => {
    if (scrollRef.current && isAtBottom) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, isAtBottom]);

  // Track if user is at bottom
  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      const atBottom = scrollTop + clientHeight >= scrollHeight - 10;
      setIsAtBottom(atBottom);
    }
  };

  // Load more messages when scrolling to top
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore) {
          onLoadMore(10);
        }
      },
      { threshold: 1.0 }
    );

    if (topRef.current) {
      observer.observe(topRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, onLoadMore]);

  const reversedMessages = [...messages].reverse();

  return (
    <div 
      ref={scrollRef} 
      className="h-full overflow-y-auto custom-scrollbar p-4 space-y-4"
      onScroll={handleScroll}
    >
      {hasMore && (
        <div ref={topRef} className="flex justify-center py-4">
          <div className="text-sm text-muted-foreground">Loading more messages...</div>
        </div>
      )}
      
      {reversedMessages.map((message, index) => {
        const prevMessage = reversedMessages[index - 1];
        const showAvatar = !prevMessage || 
          prevMessage.senderId !== message.senderId ||
          message._creationTime - prevMessage._creationTime > 5 * 60 * 1000; // 5 minutes

        return (
          <Message
            key={message._id}
            message={message}
            showAvatar={showAvatar}
            onReply={onReply}
            onOpenThread={onOpenThread}
          />
        );
      })}
      
      <div ref={bottomRef} />
      
      {/* Scroll to bottom button */}
      {!isAtBottom && (
        <button
          onClick={() => {
            if (scrollRef.current) {
              scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            }
          }}
          className="fixed bottom-24 right-8 p-3 bg-primary text-primary-foreground rounded-full shadow-lg hover:bg-primary/90 transition-colors z-10"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </button>
      )}
    </div>
  );
}
