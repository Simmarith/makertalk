import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator } from "convex/server";
import { rateLimiter } from "./lib/rateLimit";

export const send = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    channelId: v.optional(v.id("channels")),
    dmId: v.optional(v.id("directMessages")),
    text: v.string(),
    attachments: v.optional(v.array(v.object({
      storageId: v.id("_storage"),
      filename: v.string(),
      mimeType: v.string(),
      size: v.number(),
    }))),
    linkPreviews: v.optional(v.array(v.object({
      url: v.string(),
      title: v.union(v.string(), v.null()),
      description: v.union(v.string(), v.null()),
      image: v.union(v.string(), v.null()),
      siteName: v.union(v.string(), v.null()),
    }))),
    parentMessageId: v.optional(v.id("messages")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await rateLimiter.limit(ctx, "sendMessage", { key: userId });

    // Validate workspace membership
    const workspaceMembership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) => 
        q.eq("workspaceId", args.workspaceId).eq("userId", userId)
      )
      .unique();

    if (!workspaceMembership) {
      throw new Error("Not a member of this workspace");
    }

    // Validate channel or DM access
    if (args.channelId) {
      const channel = await ctx.db.get(args.channelId);
      if (!channel || channel.workspaceId !== args.workspaceId) {
        throw new Error("Invalid channel");
      }

      if (channel.isPrivate) {
        const channelMembership = await ctx.db
          .query("channelMembers")
          .withIndex("by_channel_user", (q) => 
            q.eq("channelId", args.channelId!).eq("userId", userId)
          )
          .unique();

        if (!channelMembership) {
          throw new Error("Not a member of this private channel");
        }
      }
    } else if (args.dmId) {
      const dm = await ctx.db.get(args.dmId);
      if (!dm || dm.workspaceId !== args.workspaceId || !dm.participants.includes(userId)) {
        throw new Error("Invalid direct message");
      }
    } else {
      throw new Error("Must specify either channelId or dmId");
    }

    // Process attachments to get URLs
    const processedAttachments = await Promise.all(
      (args.attachments || []).map(async (attachment) => {
        const url = await ctx.storage.getUrl(attachment.storageId);
        return {
          ...attachment,
          url: url || undefined,
        };
      })
    );

    return await ctx.db.insert("messages", {
      workspaceId: args.workspaceId,
      channelId: args.channelId,
      dmId: args.dmId,
      senderId: userId,
      text: args.text,
      attachments: processedAttachments,
      linkPreviews: args.linkPreviews,
      parentMessageId: args.parentMessageId,
      createdAt: Date.now(),
    });
  },
});

export const get = query({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const message = await ctx.db.get(args.messageId);
    if (!message || message.deletedAt) {
      return null;
    }

    // Validate access to the workspace
    const workspaceMembership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) => 
        q.eq("workspaceId", message.workspaceId).eq("userId", userId)
      )
      .unique();

    if (!workspaceMembership) {
      return null;
    }

    return message;
  },
});

export const list = query({
  args: {
    channelId: v.optional(v.id("channels")),
    dmId: v.optional(v.id("directMessages")),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return { page: [], isDone: true, continueCursor: null };
    }

    let query;
    if (args.channelId) {
      // Validate channel access
      const channel = await ctx.db.get(args.channelId);
      if (!channel) {
        return { page: [], isDone: true, continueCursor: null };
      }

      const workspaceMembership = await ctx.db
        .query("workspaceMembers")
        .withIndex("by_workspace_user", (q) => 
          q.eq("workspaceId", channel.workspaceId).eq("userId", userId)
        )
        .unique();

      if (!workspaceMembership) {
        return { page: [], isDone: true, continueCursor: null };
      }

      if (channel.isPrivate) {
        const channelMembership = await ctx.db
          .query("channelMembers")
          .withIndex("by_channel_user", (q) => 
            q.eq("channelId", args.channelId!).eq("userId", userId)
          )
          .unique();

        if (!channelMembership) {
          return { page: [], isDone: true, continueCursor: null };
        }
      }

      query = ctx.db
        .query("messages")
        .withIndex("by_channel", (q) => q.eq("channelId", args.channelId));
    } else if (args.dmId) {
      // Validate DM access
      const dm = await ctx.db.get(args.dmId);
      if (!dm || !dm.participants.includes(userId)) {
        return { page: [], isDone: true, continueCursor: null };
      }

      query = ctx.db
        .query("messages")
        .withIndex("by_dm", (q) => q.eq("dmId", args.dmId));
    } else {
      return { page: [], isDone: true, continueCursor: null };
    }

    const result = await query
      .filter((q) => q.and(
        q.eq(q.field("deletedAt"), undefined),
        q.eq(q.field("parentMessageId"), undefined)
      ))
      .order("desc")
      .paginate(args.paginationOpts);

    // Get sender info for each message
    const messagesWithSenders = await Promise.all(
      result.page.map(async (message) => {
        const sender = await ctx.db.get(message.senderId);
        
        // Get reactions for this message
        const reactions = await ctx.db
          .query("reactions")
          .withIndex("by_message", (q) => q.eq("messageId", message._id))
          .collect();

        // Group reactions by emoji as array
        const reactionMap = new Map<string, string[]>();
        reactions.forEach(reaction => {
          const users = reactionMap.get(reaction.emoji) || [];
          users.push(reaction.userId);
          reactionMap.set(reaction.emoji, users);
        });
        const reactionGroups = Array.from(reactionMap.entries()).map(([emoji, userIds]) => ({
          emoji,
          userIds,
          count: userIds.length,
        }));

        return {
          ...message,
          sender: sender ? { 
            _id: sender._id, 
            name: sender.name, 
            email: sender.email,
            image: sender.image,
          } : null,
          reactions: reactionGroups,
        };
      })
    );

    return {
      ...result,
      page: messagesWithSenders,
    };
  },
});

