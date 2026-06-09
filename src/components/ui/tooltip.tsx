"use client"

import * as React from "react"
import { Tooltip as TooltipPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * Provides a configured Tooltip provider that manages tooltip timing and context.
 *
 * @param delayDuration - Milliseconds to wait before showing the tooltip; defaults to 0
 * @returns A React element rendering a Tooltip provider with data-slot="tooltip-provider" and all other props forwarded
 */
function TooltipProvider({
  delayDuration = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  )
}

/**
 * Renders a Radix Tooltip root element with a standardized data-slot and forwards all received props.
 *
 * @param props - Props to apply to the underlying TooltipPrimitive.Root
 * @returns A TooltipPrimitive.Root element with `data-slot="tooltip"` and the provided props applied
 */
function Tooltip({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />
}

/**
 * Render a tooltip trigger element that forwards all received props and sets a data-slot attribute for styling hooks.
 *
 * @param props - Props accepted by the underlying TooltipPrimitive.Trigger; all are passed through.
 * @returns A React element representing the tooltip trigger with data-slot="tooltip-trigger".
 */
function TooltipTrigger({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

/**
 * Renders tooltip content inside a portal with themed styling and an attached arrow.
 *
 * Renders a Radix TooltipPrimitive.Content wrapped in a Portal, applies layout and animation
 * classes, and includes a positioned TooltipPrimitive.Arrow.
 *
 * @param className - Additional CSS classes to merge with the component's default styling
 * @param sideOffset - Distance in pixels between the trigger and the content (default: 0)
 * @param children - Content to display inside the tooltip
 * @returns The rendered tooltip content element (Portal → TooltipPrimitive.Content with Arrow)
 */
function TooltipContent({
  className,
  sideOffset = 0,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          "bg-foreground text-background animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-fit origin-(--radix-tooltip-content-transform-origin) rounded-md px-3 py-1.5 text-xs text-balance",
          className
        )}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow className="bg-foreground fill-foreground z-50 size-2.5 translate-y-[calc(-50%-2px)] rotate-45 rounded-[2px]" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }