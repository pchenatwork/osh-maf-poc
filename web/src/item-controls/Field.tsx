import type { ReactNode } from "react";
import type { QuestionnaireItem } from "./contract";
import { errorIdOf, labelIdOf, readLabelOrientation } from "./contract";
import shared from "./item-controls.module.css";

/**
 * The label / field / error shell every question control renders.
 *
 * No `Control` suffix on purpose: this is a plain helper, not something the
 * registry can resolve (Appendix E). It exists because seven controls were
 * hand-rolling the same four elements, which meant a layout change was a
 * seven-file change — and label orientation is exactly such a change.
 *
 * The orientation itself is read from the item by `readLabelOrientation` in
 * contract.ts, which documents the extension. Horizontal (label on the left)
 * is the default; below 720px the shared stylesheet forces every item vertical
 * regardless, so a horizontal item is never a horizontal scroll on a phone.
 *
 * A control keeps ownership of its own input and its own aria wiring: Field
 * renders the label and the error node and publishes their ids through
 * `labelIdOf` / `errorIdOf`, but it is the control that points at them.
 *
 * The wrapper carries `data-item-type` so a container can restyle one kind of
 * row — see RiskPanelControl.module.css, which flips only its choice rows.
 */

interface FieldProps {
  item: QuestionnaireItem;
  errors: string[];
  /** Base id for the item, conventionally `q-${item.linkId}`. */
  id: string;
  /**
   * The id of the single focusable input, which makes the label a real
   * <label htmlFor>. Omit for a grouped control (radios, checkboxes): the
   * label renders as a <span> that the group points at with aria-labelledby,
   * because a <legend> cannot be laid out as a grid cell.
   */
  htmlFor?: string;
  /** The input itself, plus anything that belongs beside it. */
  children: ReactNode;
}

export const Field = ({ item, errors, id, htmlFor, children }: FieldProps) => {
  const hasLabel = Boolean(item.text);

  const className = [
    shared.item,
    readLabelOrientation(item) === "vertical" && shared.vertical,
    !hasLabel && shared.noLabel,
  ]
    .filter(Boolean)
    .join(" ");

  const text = (
    <>
      {item.text}
      {item.required && <span aria-hidden="true"> *</span>}
    </>
  );

  return (
    // data-item-type is a container hook, not a style name: a class cannot
    // cross a module boundary, but an attribute can, so a container like
    // RiskPanelControl can style one kind of row without naming a class it is
    // not allowed to know. It carries the FHIR item.type verbatim.
    <div className={className} data-item-type={item.type}>
      {hasLabel &&
        (htmlFor ? (
          <label className={shared.label} id={labelIdOf(id)} htmlFor={htmlFor}>
            {text}
          </label>
        ) : (
          <span className={shared.label} id={labelIdOf(id)}>
            {text}
          </span>
        ))}

      <div className={shared.field}>
        {children}
        {errors.length > 0 && (
          <div id={errorIdOf(id)} role="alert" className={shared.error}>
            {errors.join(" ")}
          </div>
        )}
      </div>
    </div>
  );
};
