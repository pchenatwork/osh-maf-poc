namespace Osh.Maf.Api;

using Hl7.Fhir.Serialization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

/// <summary>
/// ASP.NET reports a failed body bind as "The supplied value is invalid".
/// Using Firely's DeserializationFailedException carries the actual issues, element by element.
/// </summary>
public sealed class FhirDeserializationFilter : IExceptionFilter
{
    public void OnException(ExceptionContext context)
    {
        if (context.Exception is not DeserializationFailedException dfe) return;

        context.Result = new ObjectResult(
            Outcomes.FromMessages(dfe.Exceptions.Select(e => e.Message)))
        {
            StatusCode = StatusCodes.Status400BadRequest,
            ContentTypes = { "application/fhir+json" }
        };
        context.ExceptionHandled = true;
    }
}
