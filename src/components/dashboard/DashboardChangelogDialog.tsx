"use client";

import { useState } from "react";
import { History } from "lucide-react";
import ReactMarkdown from "react-markdown";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface DashboardChangelogDialogProps {
  markdown: string;
}

export function DashboardChangelogDialog({
  markdown,
}: DashboardChangelogDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <History className="h-4 w-4" />
          Changelog
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl border-2 border-foreground bg-card p-0 shadow-[8px_8px_0_0_#000] sm:max-h-[85vh]">
        <DialogHeader className="border-b-2 border-foreground bg-secondary px-6 py-4">
          <DialogTitle className="font-heading text-2xl font-black uppercase tracking-wide">
            What&apos;s New
          </DialogTitle>
          <DialogDescription className="font-bold text-foreground/80">
            Latest product updates for FinHealth.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[65vh] overflow-y-auto px-6 py-5">
          <div className="space-y-4 text-sm leading-7 text-foreground">
            <ReactMarkdown
              components={{
                h1: ({ ...props }) => (
                  <h1
                    className="font-heading text-3xl font-black tracking-tight"
                    {...props}
                  />
                ),
                h2: ({ ...props }) => (
                  <h2
                    className="mt-8 border-b-2 border-foreground pb-2 font-heading text-2xl font-black tracking-tight first:mt-0"
                    {...props}
                  />
                ),
                h3: ({ ...props }) => (
                  <h3
                    className="mt-6 font-heading text-xl font-black tracking-tight"
                    {...props}
                  />
                ),
                p: ({ ...props }) => (
                  <p className="text-base leading-7" {...props} />
                ),
                ul: ({ ...props }) => (
                  <ul className="ml-6 list-disc space-y-2 text-base" {...props} />
                ),
                ol: ({ ...props }) => (
                  <ol className="ml-6 list-decimal space-y-2 text-base" {...props} />
                ),
                li: ({ ...props }) => <li className="pl-1" {...props} />,
                a: ({ ...props }) => (
                  <a
                    className="font-bold underline decoration-2 underline-offset-4"
                    target="_blank"
                    rel="noreferrer"
                    {...props}
                  />
                ),
                code: ({ className, children, ...props }) => {
                  const isInline = !className;

                  if (isInline) {
                    return (
                      <code
                        className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.9em] font-semibold"
                        {...props}
                      >
                        {children}
                      </code>
                    );
                  }

                  return (
                    <code
                      className="block overflow-x-auto bg-primary p-4 font-mono text-sm text-primary-foreground"
                      {...props}
                    >
                      {children}
                    </code>
                  );
                },
                pre: ({ ...props }) => (
                  <pre className="overflow-hidden border-2 border-foreground" {...props} />
                ),
                blockquote: ({ ...props }) => (
                  <blockquote
                    className="border-l-4 border-foreground bg-muted px-4 py-3 font-semibold italic"
                    {...props}
                  />
                ),
                hr: ({ ...props }) => (
                  <hr className="border-t-2 border-foreground" {...props} />
                ),
              }}
            >
              {markdown}
            </ReactMarkdown>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
