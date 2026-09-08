import type { QuestionnaireItemProps } from "../contract";
import shared from "../item-controls.module.css";
export const UnsupportedControl = ({ item }: QuestionnaireItemProps) => (
  <div className={shared.unsupported} role="note">
    Unsupported item type: <code>{item.type}</code> (linkId:{" "}
    <code>{item.linkId}</code>)
  </div>
);
