import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Sidebar } from "./Sidebar";
import { MessageArea } from "./MessageArea";
import { ThemeToggle } from "./ThemeToggle";
import { SignOutButton } from "../SignOutButton";

interface ChatInterfaceProps {
  workspaceId: string;
  onBackToWorkspaces: () => void;
}

export function ChatInterface({ workspaceId, onBackToWorkspaces }: ChatInterfaceProps) {
  const workspace = useQuery(api.workspaces.get, { workspaceId: workspaceId as Id<"workspaces"> });
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [selectedDmId, setSelectedDmId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  if (!workspace) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-background">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-0'} transition-all duration-300 overflow-hidden border-r border-border`}>
        <Sidebar
          workspaceId={workspaceId as Id<"workspaces">}
          workspace={workspace}
          selectedChannelId={selectedChannelId}
          selectedDmId={selectedDmId}
          onSelectChannel={(channelId) => {
            setSelectedChannelId(channelId);
            setSelectedDmId(null);
          }}
          onSelectDm={(dmId) => {
            setSelectedDmId(dmId);
            setSelectedChannelId(null);
          }}
          onBackToWorkspaces={onBackToWorkspaces}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="h-16 border-b border-border bg-card px-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-accent rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 className="text-lg font-semibold text-foreground">
              {workspace.name}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <SignOutButton />
          </div>
        </header>

        {/* Message Area */}
        <div className="flex-1">
          <MessageArea
            workspaceId={workspaceId as Id<"workspaces">}
            channelId={selectedChannelId as Id<"channels"> | null}
            dmId={selectedDmId as Id<"directMessages"> | null}
          />
        </div>
      </div>
    </div>
  );
}
