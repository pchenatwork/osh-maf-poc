import type { QuestionnaireItemProps } from "../contract";
import { errorIdOf, isEditable } from "../contract";
import styles from "./AttestationControl.module.css";
import shared from "../item-controls.module.css";

/**
 * A statement someone affirms by ticking a box: the not-a-resident
 * attestation, the self-administration attestation, and both parent consents.
 *
 * Every item carrying osh-attestation in asthma-maf is a `boolean` LEAF — no
 * children at all. So this renders the input itself rather than arranging
 * children, and it is the one OSH control that is not pure layout.
 *
 * It does not use `Field`, because Field's label sits in its own grid column
 * beside the input. An attestation is the reverse shape: a small control in
 * front of a long sentence, where the sentence is what is being agreed to.
 * Putting a paragraph of consent text in a 20rem label column would be
 * unreadable, and reading it is the entire point.
 */
export const AttestationControl = ({
  item,
  answers,
  setAnswers,
  errors,
  mode,
}: QuestionnaireItemProps) => {
  const agreed = answers[0]?.valueBoolean === true;
  const id = `q-${item.linkId}`;

  if (!isEditable(mode)) {
    return (
      <p className={styles.attestation}>
        <span className={styles.mark} aria-hidden="true">
          {agreed ? "☑" : "☐"}
        </span>
        <span className={styles.statement}>{item.text}</span>
        <span className={shared.value}>{agreed ? " (agreed)" : " (not agreed)"}</span>
      </p>
    );
  }

  return (
    <div className={styles.attestation}>
      <label className={styles.row} htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          checked={agreed}
          aria-required={item.required || undefined}
          aria-invalid={errors.length > 0 || undefined}
          aria-describedby={errors.length ? errorIdOf(id) : undefined}
          onChange={(e) =>
            // Unticking clears the answer rather than recording `false`.
            // An unticked consent is not a refusal on record, it is an
            // unanswered required item — which is what should block submit.
            setAnswers(e.target.checked ? [{ valueBoolean: true }] : [])
          }
        />
        <span className={styles.statement}>
          {item.text}
          {item.required && <span aria-hidden="true"> *</span>}
        </span>
      </label>

      {errors.length > 0 && (
        <div id={errorIdOf(id)} role="alert" className={shared.error}>
          {errors.join(" ")}
        </div>
      )}
    </div>
  );
};
