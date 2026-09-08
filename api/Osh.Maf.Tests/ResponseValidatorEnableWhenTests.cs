using Hl7.Fhir.Model;
using Osh.Maf.Api.Validation;
using Xunit;

namespace Osh.Maf.Tests;

/// <summary>
/// Covers the RiskPanelControl contract: a Y/N/U question whose follow-ups are
/// gated by enableWhen. The client (ChoiceControl.tsx) submits the answerOption's
/// Coding verbatim — display included — so the server's enableWhen comparison must
/// match on system+code and ignore display, per R4 Questionnaire.item.enableWhen.
/// </summary>
public class ResponseValidatorEnableWhenTests
{
    private const string Ynu = "http://schools.nyc.gov/osh/CodeSystem/ynu";

    private readonly ResponseValidator _validator = new();

    // ---------- fixtures ----------

    /// <summary>riskpanel.Q1 exactly as standardized in the form definition.</summary>
    private static Questionnaire RiskPanelQ1() => new()
    {
        Status = PublicationStatus.Active,
        Item =
        [
            new Questionnaire.ItemComponent
            {
                LinkId = "riskpanel.Q1",
                Text = "History of asthma-related hospitalizations within past 12 months",
                Type = Questionnaire.QuestionnaireItemType.Group,
                Item =
                [
                    new Questionnaire.ItemComponent
                    {
                        LinkId = "riskpanel.Q1.answer",
                        Text = "History of asthma-related hospitalizations within past 12 months",
                        Type = Questionnaire.QuestionnaireItemType.Choice,
                        Required = true,
                        AnswerOption = [Option("Y"), Option("N"), Option("U")],
                    },
                    new Questionnaire.ItemComponent
                    {
                        LinkId = "riskpanel.Q1.count",
                        Text = "How many times",
                        Type = Questionnaire.QuestionnaireItemType.Integer,
                        Required = true,
                        EnableWhen = [GatedOnYes()],
                    },
                    new Questionnaire.ItemComponent
                    {
                        LinkId = "riskpanel.Q1.last",
                        Text = "Last occurrence",
                        Type = Questionnaire.QuestionnaireItemType.Date,
                        EnableWhen = [GatedOnYes()],
                    },
                ],
            },
        ],
    };

    private static Questionnaire.AnswerOptionComponent Option(string code) =>
        new() { Value = new Coding(Ynu, code, code) };

    /// <summary>The definition's enableWhen carries system+code only — no display.</summary>
    private static Questionnaire.EnableWhenComponent GatedOnYes() => new()
    {
        Question = "riskpanel.Q1.answer",
        Operator = Questionnaire.QuestionnaireItemOperator.Equal,
        Answer = new Coding(Ynu, "Y"),
    };

    /// <summary>
    /// A response shaped the way the web client actually posts it: group nesting
    /// preserved, and the selected Coding echoed whole from the answerOption.
    /// </summary>
    private static QuestionnaireResponse Response(
        Coding selected,
        int? count = null,
        string? last = null)
    {
        var children = new List<QuestionnaireResponse.ItemComponent>
        {
            new()
            {
                LinkId = "riskpanel.Q1.answer",
                Answer = [new QuestionnaireResponse.AnswerComponent { Value = selected }],
            },
        };

        if (count is not null)
            children.Add(new QuestionnaireResponse.ItemComponent
            {
                LinkId = "riskpanel.Q1.count",
                Answer = [new QuestionnaireResponse.AnswerComponent { Value = new Integer(count) }],
            });

        if (last is not null)
            children.Add(new QuestionnaireResponse.ItemComponent
            {
                LinkId = "riskpanel.Q1.last",
                Answer = [new QuestionnaireResponse.AnswerComponent { Value = new Date(last) }],
            });

        return new QuestionnaireResponse
        {
            Status = QuestionnaireResponse.QuestionnaireResponseStatus.Completed,
            Questionnaire = "http://schools.nyc.gov/osh/Questionnaire/asthma-maf|2026.02",
            Item = [new QuestionnaireResponse.ItemComponent { LinkId = "riskpanel.Q1", Item = children }],
        };
    }

    // ---------- the regression this suite exists for ----------

    [Fact]
    public void Yes_WithDisplayOnTheCoding_EnablesFollowUps()
    {
        // ChoiceControl posts { system, code, display } — the definition's
        // enableWhen has { system, code }. A whole-element comparison would
        // treat Q1 as unanswered and reject the follow-ups the client required.
        var issues = _validator.Validate(
            RiskPanelQ1(),
            Response(new Coding(Ynu, "Y", "Y"), count: 2, last: "2026-03"));

        Assert.Empty(issues);
    }

    [Fact]
    public void Yes_WithoutDisplay_StillEnablesFollowUps()
    {
        var issues = _validator.Validate(
            RiskPanelQ1(),
            Response(new Coding(Ynu, "Y"), count: 2, last: "2026-03"));

        Assert.Empty(issues);
    }

    // ---------- guards against over-loosening the comparison ----------

    [Fact]
    public void Yes_MissingRequiredCount_IsReported()
    {
        var issues = _validator.Validate(
            RiskPanelQ1(),
            Response(new Coding(Ynu, "Y", "Y")));

        Assert.Contains(issues, i => i.LinkId == "riskpanel.Q1.count");
    }

    [Fact]
    public void No_LeavesFollowUpsDisabledAndUnrequired()
    {
        var issues = _validator.Validate(
            RiskPanelQ1(),
            Response(new Coding(Ynu, "N", "N")));

        Assert.Empty(issues);
    }

    [Fact]
    public void No_WithFollowUpAnswered_IsRejected()
    {
        var issues = _validator.Validate(
            RiskPanelQ1(),
            Response(new Coding(Ynu, "N", "N"), count: 2));

        Assert.Contains(
            issues,
            i => i.LinkId == "riskpanel.Q1.count" && i.Message.Contains("disabled"));
    }

    [Fact]
    public void Unknown_LeavesFollowUpsDisabled()
    {
        var issues = _validator.Validate(
            RiskPanelQ1(),
            Response(new Coding(Ynu, "U", "U")));

        Assert.Empty(issues);
    }

    [Fact]
    public void DifferentSystem_SameCode_DoesNotEnable()
    {
        // Guards the fix from degrading into a bare code match.
        var issues = _validator.Validate(
            RiskPanelQ1(),
            Response(new Coding("http://example.org/other", "Y", "Y"), count: 2));

        Assert.Contains(
            issues,
            i => i.LinkId == "riskpanel.Q1.count" && i.Message.Contains("disabled"));
    }

    [Fact]
    public void FlatResponse_LosesTheGroupNesting_AndIsReported()
    {
        // Documents the shape contract: the QR must mirror the group.
        var flat = new QuestionnaireResponse
        {
            Status = QuestionnaireResponse.QuestionnaireResponseStatus.Completed,
            Item =
            [
                new QuestionnaireResponse.ItemComponent
                {
                    LinkId = "riskpanel.Q1.answer",
                    Answer = [new QuestionnaireResponse.AnswerComponent { Value = new Coding(Ynu, "Y", "Y") }],
                },
            ],
        };

        var issues = _validator.Validate(RiskPanelQ1(), flat);

        Assert.Contains(issues, i => i.LinkId == "riskpanel.Q1.answer");
    }
}
