// The tokenizer, precedence table and statement grammar are adapted from the HTML prototype.
export type Span = Readonly<{ line: number; column: number; start: number; end: number }>;
export type ValueType = 'int' | 'double' | 'float' | 'bool' | 'string';
export type DeclType = ValueType | 'var';
export type NumericType = 'int' | 'double' | 'float';
type Token = { kind: 'end' | 'number' | 'string' | 'name' | 'operator'; text: string; span: Span };
export type Call = { kind: 'call'; name: string; args: Expr[]; span: Span };
export type Expr =
  | { kind: 'number' | 'string' | 'name' | 'bool'; text: string; span: Span }
  | { kind: 'cast'; type: NumericType; operand: Expr; span: Span }
  | { kind: 'unary'; operator: string; operand: Expr; span: Span }
  | { kind: 'binary'; operator: string; left: Expr; right: Expr; span: Span }
  | Call;
export type Statement =
  | { kind: 'block'; body: Statement[]; span: Span }
  | { kind: 'if'; condition: Expr; yes: Statement; no?: Statement; span: Span }
  | { kind: 'declare'; name: string; type: DeclType; value: Expr; span: Span }
  | { kind: 'assign'; name: string; value: Expr; span: Span }
  | Call;

export const SOURCE_LIMIT = 8000;
const TOKEN_LIMIT = 2400;
export const DEPTH_LIMIT = 64;

const categories = {
  syntax: 'code', missingSemicolon: 'code', unknownName: 'code', unknownCommand: 'code',
  unknownFunction: 'code', readOnlyName: 'code', duplicateName: 'code',
  wrongType: 'code', wrongArgumentCount: 'code', literalOutOfRange: 'code',
  divisionByZero: 'runtime', integerOverflow: 'runtime', castOutOfRange: 'runtime',
  argumentOutOfRange: 'runtime', invalidCommandState: 'runtime',
  sourceLimit: 'limit', tokenLimit: 'limit', nestingLimit: 'limit', stepLimit: 'limit', stringLimit: 'limit',
} as const;
type DiagnosticCode = keyof typeof categories;

export class Diagnostic extends Error {
  readonly code: DiagnosticCode;
  readonly category: (typeof categories)[DiagnosticCode];
  readonly span: Span | undefined;
  readonly explanation: string;
  readonly hint?: string;

  constructor(code: DiagnosticCode, span: Span | undefined, explanation: string, hint?: string) {
    super(span ? `Line ${span.line}, column ${span.column}: ${explanation}` : explanation);
    this.code = code;
    this.category = categories[code];
    this.span = span;
    this.explanation = explanation;
    this.hint = hint;
  }
}
export function fail(code: DiagnosticCode, span: Span | undefined, explanation: string, hint?: string): never {
  throw new Diagnostic(code, span, explanation, hint);
}
export const normalizeSource = (source: string) => source.replace(/\r\n?/g, '\n');
export const quoteName = (name: string) => `“${name.length > 60 ? name.slice(0, 59) + '…' : name}”`;
const numeric = new Set<string>(['int', 'double', 'float']);
const types = new Set<string>([...numeric, 'bool', 'string', 'var']);
const reserved = new Set([...types, 'true', 'false', 'if', 'else', 'Console', 'Math', 'System']);
const priority: ReadonlyMap<string, number> = new Map([
  ['||', 1], ['&&', 2], ['==', 3], ['!=', 3], ['<', 4], ['>', 4], ['<=', 4], ['>=', 4],
  ['+', 5], ['-', 5], ['*', 6], ['/', 6], ['%', 6],
]);
const join = (first: Span, last: Span): Span => ({ ...first, end: last.end });

