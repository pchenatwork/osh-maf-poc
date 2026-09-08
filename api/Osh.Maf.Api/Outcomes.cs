using Hl7.Fhir.Model;

namespace Osh.Maf.Api;

public static class Outcomes
{
    public static OperationOutcome NotFound(string msg) =>
        Single(OperationOutcome.IssueType.NotFound, msg);

    public static OperationOutcome Invalid(string msg) =>
        Single(OperationOutcome.IssueType.Invalid, msg);

    public static OperationOutcome Conflict(string msg) =>
        Single(OperationOutcome.IssueType.Conflict, msg);

    public static OperationOutcome FromIssues(
        IEnumerable<(string LinkId, string Message)> issues) => new()
        {
            Issue = issues.Select(i => new OperationOutcome.IssueComponent
            {
                Severity = OperationOutcome.IssueSeverity.Error,
                Code = OperationOutcome.IssueType.Invalid,
                Diagnostics = i.Message,
                Expression = [i.LinkId]     // the client keys off this
            }).ToList()
        };

    private static OperationOutcome Single(
        OperationOutcome.IssueType code, string msg) => new()
        {
            Issue =
        [
            new OperationOutcome.IssueComponent
            {
                Severity    = OperationOutcome.IssueSeverity.Error,
                Code        = code,
                Diagnostics = msg
            }
        ]
        };
    public static OperationOutcome FromMessages(IEnumerable<string> messages) => new()
    {
        Issue = messages.Select(m => new OperationOutcome.IssueComponent
        {
            Severity = OperationOutcome.IssueSeverity.Error,
            Code = OperationOutcome.IssueType.Invalid,
            Diagnostics = m
        }).ToList()
    };
}