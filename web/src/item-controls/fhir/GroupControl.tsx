import type { QuestionnaireItemProps } from "../contract";
import shared from "../item-controls.module.css";
export const GroupControl = ({ item, children }: QuestionnaireItemProps) => (
  <fieldset className={shared.group}>
    {item.text && <legend>{item.text}</legend>}
    {children}
  </fieldset>
);
