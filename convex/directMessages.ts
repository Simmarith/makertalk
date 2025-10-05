import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { rateLimiter } from "./lib/rateLimit";

export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    participants: v.array(v.id("users")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await rateLimiter.limit(ctx, "createDm", { key: userId });

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

    // Ensure current user is in participants
    const participants = [...new Set([userId, ...args.participants])];

    // Check if DM already exists
    const existingDMs = await ctx.db
      .query("directMessages")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    const existingDM = existingDMs.find(dm => 
      dm.participants.length === participants.length &&
      participants.every(p => dm.participants.includes(p))
    );

    if (existingDM) {
      return existingDM._id;
    }

    return await ctx.db.insert("directMessages", {
      workspaceId: args.workspaceId,
      participants,
      createdAt: Date.now(),
    });
  },
});

export const addParticipant = mutation({
  args: {
    dmId: v.id("directMessages"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const currentUserId = await getAuthUserId(ctx);
    if (!currentUserId) {
      throw new Error("Not authenticated");
    }

    const dm = await ctx.db.get(args.dmId);
    if (!dm) {
      throw new Error("DM not found");
    }

    if (!dm.participants.includes(currentUserId)) {
      throw new Error("Not a participant of this DM");
    }

    if (dm.participants.includes(args.userId)) {
      throw new Error("User is already a participant");
    }

    await ctx.db.patch(args.dmId, {
      participants: [...dm.participants, args.userId],
    });

    return args.dmId;
  },
});

export const get = query({
  args: { dmId: v.id("directMessages") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const dm = await ctx.db.get(args.dmId);
    if (!dm || !dm.participants.includes(userId)) {
      return null;
    }

    const participants = await Promise.all(
      dm.participants.map(async (participantId) => {
        const user = await ctx.db.get(participantId);
        return user ? {
          _id: user._id,
          name: user.name,
          email: user.email,
        } : null;
      })
    );

    return {
      ...dm,
      participants: participants.filter(Boolean),
    };
  },
});

export const list = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    // Validate workspace membership
    const workspaceMembership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) => 
        q.eq("workspaceId", args.workspaceId).eq("userId", userId)
      )
      .unique();

    if (!workspaceMembership) {
      return [];
    }

    const allDms = await ctx.db
      .query("directMessages")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    const dms = allDms.filter(dm => dm.participants.includes(userId));

    // Get participant info for each DM
    const dmsWithParticipants = await Promise.all(
      dms.map(async (dm) => {
        const participants = await Promise.all(
          dm.participants.map(async (participantId) => {
            const user = await ctx.db.get(participantId);
            return user ? {
              _id: user._id,
              name: user.name,
              email: user.email,
            } : null;
          })
        );

        return {
          ...dm,
          participants: participants.filter(Boolean),
        };
      })
    );

    return dmsWithParticipants;
  },
});
