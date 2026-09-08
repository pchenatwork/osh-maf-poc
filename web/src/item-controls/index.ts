import type { QuestionnaireItem, QuestionnaireItemControl } from "./contract";
import * as Fhir from "./fhir";
import { AttestationControl } from "./osh/AttestationControl";
import { MedicationOrderControl } from "./osh/MedicationOrderControl";
import { RiskPanelControl } from "./osh/RiskPanelControl";
import { SignatureBlockControl } from "./osh/SignatureBlockControl";

export type {
  QuestionnaireItemProps,
  QuestionnaireItemControl,
  RenderMode,
} from "./contract";

export const OSH_ITEM_CONTROL =
  "http://schools.nyc.gov/osh/StructureDefinition/item-control";

/**
 * Two keys, two sources:
 *   - a standard FHIR item.type -> a control in ./fhir
 *   - a local item-control code -> a control in ./osh
 */
const itemControlRegistry: Record<string, QuestionnaireItemControl> = {
  string: Fhir.StringControl,
  text: Fhir.TextControl,
  integer: Fhir.IntegerControl,
  decimal: Fhir.DecimalControl,
  boolean: Fhir.BooleanControl,
  date: Fhir.DateControl,
  dateTime: Fhir.DateTimeControl,
  choice: Fhir.ChoiceControl,
  "open-choice": Fhir.OpenChoiceControl,
  display: Fhir.DisplayControl,
  group: Fhir.GroupControl,
  // OSH controls appended here as they are built
  // local item-control codes
  "osh-signature-block": SignatureBlockControl,
  "osh-medication-order": MedicationOrderControl,
  "osh-attestation": AttestationControl,
  "osh-risk-panel": RiskPanelControl,
};

export function resolveItemControl(
  item: QuestionnaireItem,
): QuestionnaireItemControl {
  const control = item.extension?.find(
    (e) => e.url === OSH_ITEM_CONTROL,
  )?.valueCode;
  return itemControlRegistry[control ?? item.type] ?? Fhir.UnsupportedControl;
}
