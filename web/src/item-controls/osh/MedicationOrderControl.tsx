import type { QuestionnaireItemProps } from "../contract";
import styles from "./MedicationOrderControl.module.css";
import shared from "../item-controls.module.css";

/**
 * One medication order, laid out as a row of fields.
 *
 * Pure layout: it reads no answers and calls no setters. The children the
 * walker already rendered own all of that.
 *
 * The grid is auto-fitting rather than a fixed set of named columns, because
 * the order groups in asthma-maf carry anywhere from one child to eight, and
 * no two agree on which. `order.standard-albuterol` is a single boolean;
 * `order.other-ics` is name, strength, dose, route, frequency and two times.
 * A five-column drug/dose/route/frequency/PRN grid fits none of them.
 *
 * This is what makes it work for any MAF: it assumes a group of fields, not
 * a particular set of fields.
 */
export const MedicationOrderControl = ({
  item,
  children,
  errors,
}: QuestionnaireItemProps) => (
  <fieldset className={styles.order}>
    {item.text && <legend>{item.text}</legend>}

    <div className={styles.grid}>{children}</div>

    {errors.length > 0 && (
      <div role="alert" className={shared.error}>
        {errors.join(" ")}
      </div>
    )}
  </fieldset>
);
