import { v } from "convex/values";
import { action } from "./_generated/server";

export const fetchMetadata = action({
  args: { url: v.string() },
  handler: async (_, { url }) => {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0" },
      });
      const html = await response.text();

      const getMetaContent = (property: string) => {
        const regex = new RegExp(`<meta[^>]*(?:property|name)=["']${property}["'][^>]*content=["']([^"']*)["']`, "i");
        const match = html.match(regex);
        return match?.[1] || null;
      };

      const title = getMetaContent("og:title") || html.match(/<title>([^<]*)<\/title>/i)?.[1];
      const description = getMetaContent("og:description") || getMetaContent("description");
      const image = getMetaContent("og:image");
      const siteName = getMetaContent("og:site_name");

      return {
        url,
        title: title?.trim() || null,
        description: description?.trim() || null,
        image: image || null,
        siteName: siteName || null,
      };
    } catch {
      return null;
    }
  },
});
