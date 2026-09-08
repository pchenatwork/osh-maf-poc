import { useEffect, useState } from "react";
import type {
  Questionnaire,
  QuestionnaireResponse,
} from "../item-controls/contract";
import { QuestionnaireItemWalker } from "./QuestionnaireItemWalker";
import { RenderModeProvider } from "./RenderMode";
import { useResponseState } from "./useResponseState";
import type { RenderMode } from "../item-controls/contract";
import { isEditable } from "../item-controls/contract";
import { makeIsEnabled, pruneDisabled } from "./useEnableWhen";
import { validateClient } from "./clientValidation";

interface Props {
  questionnaire: Questionnaire;
  mode?: RenderMode;
  onSubmit?: (r: QuestionnaireResponse) => void;
  onChange?: (r: QuestionnaireResponse) => void; // Call ResponseInspector() to see the current response state
  serverErrors?: Record<string, string[]>;
}
//The renderer entry point
export function QuestionnaireRenderer({
  questionnaire,
  mode = "edit",
  onSubmit,
  onChange,
  serverErrors = {},
}: Props) {
  const { response, getAnswers, setAnswers } = useResponseState(questionnaire);
  useEffect(() => {
    onChange?.(response);
  }, [response, onChange]);
  const [showErrors, setShowErrors] = useState(false);

  const isEnabled = makeIsEnabled(response);
  const clientErrors = showErrors
    ? validateClient(questionnaire, response)
    : {};
  const errors = { ...clientErrors, ...serverErrors };

  const handleSubmit = () => {
    setShowErrors(true);
    if (Object.keys(validateClient(questionnaire, response)).length > 0) return;
    onSubmit?.({
      ...pruneDisabled(questionnaire, response),
      status: "completed",
    });
  };

  return (
    <RenderModeProvider mode={mode}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
        noValidate
      >
        <h1>
          {questionnaire.title} - (Ver: {questionnaire.version})
        </h1>
        <QuestionnaireItemWalker
          items={questionnaire.item ?? []}
          getAnswers={getAnswers}
          setAnswers={setAnswers}
          errors={errors}
          isEnabled={isEnabled}
        />
        {isEditable(mode) && <button type="submit">Submit</button>}
      </form>
    </RenderModeProvider>
  );
}
