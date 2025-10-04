import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  workspaces: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    ownerId: v.id("users"),
    createdAt: v.number(),
  }).index("by_owner", ["ownerId"]),

  workspaceMembers: defineTable({
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    role: v.union(v.literal("owner"), v.literal("admin"), v.literal("member")),
    joinedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_user", ["userId"])
    .index("by_workspace_user", ["workspaceId", "userId"]),

  channels: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    description: v.optional(v.string()),
    isPrivate: v.boolean(),
    createdBy: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_private", ["workspaceId", "isPrivate"]),

  channelMembers: defineTable({
    channelId: v.id("channels"),
    userId: v.id("users"),
    joinedAt: v.number(),
  })
    .index("by_channel", ["channelId"])
    .index("by_user", ["userId"])
    .index("by_channel_user", ["channelId", "userId"]),

  directMessages: defineTable({
    workspaceId: v.id("workspaces"),
    participants: v.array(v.id("users")),
    createdAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"]),

  messages: defineTable({
    workspaceId: v.id("workspaces"),
    channelId: v.optional(v.id("channels")),
    dmId: v.optional(v.id("directMessages")),
    senderId: v.id("users"),
    text: v.string(),
    attachments: v.optional(v.array(v.object({
      storageId: v.id("_storage"),
      filename: v.string(),
      mimeType: v.string(),
      size: v.number(),
      url: v.optional(v.string()),
    }))),
    linkPreviews: v.optional(v.array(v.object({
      url: v.string(),
      title: v.union(v.string(), v.null()),
      description: v.union(v.string(), v.null()),
      image: v.union(v.string(), v.null()),
      siteName: v.union(v.string(), v.null()),
    }))),
    parentMessageId: v.optional(v.id("messages")),
    editedAt: v.optional(v.number()),
    deletedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_channel", ["channelId"])
    .index("by_dm", ["dmId"])
    .index("by_workspace", ["workspaceId"])
    .index("by_parent", ["parentMessageId"])
    .index("by_channel_created", ["channelId", "createdAt"])
    .index("by_dm_created", ["dmId", "createdAt"]),

  invites: defineTable({
    workspaceId: v.id("workspaces"),
    email: v.string(),
    token: v.string(),
    invitedBy: v.id("users"),
    expiresAt: v.number(),
    usedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_workspace", ["workspaceId"])
    .index("by_email", ["email"]),

  reactions: defineTable({
    messageId: v.id("messages"),
    userId: v.id("users"),
    emoji: v.string(),
    createdAt: v.number(),
  })
    .index("by_message", ["messageId"])
    .index("by_message_user", ["messageId", "userId"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
