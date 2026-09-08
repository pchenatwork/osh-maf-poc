import type { QuestionnaireItem, QuestionnaireItemProps } from "../contract";
import styles from "./DisplayControl.module.css";

/**
 * FHIR `display`: text the form shows and never asks about. It carries no
 * answer, so this control reads `item` and nothing else — no answers, no
 * setAnswers, and no RenderMode branch, because read-only is the only mode a
 * display item has.
 *
 * On the asthma MAF these are not decoration. They are the eight numbered
 * consent paragraphs a parent is agreeing to, the emergency plan, and the
 * notice that a resident may not sign the form. Rendering them faithfully is
 * a legal requirement, not a styling preference — which is exactly why the
 * XHTML decision below goes the way it does.
 */

const DISPLAY_CATEGORY =
  "http://hl7.org/fhir/StructureDefinition/questionnaire-displayCategory";

/**
 * The three codes in the FHIR R4 value set, no more:
 *
 *   instructions  how to fill the form in
 *   security      how the information will be handled
 *   help          extra guidance about the containing item; the spec says it
 *                 "isn't necessarily expected to be rendered as part of the
 *                 form", so it renders quietly rather than inline-prominent
 *
 * An unrecognised code falls through to the default paragraph rather than
 * being dropped: an unknown category must never cost the reader the text.
 */
type DisplayCategory = "instructions" | "security" | "help";

const CATEGORY_CLASS: Record<DisplayCategory, string> = {
  instructions: styles.instructions,
  security: styles.security,
  help: styles.help,
};

function readCategory(item: QuestionnaireItem): DisplayCategory | undefined {
  const code = item.extension
    ?.find((e) => e.url === DISPLAY_CATEGORY)
    ?.valueCodeableConcept?.coding?.find(
      (c) => c.system === "http://hl7.org/fhir/questionnaire-display-category",
    )?.code;

  return code === "instructions" || code === "security" || code === "help"
    ? code
    : undefined;
}

export const DisplayControl = ({ item }: QuestionnaireItemProps) => {
  // Nothing to say. Not an error, and not an UnsupportedControl case — the
  // type is fully supported, this instance is simply empty.
  if (!item.text) return null;

  const category = readCategory(item);

  /**
   * `http://hl7.org/fhir/StructureDefinition/rendering-xhtml` is deliberately
   * NOT honoured, which is why it appears nowhere in this file.
   *
   * It carries server-supplied markup, and rendering it means
   * dangerouslySetInnerHTML on a string that arrived over the network. This
   * form is served to parents and outside practitioners on the public
   * internet (N5). N5 names eval() and new Function() because those were the
   * live temptations when it was written; injected markup is the same hole
   * with a different entry point — a definition is data, and data must never
   * become executable.
   *
   * So the plain `item.text` renders and the markup is dropped. FHIR requires
   * the extension to be an equivalent of that string, so nothing the reader
   * needs is lost — only bold and tables.
   *
   * If rich text becomes a real requirement, the answer is a sanitiser
   * (DOMPurify) with an allow-list, plus a decision-log entry — never a
   * direct innerHTML.
   */

  return (
    <p
      className={`${styles.display}${category ? ` ${CATEGORY_CLASS[category]}` : ""}`}
      role={category ? "note" : undefined}
    >
      {item.text}
    </p>
  );
};
