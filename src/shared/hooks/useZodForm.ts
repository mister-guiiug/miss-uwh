import { useCallback, useState } from 'react';
import { z } from 'zod';

/**
 * Petit pont formulaire ↔ Zod. Le formulaire détient des `values` (champs bruts,
 * souvent des chaînes) ; à la soumission, on valide via un schéma Zod **strict**
 * (messages FR) et, si tout passe, on reçoit la valeur **parsée et typée**.
 *
 * Distinct des schémas de persistance (lenients via `.catch`) : ici on veut
 * guider la saisie, donc on remonte des erreurs par champ — affichées par les
 * composants `Field` existants (`error` + `aria-invalid`).
 */
export interface ZodForm<TValues, TParsed> {
  values: TValues;
  errors: Partial<Record<keyof TValues, string>>;
  /** Renseigne un champ et efface son erreur (retour immédiat après échec). */
  setValue: <K extends keyof TValues>(key: K, value: TValues[K]) => void;
  /** Met à jour plusieurs champs d'un coup. */
  patch: (values: Partial<TValues>) => void;
  /** Valide ; appelle `onValid(parsed)` si tout passe, sinon pose les erreurs. */
  submit: (onValid: (parsed: TParsed) => void) => void;
}

export function useZodForm<TValues extends Record<string, unknown>, TParsed>(
  schema: z.ZodType<TParsed, z.ZodTypeDef, TValues>,
  initial: TValues
): ZodForm<TValues, TParsed> {
  const [values, setValues] = useState<TValues>(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof TValues, string>>>(
    {}
  );

  const setValue = useCallback(
    <K extends keyof TValues>(key: K, value: TValues[K]) => {
      setValues(v => ({ ...v, [key]: value }));
      setErrors(e => (e[key] === undefined ? e : { ...e, [key]: undefined }));
    },
    []
  );

  const patch = useCallback(
    (next: Partial<TValues>) => setValues(v => ({ ...v, ...next })),
    []
  );

  const submit = useCallback(
    (onValid: (parsed: TParsed) => void) => {
      const result = schema.safeParse(values);
      if (result.success) {
        setErrors({});
        onValid(result.data);
        return;
      }
      const fieldErrors = result.error.flatten().fieldErrors as Record<
        string,
        string[] | undefined
      >;
      const next: Partial<Record<keyof TValues, string>> = {};
      for (const key of Object.keys(fieldErrors)) {
        const message = fieldErrors[key]?.[0];
        if (message) next[key as keyof TValues] = message;
      }
      setErrors(next);
    },
    [schema, values]
  );

  return { values, errors, setValue, patch, submit };
}
