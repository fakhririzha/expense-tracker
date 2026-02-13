import { cn } from "@/lib/utils"

/**
 * Renders a div styled as a skeleton loading placeholder.
 *
 * @param className - Additional class names to merge with the default skeleton styles.
 * @returns The skeleton div element.
 */
function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-primary/10", className)}
      {...props}
    />
  )
}

export { Skeleton }