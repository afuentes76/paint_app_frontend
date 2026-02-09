// src/ui/components/FormField.tsx

import React from "react";
//import cn from "@/ui/theme";



type FormFieldProps = {
  label: string;
  htmlFor?: string;
  required?: boolean;
  error?: string | null;
  hint?: string;
  children: React.ReactNode;
};

export function FormField({
  label,
  htmlFor,
  required = false,
  error,
  hint,
  children,
}: FormFieldProps) {
  return (
    <div className="space-y-1">
      <label
        htmlFor={htmlFor}
        className="text-sm font-medium opacity-80"
      >
        {label}
        {required && <span className="ml-1 opacity-60">*</span>}
      </label>

      {children}

      {error ? (
        <div className="text-sm text-red-600">{error}</div>
      ) : hint ? (
        <div className="text-sm opacity-60">{hint}</div>
      ) : null}
    </div>
  );
}
