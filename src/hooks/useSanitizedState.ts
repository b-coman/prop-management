// src/hooks/useSanitizedState.ts
'use client';

import { useState, useCallback, type Dispatch, type SetStateAction } from 'react';
import { sanitizeText } from '@/lib/sanitize'; // Default sanitizer

type SanitizerFunction = (value: string) => string;

/**
 * A custom React hook for managing input string state with built-in sanitization.
 *
 * @param initialValue The initial value of the input.
 * @param sanitizer A function to sanitize the input value. Defaults to a basic text sanitizer.
 * @returns A tuple containing the sanitized value and a setter function.
 */
export function useSanitizedState(
  initialValue: string,
  sanitizer: SanitizerFunction = sanitizeText
): [string, Dispatch<SetStateAction<string>>] {
  const [value, _setValue] = useState<string>(sanitizer(initialValue));

  const setValue: Dispatch<SetStateAction<string>> = useCallback(
    (newValueOrCallback) => {
      _setValue((currentValue) => {
        const resolvedNewValue =
          typeof newValueOrCallback === 'function'
            ? (newValueOrCallback as (prevState: string) => string)(currentValue)
            : newValueOrCallback;
        return sanitizer(resolvedNewValue);
      });
    },
    [sanitizer]
  );

  return [value, setValue];
}
