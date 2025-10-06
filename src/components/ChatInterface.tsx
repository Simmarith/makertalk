import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Sidebar } from "./Sidebar";
import { MessageArea } from "./MessageArea";
import { ThemeToggle } from "./ThemeToggle";
import { SignOutButton } from "../SignOutButton";
import { Settings } from "./Settings";

interface ChatInterfaceProps {
  workspaceId: string;
  onBackToWorkspaces: () => void;
}

export function ChatInterface({ workspaceId, onBackToWorkspaces }: ChatInterfaceProps) {
  const workspace = useQuery(api.workspaces.get, { workspaceId: workspaceId as Id<"workspaces"> });
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [selectedDmId, setSelectedDmId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  if (workspace === undefined) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (workspace === null) {
    onBackToWorkspaces();
    return null;
  }

  return (
    <div className="h-screen flex bg-background">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} ${sidebarOpen ? 'md:w-64' : 'md:w-0'} fixed md:relative z-30 w-64 h-full transition-all duration-300 border-r border-border bg-background overflow-hidden`}>
        <Sidebar
          workspaceId={workspaceId as Id<"workspaces">}
          workspace={workspace}
          selectedChannelId={selectedChannelId}
          selectedDmId={selectedDmId}
          onSelectChannel={(channelId) => {
            setSelectedChannelId(channelId);
            setSelectedDmId(null);
            if (window.innerWidth < 768) setSidebarOpen(false);
          }}
          onSelectDm={(dmId) => {
            setSelectedDmId(dmId);
            setSelectedChannelId(null);
            if (window.innerWidth < 768) setSidebarOpen(false);
          }}
          onBackToWorkspaces={onBackToWorkspaces}
        />
      </div>
      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-20 md:hidden" onClick={() => setSidebarOpen(false)} />} 

      {/* Main Content */}
      <div className="h-screen flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="pt-4 pb-4 h-16 border-b border-border bg-card px-4 flex items-center justify-between">
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
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 hover:bg-accent rounded-lg transition-colors"
              title="Settings"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            <ThemeToggle />
            <SignOutButton />
          </div>
        </header>

        {/* Message Area */}
        <div className="flex-1 overflow-hidden">
          <MessageArea
            workspaceId={workspaceId as Id<"workspaces">}
            channelId={selectedChannelId as Id<"channels"> | null}
            dmId={selectedDmId as Id<"directMessages"> | null}
            onSelectChannel={(channelId) => {
              setSelectedChannelId(channelId);
              setSelectedDmId(null);
            }}
            onSelectDm={(dmId) => {
              setSelectedDmId(dmId);
              setSelectedChannelId(null);
            }}
          />
        </div>
      </div>

      {showSettings && <Settings onClose={() => setShowSettings(false)} />}
    </div>
  );
}
