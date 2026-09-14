#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { builtinModules } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.slice(2).includes('--check');
if (process.argv.slice(2).some(arg => arg !== '--check')) {
  throw new Error('Usage: node scripts/build-standalone.mjs [--check]');
}
const configFile = ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile);
if (configFile.error) throw new Error(ts.flattenDiagnosticMessageText(configFile.error.messageText, '\n'));
const config = ts.parseJsonConfigFileContent(configFile.config, ts.sys, root);
const outputRoot = path.join(root, '__bundle_output__');
const options = {
  ...config.options, module: ts.ModuleKind.CommonJS, outDir: outputRoot,
  sourceMap: false, declaration: false, declarationMap: false,
  removeComments: true, noEmit: false, noEmitOnError: true,
};
const emitted = new Map();
const program = ts.createProgram(config.fileNames, options);
const emit = program.emit(undefined, (name, body) => {
  if (name.endsWith('.js') || name.endsWith('.json')) {
    emitted.set(path.relative(outputRoot, name).split(path.sep).join('/'), body);
  }
});
const errors = [...config.errors, ...ts.getPreEmitDiagnostics(program), ...emit.diagnostics]
  .filter(d => d.category === ts.DiagnosticCategory.Error);
if (errors.length) {
  const host = { getCanonicalFileName: f => f, getCurrentDirectory: () => root, getNewLine: () => '\n' };
  process.stderr.write(ts.formatDiagnosticsWithColorAndContext(errors, host));
  process.exit(1);
}

const unitEntries = config.fileNames.filter(f => /Tests\.ts$/.test(f))
  .map(f => path.relative(root, f).split(path.sep).join('/').replace(/\.ts$/, '.js')).sort();
if (unitEntries.length === 0) throw new Error('No unit-test sources found');
const testEntry = 'tests/__standalone-entry.js';
emitted.set(testEntry, unitEntries.map(id => `require(${JSON.stringify('./' + path.posix.relative('tests', id))});`).join('\n'));
const builtins = new Set(builtinModules.flatMap(name => [name, name.replace(/^node:/, ''), 'node:' + name.replace(/^node:/, '')]));

function resolve(from, spec) {
  if (!spec.startsWith('.')) {
    if (!builtins.has(spec)) throw new Error(`Standalone entry depends on external module ${spec} in ${from}`);
    return null;
  }
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(from), spec));
  const id = [base, base + '.js', base + '.json', base + '/index.js'].find(candidate => emitted.has(candidate));
  if (id) return id;
  const asset = path.resolve(root, base);
  if (!asset.startsWith(root + path.sep) || !fs.existsSync(asset)) {
    throw new Error(`Unresolved relative module ${spec} in ${from}`);
  }
  return null;
}

function collect(entry) {
  const included = new Set();
  function visit(id) {
    if (included.has(id)) return;
    const body = emitted.get(id);
    if (body === undefined) throw new Error(`Missing compiled entry ${id}`);
    included.add(id);
    if (id.endsWith('.json')) return;
    const tree = ts.createSourceFile(id, body, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    function walk(node) {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'require') {
        if (node.arguments.length !== 1 || !ts.isStringLiteral(node.arguments[0])) {
          throw new Error(`Dynamic require is not supported in standalone module ${id}`);
        }
        const dependency = resolve(id, node.arguments[0].text);
        if (dependency) visit(dependency);
      }
      ts.forEachChild(node, walk);
    }
    walk(tree);
  }
  visit(entry);
  return [...included].sort();
}

const runtime = fs.readFileSync(path.join(root, 'scripts/standalone-runtime.cjs'), 'utf8');
const shim = fs.readFileSync(path.join(root, 'scripts/standalone-test-globals.cjs'), 'utf8');
let mismatches = 0;
for (const [file, entry, globals] of [['verify.js', 'tests/verify.js', ''], ['test.js', testEntry, shim]]) {
  const modules = collect(entry);
  const body = `/**\n * Generated from the repository TypeScript sources.\n * Rebuild: npm run build; check reproducibility: npm run build:check.\n * Entry: ${entry}; linked modules: ${modules.length}.\n */\n'use strict';\n\n`
    + globals + '\nvar __PF_ROOT__ = __dirname;\nvar __nodeRequire = require;\nvar __modules = {\n'
    + modules.map(id => `  ${JSON.stringify(id)}: function (module, exports, require, __filename, __dirname) {\n`
      + (id.endsWith('.json') ? `module.exports = ${emitted.get(id)};\n` : emitted.get(id)) + '\n  },\n').join('')
    + '};\n' + runtime + `__require('', ${JSON.stringify('./' + entry)});\n`;
  const target = path.join(root, file);
  if (check) {
    if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== body) {
      process.stderr.write(`${file} differs from its source build\n`);
      mismatches++;
    } else process.stdout.write(`${file}: reproducible (${modules.length} modules)\n`);
  } else {
    fs.writeFileSync(target, body);
    process.stdout.write(`Built ${file} (${modules.length} modules)\n`);
  }
}
if (mismatches) process.exitCode = 1;
