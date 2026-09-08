import type {
  QuestionnaireItem,
  QuestionnaireItemAnswerOption,
  QuestionnaireItemProps,
  QuestionnaireResponseItemAnswer,
} from "../contract";
import { errorIdOf, isEditable, labelIdOf } from "../contract";
import { Field } from "../Field";
import styles from "./ChoiceControl.module.css";
import shared from "../item-controls.module.css";

/**
 * Renders a `choice` item as a label and a set of choices — by default the
 * label on the left, the shape of nearly every row on the paper MAF.
 *
 * Everything configurable is configured from the Questionnaire, using
 * extensions HL7 already publishes. No OSH vocabulary appears in this file, so
 * a Seizure or Diabetes form gets the same behaviour without a code change.
 *
 *   item.text                        the label. ABSENT -> no label column at all.
 *   item.required                    marks the label, sets aria-required.
 *   item.repeats                     false -> radios (single), true -> checkboxes (multi).
 *   questionnaire-choiceOrientation  'horizontal' | 'vertical'  (default: vertical)
 *   questionnaire-itemControl        'radio-button' | 'check-box' | 'drop-down'
 *   item.answerOption[]              the choices themselves.
 *
 * Two extensions in this file are named for the same idea and do different
 * jobs — check which one you mean before touching either:
 *
 *   questionnaire-itemControl (HL7)  a *presentation* hint within this control.
 *     NOT the OSH item-control extension in item-controls/index.ts, which
 *     selects which component renders at all. Different URL, different value
 *     type (CodeableConcept vs. code).
 *
 *   questionnaire-choiceOrientation (HL7)  how the options stack against *each
 *     other*, read below. NOT the OSH label-orientation extension in contract.ts,
 *     which places the label relative to the *field*. Both can appear on the
 *     same item and mean different things.
 *
 * Do not merge them.
 */

const CHOICE_ORIENTATION =
  "http://hl7.org/fhir/StructureDefinition/questionnaire-choiceOrientation";

const FHIR_ITEM_CONTROL =
  "http://hl7.org/fhir/StructureDefinition/questionnaire-itemControl";

type Orientation = "horizontal" | "vertical";
type Presentation = "radio" | "checkbox" | "dropdown";

/** An answerOption flattened into the three things the DOM needs. */
interface Choice {
  /** Stable identity, used as React key, radio value, and selection compare. */
  key: string;
  label: string;
  /** The answer this choice writes into the QuestionnaireResponse. */
  answer: QuestionnaireResponseItemAnswer;
}

function readOrientation(item: QuestionnaireItem): Orientation {
  const code = item.extension?.find((e) => e.url === CHOICE_ORIENTATION)
    ?.valueCode;
  return code === "horizontal" ? "horizontal" : "vertical";
}

function readPresentation(item: QuestionnaireItem): Presentation {
  // Unlike the OSH extension, the HL7 itemControl value is a CodeableConcept.
  const codes = item.extension
    ?.find((e) => e.url === FHIR_ITEM_CONTROL)
    ?.valueCodeableConcept?.coding?.map((c) => c.code);

  if (codes?.includes("drop-down")) {
    // SPEC-GAP: a multi-select <select> is worse than checkboxes on every
    // axis that matters here, so a repeating drop-down degrades to check-box.
    return item.repeats ? "checkbox" : "dropdown";
  }
  if (codes?.includes("check-box")) return "checkbox";
  if (codes?.includes("radio-button")) return item.repeats ? "checkbox" : "radio";

  return item.repeats ? "checkbox" : "radio";
}

/**
 * answerOption and answer are different types that carry the same value, so
 * both sides are reduced to one string. Keying on the code alone would collide
 * across code systems; keying on the object identity would never match, since
 * the response is re-parsed from JSON.
 */
function keyOfValue(
  v: QuestionnaireItemAnswerOption | QuestionnaireResponseItemAnswer,
): string | undefined {
  if (v.valueCoding) return `c|${v.valueCoding.system ?? ""}|${v.valueCoding.code ?? ""}`;
  if (v.valueString !== undefined) return `s|${v.valueString}`;
  if (v.valueInteger !== undefined) return `i|${v.valueInteger}`;
  if (v.valueDate !== undefined) return `d|${v.valueDate}`;
  if (v.valueTime !== undefined) return `t|${v.valueTime}`;
  if (v.valueReference?.reference) return `r|${v.valueReference.reference}`;
  return undefined;
}

