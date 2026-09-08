import type { QuestionnaireItemProps } from "../contract";
import shared from "../item-controls.module.css";
import styles from "./RiskPanelControl.module.css";

/**
 * The Y/N/U risk panel: one question per row, the answer ahead of the question
 * it answers, the way the paper MAF prints this panel.
 *
 *   [ O Y  O N  O U ]  History of asthma-related hospitalizations *  How many times * [__]  Last occurrence [__/__/____]
 *
 * THE DEFINITION CONTRACT
 * -----------------------
 * Every child of the panel is a `group`, and that group is one line: a
 * `choice` answer carrying questionnaire-choiceOrientation = horizontal,
 * followed by however many qualifiers that answer turns on through enableWhen
 * (none, or "How many times" and "Last occurrence", or a free-text "Specify").
 * The group's own text repeats the answer's, so the line extracts as one
 * Observation.component and the panel still reads correctly without CSS.
 *
 * The layout depends on that wrapper and nothing substitutes for it: CSS
 * cannot group siblings, and flex has no "break here", so a form that lists
 * the same items flat under the panel renders as one long wrapping run rather
 * than a row per question. Forms are expected to conform; this control does
 * not detect or repair the flat shape.
 *
 * Pure layout, like MedicationOrderControl. It reads no answers and calls no
 * setters — the walker has already rendered every line, and GroupControl has
 * already drawn each one's fieldset. This control only decides where those
 * lines sit and which way round each one reads.
 *
 * That last part is the interesting bit, because a control cannot reach inside
 * a child it did not render. It does not have to. Two channels cross the
 * module boundary that scoped class names deliberately cannot:
 *
 *   - the `--item-*` custom properties the shared item vocabulary publishes
 *     as its style API (see item-controls.module.css). Properties are
 *     inherited *values*, not names, so setting them on a line reaches every
 *     item underneath at any depth.
 *   - `data-item-type`, stamped by Field.tsx, which lets this panel flip only
 *     its choice items and leave the qualifiers label-first.
 *
 * The child declares which knobs exist; the container turns them; neither
 * learns the other's internals.
 *
 * Nothing here is asthma-specific. Any form with a column of same-shaped
 * choice rows — a seizure trigger checklist, an allergy panel — gets this
 * layout by putting the osh-risk-panel extension on the group.
 */
export const RiskPanelControl = ({
  item,
  children,
  errors,
}: QuestionnaireItemProps) => (
  <fieldset className={styles.panel}>
    {item.text && <legend className={styles.legend}>{item.text}</legend>}

    {/* The lines render themselves: each child group is a fieldset, and the
        stylesheet turns it into the row. No wrapper element here — one less
        thing between the panel and the selectors that style it. */}
    {children}

    {errors.length > 0 && (
      <div role="alert" className={shared.error}>
        {errors.join(" ")}
      </div>
    )}
  </fieldset>
);
