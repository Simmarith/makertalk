import { useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";

interface WorkspaceMemberManagementProps {
  workspaceId: Id<"workspaces">;
  onClose: () => void;
}

export function WorkspaceMemberManagement({ workspaceId, onClose }: WorkspaceMemberManagementProps) {
  const [loading, setLoading] = useState(false);
  const membersWithRoles = useQuery(api.workspaces.getMembersWithRoles, { workspaceId });
  const currentUser = useQuery(api.auth.loggedInUser);
  const currentUserMembership = useQuery(
    api.workspaces.getMembership,
    currentUser ? { workspaceId, userId: currentUser._id } : "skip"
  );
  const updateMemberRole = useMutation(api.workspaces.updateMemberRole);

  const canManageRoles = currentUserMembership?.role === "owner" || currentUserMembership?.role === "admin";
  const isOwner = currentUserMembership?.role === "owner";

  const handleRoleChange = async (userId: Id<"users">, newRole: "admin" | "member") => {
    setLoading(true);
    try {
      await updateMemberRole({
        workspaceId,
        userId,
        newRole,
      });
      toast.success(`Member role updated to ${newRole}`);
    } catch (error: any) {
      toast.error(error.message || "Failed to update role");
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "owner":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
      case "admin":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "member":
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
    }
  };

  const canChangeRole = (member: any) => {
    // Can't change your own role
    if (member._id === currentUser?._id) return false;
    
    // Can't change owner role
    if (member.role === "owner") return false;
    
    // Only owners can manage admin roles
    if (member.role === "admin" && !isOwner) return false;
    
    return canManageRoles;
  };

  if (!membersWithRoles) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000]" onClick={onClose}>
      <div className="bg-card border border-border rounded-lg shadow-lg w-full max-w-2xl mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-semibold">Workspace Members</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-accent rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-6">
          {!canManageRoles && (
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                Only workspace owners and admins can manage member roles.
              </p>
            </div>
          )}
          
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {membersWithRoles.map((member: any) => (
              <div
                key={member._id}
                className="flex items-center justify-between p-3 border border-border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-primary">
                      {(member.name || member.email).charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <div className="font-medium">{member.name || member.email}</div>
                    {member.name && <div className="text-sm text-muted-foreground">{member.email}</div>}
                    <div className="text-xs text-muted-foreground">
                      Joined {new Date(member.joinedAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getRoleBadgeColor(member.role)}`}>
                    {member.role}
                  </span>
                  
                  {canChangeRole(member) && (
                    <div className="flex gap-1">
                      {member.role === "member" && (
                        <button
                          onClick={() => void handleRoleChange(member._id, "admin")}
                          disabled={loading}
                          className="px-3 py-1 text-xs bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:hover:bg-blue-800 rounded transition-colors disabled:opacity-50"
                        >
                          Promote to Admin
                        </button>
                      )}
                      {member.role === "admin" && isOwner && (
                        <button
                          onClick={() => void handleRoleChange(member._id, "member")}
                          disabled={loading}
                          className="px-3 py-1 text-xs bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50"
                        >
                          Demote to Member
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-6 pt-4 border-t border-border">
            <h3 className="font-medium mb-2">Role Permissions</h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div><strong className="text-purple-600">Owner:</strong> Full control, can manage admins and transfer ownership</div>
              <div><strong className="text-blue-600">Admin:</strong> Can manage channels, members, and promote members to admin</div>
              <div><strong className="text-gray-600">Member:</strong> Can participate in channels and direct messages</div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}