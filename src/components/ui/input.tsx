import * as React from "react";

import { cn } from "@/lib/utils";
import { DATA_MIN, DATA_MAX } from "@/lib/validacoesData";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    // Todo campo de data ganha um limite de ano (evita digitação tipo 0202 ou 9999).
    // Quem precisar de um limite mais apertado é só passar min/max no próprio campo.
    const ehData = type === "date" || type === "datetime-local";
    const sufixo = type === "datetime-local" ? "T00:00" : "";
    const limitesData = ehData
      ? { min: props.min ?? `${DATA_MIN}${sufixo}`, max: props.max ?? `${DATA_MAX}${type === "datetime-local" ? "T23:59" : ""}` }
      : null;
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground transition-colors focus-visible:outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          ehData && "[&:invalid]:border-destructive [&:invalid]:text-destructive",
          className,
        )}
        ref={ref}
        {...props}
        {...limitesData}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
