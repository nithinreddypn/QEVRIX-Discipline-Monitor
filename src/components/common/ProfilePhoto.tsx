import { usePhotoUrl } from "@/lib/photo";
import { UserRound } from "lucide-react";

export function ProfilePhoto({
  src,
  className = "h-8 w-8",
  iconSizeClassName = "h-4 w-4",
  fallbackIcon: FallbackIcon = UserRound,
  type = "student"
}: {
  src: string | null | undefined;
  className?: string;
  iconSizeClassName?: string;
  fallbackIcon?: React.ComponentType<{ className?: string }>;
  type?: "student" | "teacher";
}) {
  const { data: url } = usePhotoUrl(src, type);

  if (src && url) {
    return (
      <img
        src={url}
        alt="Profile"
        className={`${className} shrink-0 rounded-full object-cover ring-1 ring-border`}
      />
    );
  }

  return (
    <span className={`grid ${className} shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground`}>
      <FallbackIcon className={iconSizeClassName} />
    </span>
  );
}
