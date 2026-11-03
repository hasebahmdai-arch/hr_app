"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface LoadingButtonProps extends ButtonProps {
  loading?: boolean;
}

export const LoadingButton = React.forwardRef<HTMLButtonElement, LoadingButtonProps>(
  ({ loading = false, disabled, children, className, size, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        size={size}
        disabled={disabled || loading}
        className={cn(className)}
        {...props}
      >
        {loading ? (
          <Loader2
            className={cn("h-4 w-4 animate-spin shrink-0", size !== "icon" && "mr-2")}
            aria-hidden
          />
        ) : null}
        {children}
      </Button>
    );
  }
);
LoadingButton.displayName = "LoadingButton";
