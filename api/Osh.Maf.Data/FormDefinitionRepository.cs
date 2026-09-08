using Dapper;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Data.SqlClient;

namespace Osh.Maf.Data;
public sealed record FormDefinitionRow(
    Guid FormDefinitionId, string CanonicalUrl, string Version,
    string Title, string Status, string DefinitionJson, DateTime PublishedUtc);

public sealed class FormDefinitionRepository(string connectionString)
{
    private SqlConnection Conn() => new(connectionString);

    // ---- DEMO MODE -------------------------------------------------------
    // Form definitions are loaded from _formDef/*.json instead of SQL.
    // Everything else in this class still goes to the database.
    private static readonly string DefFolder =
        Path.Combine(AppContext.BaseDirectory, "_formDef");

    private static readonly Lazy<IReadOnlyList<FormDefinitionRow>> FileDefs =
        new(LoadFolder, LazyThreadSafetyMode.ExecutionAndPublication);

    public Task<FormDefinitionRow?> GetAsync(string url, string? version)
    {
        var matches = FileDefs.Value
            .Where(r => string.Equals(r.CanonicalUrl, url, StringComparison.OrdinalIgnoreCase));

        var row = version is null
            ? matches.Where(r => r.Status == "active")
                     .OrderByDescending(r => r.PublishedUtc)
                     .FirstOrDefault()
            : matches.FirstOrDefault(r =>
                  string.Equals(r.Version, version, StringComparison.OrdinalIgnoreCase));

        return Task.FromResult(row);
    }

    private static IReadOnlyList<FormDefinitionRow> LoadFolder()
    {
        if (!Directory.Exists(DefFolder))
            throw new DirectoryNotFoundException(
                $"Form definition folder not found: {DefFolder}. " +
                "Check that _formDef\\*.json is set to CopyToOutputDirectory in Osh.Maf.Data.csproj.");

        var rows = new List<FormDefinitionRow>();

        foreach (var path in Directory.EnumerateFiles(DefFolder, "*.json", SearchOption.AllDirectories))
        {
            var json = File.ReadAllText(path);

            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            string? Str(string name) =>
                root.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String
                    ? v.GetString()
                    : null;

            var url     = Str("url");
            var version = Str("version");

            // A Questionnaire with no url|version cannot be pinned (N4). Skip it.
            if (string.IsNullOrWhiteSpace(url) || string.IsNullOrWhiteSpace(version))
                continue;

            rows.Add(new FormDefinitionRow(
                FormDefinitionId: StableId(url + "|" + version),
                CanonicalUrl:     url,
                Version:          version,
                Title:            Str("title") ?? Str("name") ?? Path.GetFileNameWithoutExtension(path),
                Status:           (Str("status") ?? "active").ToLowerInvariant(),
                DefinitionJson:   json,          // stored bytes, served verbatim
                PublishedUtc:     File.GetLastWriteTimeUtc(path)));
        }

        return rows;
    }

    // Same url|version always yields the same id, so the front end can
    // round-trip a definition id across restarts without a database.
    private static Guid StableId(string key)
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(key));
        return new Guid(hash.AsSpan(0, 16));
    }

    public async Task<FormDefinitionRow?> GetByIdAsync(Guid id)
    {
        await using var c = Conn();
        return await c.QueryFirstOrDefaultAsync<FormDefinitionRow>(
            "SELECT * FROM dbo.FormDefinition WHERE FormDefinitionId = @id", new { id });
    }

    public async Task<Guid> InsertAsync(
        string url, string version, string title, string status, string json)
    {
        await using var c = Conn();
        var id = Guid.NewGuid();
        await c.ExecuteAsync(
            """
            INSERT INTO dbo.FormDefinition
              (FormDefinitionId, CanonicalUrl, Version, Title, Status, DefinitionJson)
            VALUES (@id, @url, @version, @title, @status, @json)
            """,
            new { id, url, version, title, status, json });
        return id;
    }
}