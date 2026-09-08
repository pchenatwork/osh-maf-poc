import type { QuestionnaireItemProps } from "../contract";
import shared from "../item-controls.module.css";

/** Placeholder — not in the lab manual yet. To be implemented. */
export const OpenChoiceControl = ({ item }: QuestionnaireItemProps) => (
  <div className={shared.unsupported} role="note">
    OpenChoiceControl type: <code>{item.type}</code> (linkId:{" "}
    <code>{item.linkId}</code>)
  </div>
);