export function tokenize(source: string): Token[] {
  source = normalizeSource(source);
  if (source.length > SOURCE_LIMIT) fail('sourceLimit', undefined, `Use ${SOURCE_LIMIT} characters or fewer.`, 'Try removing unused lines or comments.');
  const pattern = /(?<space>\s+|\/\/[^\r\n]*|\/\*[\s\S]*?\*\/)|(?<number>(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?[fFdD]?)|(?<string>"(?:[^"\\\r\n]|\\["\\nrt])*")|(?<name>[A-Za-z_]\w*)|(?<operator>==|!=|<=|>=|&&|\|\||[+*\/%<>=!;.,(){}-])/y;
  const tokens: Token[] = [];
  let line = 1, column = 1;
  while (pattern.lastIndex < source.length) {
    const start = pattern.lastIndex;
    const match = pattern.exec(source);
    const span = { line, column, start, end: match ? pattern.lastIndex : start + 1 };
    if (!match) fail('syntax', span, `Unexpected character ${JSON.stringify(source[start])}.`, 'Check the highlighted line for a stray character or unfinished string.');
    const kind = Object.keys(match.groups!).find(key => match.groups![key] !== undefined);
    if (source.startsWith('/*', start) && kind !== 'space') fail('syntax', span, 'Close the block comment with */.');
    if (kind !== 'space') {
      if (tokens.length === TOKEN_LIMIT) fail('tokenLimit', span, 'This program has too many instructions or expressions.', 'Try removing repeated code.');
      tokens.push({ kind: kind as Token['kind'], text: match[0], span });
    }
    const lines = match[0].split(/\r\n|\r|\n/);
    line += lines.length - 1;
    column = lines.length > 1 ? lines.at(-1)!.length + 1 : column + match[0].length;
  }
  tokens.push({ kind: 'end', text: '', span: { line, column, start: source.length, end: source.length } });
  return tokens;
}

export function parseProgram(source: string): Statement[] {
  const tokens = tokenize(source);
  let cursor = 0;
  const current = () => tokens[cursor];
  const previous = () => tokens[cursor - 1];
  const check = (text: string) => current().text === text && current().kind !== 'string';
  const take = (text: string) => check(text) ? tokens[cursor++] : undefined;
  const expect = (text: string) => take(text) ?? fail('syntax', current().span, `Expected “${text}”.`);
  function semicolon() {
    const token = take(';');
    if (token) return token;
    const last = previous().span;
    const { end, line } = last;
    // A missing separator belongs to the statement that just ended.
    fail('missingSemicolon', { line, column: last.column + end - last.start, start: end, end },
      'Expected “;” at the end of this statement.', 'Add a semicolon where the statement ends.');
  }
  function name(binding = false): Token {
    const token = current();
    if (token.kind !== 'name' || (binding && reserved.has(token.text))) fail('syntax', token.span, 'Expected a variable name.');
    cursor++;
    return token;
  }
  function bound(depth: number) {
    if (depth > DEPTH_LIMIT) fail('nestingLimit', current().span, 'Simplify this deeply nested code.', 'Split the expression or block into smaller parts.');
  }
  function atom(depth: number): Expr {
    bound(depth);
    const token = current();
    if (take('(')) {
      if (numeric.has(current().text) && tokens[cursor + 1]?.text === ')') {
        const type = name().text as NumericType;
        expect(')');
        const operand = atom(depth + 1);
        return { kind: 'cast', type, operand, span: join(token.span, operand.span) };
      }
      const value = expression(depth + 1);
      return { ...value, span: join(token.span, expect(')').span) };
    }
    if (token.kind === 'operator' && ['-', '+', '!'].includes(token.text)) {
      cursor++;
      const operand = atom(depth + 1);
      return { kind: 'unary', operator: token.text, operand, span: join(token.span, operand.span) };
    }
    if (token.kind === 'number' || token.kind === 'string') { cursor++; return { kind: token.kind, text: token.text, span: token.span }; }
    let identifier = name().text;
    if (identifier === 'true' || identifier === 'false') return { kind: 'bool', text: identifier, span: token.span };
    while (take('.')) identifier += '.' + name().text;
    if (!take('(')) return { kind: 'name', text: identifier, span: join(token.span, previous().span) };
    const args: Expr[] = [];
    if (!take(')')) {
      do { args.push(expression(depth + 1)); } while (take(','));
      expect(')');
    }
    return { kind: 'call', name: identifier, args, span: join(token.span, previous().span) };
  }
  function expression(depth: number, minimum = 1): Expr {
    let left = atom(depth);
    let chain = 0;
    while (current().kind === 'operator' && (priority.get(current().text) ?? 0) >= minimum) {
      bound(depth + ++chain);
      const operator = tokens[cursor++].text;
      const right = expression(depth + chain, priority.get(operator)! + 1);
      left = { kind: 'binary', operator, left, right, span: join(left.span, right.span) };
    }
    return left;
  }
  function list(depth: number, inBlock: boolean): Statement[] {
    const result: Statement[] = [];
    while (current().kind !== 'end' && !(inBlock && check('}'))) result.push(statement(depth));
    return result;
  }
  function statement(depth: number): Statement {
    bound(depth);
    const { span, kind, text } = current();
    if (take('{')) return { kind: 'block', body: list(depth + 1, true), span: join(span, expect('}').span) };
    if (take('if')) {
      expect('(');
      const condition = expression(depth);
      expect(')');
      const yes = statement(depth + 1), no = take('else') ? statement(depth + 1) : undefined;
      return { kind: 'if', condition, yes, no, span: join(span, (no ?? yes).span) };
    }
    if (kind === 'name' && types.has(text)) {
      cursor++;
      const identifier = name(true).text;
      expect('=');
      const value = expression(depth);
      return { kind: 'declare', name: identifier, type: text as DeclType, value, span: join(span, semicolon().span) };
    }
    if (kind === 'name' && tokens[cursor + 1]?.text === '=') {
      const identifier = name(true).text;
      expect('=');
      const value = expression(depth);
      return { kind: 'assign', name: identifier, value, span: join(span, semicolon().span) };
    }
    const call = expression(depth);
    if (call.kind !== 'call') fail('syntax', call.span, 'Use a command, variable declaration, or assignment.');
    return { ...call, span: join(call.span, semicolon().span) };
  }
  return list(0, false);
}
