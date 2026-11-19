import { DEPTH_LIMIT, fail, quoteName, type Call, type Expr, type NumericType, type Span, type Statement, type ValueType } from './parser.ts';

export type NumberValue = { type: NumericType; value: number };
export type Value = NumberValue | { type: 'bool'; value: boolean } | { type: 'string'; value: string };
export type MathName = 'Abs' | 'Round' | 'Min' | 'Max' | 'Pow' | 'Sqrt';
export type Environment = {
  math: readonly MathName[];
  hasSensor(name: string): boolean;
  readSensor(name: string): Value | undefined;
  validateCommand(node: Call): void;
  command(node: Call, args: readonly Value[]): void;
  halted(): boolean;
};
const intMin = -2147483648;
const intMax = 2147483647;
const maxString = 8000;
export const int = (value: number): NumberValue => ({ type: 'int', value });
export const double = (value: number): NumberValue => ({ type: 'double', value });
const isNumeric = (value: Value): value is NumberValue => typeof value.value === 'number';
export const asNumber = (value: Value, span: Span): NumberValue => isNumeric(value) ? value : fail('wrongType', span, 'Expected a number.');
const boolValue = (value: Value, span: Span) => value.type === 'bool' ? value.value : fail('wrongType', span, 'Expected true or false.');
export function printable(value?: Value): string {
  if (!value) return '';
  return value.type === 'bool' ? (value.value ? 'True' : 'False') : String(value.value);
}
const widen = (a: NumericType, b: NumericType): NumericType =>
  a === 'double' || b === 'double' ? 'double' : a === 'float' || b === 'float' ? 'float' : 'int';
const ofType = (type: NumericType, value: number): NumberValue => ({ type, value: type === 'float' ? Math.fround(value) : value });
function convert(type: ValueType | 'var', value: Value, span: Span): Value {
  if (type === 'var' || type === value.type) return value;
  if (isNumeric(value) && (type === 'double' || (type === 'float' && value.type === 'int'))) return ofType(type, value.value);
  return fail('wrongType', span, `Cannot convert ${value.type} to ${type} here.`, 'Check the variable type and the value you assign to it.');
}
export function roundEven(value: number, digits = 0): number {
  if (!Number.isFinite(value) || Math.abs(value) >= 1e16) return value;
  const scale = 10 ** digits, scaled = value * scale, floor = Math.floor(scaled);
  const rounded = scaled - floor === 0.5 ? floor + Math.abs(floor % 2) : Math.round(scaled);
  return (rounded === 0 && value < 0 ? -0 : rounded) / scale;
}

function applyMath(name: MathName, node: Call, args: Value[]): NumberValue {
  const one = name === 'Abs' || name === 'Sqrt';
  const round = name === 'Round';
  if (one ? args.length !== 1 : round ? args.length < 1 || args.length > 2 : args.length !== 2) {
    fail('wrongArgumentCount', node.span, `Check how many arguments Math.${name} takes.`);
  }
  const a = asNumber(args[0], node.args[0].span);
  const b = args[1] && asNumber(args[1], node.args[1].span);
  switch (name) {
    case 'Abs':
      if (a.type === 'int' && a.value === intMin) fail('integerOverflow', node.span, 'Math.Abs result is too large for an int.', 'Check the number passed to Math.Abs.');
      return ofType(a.type, Math.abs(a.value));
    case 'Round':
      if (b && b.type !== 'int') fail('wrongType', node.args[1].span, 'Math.Round needs an int for its digit count.');
      if (b && (b.value < 0 || b.value > 15)) fail('argumentOutOfRange', node.args[1].span, 'Math.Round needs a digit count from 0 to 15.');
      return double(roundEven(a.value, b?.value));
    case 'Sqrt': return double(Math.sqrt(a.value));
    case 'Pow': return double(Math.pow(a.value, b.value));
    default: {
      const type = widen(a.type, b.type);
      return ofType(type, Math[name === 'Min' ? 'min' : 'max'](ofType(type, a.value).value, ofType(type, b.value).value));
    }
  }
}

