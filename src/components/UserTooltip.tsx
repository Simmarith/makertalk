import { useState } from "react";

interface UserTooltipProps {
  name: string;
  email: string;
  image?: string;
  children: React.ReactNode;
}

export function UserTooltip({ name, email, image, children }: UserTooltipProps) {
  const [show, setShow] = useState(false);

  return (
    <span className="relative inline-block">
      <span
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
      >
        {children}
      </span>
      {show && (
        <div className="absolute bottom-full left-0 mb-2 z-50 pointer-events-none">
          <div className="bg-card border border-border rounded-lg shadow-lg p-3 min-w-[200px]">
            <div className="flex items-center gap-3">
              {image ? (
                <img src={image} alt={name} className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-semibold">
                  {name[0] || email[0]}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-foreground truncate">{name}</div>
                <div className="text-sm text-muted-foreground truncate">{email}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </span>
  );
}
