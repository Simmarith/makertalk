import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";
import { WorkspaceMemberManagement } from "./WorkspaceMemberManagement";

interface SidebarProps {
  workspaceId: Id<"workspaces">;
  workspace: any;
  selectedChannelId: string | null;
  selectedDmId: string | null;
  onSelectChannel: (channelId: string) => void;
  onSelectDm: (dmId: string) => void;
  onBackToWorkspaces: () => void;
}

export function Sidebar({
  workspaceId,
  workspace,
  selectedChannelId,
  selectedDmId,
  onSelectChannel,
  onSelectDm,
  onBackToWorkspaces,
}: SidebarProps) {
  const rawChannels = useQuery(api.channels.list, { workspaceId });
  const channels = useMemo(() => rawChannels || [], [rawChannels]);
  // Auto-select last channel on workspace change
  useEffect(() => {
    if (!channels.length) return;
    const lastChannelId = localStorage.getItem(`lastChannelId:${workspaceId}`);
    if (lastChannelId && channels.some(c => c?._id === lastChannelId)) {
      onSelectChannel(lastChannelId);
    }
  }, [channels, workspaceId, onSelectChannel]);
  const dms = useQuery(api.directMessages.list, { workspaceId }) || [];
  const workspaceMembers = useQuery(api.workspaces.getMembers, { workspaceId }) || [];
  const createChannel = useMutation(api.channels.create);
  const joinChannel = useMutation(api.channels.join);
  const leaveChannel = useMutation(api.channels.leave);
  const addMemberToChannel = useMutation(api.channels.addMember);
  const removeMemberFromChannel = useMutation(api.channels.removeMember);
  const generateInvite = useMutation(api.workspaces.generateInvite);
  const createDm = useMutation(api.directMessages.create);
  const reorderChannels = useMutation(api.channels.reorder);

  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState<string | null>(null);
  const channelMembers = useQuery(
    api.channels.getMembers,
    showAddMemberModal ? { channelId: showAddMemberModal as Id<"channels"> } : "skip"
  );
  const currentUser = useQuery(api.auth.loggedInUser);
  const selectedChannel = useQuery(
    api.channels.get,
    showAddMemberModal ? { channelId: showAddMemberModal as Id<"channels"> } : "skip"
  );
  const workspaceMembership = useQuery(
    api.workspaces.getMembership,
    currentUser && workspaceId ? { workspaceId, userId: currentUser._id } : "skip"
  );
  const [showStartDmModal, setShowStartDmModal] = useState(false);
  const [showWorkspaceMemberManagement, setShowWorkspaceMemberManagement] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState("");
  const [dmSearchQuery, setDmSearchQuery] = useState("");
  const [channelName, setChannelName] = useState("");
  const [channelDescription, setChannelDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [draggedChannel, setDraggedChannel] = useState<string | null>(null);
  const [dragOverChannel, setDragOverChannel] = useState<string | null>(null);
  const [dmsCollapsed, setDmsCollapsed] = useState(false);
  const [loading, setLoading] = useState(false);

  const sortedDms = [...dms].sort((a, b) => (b.lastMessageAt || b.createdAt) - (a.lastMessageAt || a.createdAt));

  const canReorder = workspaceMembership?.role === "owner" || workspaceMembership?.role === "admin";

  const handleDragStart = (e: React.DragEvent, channelId: string) => {
    if (!canReorder) return;
    setDraggedChannel(channelId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, channelId: string) => {
    if (!canReorder) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverChannel(channelId);
  };

  const handleDragLeave = () => {
    setDragOverChannel(null);
  };

  const handleDrop = async (e: React.DragEvent, targetChannelId: string) => {
    if (!canReorder || !draggedChannel) return;
    e.preventDefault();

    if (draggedChannel === targetChannelId) {
      setDraggedChannel(null);
      setDragOverChannel(null);
      return;
    }

    const channelList = channels.filter((c): c is NonNullable<typeof c> => Boolean(c));
    const draggedIndex = channelList.findIndex(c => c._id === draggedChannel);
    const targetIndex = channelList.findIndex(c => c._id === targetChannelId);

    const reordered = [...channelList];
    const [removed] = reordered.splice(draggedIndex, 1);
    reordered.splice(targetIndex, 0, removed);

    const channelOrders = reordered.map((channel, index) => ({
      channelId: channel._id as Id<"channels">,
      order: index,
    }));

    try {
      await reorderChannels({ workspaceId, channelOrders });
    } catch (error) {
      toast.error("Failed to reorder channels");
    }

    setDraggedChannel(null);
    setDragOverChannel(null);
  };

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!channelName.trim()) return;
    setLoading(true);
    try {
      const channelId = await createChannel({
        workspaceId,
        name: channelName.trim(),
        description: channelDescription.trim() || undefined,
        isPrivate,
      });
      toast.success("Channel created successfully!");
      onSelectChannel(channelId);
      setShowCreateChannel(false);
      setChannelName("");
      setChannelDescription("");
      setIsPrivate(false);
    } catch {
      toast.error("Failed to create channel");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateInvite = async () => {
    setLoading(true);
    try {
      const token = await generateInvite({ workspaceId });
      const inviteUrl = `${window.location.origin}?invite=${token}`;
      await navigator.clipboard.writeText(inviteUrl);
      toast.success("Invite link copied to clipboard!");
      setShowInviteForm(false);
    } catch {
      toast.error("Failed to generate invite");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinChannel = async (channelId: string) => {
    try {
      await joinChannel({ channelId: channelId as Id<"channels"> });
      onSelectChannel(channelId);
    } catch {
      toast.error("Failed to join channel");
    }
  };

  const handleAddMember = async (userId: string) => {
    if (!showAddMemberModal) return;
    setLoading(true);
    try {
      await addMemberToChannel({
        channelId: showAddMemberModal as Id<"channels">,
        userId: userId as Id<"users">,
      });
      toast.success("Member added successfully!");
    } catch (error: any) {
      toast.error(error.message || "Failed to add member");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!showAddMemberModal) return;
    setLoading(true);
    try {
      await removeMemberFromChannel({
        channelId: showAddMemberModal as Id<"channels">,
        userId: userId as Id<"users">,
      });
      toast.success("Member removed successfully!");
    } catch (error: any) {
      toast.error(error.message || "Failed to remove member");
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveChannel = async (channelId: string) => {
    try {
      await leaveChannel({ channelId: channelId as Id<"channels"> });
      toast.success("Left channel successfully!");
      if (selectedChannelId === channelId) {
        onSelectChannel("");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to leave channel");
    }
  };

  const handleStartDm = async (userId: string) => {
    setLoading(true);
    try {
      const dmId = await createDm({
        workspaceId,
        participants: [userId as Id<"users">],
      });
      toast.success("DM started!");
      onSelectDm(dmId);
      setShowStartDmModal(false);
      setDmSearchQuery("");
    } catch (error: any) {
      toast.error(error.message || "Failed to start DM");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    <div className="h-full bg-card flex flex-col custom-scrollbar">
      {/* Workspace Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-bold text-foreground truncate">{workspace.name}</h2>
          <button
            onClick={onBackToWorkspaces}
            className="p-1 hover:bg-accent rounded text-muted-foreground"
            title="Back to workspaces"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
        </div>
        {workspace.description && (
          <p className="text-sm text-muted-foreground">{workspace.description}</p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {/* Channels Section */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Channels
            </h3>
            <button
              onClick={() => setShowCreateChannel(true)}
              className="p-1 hover:bg-accent rounded text-muted-foreground"
              title="Create channel"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>

          {showCreateChannel && (
            <form onSubmit={e => { void handleCreateChannel(e); }} className="mb-4 p-3 border border-border rounded-lg bg-background">
              <div className="space-y-3">
                <input
                  type="text"
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value)}
                  placeholder="Channel name"
                  className="w-full px-2 py-1 text-sm border border-border rounded bg-background text-foreground focus:ring-1 focus:ring-primary"
                  required
                />
                <input
                  type="text"
                  value={channelDescription}
                  onChange={(e) => setChannelDescription(e.target.value)}
                  placeholder="Description (optional)"
                  className="w-full px-2 py-1 text-sm border border-border rounded bg-background text-foreground focus:ring-1 focus:ring-primary"
                />
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={isPrivate}
                    onChange={(e) => setIsPrivate(e.target.checked)}
                    className="rounded"
                  />
                  Private channel
                </label>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-1 px-2 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
                  >
                    {loading ? "Creating..." : "Create"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateChannel(false)}
                    className="px-2 py-1 text-sm border border-border rounded hover:bg-accent"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </form>
          )}

          <div className="space-y-1">
            {channels.filter((channel): channel is NonNullable<typeof channel> => Boolean(channel)).map((channel) => (
              <div 
                key={channel._id} 
                className={`flex items-center gap-1 group ${dragOverChannel === channel._id && draggedChannel !== channel._id ? 'border-t-2 border-primary' : ''}`}
                draggable={canReorder}
                onDragStart={(e) => handleDragStart(e, channel._id)}
                onDragOver={(e) => handleDragOver(e, channel._id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => void handleDrop(e, channel._id)}
              >
                <button
                  onClick={() => {
                    localStorage.setItem(`lastChannelId:${workspaceId}`, channel._id);
                    onSelectChannel(channel._id);
                  }}
                  className={`flex-1 text-left px-2 py-1 rounded text-sm hover:bg-accent transition-colors ${
                    selectedChannelId === channel._id ? 'bg-accent' : ''
                  } ${canReorder ? 'cursor-move' : ''}`}
                >
                  <span className="flex items-center gap-2">
                    {channel.isPrivate ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    ) : (
                      <span className="text-muted-foreground">#</span>
                    )}
                    <span className="truncate">{channel.name}</span>
                  </span>
                </button>
                {channel.isPrivate && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowAddMemberModal(channel._id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-accent rounded text-muted-foreground"
                      title="Manage members"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleLeaveChannel(channel._id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-accent rounded text-muted-foreground hover:text-red-500"
                      title="Leave channel"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Direct Messages Section */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => setDmsCollapsed(!dmsCollapsed)}
              className="flex items-center gap-1 hover:bg-accent rounded px-1 -mx-1 transition-colors"
            >
              <svg
                className={`w-3 h-3 transition-transform ${dmsCollapsed ? '' : 'rotate-90'}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Direct Messages
              </h3>
            </button>
            <button
              onClick={() => setShowStartDmModal(true)}
              className="p-1 hover:bg-accent rounded text-muted-foreground"
              title="Start DM"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
          {!dmsCollapsed && (
          <div className="space-y-1">
            {sortedDms.map((dm) => {
              const otherParticipants = dm.participants.filter((p: any) => p && currentUser && p._id !== currentUser._id);
              const displayName = otherParticipants.length > 0 
                ? otherParticipants.map((p: any) => p.name || p.email).join(", ")
                : "You";
              
              return (
                <button
                  key={dm._id}
                  onClick={() => onSelectDm(dm._id)}
                  className={`w-full text-left px-2 py-1 rounded text-sm hover:bg-accent transition-colors ${
                    selectedDmId === dm._id ? 'bg-accent' : ''
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></div>
                    <span className="truncate">{displayName}</span>
                  </span>
                </button>
              );
            })}
          </div>
          )}
        </div>
      </div>

      {/* Invite Section */}
      <div className="p-4 border-t border-border">
        <div className="space-y-2">
          {(workspaceMembership?.role === "owner" || workspaceMembership?.role === "admin") && (
            <button
              onClick={() => setShowWorkspaceMemberManagement(true)}
              className="w-full py-2 px-3 text-sm border border-border rounded hover:bg-accent transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              Manage Members
            </button>
          )}
          
          {!showInviteForm ? (
            <button
              onClick={() => setShowInviteForm(true)}
              className="w-full py-2 px-3 text-sm border border-border rounded hover:bg-accent transition-colors"
            >
              Invite People
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Generate an invite link to share with others?</p>
              <div className="flex gap-2">
                <button
                  onClick={() => void handleGenerateInvite()}
                  disabled={loading}
                  className="flex-1 py-1 px-2 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
                >
                  {loading ? "Generating..." : "Generate Invite"}
                </button>
                <button
                  onClick={() => setShowInviteForm(false)}
                  className="px-2 py-1 text-sm border border-border rounded hover:bg-accent"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>

    {/* Start DM Modal */}
    {showStartDmModal && createPortal(
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000]" onClick={() => { setShowStartDmModal(false); setDmSearchQuery(""); }}>
        <div className="bg-card border border-border rounded-lg p-4 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
          <h3 className="font-semibold mb-3">Start Direct Message</h3>
          <input
            type="text"
            value={dmSearchQuery}
            onChange={(e) => setDmSearchQuery(e.target.value)}
            placeholder="Search members..."
            className="w-full px-3 py-2 mb-3 text-sm border border-border rounded bg-background text-foreground focus:ring-1 focus:ring-primary"
          />
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {workspaceMembers
              .filter((member: any) => {
                const query = dmSearchQuery.toLowerCase();
                return !query || 
                  member.name?.toLowerCase().includes(query) || 
                  member.email?.toLowerCase().includes(query);
              })
              .map((member: any) => (
                <button
                  key={member._id}
                  onClick={() => void handleStartDm(member._id)}
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
            onClick={() => { setShowStartDmModal(false); setDmSearchQuery(""); }}
            className="mt-3 w-full py-2 px-3 text-sm border border-border rounded hover:bg-accent"
          >
            Cancel
          </button>
        </div>
      </div>,
      document.body
    )}

    {/* Add/Remove Member Modal */}
    {showAddMemberModal && createPortal(
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000]" onClick={() => { setShowAddMemberModal(null); setMemberSearchQuery(""); }}>
        <div className="bg-card border border-border rounded-lg p-4 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
          <h3 className="font-semibold mb-3">Manage Channel Members</h3>
          <input
            type="text"
            value={memberSearchQuery}
            onChange={(e) => setMemberSearchQuery(e.target.value)}
            placeholder="Search members..."
            className="w-full px-3 py-2 mb-3 text-sm border border-border rounded bg-background text-foreground focus:ring-1 focus:ring-primary"
          />
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {workspaceMembers
              .filter((member: any) => {
                const query = memberSearchQuery.toLowerCase();
                return !query || 
                  member.name?.toLowerCase().includes(query) || 
                  member.email?.toLowerCase().includes(query);
              })
              .map((member: any) => {
                const isMember = channelMembers?.some((m: any) => m._id === member._id);
                const isChannelCreator = currentUser && selectedChannel?.createdBy === currentUser._id;
                const isOwnerOrAdmin = workspaceMembership?.role === "owner" || workspaceMembership?.role === "admin";
                const canManage = isChannelCreator || isOwnerOrAdmin;
                
                return (
                  <button
                    key={member._id}
                    onClick={() => isMember ? void handleRemoveMember(member._id) : void handleAddMember(member._id)}
                    disabled={loading || (isMember && !canManage)}
                    className="w-full text-left px-3 py-2 rounded hover:bg-accent transition-colors disabled:opacity-50 flex items-center justify-between group"
                  >
                    <div>
                      <div className="font-medium">{member.name || member.email}</div>
                      {member.name && <div className="text-sm text-muted-foreground">{member.email}</div>}
                    </div>
                    {canManage && (
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        {isMember ? (
                          <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                      </div>
                    )}
                  </button>
                );
              })
            }
          </div>
          <button
            onClick={() => { setShowAddMemberModal(null); setMemberSearchQuery(""); }}
            className="mt-3 w-full py-2 px-3 text-sm border border-border rounded hover:bg-accent"
          >
            Close
          </button>
        </div>
      </div>,
      document.body
    )}
    
    {/* Workspace Member Management Modal */}
    {showWorkspaceMemberManagement && (
      <WorkspaceMemberManagement
        workspaceId={workspaceId}
        onClose={() => setShowWorkspaceMemberManagement(false)}
      />
    )}
    </>
  );
}
