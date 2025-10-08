import React, { useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";
import { UserTooltip } from "./UserTooltip";

interface SidebarActionsProps {
  workspaceId: Id<"workspaces">;
  workspaceMembership: any;
  showInviteForm: boolean;
  loading: boolean;
  onShowWorkspaceMemberManagement: () => void;
  onShowInviteForm: () => void;
  onGenerateInvite: () => void;
  onHideInviteForm: () => void;
  onSelectDm: (dmId: string) => void;
}

export function SidebarActions({
  workspaceId,
  workspaceMembership,
  showInviteForm,
  loading,
  onShowWorkspaceMemberManagement,
  onShowInviteForm,
  onGenerateInvite,
  onHideInviteForm,
  onSelectDm,
}: SidebarActionsProps) {
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const workspaceMembers = useQuery(api.workspaces.getMembers, { workspaceId }) || [];
  const dms = useQuery(api.directMessages.list, { workspaceId }) || [];
  const currentUser = useQuery(api.auth.loggedInUser);
  const createDm = useMutation(api.directMessages.create);
  const [dmLoading, setDmLoading] = useState<string | null>(null);

  const handleOpenDm = async (member: any) => {
    if (!currentUser || currentUser._id === member._id) return;
    // find existing DM between currentUser and member (2 participants)
    const existing = dms.find((dm: any) => {
      const parts = dm.participants.map((p: any) => p._id);
      return parts.length === 2 && parts.includes(currentUser._id) && parts.includes(member._id);
    });
    if (existing) {
      onSelectDm(existing._id);
      setShowMembersModal(false);
      return;
    }

    setDmLoading(member._id);
    try {
      const dmId = await createDm({ workspaceId, participants: [member._id] });
      onSelectDm(dmId);
      setShowMembersModal(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to open DM");
    } finally {
      setDmLoading(null);
    }
  };

  return (
    <div className="space-y-2">
      {(workspaceMembership?.role === "owner" || workspaceMembership?.role === "admin") && (
        <button
          onClick={onShowWorkspaceMemberManagement}
          className="w-full py-2 px-3 text-sm border border-border rounded hover:bg-accent transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          Manage Members
        </button>
      )}

      <button
        onClick={() => setShowMembersModal(true)}
        className="w-full py-2 px-3 text-sm border border-border rounded hover:bg-accent transition-colors flex items-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a4 4 0 00-4-4h-1M9 20H4v-2a4 4 0 014-4h1m6-4a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
        View Members
      </button>

      {!showInviteForm ? (
        <button
          onClick={onShowInviteForm}
          className="w-full py-2 px-3 text-sm border border-border rounded hover:bg-accent transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
          Invite People
        </button>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Generate an invite link to share with others?</p>
          <div className="flex gap-2">
            <button
              onClick={onGenerateInvite}
              disabled={loading}
              className="flex-1 py-1 px-2 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? "Generating..." : "Generate Invite"}
            </button>
            <button
              onClick={onHideInviteForm}
              className="px-2 py-1 text-sm border border-border rounded hover:bg-accent"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <a
        href="https://github.com/Simmarith/makertalk/issues/new"
        target="_blank"
        rel="noopener noreferrer"
        className="w-full py-2 px-3 text-sm border border-border rounded hover:bg-accent transition-colors flex items-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        Report Issue
      </a>

      {showMembersModal && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000]" onClick={() => { setShowMembersModal(false); setMemberSearch(""); }}>
          <div className="bg-card border border-border rounded-lg p-4 max-w-lg w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-3">Workspace Members</h3>
            <input
              type="text"
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              placeholder="Search members..."
              className="w-full px-3 py-2 mb-3 text-sm border border-border rounded bg-background text-foreground focus:ring-1 focus:ring-primary"
            />
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {workspaceMembers
                .filter((m: any) => {
                  const q = memberSearch.toLowerCase();
                  return !q || m.name?.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q);
                })
                .map((member: any) => (
                  <div key={member._id} className="flex items-center justify-between p-2 rounded hover:bg-accent transition-colors">
                    <UserTooltip name={member.name || member.email} email={member.email} image={member.image}>
                      <div className="flex items-center gap-3 min-w-0">
                        {member.image ? (
                          <img src={member.image} className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-semibold">
                            { (member.name || member.email || "")[0] }
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="font-medium truncate">{member.name || member.email}</div>
                          {member.name && <div className="text-sm text-muted-foreground truncate">{member.email}</div>}
                        </div>
                      </div>
                    </UserTooltip>
                    <div>
                      <button
                        onClick={() => void handleOpenDm(member)}
                        disabled={dmLoading === member._id}
                        className="ml-2 p-1 rounded hover:bg-accent text-sm"
                        title="Message"
                      >
                        {dmLoading === member._id ? (
                          <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
            </div>
            <div className="mt-3">
              <button onClick={() => { setShowMembersModal(false); setMemberSearch(""); }} className="w-full py-2 px-3 text-sm border border-border rounded hover:bg-accent">Close</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
