import { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { SignOutButton } from "../SignOutButton";
import { ThemeToggle } from "./ThemeToggle";

interface WorkspaceSelectorProps {
  onSelectWorkspace: (workspaceId: string) => void;
  inviteToken?: string | null;
}

export function WorkspaceSelector({ onSelectWorkspace, inviteToken }: WorkspaceSelectorProps) {
  const rawWorkspaces = useQuery(api.workspaces.list);
  const workspaces = useMemo(() => rawWorkspaces || [], [rawWorkspaces]);
  const createWorkspace = useMutation(api.workspaces.create);
  const joinByInvite = useMutation(api.workspaces.joinByInvite);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceDescription, setWorkspaceDescription] = useState("");
  const [inviteTokenInput, setInviteTokenInput] = useState("");
  const [loading, setLoading] = useState(false);

  // Auto-select last workspace on mount
  useEffect(() => {
    const lastWorkspaceId = localStorage.getItem("lastWorkspaceId");
    if (lastWorkspaceId && workspaces.some(w => w?._id === lastWorkspaceId)) {
      onSelectWorkspace(lastWorkspaceId);
    }
  }, [workspaces, onSelectWorkspace]);

  useEffect(() => {
    if (inviteToken) {
      setLoading(true);
      joinByInvite({ token: inviteToken })
        .then((workspaceId) => {
          toast.success("Joined workspace successfully!");
          localStorage.setItem("lastWorkspaceId", workspaceId);
          onSelectWorkspace(workspaceId);
        })
        .catch(() => {
          toast.error("Failed to join workspace. Invalid invite link.");
        })
        .finally(() => setLoading(false));
    }
  }, [inviteToken, joinByInvite, onSelectWorkspace]);

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceName.trim()) return;
    setLoading(true);
    try {
      const workspaceId = await createWorkspace({
        name: workspaceName.trim(),
        description: workspaceDescription.trim() || undefined,
      });
      toast.success("Workspace created successfully!");
      localStorage.setItem("lastWorkspaceId", workspaceId);
      onSelectWorkspace(workspaceId);
    } catch {
      toast.error("Failed to create workspace");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteTokenInput.trim()) return;
    setLoading(true);
    try {
      const workspaceId = await joinByInvite({ token: inviteTokenInput.trim() });
      toast.success("Joined workspace successfully!");
      localStorage.setItem("lastWorkspaceId", workspaceId);
      onSelectWorkspace(workspaceId);
    } catch {
      toast.error("Failed to join workspace. Check your invite link.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-4xl mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-foreground">MakerTalk</h1>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-4">Choose a Workspace</h2>
          <p className="text-muted-foreground">Select an existing workspace or create a new one</p>
        </div>

        {workspaces.length > 0 && (
          <div className="mb-12">
            <h3 className="text-xl font-semibold text-foreground mb-6">Your Workspaces</h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {workspaces.filter((workspace): workspace is NonNullable<typeof workspace> => Boolean(workspace)).map((workspace) => (
                <button
                  key={workspace._id}
                  onClick={() => {
                    localStorage.setItem("lastWorkspaceId", workspace._id);
                    onSelectWorkspace(workspace._id);
                  }}
                  className="p-6 border border-border rounded-lg hover:border-primary hover:bg-accent transition-colors text-left"
                >
                  <h4 className="font-semibold text-foreground mb-2">{workspace.name}</h4>
                  {workspace.description && (
                    <p className="text-sm text-muted-foreground mb-3">{workspace.description}</p>
                  )}
                  <span className="inline-block px-2 py-1 text-xs bg-primary/10 text-primary rounded">
                    {workspace.role}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid gap-8 md:grid-cols-2">
          {/* Create Workspace */}
          <div className="border border-border rounded-lg p-6">
            <h3 className="text-xl font-semibold text-foreground mb-4">Create New Workspace</h3>
            {!showCreateForm ? (
              <button
                onClick={() => setShowCreateForm(true)}
                className="w-full py-3 px-4 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                Create Workspace
              </button>
            ) : (
              <form onSubmit={e => { void handleCreateWorkspace(e); }} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Workspace Name *
                  </label>
                  <input
                    type="text"
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="My Team"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Description
                  </label>
                  <textarea
                    value={workspaceDescription}
                    onChange={(e) => setWorkspaceDescription(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="What's this workspace for?"
                    rows={3}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-2 px-4 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {loading ? "Creating..." : "Create"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="px-4 py-2 border border-border rounded-lg hover:bg-accent transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Join Workspace */}
          <div className="border border-border rounded-lg p-6">
            <h3 className="text-xl font-semibold text-foreground mb-4">Join Workspace</h3>
            {!showJoinForm ? (
              <button
                onClick={() => setShowJoinForm(true)}
                className="w-full py-3 px-4 border border-border rounded-lg hover:bg-accent transition-colors"
              >
                Join with Invite
              </button>
            ) : (
              <form onSubmit={e => { void handleJoinWorkspace(e); }} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Invite Token
                  </label>
                  <input
                    type="text"
                    value={inviteTokenInput}
                    onChange={(e) => setInviteTokenInput(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="Paste your invite token here"
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-2 px-4 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {loading ? "Joining..." : "Join"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowJoinForm(false)}
                    className="px-4 py-2 border border-border rounded-lg hover:bg-accent transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
