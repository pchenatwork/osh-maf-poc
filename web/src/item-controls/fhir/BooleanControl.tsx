import type { QuestionnaireItemProps } from "../contract";
import { errorIdOf, isEditable, labelIdOf } from "../contract";
import { Field } from "../Field";
import styles from "./BooleanControl.module.css";
import shared from "../item-controls.module.css";

export const BooleanControl = ({
  item,
  answers,
  setAnswers,
  errors,
  mode,
}: QuestionnaireItemProps) => {
  const value = answers[0]?.valueBoolean;
  const id = `q-${item.linkId}`;

  if (!isEditable(mode)) {
    return (
      <Field item={item} id={id} errors={[]}>
        <span className={shared.value}>
          {value === undefined ? "—" : value ? "Yes" : "No"}
        </span>
      </Field>
    );
  }

  return (
    <Field item={item} id={id} errors={errors}>
      {/* A <fieldset>/<legend> cannot be laid out as a two-column grid
          reliably — the legend is out of flow. role + aria-labelledby is the
          accessible equivalent with none of the layout constraints, and is
          what ChoiceControl already uses for the same reason.

          No aria-label fallback when the item has no text: an unnamed group
          is better than a screen reader announcing a linkId. */}
      <div
        role="radiogroup"
        aria-labelledby={item.text ? labelIdOf(id) : undefined}
        aria-required={item.required || undefined}
        aria-invalid={errors.length > 0 || undefined}
        aria-describedby={errors.length ? errorIdOf(id) : undefined}
        className={styles.options}
      >
        {[true, false].map((v) => (
          <label
            key={String(v)}
            className={styles.option}
            htmlFor={`${id}-${v}`}
          >
            <input
              id={`${id}-${v}`}
              type="radio"
              name={id}
              checked={value === v}
              onChange={() => setAnswers([{ valueBoolean: v }])}
            />
            {v ? "Yes" : "No"}
          </label>
        ))}
      </div>
    </Field>
  );
};
