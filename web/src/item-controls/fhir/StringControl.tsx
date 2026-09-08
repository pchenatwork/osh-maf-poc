import type { QuestionnaireItemProps } from "../contract";
import { errorIdOf, isEditable } from "../contract";
import { Field } from "../Field";
import shared from "../item-controls.module.css";

export const StringControl = ({
  item,
  answers,
  setAnswers,
  errors,
  mode,
}: QuestionnaireItemProps) => {
  const value = answers[0]?.valueString ?? "";
  const id = `q-${item.linkId}`;

  if (!isEditable(mode)) {
    return (
      <Field item={item} id={id} errors={[]}>
        <span className={shared.value}>{value || "—"}</span>
      </Field>
    );
  }

  return (
    <Field item={item} id={id} errors={errors} htmlFor={id}>
      <input
        id={id}
        type="text"
        value={value}
        aria-required={item.required || undefined}
        aria-invalid={errors.length > 0 || undefined}
        aria-describedby={errors.length ? errorIdOf(id) : undefined}
        onChange={(e) =>
          setAnswers(e.target.value ? [{ valueString: e.target.value }] : [])
        }
      />
    </Field>
  );
};
