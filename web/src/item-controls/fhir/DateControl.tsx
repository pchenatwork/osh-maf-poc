import type { QuestionnaireItemProps } from "../contract";
import { TemporalField } from "./TemporalField";

/** FHIR `date`. All three temporal controls share TemporalField. */
export const DateControl = (props: QuestionnaireItemProps) => (
  <TemporalField {...props} kind="date" />
);
