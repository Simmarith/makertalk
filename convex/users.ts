import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { rateLimiter } from "./lib/rateLimit";

export const generateAvatarUploadUrl = mutation({
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

export const updateAvatar = mutation({
  args: {
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const url = await ctx.storage.getUrl(args.storageId);
    if (!url) {
      throw new Error("Failed to get avatar URL");
    }

    await ctx.db.patch(userId, { image: url });
    return url;
  },
});

export const updateProfile = mutation({
  args: {
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const updates: any = {};
    if (args.name !== undefined) {
      updates.name = args.name;
    }
    if (args.avatarUrl !== undefined) {
      updates.image = args.avatarUrl;
    }

    await ctx.db.patch(userId, updates);
  },
});
