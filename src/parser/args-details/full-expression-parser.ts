import { F, SingleParser } from '@masala/parser'
import { ExpressionNode, SimpleExpressionNode } from '../ast.js'
import { createArrayParser } from './array-parser.js'
import { createMapperParser } from './mapper-parser.js'
import {
  createBarePipeParser,
  createPipeParser,
  PipeExpressionNode,
} from './pipe-parser/pipe-parser.js'
import { createSimpleExpressionParser } from './simple-expression-parser.js'
import { ArgTokens } from './tokens/argument-tokens.js'
import { atomicParser, expressionAtomicParser } from './tokens/literals-parser.js'

// R-LITERAL-02: Dual expression ladder (bare context vs braced context)
export function createExpressionWithPipe(
  tokens: ArgTokens,
): SingleParser<ExpressionNode> {
  const { LEFT, RIGHT, OPEN, CLOSE } = tokens

  // --- Braced ladder: IdentifierNode for variables inside {} ---
  const bracedAtomic: SingleParser<ExpressionNode> = expressionAtomicParser(tokens)

  const bracedParenthesisExpression = F.lazy(() =>
    LEFT.drop().then(bracedFullExpression).then(RIGHT.drop()),
  ).map((t) => t.single())

  const bracedArrayLiteral = createArrayParser(tokens, () => bracedFullExpression)

  const bracedPrimary = F.try(bracedArrayLiteral)
    .or(F.try(bracedParenthesisExpression))
    .or(bracedAtomic)

  const bracedSimpleExpression: SingleParser<SimpleExpressionNode> =
    createSimpleExpressionParser(tokens, bracedPrimary)

  // Pipe parser always uses braced context (pipes live inside {})
  const bracedPipeExpression: SingleParser<PipeExpressionNode> = createPipeParser(
    tokens,
    bracedSimpleExpression,
  )

  const bracedBaseExpression: SingleParser<ExpressionNode> = F.try(bracedPipeExpression)
    .or(bracedSimpleExpression)

  const bracedFullExpression = createMapperParser(tokens, bracedBaseExpression)

  // Braced expression: { bracedFullExpression } -- unwraps braces, returns inner expression
  const bracedExpression = F.lazy(() =>
    OPEN.drop().then(bracedFullExpression).then(CLOSE.drop()),
  ).map((t) => t.single())

  // --- Bare ladder: BareStringNode for identifiers at top level ---
  const bareAtomic: SingleParser<ExpressionNode> = atomicParser(tokens)

  const bareParenthesisExpression = F.lazy(() =>
    LEFT.drop().then(bareFullExpression).then(RIGHT.drop()),
  ).map((t) => t.single())

  const bareArrayLiteral = createArrayParser(tokens, () => bareFullExpression)

  // Bare primary includes bracedExpression and bracedPipeExpression for {} contexts
  const barePrimary = F.try(bareArrayLiteral)
    .or(F.try(bareParenthesisExpression))
    .or(F.try(bracedExpression))
    .or(bareAtomic)

  const bareSimpleExpression: SingleParser<SimpleExpressionNode> =
    createSimpleExpressionParser(tokens, barePrimary)

  // R-BPIPE-01: Bare pipe parser for value|pipe syntax outside braces
  const barePipeExpression: SingleParser<PipeExpressionNode> = createBarePipeParser(
    tokens,
    bareSimpleExpression,
  )

  // R-BPIPE-02: Expression ladder -- braced pipe, then bare pipe, then bare simple
  const bareBaseExpression: SingleParser<ExpressionNode> = F.try(bracedPipeExpression)
    .or(F.try(barePipeExpression))
    .or(bareSimpleExpression)

  const bareFullExpression = createMapperParser(tokens, bareBaseExpression)

  return bareFullExpression
}