export function execute(program: Statement[], env: Environment): void {
  const scopes: Map<string, Value>[] = [new Map()];
  const scopeOf = (name: string) => scopes.findLast(scope => scope.has(name));
  function expression(node: Expr, depth = 0): Value {
    if (depth > DEPTH_LIMIT) fail('nestingLimit', node.span, 'Simplify this deeply nested expression.', 'Split it into smaller expressions.');
    const evaluate = (expr: Expr) => expression(expr, depth + 1);
    switch (node.kind) {
      case 'number': {
        const suffix = node.text.at(-1)?.toLowerCase();
        const type = suffix === 'f' ? 'float' : /[.ed]/i.test(node.text) ? 'double' : 'int';
        const raw = Number(node.text.replace(/[fd]$/i, ''));
        const value = ofType(type, raw);
        if (!Number.isFinite(value.value) || (type === 'int' && raw > intMax)) fail('literalOutOfRange', node.span, `This literal does not fit in a ${type}.`);
        return value;
      }
      case 'bool': return { type: 'bool', value: node.text === 'true' };
      case 'string': {
        // The lexer allows literal tabs. JSON requires control characters to be escaped.
        const json = node.text.replace(/[\u0000-\u001f]/g, char => JSON.stringify(char).slice(1, -1));
        return { type: 'string', value: JSON.parse(json) as string };
      }
      case 'name': {
        return scopeOf(node.text)?.get(node.text) ?? env.readSensor(node.text) ??
          fail('unknownName', node.span, `Unknown name ${quoteName(node.text)} in this lesson.`, 'Check its spelling and where the variable was declared.');
      }
      case 'cast': {
        const value = asNumber(evaluate(node.operand), node.operand.span).value;
        if (node.type !== 'int') return ofType(node.type, value);
        const truncated = Math.trunc(value);
        if (!Number.isFinite(truncated) || truncated < intMin || truncated > intMax) {
          fail('castOutOfRange', node.span, 'This value cannot be cast to a 32-bit int.', 'Check the value before converting it.');
        }
        return int(truncated | 0);
      }
      case 'unary': {
        if (node.operator === '-' && node.operand.kind === 'number' && /^0*2147483648$/.test(node.operand.text)) return int(intMin);
        const value = evaluate(node.operand);
        if (node.operator === '!') return { type: 'bool', value: !boolValue(value, node.span) };
        const a = asNumber(value, node.span);
        const result = node.operator === '-' ? -a.value : a.value;
        return ofType(a.type, a.type === 'int' ? result | 0 : result);
      }
      case 'call': {
        const full = node.name.replace(/^System\./, '');
        const method = env.math.find(name => 'Math.' + name === full);
        if (!method) fail('unknownFunction', node.span, `${quoteName(node.name)} is not an available Math function in this lesson.`);
        return applyMath(method, node, node.args.map(evaluate));
      }
      case 'binary': {
        const left = evaluate(node.left), op = node.operator;
        if (op === '&&' || op === '||') {
          const a = boolValue(left, node.left.span);
          return { type: 'bool', value: op === '&&' ? a && boolValue(evaluate(node.right), node.right.span) : a || boolValue(evaluate(node.right), node.right.span) };
        }
        const right = evaluate(node.right);
        if (op === '+' && (left.type === 'string' || right.type === 'string')) {
          const value = printable(left) + printable(right);
          if (value.length > maxString) fail('stringLimit', node.span, 'This string is too long.', 'Try combining shorter strings.');
          return { type: 'string', value };
        }
        const numbers = isNumeric(left) && isNumeric(right);
        const type = numbers ? widen(left.type, right.type) : 'int';
        const a = numbers ? ofType(type, left.value).value : left.value;
        const b = numbers ? ofType(type, right.value).value : right.value;
        if (op === '==' || op === '!=') {
          if (left.type !== right.type && !numbers) fail('wrongType', node.span, 'Compare values of compatible types.');
          return { type: 'bool', value: (a === b) === (op === '==') };
        }
        if (typeof a !== 'number' || typeof b !== 'number') fail('wrongType', node.span, 'This operator needs two numbers.');
        const result = (value: number) => ofType(type, type === 'int' ? value | 0 : value);
        if (type === 'int' && (op === '/' || op === '%') && b === 0) {
          fail('divisionByZero', node.right.span, 'Cannot divide by zero. The divisor is 0.', 'Check the value of the divisor before dividing.');
        }
        if (type === 'int' && op === '/' && a === intMin && b === -1) {
          fail('integerOverflow', node.span, 'This division result is too large for an int.');
        }
        switch (op) {
          case '<': return { type: 'bool', value: a < b };
          case '>': return { type: 'bool', value: a > b };
          case '<=': return { type: 'bool', value: a <= b };
          case '>=': return { type: 'bool', value: a >= b };
          case '+': return result(a + b);
          case '-': return result(a - b);
          case '*': return result(type === 'int' ? Math.imul(a, b) : a * b);
          case '/': return result(type === 'int' ? Math.trunc(a / b) : a / b);
          case '%': return result(a % b);
          default: return fail('syntax', node.span, 'Unsupported operator.');
        }
      }
    }
  }
  function executeOne(node: Statement) {
    if (env.halted()) return;
    switch (node.kind) {
      case 'block':
        scopes.push(new Map());
        node.body.forEach(executeOne);
        scopes.pop();
        break;
      case 'if': {
        const branch = boolValue(expression(node.condition), node.condition.span) ? node.yes : node.no;
        if (branch) {
          scopes.push(new Map());
          executeOne(branch);
          scopes.pop();
        }
        break;
      }
      case 'declare':
        if (scopeOf(node.name) || env.hasSensor(node.name)) fail('duplicateName', node.span, `${quoteName(node.name)} is already in use.`);
        scopes.at(-1)!.set(node.name, convert(node.type, expression(node.value), node.span));
        break;
      case 'assign': {
        const scope = scopeOf(node.name);
        if (!scope) fail('readOnlyName', node.span, `${quoteName(node.name)} is not a writable variable.`);
        scope.set(node.name, convert(scope.get(node.name)!.type, expression(node.value), node.span));
        break;
      }
      case 'call':
        env.validateCommand(node);
        env.command(node, node.args.map(arg => expression(arg)));
        break;
    }
  }
  program.forEach(executeOne);
}
