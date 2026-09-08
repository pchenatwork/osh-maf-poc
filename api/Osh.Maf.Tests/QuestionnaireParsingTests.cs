using Hl7.Fhir.Model;
using Osh.Maf.Api.Serialization;
using Xunit;

namespace Osh.Maf.Tests;

public class QuestionnaireParsingTests
{
    private static string DefinitionsDir =>
        Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../../definitions"));

    private static Questionnaire Load(string file) =>
        FhirJson.Deserialize<Questionnaire>(File.ReadAllText(Path.Combine(DefinitionsDir, file)));

    [Fact]
    public void ToyForm_Parses()
    {
        var q = Load("toy-form-1.0.json");

        Assert.Equal("1.0", q.Version);
        Assert.Equal(4, q.Item.Count);
        Assert.True(q.Item[0].Required);
    }

    [Fact]
    public void AllLinkIds_AreUnique()
    {
        var ids = Flatten(Load("toy-form-1.0.json").Item).Select(i => i.LinkId).ToList();
        Assert.Equal(ids.Count, ids.Distinct().Count());
    }

    [Fact]
    public void RoundTrips_WithoutLoss()
    {
        var q = Load("toy-form-1.0.json");
        var again = FhirJson.Deserialize<Questionnaire>(FhirJson.Serialize(q));
        Assert.True(q.IsExactly(again));
    }

    /*  Sample Input Json:
     {
  "resourceType": "Questionnaire",
  "id": "sample1",
  "status": "active",
  "title": "Sample flattened input",
  "item": [
    {
      "linkId": "a",
      "text": "Question A",
      "item": [
        {
          "linkId": "a.1",
          "text": "Question A.1"
        }
      ]
    },
    {
      "linkId": "b",
      "text": "Question B",
      "item": [
        {
          "linkId": "b.1",
          "text": "Question B.1",
          "item": [
            {
              "linkId": "b.1.a",
              "text": "Question B.1.a"
            }
          ]
        }
      ]
    }
  ]
}     
    ==> 
    [{
        "linkId": "a",
        "text": "Question A"
    }, {
        "linkId": "a.1",
        "text": "Question A.1"
    }, {
        "linkId": "b",
        "text": "Question B"
    }, {
        "linkId": "b.1",
        "text": "Question B.1"
    }, {
        "linkId": "b.1.a",
        "text": "Question B.1.a"
    }]
     * */
    internal static IEnumerable<Questionnaire.ItemComponent> Flatten(
        IEnumerable<Questionnaire.ItemComponent>? items) =>
        (items ?? []).SelectMany(i => new[] { i }.Concat(Flatten(i.Item)));
}