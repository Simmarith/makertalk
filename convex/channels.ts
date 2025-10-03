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
