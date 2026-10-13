import { Badge as ShadcnBadge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Colour-variant badge — the branded wrapper around shadcn's `badge`. Consumers
 * import from here, never from `components/ui/badge`. Backgrounds are always
 * subtly tinted (never solid-filled — solid is for buttons); the colour is
 * metadata, not an action. See ui-guidelines "Badges".
 */
export type BadgeColor = "gray" | "blue" | "amber" | "red" | "green" | "purple";

const colorStyles: Record<BadgeColor, string> = {
  gray: "bg-muted text-foreground border-transparent",
  blue: "bg-blue-pastel text-blue-dark border-transparent",
  amber: "bg-amber-100 text-amber-800 border-transparent",
  red: "bg-red-pastel text-red-dark border-transparent",
  green: "bg-green-pastel text-green-dark border-transparent",
  purple: "bg-purple-pastel text-purple-dark border-transparent",
};

export interface BadgeProps extends React.ComponentProps<typeof ShadcnBadge> {
  color?: BadgeColor;
}

const Badge = ({ color = "gray", className, ...props }: BadgeProps) => {
  return (
    <ShadcnBadge
      variant="outline"
      className={cn(colorStyles[color], className)}
      {...props}
    />
  );
};

export { Badge };
