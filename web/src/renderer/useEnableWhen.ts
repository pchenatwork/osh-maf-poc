import fhirpath from "fhirpath";
import fhirpath_r4_model from "fhirpath/fhir-context/r4";
import type {
  Questionnaire,
  QuestionnaireItem,
  QuestionnaireItemEnableWhen,
  QuestionnaireResponse,
  QuestionnaireResponseItem,
  QuestionnaireResponseItemAnswer,
} from "../item-controls/contract";

const ENABLE_WHEN_EXPR =
  "http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-enableWhenExpression";

/** Pull the typed value out of an answer, whatever its type. */
function answerValue(a: QuestionnaireResponseItemAnswer): unknown {
  return (
    a.valueBoolean ??
    a.valueString ??
    a.valueInteger ??
    a.valueDecimal ??
    a.valueDate ??
    a.valueDateTime ??
    a.valueTime ??
    a.valueCoding?.code ??
    a.valueQuantity?.value
  );
}

/** Pull the comparison value out of an enableWhen condition. */
function conditionValue(c: QuestionnaireItemEnableWhen): unknown {
  return (
    c.answerBoolean ??
    c.answerString ??
    c.answerInteger ??
    c.answerDecimal ??
    c.answerDate ??
    c.answerDateTime ??
    c.answerTime ??
    c.answerCoding?.code ??
    c.answerQuantity?.value
  );
}

function findAnswers(
  items: QuestionnaireResponseItem[] | undefined,
  linkId: string,
): QuestionnaireResponseItemAnswer[] {
  for (const it of items ?? []) {
    if (it.linkId === linkId) return it.answer ?? [];
    const found = findAnswers(it.item, linkId);
    if (found.length) return found;
  }
  return [];
}

function evalCondition(
  c: QuestionnaireItemEnableWhen,
  response: QuestionnaireResponse,
): boolean {
  const answers = findAnswers(response.item, c.question);

  if (c.operator === "exists") {
    return answers.length > 0 === (c.answerBoolean ?? true);
  }
  if (answers.length === 0) return false;

  const target = conditionValue(c);

  return answers.some((a) => {
    const v = answerValue(a);
    switch (c.operator) {
      case "=":
        return v === target;
      case "!=":
        return v !== target;
      case ">":
        return Number(v) > Number(target);
      case "<":
        return Number(v) < Number(target);
      case ">=":
        return Number(v) >= Number(target);
      case "<=":
        return Number(v) <= Number(target);
      default:
        return false;
    }
  });
}

export function makeIsEnabled(response: QuestionnaireResponse) {
  return (item: QuestionnaireItem): boolean => {
    // 1. FHIRPath-based enableWhenExpression
    const expr = item.extension?.find(
      (e) => e.url === ENABLE_WHEN_EXPR,
    )?.valueExpression;

    if (expr?.expression) {
      const result = fhirpath.evaluate(
        response,
        expr.expression,
        { resource: response },
        fhirpath_r4_model,
      );

      if (result instanceof Promise) {
        throw new Error(
          "Asynchronous FHIRPath expressions are not supported here.",
        );
      }

      return result.length > 0 && result[0] === true;
    }

    // 2. No enableWhen → enabled by default
    if (!item.enableWhen?.length) return true;

    // 3. Standard FHIR enableWhen conditions
    const results = item.enableWhen.map((condition) =>
      evalCondition(condition, response),
    );
    // FHIR default is "all" when enableBehavior isn't specified
    return item.enableBehavior === "any"
      ? results.some(Boolean)
      : results.every(Boolean);
  };
}

/** Strip answers for items that are currently hidden. Call before submit. */
export function pruneDisabled(
  q: Questionnaire,
  response: QuestionnaireResponse,
): QuestionnaireResponse {
  const isEnabled = makeIsEnabled(response);

  const walk = (
    qItems: QuestionnaireItem[] = [],
    rItems: QuestionnaireResponseItem[] = [],
  ): QuestionnaireResponseItem[] =>
    qItems.filter(isEnabled).map((qi) => {
      const ri = rItems.find((r) => r.linkId === qi.linkId) ?? {
        linkId: qi.linkId,
      };
      return qi.item ? { ...ri, item: walk(qi.item, ri.item) } : ri;
    });

  return { ...response, item: walk(q.item, response.item) };
}
