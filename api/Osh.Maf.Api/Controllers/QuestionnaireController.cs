using Hl7.Fhir.Model;
using Hl7.Fhir.Serialization;   // DeserializationFailedException
using Microsoft.AspNetCore.Mvc;
using Osh.Maf.Data;
using Osh.Maf.Api.Serialization;
using System.Text.Json;                     // JsonException
using Task = System.Threading.Tasks.Task;   // FHIR has its own Task resource!

namespace Osh.Maf.Api.Controllers;

[ApiController]
[Route("fhir/Questionnaire")]
public sealed class QuestionnaireController(FormDefinitionRepository repo) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Search(
        [FromQuery] string url, [FromQuery] string? version)
    {
        var row = await repo.GetAsync(url, version);
        if (row is null)
            return NotFound(Outcomes.NotFound($"No Questionnaire for {url}"));

        // Return the STORED bytes, not a round-trip. See note below.
        return Content(row.DefinitionJson, "application/fhir+json");
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var row = await repo.GetByIdAsync(id);
        return row is null
            ? NotFound(Outcomes.NotFound($"No Questionnaire {id}"))
            : Content(row.DefinitionJson, "application/fhir+json");
    }

    [HttpPost]
    [Consumes("application/fhir+json", "application/json")] //Declares "Content-Types" the action accepts (for model binding and documentation).
    [ProducesResponseType(typeof(Questionnaire), StatusCodes.Status201Created)]
    // possible response HTTP status codes and the CLR type returned. Useful for Swagger/OpenAPI and client generation.
    [ProducesResponseType(typeof(OperationOutcome), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(OperationOutcome), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Publish()
    {
        // Bind the body by hand. MVC's input formatter swallows Firely's
        // DeserializationFailedException into a bare ModelState entry
        // ("The supplied value is invalid"), which loses the element-level
        // diagnostics and never reaches FhirDeserializationFilter.
        using var reader = new StreamReader(Request.Body);
        var json = await reader.ReadToEndAsync();

        if (string.IsNullOrWhiteSpace(json))
            return BadRequest(Outcomes.Invalid("Request body is empty."));

        Questionnaire q;
        try
        {
            q = FhirJson.Deserialize<Questionnaire>(json);
        }
        catch (DeserializationFailedException dfe)
        {
            return BadRequest(Outcomes.FromMessages(dfe.Exceptions.Select(e => e.Message)));
        }
        catch (JsonException je)
        {
            return BadRequest(Outcomes.Invalid($"Malformed JSON: {je.Message}"));
        }

        if (string.IsNullOrWhiteSpace(q.Url) || string.IsNullOrWhiteSpace(q.Version))
            return BadRequest(Outcomes.Invalid("url and version are required."));

        if (await repo.GetAsync(q.Url, q.Version) is not null)
            return Conflict(Outcomes.Conflict(
                $"{q.Url}|{q.Version} already exists. Definitions are immutable."));

        var id = await repo.InsertAsync(
            q.Url, q.Version,
            q.Title ?? q.Name ?? "Untitled",
            q.Status?.ToString().ToLowerInvariant() ?? "draft",
            FhirJson.Serialize(q));

        return Created($"/fhir/Questionnaire/{id}", q);
    }

}