export const getThreadCount = query({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    const count = await ctx.db
      .query("messages")
      .withIndex("by_parent", (q) => q.eq("parentMessageId", args.messageId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();
    
    return count.length;
  },
});

export const getThreadMessages = query({
  args: {
    parentMessageId: v.id("messages"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return { page: [], isDone: true, continueCursor: null };
    }

    // Get parent message to validate access
    const parentMessage = await ctx.db.get(args.parentMessageId);
    if (!parentMessage) {
      return { page: [], isDone: true, continueCursor: null };
    }

    // Validate access to the workspace
    const workspaceMembership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) => 
        q.eq("workspaceId", parentMessage.workspaceId).eq("userId", userId)
      )
      .unique();

    if (!workspaceMembership) {
      return { page: [], isDone: true, continueCursor: null };
    }

    const result = await ctx.db
      .query("messages")
      .withIndex("by_parent", (q) => q.eq("parentMessageId", args.parentMessageId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .order("asc")
      .paginate(args.paginationOpts);

    // Get sender info for each message
    const messagesWithSenders = await Promise.all(
      result.page.map(async (message) => {
        const sender = await ctx.db.get(message.senderId);
        return {
          ...message,
          sender: sender ? { 
            _id: sender._id, 
            name: sender.name, 
            email: sender.email,
            image: sender.image,
          } : null,
        };
      })
    );

    return {
      ...result,
      page: messagesWithSenders,
    };
  },
});

export const edit = mutation({
  args: {
    messageId: v.id("messages"),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const message = await ctx.db.get(args.messageId);
    if (!message || message.senderId !== userId) {
      throw new Error("Cannot edit this message");
    }

    await ctx.db.patch(args.messageId, {
      text: args.text,
      editedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new Error("Message not found");
    }

    // Check if user is the sender, workspace owner, or admin
    const workspaceMembership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) => 
        q.eq("workspaceId", message.workspaceId).eq("userId", userId)
      )
      .unique();

    const isOwnerOrAdmin = workspaceMembership?.role === "owner" || workspaceMembership?.role === "admin";
    const isSender = message.senderId === userId;

    if (!isSender && !isOwnerOrAdmin) {
      throw new Error("Cannot delete this message");
    }

    await ctx.db.patch(args.messageId, {
      deletedAt: Date.now(),
    });
  },
});

export const addReaction = mutation({
  args: {
    messageId: v.id("messages"),
    emoji: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await rateLimiter.limit(ctx, "addReaction", { key: userId });

    // Check if reaction already exists
    const existingReaction = await ctx.db
      .query("reactions")
      .withIndex("by_message_user", (q) => 
        q.eq("messageId", args.messageId).eq("userId", userId)
      )
      .filter((q) => q.eq(q.field("emoji"), args.emoji))
      .unique();

    if (existingReaction) {
      // Remove reaction if it exists
      await ctx.db.delete(existingReaction._id);
    } else {
      // Add new reaction
      await ctx.db.insert("reactions", {
        messageId: args.messageId,
        userId,
        emoji: args.emoji,
        createdAt: Date.now(),
      });
    }
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await rateLimiter.limit(ctx, "uploadFile", { key: userId });

    return await ctx.storage.generateUploadUrl();
  },
});
