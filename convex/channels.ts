import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
    description: v.optional(v.string()),
    isPrivate: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check if user is member of workspace
    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) => 
        q.eq("workspaceId", args.workspaceId).eq("userId", userId)
      )
      .unique();

    if (!membership) {
      throw new Error("Not a member of this workspace");
    }

    const channelId = await ctx.db.insert("channels", {
      workspaceId: args.workspaceId,
      name: args.name,
      description: args.description,
      isPrivate: args.isPrivate,
      createdBy: userId,
      createdAt: Date.now(),
    });

    // Add creator to channel
    await ctx.db.insert("channelMembers", {
      channelId,
      userId,
      joinedAt: Date.now(),
    });

    return channelId;
  },
});

export const list = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    // Check if user is member of workspace
    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) => 
        q.eq("workspaceId", args.workspaceId).eq("userId", userId)
      )
      .unique();

    if (!membership) {
      return [];
    }

    // Get all public channels
    const publicChannels = await ctx.db
      .query("channels")
      .withIndex("by_workspace_private", (q) => 
        q.eq("workspaceId", args.workspaceId).eq("isPrivate", false)
      )
      .collect();

    // Get private channels user is member of
    const userChannelMemberships = await ctx.db
      .query("channelMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const privateChannelIds = userChannelMemberships.map(m => m.channelId);
    const privateChannels = await Promise.all(
      privateChannelIds.map(async (channelId) => {
        const channel = await ctx.db.get(channelId);
        return channel && channel.workspaceId === args.workspaceId && channel.isPrivate 
          ? channel 
          : null;
      })
    );

    return [...publicChannels, ...privateChannels.filter(Boolean)];
  },
});

export const get = query({
  args: { channelId: v.id("channels") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const channel = await ctx.db.get(args.channelId);
    if (!channel) {
      return null;
    }

    // Check workspace membership
    const workspaceMembership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) => 
        q.eq("workspaceId", channel.workspaceId).eq("userId", userId)
      )
      .unique();

    if (!workspaceMembership) {
      throw new Error("Not a member of this workspace");
    }

    // For private channels, check channel membership
    if (channel.isPrivate) {
      const channelMembership = await ctx.db
        .query("channelMembers")
        .withIndex("by_channel_user", (q) => 
          q.eq("channelId", args.channelId).eq("userId", userId)
        )
        .unique();

      if (!channelMembership) {
        throw new Error("Not a member of this private channel");
      }
    }

    return channel;
  },
});

export const getMembers = query({
  args: { channelId: v.id("channels") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const channel = await ctx.db.get(args.channelId);
    if (!channel) {
      return [];
    }

    const memberships = await ctx.db
      .query("channelMembers")
      .withIndex("by_channel", (q) => q.eq("channelId", args.channelId))
      .collect();

    const members = await Promise.all(
      memberships.map(async (membership) => {
        const user = await ctx.db.get(membership.userId);
        return user ? {
          _id: user._id,
          name: user.name,
          email: user.email,
        } : null;
      })
    );

    return members.filter(Boolean);
  },
});

export const addMember = mutation({
  args: {
    channelId: v.id("channels"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const currentUserId = await getAuthUserId(ctx);
    if (!currentUserId) {
      throw new Error("Not authenticated");
    }

    const channel = await ctx.db.get(args.channelId);
    if (!channel) {
      throw new Error("Channel not found");
    }

    // Check if current user is a member of the channel
    const currentUserMembership = await ctx.db
      .query("channelMembers")
      .withIndex("by_channel_user", (q) => 
        q.eq("channelId", args.channelId).eq("userId", currentUserId)
      )
      .unique();

    if (!currentUserMembership) {
      throw new Error("You must be a member of this channel to add others");
    }

    // Check if target user is in workspace
    const workspaceMembership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) => 
        q.eq("workspaceId", channel.workspaceId).eq("userId", args.userId)
      )
      .unique();

    if (!workspaceMembership) {
      throw new Error("User is not a member of this workspace");
    }

    // Check if already a member
    const existingMembership = await ctx.db
      .query("channelMembers")
      .withIndex("by_channel_user", (q) => 
        q.eq("channelId", args.channelId).eq("userId", args.userId)
      )
      .unique();

    if (existingMembership) {
      throw new Error("User is already a member of this channel");
    }

    await ctx.db.insert("channelMembers", {
      channelId: args.channelId,
      userId: args.userId,
      joinedAt: Date.now(),
    });
  },
});

