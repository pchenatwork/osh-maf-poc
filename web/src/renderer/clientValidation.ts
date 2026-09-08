import type {
  Questionnaire,
  QuestionnaireItem,
  QuestionnaireResponse,
  QuestionnaireResponseItem,
  QuestionnaireResponseItemAnswer,
} from "../item-controls/contract";
import { makeIsEnabled } from "./useEnableWhen";

export function validateClient(
  q: Questionnaire,
  response: QuestionnaireResponse,
): Record<string, string[]> {
  const isEnabled = makeIsEnabled(response);
  const errors: Record<string, string[]> = {};

  const add = (linkId: string, msg: string) => {
    (errors[linkId] ??= []).push(msg);
  };

  const findAnswers = (
    items: QuestionnaireResponseItem[] | undefined,
    linkId: string,
  ): QuestionnaireResponseItemAnswer[] => {
    for (const it of items ?? []) {
      if (it.linkId === linkId) return it.answer ?? [];
      const f = findAnswers(it.item, linkId);
      if (f.length) return f;
    }
    return [];
  };

  const walk = (items: QuestionnaireItem[] = []) => {
    for (const item of items) {
      if (!isEnabled(item)) continue;

      if (item.type !== "group" && item.type !== "display") {
        const answers = findAnswers(response.item, item.linkId);
        if (item.required && answers.length === 0) {
          add(item.linkId, `${item.text ?? "This field"} is required.`);
        }
        if (!item.repeats && answers.length > 1) {
          add(item.linkId, "Only one answer is allowed.");
        }
      }

      walk(item.item);
    }
  };

  walk(q.item);
  return errors;
}
