import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";
import { createPortal } from "react-dom";
import { MessageComposer } from "./MessageComposer";
import { MessageList } from "./MessageList";
import { ThreadPanel } from "./ThreadPanel";
import { PinnedMessages } from "./PinnedMessages";
import { requestNotificationPermission, showNotification } from "../utils/notifications";

interface MessageAreaProps {
  workspaceId: Id<"workspaces">;
  channelId: Id<"channels"> | null;
  dmId: Id<"directMessages"> | null;
  onSelectChannel: (channelId: string) => void;
  onSelectDm: (dmId: string) => void;
}

export function MessageArea({ workspaceId, channelId, dmId, onSelectChannel, onSelectDm }: MessageAreaProps) {
  const channel = useQuery(api.channels.get, channelId ? { channelId } : "skip");
  const dm = useQuery(api.directMessages.get, dmId ? { dmId } : "skip");
  const currentUser = useQuery(api.auth.loggedInUser);
  const notificationsEnabled = useQuery(api.channelNotifications.get, channelId ? { channelId } : "skip");
  const toggleNotifications = useMutation(api.channelNotifications.toggle);
  const workspaceMembers = useQuery(api.workspaces.getMembers, { workspaceId });
  const workspaceMembership = useQuery(
    api.workspaces.getMembership,
    currentUser && workspaceId ? { workspaceId, userId: currentUser._id } : "skip"
  );
  
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
  const deleteChannel = useMutation(api.channels.deleteChannel);
  const updateChannel = useMutation(api.channels.update);
  const addParticipantToDm = useMutation(api.directMessages.addParticipant);
  const createDm = useMutation(api.directMessages.create);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [threadMessageId, setThreadMessageId] = useState<string | null>(null);
  const [showThread, setShowThread] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [showAddToDmModal, setShowAddToDmModal] = useState(false);
  const [dmMemberSearch, setDmMemberSearch] = useState("");
  const [loading, setLoading] = useState(false);
  
  const isChannelCreator = currentUser && channel?.createdBy === currentUser._id;
  const isOwnerOrAdmin = workspaceMembership?.role === "owner" || workspaceMembership?.role === "admin";
  const canEditChannel = isChannelCreator || isOwnerOrAdmin;
  const prevMessagesRef = useRef<any[]>([]);

  useEffect(() => {
    void requestNotificationPermission();
  }, []);

  useEffect(() => {
    if (!currentUser || !messages?.page) return;

    const newMessages = messages.page.filter(
      (msg: any) => !prevMessagesRef.current.some((prev: any) => prev._id === msg._id)
    );

    newMessages.forEach((msg: any) => {
      if (msg.senderId === currentUser._id) return;
      if (!document.hidden) return;

      if (channelId && notificationsEnabled) {
        showNotification('New message', {
          body: `${msg.sender?.name || msg.sender?.email || 'Someone'}: ${msg.text.slice(0, 100)}`,
          icon: msg.sender?.image,
          tag: `channel-${channelId}`,
        });
      }

      const mentionRegex = new RegExp(`@${currentUser.email}`, 'i');
      if (mentionRegex.test(msg.text)) {
        showNotification('You were mentioned', {
          body: `${msg.sender?.name || msg.sender?.email || 'Someone'}: ${msg.text.slice(0, 100)}`,
          icon: msg.sender?.image,
        });
      }
    });

    prevMessagesRef.current = messages.page;
  }, [messages?.page, currentUser, channelId, notificationsEnabled]);

  const handleSendMessage = async (text: string, attachments?: any[], linkPreviews?: any[]) => {
    if (!text.trim() && (!attachments || attachments.length === 0)) return;

    try {
      await sendMessage({
        workspaceId,
        channelId: channelId || undefined,
        dmId: dmId || undefined,
        text: text.trim(),
        attachments,
        linkPreviews,
        parentMessageId: replyingTo ? (replyingTo as Id<"messages">) : undefined,
      });
      setReplyingTo(null);
    } catch {
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

  const handleDeleteChannel = async () => {
    if (!channelId || !confirm("Are you sure you want to delete this channel? This action cannot be undone.")) return;
    
    try {
      await deleteChannel({ channelId });
      toast.success("Channel deleted successfully!");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to delete channel");
    }
  };

  const handleUpdateName = async () => {
    if (!channelId || !editName.trim()) return;
    
    try {
      await updateChannel({ channelId, name: editName.trim() });
      toast.success("Channel name updated!");
      setEditingName(false);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to update channel name");
    }
  };

  const handleUpdateDescription = async () => {
    if (!channelId) return;
    
    try {
      await updateChannel({ channelId, description: editDescription.trim() || undefined });
      toast.success("Channel description updated!");
      setEditingDescription(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to update channel description");
    }
  };

  const handleAddToDm = async (userId: string) => {
    if (!dmId) return;
    
    setLoading(true);
    try {
      await addParticipantToDm({ dmId, userId: userId as Id<"users"> });
      toast.success("Participant added!");
      setShowAddToDmModal(false);
      setDmMemberSearch("");
    } catch (error: any) {
      toast.error(error.message || "Failed to add participant");
    } finally {
      setLoading(false);
    }
  };

  const handleUserClick = async (userId: Id<"users">) => {
    try {
      const dmId = await createDm({ workspaceId, participants: [userId] });
      onSelectDm?.(dmId);
    } catch (error: any) {
      toast.error(error.message || "Failed to open DM");
    }
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
          <h3 className="text-lg font-semibold mb-2">Welcome to MakerTalk</h3>
          <p>Select a channel or start a direct message to begin chatting</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100dvh-4rem)] flex bg-background overflow-hidden">
      {/* Main Message Area */}
      <div className={`flex-1 flex flex-col min-w-0 ${showThread ? 'hidden md:flex md:border-r md:border-border' : ''}`}>
        {/* Header */}
        <div className="border-b border-border p-4 bg-card flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-1">
              <div className="flex-1">
                {editingName ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="px-2 py-1 text-lg font-semibold border border-border rounded bg-background text-foreground focus:ring-1 focus:ring-primary"
                      autoFocus
                    />
                    <button onClick={() => void handleUpdateName()} className="p-1 hover:bg-accent rounded text-muted-foreground" title="Save">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                    <button onClick={() => setEditingName(false)} className="p-1 hover:bg-accent rounded text-muted-foreground" title="Cancel">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h2 className="text-base md:text-lg font-semibold text-foreground flex items-center">
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
                    {channelId && canEditChannel && (
                      <button
                        onClick={() => { setEditName(channel?.name || ""); setEditingName(true); }}
                        className="p-1 hover:bg-accent rounded text-muted-foreground"
                        title="Edit name"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                    )}
                    {dmId && (
                      <button
                        onClick={() => setShowAddToDmModal(true)}
                        className="p-1 hover:bg-accent rounded text-muted-foreground"
                        title="Add people"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                        </svg>
                      </button>
                    )}
                  </div>
                )}
                {editingDescription ? (
                  <div className="hidden md:flex items-center gap-2 mt-1">
                    <input
                      type="text"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="Description (optional)"
                      className="px-2 py-1 text-sm border border-border rounded bg-background text-foreground focus:ring-1 focus:ring-primary"
                      autoFocus
                    />
                    <button onClick={() => void handleUpdateDescription()} className="p-1 hover:bg-accent rounded text-muted-foreground" title="Save">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                    <button onClick={() => setEditingDescription(false)} className="p-1 hover:bg-accent rounded text-muted-foreground" title="Cancel">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <div className="hidden md:flex items-center gap-2 mt-1">
                    {channel?.description ? (
                      <p className="text-sm text-muted-foreground">{channel.description}</p>
                    ) : (
                      channelId && canEditChannel && <p className="text-sm text-muted-foreground italic">No description</p>
                    )}
                    {channelId && canEditChannel && (
                      <button
                        onClick={() => { setEditDescription(channel?.description || ""); setEditingDescription(true); }}
                        className="p-1 hover:bg-accent rounded text-muted-foreground"
                        title="Edit description"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                    )}
                  </div>
                )}
              </div>
              {channelId && (
                <button
                  onClick={() => channelId && void toggleNotifications({ channelId, enabled: !notificationsEnabled })}
                  className={`p-1 hover:bg-accent rounded ${notificationsEnabled ? 'text-primary' : 'text-muted-foreground'}`}
                  title={notificationsEnabled ? 'Disable notifications' : 'Enable notifications'}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {notificationsEnabled ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13.5v-8A2.5 2.5 0 0017.5 3h-11A2.5 2.5 0 004 5.5v8m16 0l-2.5 2.5m2.5-2.5l-2.5-2.5M4 13.5l2.5 2.5M4 13.5l2.5-2.5m5 5.5v1a3 3 0 11-6 0v-1m6 0H9" />
                    )}
                  </svg>
                </button>
              )}
              {channelId && canEditChannel && (
                <button
                  onClick={() => void handleDeleteChannel()}
                  className="p-1 hover:bg-accent rounded text-muted-foreground hover:text-red-500"
                  title="Delete channel"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
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

        {/* Pinned Messages */}
        <PinnedMessages channelId={channelId} dmId={dmId} />

        {/* Messages */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <MessageList
            messages={messages?.page || []}
            workspaceId={workspaceId}
            onReply={setReplyingTo}
            onOpenThread={handleOpenThread}
            onLoadMore={() => {}}
            hasMore={false}
            onChannelClick={onSelectChannel}
            onUserClick={handleUserClick}
          />
        </div>

        {/* Reply indicator */}
        {replyingTo && (
          <div className="px-4 py-2 bg-accent border-t border-border flex-shrink-0">
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
        <div className="border-t border-border flex-shrink-0">
          <MessageComposer workspaceId={workspaceId} channelId={channelId} dmId={dmId} onSendMessage={(text, attachments, linkPreviews) => void handleSendMessage(text, attachments, linkPreviews)} />
        </div>
      </div>

      {/* Thread Panel */}
      {showThread && threadMessageId && (
        <div className="w-full md:flex-1 md:max-w-md h-full">
          <ThreadPanel
            messageId={threadMessageId as Id<"messages">}
            workspaceId={workspaceId}
            onClose={handleCloseThread}
            onChannelClick={onSelectChannel}
            onUserClick={handleUserClick}
          />
        </div>
      )}

      {/* Add to DM Modal */}
      {showAddToDmModal && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000]" onClick={() => { setShowAddToDmModal(false); setDmMemberSearch(""); }}>
          <div className="bg-card border border-border rounded-lg p-4 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-3">Add People to DM</h3>
            <input
              type="text"
              value={dmMemberSearch}
              onChange={(e) => setDmMemberSearch(e.target.value)}
              placeholder="Search members..."
              className="w-full px-3 py-2 mb-3 text-sm border border-border rounded bg-background text-foreground focus:ring-1 focus:ring-primary"
            />
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {workspaceMembers
                ?.filter((member: any) => {
                  const query = dmMemberSearch.toLowerCase();
                  const isAlreadyParticipant = dm?.participants.some((p: any) => p._id === member._id);
                  return !isAlreadyParticipant && (!query || 
                    member.name?.toLowerCase().includes(query) || 
                    member.email?.toLowerCase().includes(query));
                })
                .map((member: any) => (
                  <button
                    key={member._id}
                    onClick={() => void handleAddToDm(member._id)}
                    disabled={loading}
                    className="w-full text-left px-3 py-2 rounded hover:bg-accent transition-colors disabled:opacity-50"
                  >
                    <div className="font-medium">{member.name || member.email}</div>
                    {member.name && <div className="text-sm text-muted-foreground">{member.email}</div>}
                  </button>
                ))
              }
            </div>
            <button
              onClick={() => { setShowAddToDmModal(false); setDmMemberSearch(""); }}
              className="mt-3 w-full py-2 px-3 text-sm border border-border rounded hover:bg-accent"
            >
              Cancel
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