export const removeMember = mutation({
  args: {
    channelId: v.id("channels"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const currentUserId = await getAuthUserId(ctx);
    if (!currentUserId) {
      throw new Error("Not authenticated");
    }

    const channel = await ctx.db.get(args.channelId);
    if (!channel) {
      throw new Error("Channel not found");
    }

    // Check if current user is channel creator, workspace owner, or admin
    const isChannelCreator = channel.createdBy === currentUserId;
    
    const workspaceMembership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) => 
        q.eq("workspaceId", channel.workspaceId).eq("userId", currentUserId)
      )
      .unique();

    const isOwnerOrAdmin = workspaceMembership && (workspaceMembership.role === "owner" || workspaceMembership.role === "admin");

    if (!isChannelCreator && !isOwnerOrAdmin) {
      throw new Error("Only channel creator, workspace owners and admins can remove members");
    }

    const membership = await ctx.db
      .query("channelMembers")
      .withIndex("by_channel_user", (q) => 
        q.eq("channelId", args.channelId).eq("userId", args.userId)
      )
      .unique();

    if (!membership) {
      throw new Error("User is not a member of this channel");
    }

    await ctx.db.delete(membership._id);
  },
});

export const update = mutation({
  args: {
    channelId: v.id("channels"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const channel = await ctx.db.get(args.channelId);
    if (!channel) {
      throw new Error("Channel not found");
    }

    // Check if user is channel creator, workspace owner, or admin
    const isChannelCreator = channel.createdBy === userId;
    
    const workspaceMembership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) => 
        q.eq("workspaceId", channel.workspaceId).eq("userId", userId)
      )
      .unique();

    const isOwnerOrAdmin = workspaceMembership && (workspaceMembership.role === "owner" || workspaceMembership.role === "admin");

    if (!isChannelCreator && !isOwnerOrAdmin) {
      throw new Error("Only channel creator, workspace owners and admins can edit channels");
    }

    const updates: any = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;

    await ctx.db.patch(args.channelId, updates);
  },
});

export const deleteChannel = mutation({
  args: { channelId: v.id("channels") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const channel = await ctx.db.get(args.channelId);
    if (!channel) {
      throw new Error("Channel not found");
    }

    // Check if user is channel creator, workspace owner, or admin
    const isChannelCreator = channel.createdBy === userId;
    
    const workspaceMembership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) => 
        q.eq("workspaceId", channel.workspaceId).eq("userId", userId)
      )
      .unique();

    const isOwnerOrAdmin = workspaceMembership && (workspaceMembership.role === "owner" || workspaceMembership.role === "admin");

    if (!isChannelCreator && !isOwnerOrAdmin) {
      throw new Error("Only channel creator, workspace owners and admins can delete channels");
    }

    // Delete the channel
    await ctx.db.delete(args.channelId);

    // Delete all channel memberships
    const memberships = await ctx.db
      .query("channelMembers")
      .withIndex("by_channel", (q) => q.eq("channelId", args.channelId))
      .collect();
    
    for (const membership of memberships) {
      await ctx.db.delete(membership._id);
    }
  },
});

export const leave = mutation({
  args: { channelId: v.id("channels") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const membership = await ctx.db
      .query("channelMembers")
      .withIndex("by_channel_user", (q) => 
        q.eq("channelId", args.channelId).eq("userId", userId)
      )
      .unique();

    if (!membership) {
      throw new Error("Not a member of this channel");
    }

    await ctx.db.delete(membership._id);
  },
});

export const join = mutation({
  args: { channelId: v.id("channels") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const channel = await ctx.db.get(args.channelId);
    if (!channel) {
      throw new Error("Channel not found");
    }

    if (channel.isPrivate) {
      throw new Error("Cannot join private channel without invitation");
    }

    // Check workspace membership
    const workspaceMembership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) => 
        q.eq("workspaceId", channel.workspaceId).eq("userId", userId)
      )
      .unique();

    if (!workspaceMembership) {
      throw new Error("Not a member of this workspace");
    }

    // Check if already a member
    const existingMembership = await ctx.db
      .query("channelMembers")
      .withIndex("by_channel_user", (q) => 
        q.eq("channelId", args.channelId).eq("userId", userId)
      )
      .unique();

    if (existingMembership) {
      return; // Already a member
    }

    await ctx.db.insert("channelMembers", {
      channelId: args.channelId,
      userId,
      joinedAt: Date.now(),
    });
  },
});
