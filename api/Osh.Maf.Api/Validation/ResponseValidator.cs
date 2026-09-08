using Hl7.Fhir.Model;

namespace Osh.Maf.Api.Validation;

public sealed record ValidationIssue(string LinkId, string Message);

public sealed class ResponseValidator
{
    public IReadOnlyList<ValidationIssue> Validate(
        Questionnaire q, QuestionnaireResponse r)
    {
        var issues = new List<ValidationIssue>();
        Walk(q.Item, r.Item, r, issues);
        return issues;
    }

    private void Walk(
        List<Questionnaire.ItemComponent>? qItems,
        List<QuestionnaireResponse.ItemComponent>? rItems,
        QuestionnaireResponse root,
        List<ValidationIssue> issues)
    {
        foreach (var qi in qItems ?? [])
        {
            var ri = rItems?.FirstOrDefault(x => x.LinkId == qi.LinkId);

            if (!IsEnabled(qi, root))
            {
                // A disabled item carrying an answer means the client was bypassed.
                if (ri?.Answer is { Count: > 0 })
                    issues.Add(new(qi.LinkId, "Answer supplied for a disabled item."));
                continue;
            }

            var answers = ri?.Answer ?? [];
            var isLeaf = qi.Type is not (Questionnaire.QuestionnaireItemType.Group
                                      or Questionnaire.QuestionnaireItemType.Display);

            if (isLeaf)
            {
                if (qi.Required == true && answers.Count == 0)
                    issues.Add(new(qi.LinkId, $"'{qi.Text}' is required."));

                if (qi.Repeats != true && answers.Count > 1)
                    issues.Add(new(qi.LinkId, "Multiple answers on a non-repeating item."));

                foreach (var a in answers)
                {
                    if (!TypeMatches(qi.Type, a))
                        issues.Add(new(qi.LinkId,
                            $"Answer type does not match declared type '{qi.Type}'."));

                    if (qi.AnswerOption is { Count: > 0 }
                        && a.Value is Coding c
                        && !qi.AnswerOption.Any(o => (o.Value as Coding)?.Code == c.Code))
                        issues.Add(new(qi.LinkId, $"'{c.Code}' is not an allowed option."));
                }
            }

            Walk(qi.Item, ri?.Item, root, issues);
        }
    }

    // VERIFY: enum member names against IntelliSense — codegen naming
    // has shifted between SDK majors. The shape is right regardless.
    private static bool TypeMatches(
        Questionnaire.QuestionnaireItemType? t,
        QuestionnaireResponse.AnswerComponent a) => t switch
        {
            Questionnaire.QuestionnaireItemType.String
              or Questionnaire.QuestionnaireItemType.Text => a.Value is FhirString,
            Questionnaire.QuestionnaireItemType.Integer => a.Value is Integer,
            Questionnaire.QuestionnaireItemType.Decimal => a.Value is FhirDecimal,
            Questionnaire.QuestionnaireItemType.Boolean => a.Value is FhirBoolean,
            Questionnaire.QuestionnaireItemType.Date => a.Value is Date,
            Questionnaire.QuestionnaireItemType.DateTime => a.Value is FhirDateTime,
            Questionnaire.QuestionnaireItemType.Time => a.Value is Time,
            Questionnaire.QuestionnaireItemType.Choice
              or Questionnaire.QuestionnaireItemType.OpenChoice => a.Value is Coding or FhirString,
            Questionnaire.QuestionnaireItemType.Quantity => a.Value is Quantity,
            _ => true
        };

    private static bool IsEnabled(
        Questionnaire.ItemComponent qi, QuestionnaireResponse root)
    {
        if (qi.EnableWhen is not { Count: > 0 }) return true;

        var results = qi.EnableWhen.Select(c =>
        {
            var answers = FindAnswers(root.Item, c.Question);

            if (c.Operator == Questionnaire.QuestionnaireItemOperator.Exists)
                return (answers.Count > 0) == ((c.Answer as FhirBoolean)?.Value ?? true);

            if (answers.Count == 0) return false;

            return answers.Any(a => c.Operator switch
            {
                Questionnaire.QuestionnaireItemOperator.Equal => AnswerEquals(a.Value, c.Answer),
                Questionnaire.QuestionnaireItemOperator.NotEqual => !AnswerEquals(a.Value, c.Answer),
                _ => CompareNumeric(a.Value, c.Answer, c.Operator!.Value)
            });
        }).ToList();

        return qi.EnableBehavior == Questionnaire.EnableWhenBehavior.Any
            ? results.Any(x => x)
            : results.All(x => x);
    }

    /// <summary>
    /// Equality for an enableWhen comparison.
    ///
    /// Codings compare on system+code only. R4 defines the match on the concept,
    /// not the element, and the client submits the answerOption's Coding verbatim
    /// (display included) while a definition's enableWhen.answerCoding normally
    /// carries system+code alone. IsExactly would call those unequal and silently
    /// disable every follow-up, so the two sides must agree here.
    ///
    /// A system missing on either side is treated as unconstrained rather than as
    /// a mismatch; everything that is not a Coding falls back to IsExactly.
    /// </summary>
    
    private static bool AnswerEquals(DataType? left, DataType? right) => (left, right) switch
    {
        (Coding l, Coding r) => l.Code == r.Code
            && (l.System is null || r.System is null || l.System == r.System),
        (null, null) => true,
        (null, _) or (_, null) => false,
        _ => left.IsExactly(right)
    }; 
   // private static bool AnswerEquals(DataType? left, DataType? right) =>  left.IsExactly(right);

    private static List<QuestionnaireResponse.AnswerComponent> FindAnswers(
        List<QuestionnaireResponse.ItemComponent>? items, string linkId)
    {
        foreach (var it in items ?? [])
        {
            if (it.LinkId == linkId) return it.Answer ?? [];
            var found = FindAnswers(it.Item, linkId);
            if (found.Count > 0) return found;
        }
        return [];
    }

    private static bool CompareNumeric(
        DataType? left, DataType? right, Questionnaire.QuestionnaireItemOperator op)
    {
        decimal? L = ToDecimal(left), R = ToDecimal(right);
        if (L is null || R is null) return false;

        return op switch
        {
            Questionnaire.QuestionnaireItemOperator.GreaterThan => L > R,
            Questionnaire.QuestionnaireItemOperator.LessThan => L < R,
            Questionnaire.QuestionnaireItemOperator.GreaterOrEqual => L >= R,
            Questionnaire.QuestionnaireItemOperator.LessOrEqual => L <= R,
            _ => false
        };
    }

    private static decimal? ToDecimal(DataType? d) => d switch
    {
        Integer i => i.Value,
        FhirDecimal f => f.Value,
        Quantity q => q.Value,
        _ => null
    };
}