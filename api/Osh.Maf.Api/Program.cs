using Hl7.Fhir.Serialization;
using Microsoft.AspNetCore.Mvc;
using Osh.Maf.Api;
using Osh.Maf.Api.Serialization;
using Osh.Maf.Api.Validation;
using Osh.Maf.Data;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services
    .AddControllers(options =>
    {
        // ** Assume ALL the endpoints emit 'application/fhir+json' **
        // Revise if we have some other endpoints in this project that is not dealing with FHIR
        options.Filters.Add(new ProducesAttribute("application/fhir+json")); 
        options.Filters.Add<FhirDeserializationFilter>();
    })
    .AddJsonOptions(o => o.JsonSerializerOptions.ForFhir());

builder.Services.AddOpenApi(options =>
{
    // Keep FHIR POCOs out of the schema — see §0.5 for why this matters.
    options.AddSchemaTransformer((schema, context, _) =>
    {
        if (typeof(Hl7.Fhir.Model.Base).IsAssignableFrom(context.JsonTypeInfo.Type))
        {
            var t = context.JsonTypeInfo.Type;
            schema.Properties?.Clear();
            schema.Required?.Clear();
            schema.AdditionalPropertiesAllowed = true;
            schema.Description =
                $"FHIR R4 {t.Name}. Post raw application/fhir+json. " +
                $"Spec: http://hl7.org/fhir/R4/{t.Name.ToLowerInvariant()}.html";
        }
        return Task.CompletedTask;
    });
});
builder.Services.Configure<ApiBehaviorOptions>(options =>
{
    options.InvalidModelStateResponseFactory = context =>
    {
        var messages = context.ModelState
            .Where(kv => kv.Value?.Errors.Count > 0)
            .SelectMany(kv => kv.Value!.Errors.Select(e =>
                string.IsNullOrWhiteSpace(kv.Key)
                    ? e.ErrorMessage
                    : $"{kv.Key}: {e.ErrorMessage}"));

        return new ObjectResult(Osh.Maf.Api.Outcomes.FromMessages(messages))
        {
            StatusCode = StatusCodes.Status400BadRequest,
            ContentTypes = { "application/fhir+json" }
        };
    };
});

// Origins allowed to call this API. Development falls back to the Vite dev
// server; a deployed environment MUST supply its own, which on Render is the
// environment variable
//     Cors__AllowedOrigins__0 = https://<your-site>.azurestaticapps.net
// An empty list outside Development is deliberate: no origin is allowed until
// one is named, rather than silently opening the API to every site.
var allowedOrigins = builder.Configuration
    .GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];

if (allowedOrigins.Length == 0 && builder.Environment.IsDevelopment())
    allowedOrigins = ["http://localhost:5173"];

// Form definitions now come from _formDef, so the connection string is needed
// only by FormResponseRepository. Absent is not a startup failure — it fails
// on first use instead, which keeps the read-only surface deployable without
// a database.
var mafConnection = builder.Configuration.GetConnectionString("Maf") ?? "";

builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
    p.WithOrigins(allowedOrigins).AllowAnyHeader().AllowAnyMethod()));

builder.Services.AddSingleton(new FormDefinitionRepository(mafConnection));
builder.Services.AddSingleton(new FormResponseRepository(mafConnection));
builder.Services.AddSingleton<ResponseValidator>();

var app = builder.Build();


// Scalar is the only browsable surface a deployed POC has, so it stays on
// outside Development. Set Api__ExposeDocs=false to turn it off.
if (app.Environment.IsDevelopment()
    || app.Configuration.GetValue("Api:ExposeDocs", true))
{
    app.MapOpenApi();               // /openapi/v1.json
    app.MapScalarApiReference();    // /scalar
}

app.UseCors();

app.Use(async (ctx, next) =>
{
    // ?? The third error tier on Content negotiation 415/406, see developer-guide
    await next();
    if (ctx.Response.StatusCode >= 400
        && !ctx.Response.HasStarted
        && ctx.Response.ContentLength is null or 0
        && ctx.Request.Path.StartsWithSegments("/fhir"))
    {
        ctx.Response.ContentType = "application/fhir+json";
        await ctx.Response.WriteAsync(FhirJson.Serialize(
            Outcomes.FromMessages(
                [$"Request failed with status {ctx.Response.StatusCode}."])));
    }
});

// Render polls this to decide whether the instance is live, and it is the
// quickest way to tell a cold start from a broken deploy. Deliberately outside
// /fhir so the OperationOutcome middleware above leaves it alone.
app.MapGet("/healthz", () => Results.Text("ok", "text/plain"));

app.MapControllers();
app.Run();