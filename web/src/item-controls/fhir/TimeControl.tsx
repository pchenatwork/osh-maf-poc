import type { QuestionnaireItemProps } from "../contract";
import { TemporalField } from "./TemporalField";

/** FHIR `time`. All three temporal controls share TemporalField. */
export const TimeControl = (props: QuestionnaireItemProps) => (
  <TemporalField {...props} kind="time" />
);
