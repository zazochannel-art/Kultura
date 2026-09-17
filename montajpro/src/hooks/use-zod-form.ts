"use client";

import { useCallback, useState } from "react";
import { z } from "zod";

/**
 * Formulare controlate cu validare zod la trimitere.
 *
 * Deliberat mic: câmpurile aplicației sunt în mare parte numerice și folosesc
 * componente proprii (NumberInput, Select), unde un `register` clasic ar
 * complica mai mult decât ajută.
 */
export function useZodForm<Schema extends z.ZodType<object, object>>(
  schema: Schema,
  initialValues: z.input<Schema>,
) {
  type Values = z.input<Schema>;
  const [values, setValues] = useState<Values>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const set = useCallback(<K extends keyof Values>(key: K, value: Values[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key as string]) return current;
      const next = { ...current };
      delete next[key as string];
      return next;
    });
  }, []);

  const reset = useCallback((next?: Values) => {
    setValues(next ?? initialValues);
    setErrors({});
    // `initialValues` este stabil prin construcție (obiect literal la montare).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = useCallback(
    (onValid: (data: z.output<Schema>) => void | Promise<void>) =>
      async (event?: React.FormEvent) => {
        event?.preventDefault();
        const result = schema.safeParse(values);
        if (!result.success) {
          const fieldErrors: Record<string, string> = {};
          for (const issue of result.error.issues) {
            const key = String(issue.path[0] ?? "_");
            if (!fieldErrors[key]) fieldErrors[key] = issue.message;
          }
          setErrors(fieldErrors);
          return false;
        }
        setSubmitting(true);
        try {
          await onValid(result.data as z.output<Schema>);
          return true;
        } finally {
          setSubmitting(false);
        }
      },
    [schema, values],
  );

  return { values, set, setValues, errors, setErrors, handleSubmit, submitting, reset };
}

/** Mesaje de validare refolosite, în română. */
export const required = (label: string) => `${label} este obligatoriu`;
