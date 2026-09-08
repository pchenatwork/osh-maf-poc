using System.Text.Json;
using Hl7.Fhir.Serialization;   // brings in the ForFhir() extension

namespace Osh.Maf.Api.Serialization;
public static class FhirJson
{
    /// <summary>
    /// Shared, immutable options for all FHIR (de)serialization.
    /// MUST be a single reused instance — creating these per call degrades
    /// performance severely, per Firely's own documentation.
    /// </summary>
    public static readonly JsonSerializerOptions Options =
        new JsonSerializerOptions().ForFhir();
    // VERIFY: if the no-arg overload doesn't resolve, use
    // .ForFhir(Hl7.Fhir.Model.ModelInfo.ModelInspector)

    public static string Serialize<T>(T resource) =>
        JsonSerializer.Serialize(resource, Options);

    public static T Deserialize<T>(string json) =>
        JsonSerializer.Deserialize<T>(json, Options)
            ?? throw new InvalidOperationException("Deserialized to null.");

    /// <summary>Non-generic overload — no reflection needed.</summary>
    public static object? Deserialize(string json, Type type) =>
        JsonSerializer.Deserialize(json, type, Options);
}