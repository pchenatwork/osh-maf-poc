import { useState, useCallback, useMemo } from "react";
import type {
  Questionnaire,
  QuestionnaireItem,
  QuestionnaireResponse,
  QuestionnaireResponseItem,
  QuestionnaireResponseItemAnswer,
} from "../item-controls/contract";

/** Build an empty response mirroring the questionnaire's item tree. */
function scaffold(
  items: QuestionnaireItem[] = [],
): QuestionnaireResponseItem[] {
  return items.map((i) =>
    i.item
      ? { linkId: i.linkId, text: i.text, item: scaffold(i.item) }
      : { linkId: i.linkId, text: i.text, answer: [] },
  );
}

function findItem(
  items: QuestionnaireResponseItem[] | undefined,
  linkId: string,
): QuestionnaireResponseItem | undefined {
  for (const it of items ?? []) {
    if (it.linkId === linkId) return it;
    const found = findItem(it.item, linkId);
    if (found) return found;
  }
  return undefined;
}

export function useResponseState(questionnaire: Questionnaire) {
  const [response, setResponse] = useState<QuestionnaireResponse>(() => ({
    resourceType: "QuestionnaireResponse",
    questionnaire: `${questionnaire.url}|${questionnaire.version}`,
    status: "in-progress",
    item: scaffold(questionnaire.item),
  }));

  const getAnswers = useCallback(
    (linkId: string): QuestionnaireResponseItemAnswer[] =>
      findItem(response.item, linkId)?.answer ?? [],
    [response],
  );

  const setAnswers = useCallback(
    (linkId: string, answers: QuestionnaireResponseItemAnswer[]) => {
      setResponse((prev) => {
        const next = structuredClone(prev);
        const target = findItem(next.item, linkId);
        if (target) target.answer = answers;
        return next;
      });
    },
    [],
  );

  return useMemo(
    () => ({ response, getAnswers, setAnswers, setResponse }),
    [response, getAnswers, setAnswers],
  );
}
