import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const toggle = mutation({
  args: { channelId: v.id("channels"), enabled: v.boolean() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("channelNotifications")
      .withIndex("by_channel_user", (q) => q.eq("channelId", args.channelId).eq("userId", userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { enabled: args.enabled });
    } else {
      await ctx.db.insert("channelNotifications", {
        channelId: args.channelId,
        userId,
        enabled: args.enabled,
      });
    }
  },
});

export const get = query({
  args: { channelId: v.id("channels") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return false;

    const setting = await ctx.db
      .query("channelNotifications")
      .withIndex("by_channel_user", (q) => q.eq("channelId", args.channelId).eq("userId", userId))
      .first();

    return setting?.enabled ?? false;
  },
});

export const getUsersToNotify = query({
  args: { channelId: v.id("channels") },
  handler: async (ctx, args) => {
    const notifications = await ctx.db
      .query("channelNotifications")
      .withIndex("by_channel_user", (q) => q.eq("channelId", args.channelId))
      .filter((q) => q.eq(q.field("enabled"), true))
      .collect();

    return notifications.map((n) => n.userId);
  },
});
