using Dapper;
using Microsoft.Data.SqlClient;

namespace Osh.Maf.Data;

public sealed record FormResponseRow(
    Guid FormResponseId,
    Guid FormDefinitionId,
    string ResponseJson,
    string Status,
    string? SubjectOsis,
    DateTime CreatedUtc,
    DateTime UpdatedUtc);

public sealed class FormResponseRepository(string connectionString)
{
    private SqlConnection Conn() => new(connectionString);

    public async Task<FormResponseRow?> GetByIdAsync(Guid id)
    {
        await using var c = Conn();
        return await c.QueryFirstOrDefaultAsync<FormResponseRow>(
            "SELECT * FROM dbo.FormResponse WHERE FormResponseId = @id", new { id });
    }

    public async Task<IReadOnlyList<FormResponseRow>> GetBySubjectAsync(string osis)
    {
        await using var c = Conn();
        var rows = await c.QueryAsync<FormResponseRow>(
            """
            SELECT * FROM dbo.FormResponse
            WHERE SubjectOsis = @osis
            ORDER BY CreatedUtc DESC
            """, new { osis });
        return rows.AsList();
    }

    public async Task<Guid> InsertAsync(
        Guid formDefinitionId, string responseJson, string status)
    {
        await using var c = Conn();
        var id = Guid.NewGuid();
        await c.ExecuteAsync(
            """
            INSERT INTO dbo.FormResponse
              (FormResponseId, FormDefinitionId, ResponseJson, Status)
            VALUES (@id, @formDefinitionId, @responseJson, @status)
            """,
            new { id, formDefinitionId, responseJson, status });
        return id;
    }

    /// <summary>
    /// Updates a response only while it is still in-progress. Returns false if the
    /// row is missing or already completed — the caller maps that to 409.
    /// The WHERE clause does the guarding, so a concurrent completion cannot slip
    /// through between a read and a write.
    /// </summary>
    public async Task<bool> UpdateIfInProgressAsync(
        Guid id, string responseJson, string status)
    {
        await using var c = Conn();
        var affected = await c.ExecuteAsync(
            """
            UPDATE dbo.FormResponse
               SET ResponseJson = @responseJson,
                   Status       = @status,
                   UpdatedUtc   = SYSUTCDATETIME()
             WHERE FormResponseId = @id
               AND Status = 'in-progress'
            """,
            new { id, responseJson, status });
        return affected == 1;
    }
}