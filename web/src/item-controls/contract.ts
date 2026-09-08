/**
 * Defines the interfaces that every control in [fhir] and [osh] must implement.
 * Also defines the RenderMode type and related helpers.
 *
 * [fhir]: https://www.hl7.org/fhir/questionnaire.html
 * [osh]: Custom controls specific to the NYC DOE Office of School Health (OSH) implementation of FHIR.
 */
import type {
  Questionnaire,
  QuestionnaireItem,
  QuestionnaireItemAnswerOption,
  QuestionnaireItemEnableWhen,
  QuestionnaireResponse,
  QuestionnaireResponseItem,
  QuestionnaireResponseItemAnswer,
} from "fhir/r4";
import type { FC, ReactNode } from "react";

/**
 * Single import point for FHIR types. Every other file imports from here,
 * never from 'fhir/r4' directly (enforced by lint — see eslint.config.js).
 * An R4 -> R5 move changes this block and nothing else.
 */
export type {
  Questionnaire,
  QuestionnaireItem,
  QuestionnaireItemAnswerOption,
  QuestionnaireItemEnableWhen,
  QuestionnaireResponse,
  QuestionnaireResponseItem,
  QuestionnaireResponseItemAnswer,
};

/**
 * How a render is presented. Purely a UI concern — unrelated to
 * QuestionnaireResponse.status, which carries workflow state.
 *
 * Two underlying axes: is it editable, and what medium is it for.
 * The fourth combination (editable on paper) is nonsense, so this is
 * a flat three-value union rather than a pair of booleans.
 */
export type RenderMode = "edit" | "view" | "print";

/** True when the user can change answers. */
export const isEditable = (mode: RenderMode): boolean => mode === "edit";

/** True when rendering for paper rather than screen. */
export const isPrint = (mode: RenderMode): boolean => mode === "print";

/**
 * How an item places its label against its field.
 *
 * The default is horizontal — label on the left — which is the shape of nearly
 * every row on the paper MAF. An item opts back into label-above-input with a
 * local extension:
 *
 *   http://schools.nyc.gov/osh/StructureDefinition/label-orientation
 *   valueCode: "horizontal" | "vertical"        (absent -> horizontal)
 *
 * This is NOT the HL7 questionnaire-choiceOrientation extension ChoiceControl
 * reads. That one stacks the answer options relative to *each other*; this one
 * places the label relative to the *field*. Both can appear on the same choice
 * item and mean different things. Do not merge them.
 *
 * Field.tsx is the only component that reads this — every control gets the
 * behaviour by rendering through it.
 */
export const LABEL_ORIENTATION =
  "http://schools.nyc.gov/osh/StructureDefinition/label-orientation";

export type LabelOrientation = "horizontal" | "vertical";

export function readLabelOrientation(item: QuestionnaireItem): LabelOrientation {
  const code = item.extension?.find((e) => e.url === LABEL_ORIENTATION)?.valueCode;
  return code === "vertical" ? "vertical" : "horizontal";
}

/**
 * The two ids Field.tsx renders, derived from an item's base id (`q-${linkId}`).
 *
 * A control needs them to wire aria-labelledby and aria-describedby onto its
 * own input, which Field cannot do for it. Deriving them in one place is what
 * keeps the two halves from drifting apart.
 */
export const labelIdOf = (id: string) => `${id}-label`;
export const errorIdOf = (id: string) => `${id}-err`;

/**
 * Address of one item occurrence within the response tree.
 *
 * A bare linkId is NOT enough: a repeating group has several occurrences of the
 * same linkId, and they must be addressable separately. Asthma has no repeating
 * groups so every path here is length-1 with index 0 — but General, Seizure and
 * Diabetes all have order tables, and retrofitting a path later means rewriting
 * every control.
 */
export type ItemPath = ReadonlyArray<{ linkId: string; index: number }>;

/** Props for a component that renders one Questionnaire.item. */
export interface QuestionnaireItemProps {
  item: QuestionnaireItem;
  path: ItemPath;
  answers: QuestionnaireResponseItemAnswer[];
  setAnswers: (answers: QuestionnaireResponseItemAnswer[]) => void;
  errors: string[];
  mode: RenderMode;

  /**
   * Children in document order. Group items only.
   *
   * Deliberately opaque: a control places the block, not the pieces. An
   * earlier `childSlots` prop handed the same children back keyed by linkId
   * suffix so a control could position each one — it was never wired up, and
   * removing it cost nothing. See Appendix F.
   */
  children?: ReactNode;
}

/** A component that renders one Questionnaire.item. */
export type QuestionnaireItemControl = FC<QuestionnaireItemProps>;
