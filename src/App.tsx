import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { SignInForm } from "./SignInForm";
import { SignOutButton } from "./SignOutButton";
import { Toaster } from "sonner";
import { useState, useEffect } from "react";
import { WorkspaceSelector } from "./components/WorkspaceSelector";
import { ChatInterface } from "./components/ChatInterface";
import { ThemeProvider } from "./components/ThemeProvider";

export default function App() {
  return (
    <ThemeProvider>
      <div className="min-h-screen flex flex-col bg-background">
        <Toaster />
        <Content />
      </div>
    </ThemeProvider>
  );
}

function Content() {
  const loggedInUser = useQuery(api.auth.loggedInUser);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('invite');
    if (token) {
      setInviteToken(token);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  if (loggedInUser === undefined) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <>
      <Authenticated>
        {!selectedWorkspaceId ? (
          <WorkspaceSelector 
            onSelectWorkspace={setSelectedWorkspaceId} 
            inviteToken={inviteToken}
            onInviteProcessed={() => setInviteToken(null)}
          />
        ) : (
          <ChatInterface 
            workspaceId={selectedWorkspaceId} 
            onBackToWorkspaces={() => {
              localStorage.removeItem("lastWorkspaceId");
              setSelectedWorkspaceId(null);
            }}
          />
        )}
      </Authenticated>
      
      <Unauthenticated>
        <div className="min-h-screen flex items-center justify-center p-8">
          <div className="w-full max-w-md mx-auto">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-foreground mb-4">Welcome to MakerTalk</h1>
              <p className="text-xl text-muted-foreground">Sign in to get started</p>
            </div>
            <SignInForm />
          </div>
        </div>
      </Unauthenticated>
    </>
  );
}
