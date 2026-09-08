import type { QuestionnaireItemProps } from "../contract";
import { errorIdOf, isEditable } from "../contract";
import { Field } from "../Field";
import shared from "../item-controls.module.css";

export const IntegerControl = ({
  item,
  answers,
  setAnswers,
  errors,
  mode,
}: QuestionnaireItemProps) => {
  const selected = answers[0]?.valueInteger ?? "";
  const id = `q-${item.linkId}`;

  if (!isEditable(mode)) {
    return (
      <Field item={item} id={id} errors={[]}>
        <span className={shared.value}>{selected === "" ? "—" : selected}</span>
      </Field>
    );
  }

  return (
    <Field item={item} id={id} errors={errors} htmlFor={id}>
      <input
        type="number"
        id={id}
        value={selected}
        aria-required={item.required || undefined}
        aria-invalid={errors.length > 0 || undefined}
        aria-describedby={errors.length ? errorIdOf(id) : undefined}
        onChange={(e) => {
          const value = e.target.value
            ? parseInt(e.target.value, 10)
            : undefined;
          setAnswers(value !== undefined ? [{ valueInteger: value }] : []);
        }}
      />
    </Field>
  );
};
