"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ONBOARDING_GOAL_OPTIONS,
  ONBOARDING_WELCOME_COPY,
  type OnboardingSelectedGoal,
} from "@/lib/onboarding/constants";

interface WelcomeDialogProps {
  open: boolean;
  isSubmitting?: boolean;
  error?: string | null;
  onStartChecklist: (selectedGoal: OnboardingSelectedGoal) => void;
  onStartTour: (selectedGoal: OnboardingSelectedGoal) => void;
  onSkip: () => void;
}

export function WelcomeDialog({
  open,
  isSubmitting = false,
  error,
  onStartChecklist,
  onStartTour,
  onSkip,
}: WelcomeDialogProps) {
  const [selectedGoal, setSelectedGoal] =
    useState<OnboardingSelectedGoal | null>(null);

  const canStart = selectedGoal !== null && !isSubmitting;

  return (
    <Dialog open={open} onOpenChange={() => undefined}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"
      >
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl font-black uppercase tracking-wide">
            {ONBOARDING_WELCOME_COPY.title}
          </DialogTitle>
          <DialogDescription className="text-sm font-semibold">
            {ONBOARDING_WELCOME_COPY.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <fieldset className="space-y-3" disabled={isSubmitting}>
            <legend className="text-sm font-black uppercase tracking-widest">
              Choose your focus
            </legend>
            <div className="grid gap-3">
              {ONBOARDING_GOAL_OPTIONS.map((goal) => {
                const isSelected = selectedGoal === goal.id;

                return (
                  <label
                    key={goal.id}
                    className={`cursor-pointer neo-border p-4 transition-all ${
                      isSelected
                        ? "bg-secondary text-secondary-foreground shadow-[3px_3px_0_0_#000]"
                        : "bg-card hover:bg-accent"
                    }`}
                  >
                    <span className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="onboarding-goal"
                        value={goal.id}
                        checked={isSelected}
                        onChange={() => setSelectedGoal(goal.id)}
                        className="mt-1"
                      />
                      <span className="space-y-1">
                        <span className="block font-black">{goal.label}</span>
                        <span className="block text-sm font-medium text-muted-foreground">
                          {goal.description}
                        </span>
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {error ? (
            <p className="neo-border bg-destructive/10 p-3 text-sm font-bold text-destructive">
              {error}
            </p>
          ) : null}

          <p className="text-sm font-medium text-muted-foreground">
            {ONBOARDING_WELCOME_COPY.skip}
          </p>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={onSkip}
            disabled={isSubmitting}
          >
            Skip for now
          </Button>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => selectedGoal && onStartChecklist(selectedGoal)}
              disabled={!canStart}
            >
              Start setup checklist
            </Button>
            <Button
              type="button"
              onClick={() => selectedGoal && onStartTour(selectedGoal)}
              disabled={!canStart}
            >
              Start dashboard tour
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
