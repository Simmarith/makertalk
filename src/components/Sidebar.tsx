import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";

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
  const channels = useQuery(api.channels.list, { workspaceId }) || [];
  const dms = useQuery(api.directMessages.list, { workspaceId }) || [];
  const createChannel = useMutation(api.channels.create);
  const joinChannel = useMutation(api.channels.join);
  const generateInvite = useMutation(api.workspaces.generateInvite);

  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [channelName, setChannelName] = useState("");
  const [channelDescription, setChannelDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [loading, setLoading] = useState(false);

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
    } catch (error) {
      toast.error("Failed to create channel");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setLoading(true);
    try {
      const token = await generateInvite({
        workspaceId,
        email: inviteEmail.trim(),
      });
      
      // Copy invite link to clipboard
      const inviteUrl = `${window.location.origin}?invite=${token}`;
      await navigator.clipboard.writeText(inviteUrl);
      
      toast.success("Invite link copied to clipboard!");
      setShowInviteForm(false);
      setInviteEmail("");
    } catch (error) {
      toast.error("Failed to generate invite");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinChannel = async (channelId: string) => {
    try {
      await joinChannel({ channelId: channelId as Id<"channels"> });
      onSelectChannel(channelId);
    } catch (error) {
      toast.error("Failed to join channel");
    }
  };

  return (
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
            <form onSubmit={handleCreateChannel} className="mb-4 p-3 border border-border rounded-lg bg-background">
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
              <button
                key={channel._id}
                onClick={() => onSelectChannel(channel._id)}
                className={`w-full text-left px-2 py-1 rounded text-sm hover:bg-accent transition-colors ${
                  selectedChannelId === channel._id ? 'bg-accent' : ''
                }`}
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
            ))}
          </div>
        </div>

        {/* Direct Messages Section */}
        <div className="p-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Direct Messages
          </h3>
          <div className="space-y-1">
            {dms.map((dm) => {
              const otherParticipants = dm.participants.filter((p: any) => p && p._id !== workspace.ownerId);
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
        </div>
      </div>

      {/* Invite Section */}
      <div className="p-4 border-t border-border">
        {!showInviteForm ? (
          <button
            onClick={() => setShowInviteForm(true)}
            className="w-full py-2 px-3 text-sm border border-border rounded hover:bg-accent transition-colors"
          >
            Invite People
          </button>
        ) : (
          <form onSubmit={handleGenerateInvite} className="space-y-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="Email address"
              className="w-full px-2 py-1 text-sm border border-border rounded bg-background text-foreground focus:ring-1 focus:ring-primary"
              required
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-1 px-2 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
              >
                {loading ? "Generating..." : "Generate Invite"}
              </button>
              <button
                type="button"
                onClick={() => setShowInviteForm(false)}
                className="px-2 py-1 text-sm border border-border rounded hover:bg-accent"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
