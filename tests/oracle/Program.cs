using System.Globalization;
using System.Text.Json;

var oracle = JsonDocument.Parse(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "expected.json")));
var actual = new object[] {
    5 / 2, -5 / 2, -5 % 2, (int)-4.9, Math.Abs(-3), Math.Abs(-2147483648.0),
    Math.Round(2.5), Math.Round(3.5), Math.Round(-2.5), Math.Round(2.25, 1), Math.Round(-2.75, 1),
    Math.Min(6, 4), Math.Max(3, 6), Math.Pow(4, 2), Math.Sqrt(25),
    Math.Sqrt(-1), Math.Pow(-2, 0.5), Math.Pow(2, 1024)
};
var fixtures = oracle.RootElement.GetProperty("expressions");
if (fixtures.GetArrayLength() != actual.Length) throw new Exception("Oracle fixture count changed.");
for (var i = 0; i < actual.Length; i++)
{
    var value = Convert.ToString(actual[i], CultureInfo.InvariantCulture);
    if (value != fixtures[i][1].GetString()) throw new Exception($"Mismatch for {fixtures[i][0]}: {value}");
}
static void CheckOverflow(Action f)
{
    try { f(); }
    catch (OverflowException) { return; }
    throw new Exception("Expected an overflow.");
}
CheckOverflow(() => Math.Abs(int.MinValue));
CheckOverflow(() => _ = checked((int)Math.Sqrt(-1)));
CheckOverflow(() => _ = checked((int)Math.Pow(2, 1024)));
Console.WriteLine($"{actual.Length} expression and 3 overflow checks agree with .NET.");
