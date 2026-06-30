using System.Text.Json;
using Microsoft.Data.Sqlite;

namespace RslBattleReader.Account;

/// <summary>
/// Resolves which game account a captured battle belongs to, so multi-account
/// users don't get an undifferentiated battle log.
///
/// Primary source — Gestal's active account pointer:
///   %LocalAppData%\Gestal\active.json  → payload.activeAccountKey
///   %LocalAppData%\Gestal\accounts\&lt;key&gt;\metadata.json → payload.displayName
///
/// Fallback — Plarium's local DB when Gestal isn't present:
///   %LocalAppDataLow%\Plarium\Raid_ Shadow Legends\raidV2.db
///   Dictionary table, key='UserId', value = JSON object containing a GUID.
///
/// Resolution is cheap (two small JSON reads) and done per capture, so switching
/// accounts in Gestal is reflected on the very next battle.
/// </summary>
internal readonly record struct AccountInfo(string? AccountId, string? DisplayName)
{
    public static readonly AccountInfo None = new(null, null);
}

internal static class AccountResolver
{
    private static readonly string GestalRoot =
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Gestal");

    private static readonly string ActiveJson = Path.Combine(GestalRoot, "active.json");

    private static readonly string RaidDb =
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData) + "Low",
                     @"Plarium\Raid_ Shadow Legends\raidV2.db");

    /// <summary>Best-effort account resolution. Never throws.</summary>
    public static AccountInfo Resolve()
    {
        var fromGestal = TryGestal();
        if (fromGestal.AccountId is not null) return fromGestal;

        var fromDb = TryRaidDb();
        if (fromDb.AccountId is not null) return fromDb;

        return AccountInfo.None;
    }

    // ── Primary: Gestal active.json + metadata.json ─────────────────────────────
    private static AccountInfo TryGestal()
    {
        try
        {
            if (!File.Exists(ActiveJson)) return AccountInfo.None;

            using var active = JsonDocument.Parse(File.ReadAllText(ActiveJson));
            if (!active.RootElement.TryGetProperty("payload", out var payload) ||
                !payload.TryGetProperty("activeAccountKey", out var keyEl))
                return AccountInfo.None;

            var accountId = keyEl.GetString();
            if (string.IsNullOrWhiteSpace(accountId)) return AccountInfo.None;

            return new AccountInfo(accountId, ReadDisplayName(accountId));
        }
        catch
        {
            return AccountInfo.None;
        }
    }

    private static string? ReadDisplayName(string accountId)
    {
        try
        {
            var metaPath = Path.Combine(GestalRoot, "accounts", accountId, "metadata.json");
            if (!File.Exists(metaPath)) return null;
            using var meta = JsonDocument.Parse(File.ReadAllText(metaPath));
            return meta.RootElement.TryGetProperty("payload", out var p) &&
                   p.TryGetProperty("displayName", out var dn)
                ? dn.GetString()
                : null;
        }
        catch
        {
            return null;
        }
    }

    // ── Fallback: Plarium raidV2.db (Dictionary table, key='UserId') ────────────
    private static AccountInfo TryRaidDb()
    {
        try
        {
            if (!File.Exists(RaidDb)) return AccountInfo.None;

            // Read-only, shared — the game may hold the file open.
            var cs = new SqliteConnectionStringBuilder
            {
                DataSource = RaidDb,
                Mode       = SqliteOpenMode.ReadOnly,
            }.ToString();

            using var conn = new SqliteConnection(cs);
            conn.Open();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT value FROM Dictionary WHERE key = 'UserId' LIMIT 1";
            var raw = cmd.ExecuteScalar() as string;
            if (string.IsNullOrWhiteSpace(raw)) return AccountInfo.None;

            // value is a JSON object containing a GUID — accept either a bare GUID
            // string or an object whose first string-ish field is the GUID.
            var guid = ExtractGuid(raw);
            return guid is null ? AccountInfo.None : new AccountInfo(guid, null);
        }
        catch
        {
            return AccountInfo.None;
        }
    }

    private static string? ExtractGuid(string raw)
    {
        try
        {
            using var doc = JsonDocument.Parse(raw);
            var root = doc.RootElement;
            if (root.ValueKind == JsonValueKind.String) return root.GetString();
            if (root.ValueKind == JsonValueKind.Object)
            {
                foreach (var prop in root.EnumerateObject())
                    if (prop.Value.ValueKind == JsonValueKind.String &&
                        Guid.TryParse(prop.Value.GetString(), out _))
                        return prop.Value.GetString();
            }
        }
        catch
        {
            // Not JSON — maybe the raw value is itself a GUID.
            if (Guid.TryParse(raw.Trim('"'), out _)) return raw.Trim('"');
        }
        return null;
    }
}
