# 💬 MakerTalk - Team Chat App

A modern, open-source team chat application designed to remain usable and accessible in the far future without changing its license or extorting users for money. Built with transparency and user freedom in mind. 🚀

This project is built with [Chef](https://chef.convex.dev) using [Convex](https://convex.dev) as its backend. You can find docs about Chef with useful information like how to deploy to production [here](https://docs.convex.dev/chef).

## ✨ Features

- 🏢 **Workspaces**: Organize teams into separate workspaces with member management
- 📢 **Channels**: Public and private channels for organized discussions
- 💬 **Direct Messages**: One-on-one and group conversations
- 🧵 **Threads**: Reply to messages in organized threads
- 📎 **File Attachments**: Share images, videos, PDFs, and other files
- 🔗 **Link Previews**: Automatic OpenGraph metadata fetching for rich link previews
- 😊 **Reactions**: React to messages with emojis
- ⚡ **Real-time Updates**: Instant message delivery powered by Convex
- 📱 **Responsive Design**: Works seamlessly on mobile and desktop
- 🌙 **Dark Mode**: Built-in theme toggle

## 🔧 How It Works

### Architecture

**Frontend (React + Vite)**
- Component-based UI with TypeScript
- Real-time data synchronization via Convex React hooks
- Responsive design with Tailwind CSS
- Client-side routing and state management

**Backend (Convex)**
- Serverless functions for all business logic
- Real-time database with automatic subscriptions
- File storage for attachments
- Authentication via Convex Auth
- HTTP actions for external API calls (OpenGraph fetching)

### Key Components

- **ChatInterface**: Main app container managing workspace view
- **Sidebar**: Navigation for channels and direct messages
- **MessageArea**: Displays messages with composer and thread support
- **Message**: Individual message rendering with reactions and actions
- **MessageComposer**: Input area with file upload and link preview extraction
- **ThreadPanel**: Side panel for threaded conversations
- **LinkPreview**: Rich preview cards for URLs in messages

### Data Flow

1. User sends a message via MessageComposer
2. URLs are extracted and OpenGraph metadata is fetched
3. Files are uploaded to Convex storage
4. Message mutation stores data in Convex database
5. All connected clients receive real-time updates via Convex subscriptions
6. UI automatically re-renders with new data
  
## 📁 Project structure
  
The frontend code is in the `src` directory and is built with [Vite](https://vitejs.dev/).
  
The backend code is in the `convex` directory.
  
`npm run dev` will start the frontend and backend servers.

## 🔐 App authentication

Chef apps use [Convex Auth](https://auth.convex.dev/) with Anonymous auth for easy sign in. You may wish to change this before deploying your app.

## 🚀 Developing and deploying your app

Check out the [Convex docs](https://docs.convex.dev/) for more information on how to develop with Convex.
* If you're new to Convex, the [Overview](https://docs.convex.dev/understanding/) is a good place to start
* Check out the [Hosting and Deployment](https://docs.convex.dev/production/) docs for how to deploy your app
* Read the [Best Practices](https://docs.convex.dev/understanding/best-practices/) guide for tips on how to improve you app further

## 🌐 HTTP API

User-defined http routes are defined in the `convex/router.ts` file. We split these routes into a separate file from `convex/http.ts` to allow us to prevent the LLM from modifying the authentication routes.

## 💡 Philosophy

This project is committed to:
- 🔓 **Open Source**: Free to use, modify, and deploy
- 🆓 **No Lock-in**: Self-hostable with standard technologies
- 🕊️ **User Freedom**: No artificial limitations or paywalls
- ⏳ **Long-term Viability**: Built to last without requiring ongoing payments
- 👁️ **Transparency**: All code and logic is visible and auditable
