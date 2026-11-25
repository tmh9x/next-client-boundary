import ts from "typescript";

export interface ImportRef {
  /** The module specifier as written, e.g. "./db" or "node:fs". */
  specifier: string;
  /** True for imports that TypeScript erases (`import type`, `export type`). */
  typeOnly: boolean;
  /** 1-based line of the import. */
  line: number;
}

function scriptKind(fileName: string): ts.ScriptKind {
  if (fileName.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (fileName.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (/\.[cm]?js$/.test(fileName)) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function importIsTypeOnly(node: ts.ImportDeclaration): boolean {
  const clause = node.importClause;
  if (clause === undefined) {
    return false; // side-effect import: import "./polyfill"
  }
  if (clause.isTypeOnly) {
    return true;
  }
  if (clause.name !== undefined) {
    return false; // default import is a value
  }
  const bindings = clause.namedBindings;
  if (bindings === undefined || ts.isNamespaceImport(bindings)) {
    return false;
  }
  return bindings.elements.length > 0 && bindings.elements.every((element) => element.isTypeOnly);
}

function exportIsTypeOnly(node: ts.ExportDeclaration): boolean {
  if (node.isTypeOnly) {
    return true;
  }
  const clause = node.exportClause;
  return clause !== undefined && ts.isNamedExports(clause) && clause.elements.length > 0 && clause.elements.every((element) => element.isTypeOnly);
}

/**
 * Every module reference in a file: static imports and re-exports, dynamic
 * `import()`, `require()` and `import x = require()`.
 */
export function importsOf(fileName: string, source: string): ImportRef[] {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, scriptKind(fileName));
  const refs: ImportRef[] = [];
  const add = (literal: ts.Node, specifier: string, typeOnly: boolean) => {
    const line = file.getLineAndCharacterOfPosition(literal.getStart(file)).line + 1;
    refs.push({ specifier, typeOnly, line });
  };

  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      add(node.moduleSpecifier, node.moduleSpecifier.text, importIsTypeOnly(node));
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier !== undefined && ts.isStringLiteral(node.moduleSpecifier)) {
      add(node.moduleSpecifier, node.moduleSpecifier.text, exportIsTypeOnly(node));
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference) &&
      ts.isStringLiteral(node.moduleReference.expression)
    ) {
      add(node.moduleReference.expression, node.moduleReference.expression.text, node.isTypeOnly);
    } else if (ts.isCallExpression(node)) {
      const [argument] = node.arguments;
      const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
      const isRequire = ts.isIdentifier(node.expression) && node.expression.text === "require";
      if ((isDynamicImport || isRequire) && argument !== undefined && ts.isStringLiteralLike(argument)) {
        add(argument, argument.text, false);
      }
    } else if (ts.isImportTypeNode(node)) {
      return; // import("x").Type is a type position
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return refs;
}
