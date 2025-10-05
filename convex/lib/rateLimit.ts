import { RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "../_generated/api";

export const rateLimiter = new RateLimiter(components.rateLimiter, {
  sendMessage: { kind: "fixed window", rate: 30, period: 60_000 },
  uploadFile: { kind: "fixed window", rate: 10, period: 60_000 },
  createWorkspace: { kind: "fixed window", rate: 5, period: 3_600_000 },
  createChannel: { kind: "fixed window", rate: 10, period: 3_600_000 },
  createDm: { kind: "fixed window", rate: 20, period: 3_600_000 },
  addReaction: { kind: "fixed window", rate: 50, period: 60_000 },
  createInvite: { kind: "fixed window", rate: 10, period: 3_600_000 },
});
