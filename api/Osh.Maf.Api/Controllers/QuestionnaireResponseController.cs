using Hl7.Fhir.Model;
using Microsoft.AspNetCore.Mvc;
using Osh.Maf.Api.Serialization;
using Osh.Maf.Api.Validation;
using Osh.Maf.Data;
using Task = System.Threading.Tasks.Task;

namespace Osh.Maf.Api.Controllers;

[ApiController]
[Route("fhir/QuestionnaireResponse")]
public sealed class QuestionnaireResponseController(
    FormDefinitionRepository defs,
    FormResponseRepository responses,
    ResponseValidator validator) : ControllerBase
{
    [HttpPost]
    [Consumes("application/fhir+json", "application/json")]
    public async Task<IActionResult> Create([FromBody] QuestionnaireResponse r)
    {
        if (string.IsNullOrWhiteSpace(r.Questionnaire))
            return BadRequest(Outcomes.Invalid(
                "questionnaire (canonical|version) is required."));

        var parts = r.Questionnaire.Split('|');
        var defRow = await defs.GetAsync(parts[0], parts.Length > 1 ? parts[1] : null);
        if (defRow is null)
            return BadRequest(Outcomes.Invalid(
                $"Unknown definition {r.Questionnaire}."));

        var q = FhirJson.Deserialize<Questionnaire>(defRow.DefinitionJson);

        var issues = validator.Validate(q, r);
        if (issues.Count > 0)
            return UnprocessableEntity(
                Outcomes.FromIssues(issues.Select(i => (i.LinkId, i.Message))));

        var id = await responses.InsertAsync(
            defRow.FormDefinitionId,
            FhirJson.Serialize(r),
            r.Status?.ToString().ToLowerInvariant() ?? "in-progress");

        r.Id = id.ToString();
        return Created($"/fhir/QuestionnaireResponse/{id}", r);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var row = await responses.GetByIdAsync(id);
        return row is null
            ? NotFound(Outcomes.NotFound($"No QuestionnaireResponse {id}"))
            : Content(row.ResponseJson, "application/fhir+json");
    }

    [HttpPut("{id:guid}")]
    [Consumes("application/fhir+json", "application/json")]
    public async Task<IActionResult> Update(
        Guid id, [FromBody] QuestionnaireResponse r)
    {
        var existing = await responses.GetByIdAsync(id);
        if (existing is null)
            return NotFound(Outcomes.NotFound($"No QuestionnaireResponse {id}"));

        // Validate against the version the response was originally filled under,
        // not whatever the incoming body claims.
        var defRow = await defs.GetByIdAsync(existing.FormDefinitionId);
        if (defRow is null)
            return StatusCode(500,
                Outcomes.Invalid("Pinned definition is missing."));

        var q = FhirJson.Deserialize<Questionnaire>(defRow.DefinitionJson);

        var issues = validator.Validate(q, r);
        if (issues.Count > 0)
            return UnprocessableEntity(
                Outcomes.FromIssues(issues.Select(i => (i.LinkId, i.Message))));

        var status = r.Status?.ToString().ToLowerInvariant() ?? "in-progress";
        var updated = await responses.UpdateIfInProgressAsync(
            id, FhirJson.Serialize(r), status);

        if (!updated)
            return Conflict(Outcomes.Conflict(
                "This response is no longer in-progress and cannot be modified."));

        r.Id = id.ToString();
        return Ok(r);
    }
}