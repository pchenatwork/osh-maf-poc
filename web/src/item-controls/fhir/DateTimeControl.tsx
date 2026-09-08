import type { QuestionnaireItemProps } from "../contract";
import { TemporalField } from "./TemporalField";

/** FHIR `dateTime`. All three temporal controls share TemporalField. */
export const DateTimeControl = (props: QuestionnaireItemProps) => (
  <TemporalField {...props} kind="dateTime" />
);
