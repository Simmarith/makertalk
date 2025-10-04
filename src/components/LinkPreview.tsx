interface LinkPreviewProps {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
}

export function LinkPreview({ url, title, description, image, siteName }: LinkPreviewProps) {
  const domain = new URL(url).hostname.replace('www.', '');

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="block border border-border rounded-lg overflow-hidden hover:bg-accent/50 transition-colors max-w-full md:max-w-md mt-2"
    >
      {image && (
        <img
          src={image}
          alt={title || url}
          className="w-full h-32 md:h-48 object-cover"
        />
      )}
      <div className="p-3">
        {siteName && (
          <div className="text-xs text-muted-foreground mb-1">{siteName}</div>
        )}
        {title && (
          <div className="font-semibold text-foreground line-clamp-2 mb-1">
            {title}
          </div>
        )}
        {description && (
          <div className="text-sm text-muted-foreground line-clamp-2 mb-2">
            {description}
          </div>
        )}
        <div className="text-xs text-primary">{domain}</div>
      </div>
    </a>
  );
}