function toChoice(option: QuestionnaireItemAnswerOption): Choice | undefined {
  const key = keyOfValue(option);
  if (key === undefined) return undefined;

  if (option.valueCoding) {
    return {
      key,
      label: option.valueCoding.display ?? option.valueCoding.code ?? "",
      answer: { valueCoding: option.valueCoding },
    };
  }
  if (option.valueString !== undefined) {
    return { key, label: option.valueString, answer: { valueString: option.valueString } };
  }
  if (option.valueInteger !== undefined) {
    return {
      key,
      label: String(option.valueInteger),
      answer: { valueInteger: option.valueInteger },
    };
  }
  if (option.valueDate !== undefined) {
    return { key, label: option.valueDate, answer: { valueDate: option.valueDate } };
  }
  if (option.valueTime !== undefined) {
    return { key, label: option.valueTime, answer: { valueTime: option.valueTime } };
  }
  if (option.valueReference) {
    return {
      key,
      label: option.valueReference.display ?? option.valueReference.reference ?? "",
      answer: { valueReference: option.valueReference },
    };
  }
  return undefined;
}

export const ChoiceControl = ({
  item,
  answers,
  setAnswers,
  errors,
  mode,
}: QuestionnaireItemProps) => {
  const id = `q-${item.linkId}`;
  const errorId = errorIdOf(id);
  const labelId = labelIdOf(id);

  const choices = (item.answerOption ?? [])
    .map(toChoice)
    .filter((c): c is Choice => c !== undefined);

  const selected = new Set(
    answers.map(keyOfValue).filter((k): k is string => k !== undefined),
  );

  const hasLabel = Boolean(item.text);
  const orientation = readOrientation(item);
  const presentation = readPresentation(item);

  /* ---------- read-only: view and print ---------- */

  if (!isEditable(mode)) {
    const chosen = choices.filter((c) => selected.has(c.key)).map((c) => c.label);
    return (
      <Field item={item} id={id} errors={[]}>
        <span className={shared.value}>{chosen.length ? chosen.join(", ") : "—"}</span>
      </Field>
    );
  }

  /* ---------- edit ---------- */

  const select = (choice: Choice) => {
    if (presentation === "radio" || presentation === "dropdown") {
      setAnswers([choice.answer]);
      return;
    }
    // Rebuild from the option order rather than appending, so the answer array
    // is canonical regardless of the order the user clicked. That stability
    // matters once the response JSON is hashed for the signature block.
    const next = new Set(selected);
    if (next.has(choice.key)) next.delete(choice.key);
    else next.add(choice.key);
    setAnswers(choices.filter((c) => next.has(c.key)).map((c) => c.answer));
  };

  const errorProps = {
    "aria-invalid": errors.length > 0 || undefined,
    "aria-describedby": errors.length ? errorId : undefined,
  };

  const field =
    presentation === "dropdown" ? (
      <select
        id={id}
        value={choices.find((c) => selected.has(c.key))?.key ?? ""}
        aria-required={item.required || undefined}
        {...errorProps}
        onChange={(e) => {
          const choice = choices.find((c) => c.key === e.target.value);
          setAnswers(choice ? [choice.answer] : []);
        }}
      >
        <option value="">— select —</option>
        {choices.map((c) => (
          <option key={c.key} value={c.key}>
            {c.label}
          </option>
        ))}
      </select>
    ) : (
      // A <fieldset>/<legend> cannot be laid out as a two-column grid
      // reliably — the legend is out of flow. role + aria-labelledby is the
      // accessible equivalent with none of the layout constraints.
      //
      // There is deliberately no aria-label fallback when the item has no
      // text: an unnamed group is better than a screen reader announcing a
      // linkId, which is a developer string, not a human-facing name.
      <div
        role={presentation === "radio" ? "radiogroup" : "group"}
        aria-labelledby={hasLabel ? labelId : undefined}
        aria-required={item.required || undefined}
        {...errorProps}
        className={`${styles.options} ${
          orientation === "horizontal"
            ? styles.optionsHorizontal
            : styles.optionsVertical
        }`}
      >
        {choices.map((c) => (
          <label key={c.key} className={styles.option} htmlFor={`${id}-${c.key}`}>
            <input
              id={`${id}-${c.key}`}
              type={presentation === "radio" ? "radio" : "checkbox"}
              name={id}
              value={c.key}
              checked={selected.has(c.key)}
              onChange={() => select(c)}
            />
            <span>{c.label}</span>
          </label>
        ))}
      </div>
    );

  return (
    // Only the drop-down has a single focusable input to point a real <label>
    // at; the radio and checkbox groups keep aria-labelledby instead.
    <Field
      item={item}
      id={id}
      errors={errors}
      htmlFor={presentation === "dropdown" ? id : undefined}
    >
      {field}

      {/* A radio group cannot be cleared by clicking, so an optional item
          would otherwise be a one-way door after a misclick. */}
      {presentation === "radio" && !item.required && selected.size > 0 && (
        <button
          type="button"
          className={styles.clear}
          onClick={() => setAnswers([])}
        >
          Clear
        </button>
      )}
    </Field>
  );
};
