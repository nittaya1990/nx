import { ExecutorContext } from '@nrwl/devkit';
import { ESLint } from 'eslint';

import { readFileSync, writeFileSync } from 'fs';
import { dirname, join, resolve } from 'path';

import { Schema } from './schema';
import { lint, loadESLint } from './utility/eslint-utils';
import { createDirectory } from './utility/create-directory';

export default async function run(
  options: Schema,
  context: ExecutorContext
): Promise<{ success: boolean }> {
  // this is only used for the hasher
  delete options.hasTypeAwareRules;

  const systemRoot = context.root;
  process.chdir(context.cwd);

  const projectName = context.projectName || '<???>';
  const printInfo = options.format && !options.silent;

  if (printInfo) {
    console.info(`\nLinting ${JSON.stringify(projectName)}...`);
  }

  const projectESLint: { ESLint: typeof ESLint } = await loadESLint();
  const version = projectESLint.ESLint?.version?.split('.');
  if (
    !version ||
    version.length < 2 ||
    Number(version[0]) < 7 ||
    (Number(version[0]) === 7 && Number(version[1]) < 6)
  ) {
    throw new Error('ESLint must be version 7.6 or higher.');
  }

  const eslint = new projectESLint.ESLint({});

  /**
   * We want users to have the option of not specifying the config path, and let
   * eslint automatically resolve the `.eslintrc.json` files in each folder.
   */
  const eslintConfigPath = options.eslintConfig
    ? resolve(systemRoot, options.eslintConfig)
    : undefined;

  let lintResults: ESLint.LintResult[] = await lint(eslintConfigPath, options);

  if (lintResults.length === 0) {
    throw new Error('Invalid lint configuration. Nothing to lint.');
  }

  // if quiet, only show errors
  if (options.quiet) {
    console.debug('Quiet mode enabled - filtering out warnings\n');
    lintResults = ESLint.getErrorResults(lintResults);
  }

  const formatter = await eslint.loadFormatter(options.format);

  let totalErrors = 0;
  let totalWarnings = 0;

  // output fixes to disk, if applicable based on the options
  await projectESLint.ESLint.outputFixes(lintResults);

  // If disableErrorsInline has been set, filter out the rules the have been configured
  if (
    Array.isArray(options.disableErrorsInline) &&
    options.disableErrorsInline.length > 0
  ) {
    const toBeInlineDisabled: ESLint.LintResult[] = [];
    const remainingAfterInlineDisabled: ESLint.LintResult[] = [];

    lintResults.forEach((result) => {
      const toBeInlineDisabledResult: ESLint.LintResult = {
        ...result,
        messages: [],
      };
      const remainingAfterInlineDisabledResult: ESLint.LintResult = {
        ...result,
        messages: [],
      };

      for (const message of result.messages) {
        // Special "match all" syntax
        if (
          options.disableErrorsInline.length === 1 &&
          options.disableErrorsInline[0] === '*'
        ) {
          toBeInlineDisabledResult.messages.push(message);
          continue;
        }
        if (options.disableErrorsInline.includes(message.ruleId)) {
          toBeInlineDisabledResult.messages.push(message);
          continue;
        }
        remainingAfterInlineDisabledResult.messages.push(message);
      }

      toBeInlineDisabledResult.errorCount =
        toBeInlineDisabledResult.messages.length;
      remainingAfterInlineDisabledResult.errorCount =
        remainingAfterInlineDisabledResult.messages.length;

      toBeInlineDisabled.push(toBeInlineDisabledResult);
      remainingAfterInlineDisabled.push(remainingAfterInlineDisabledResult);
    });

    lintResults = remainingAfterInlineDisabled;

    for (const resultToBeInlineDisabled of toBeInlineDisabled) {
      const processedLinesAndRules = new Map<number, Set<string>>();
      const currentFileContents = readFileSync(
        resultToBeInlineDisabled.filePath,
        { encoding: 'utf-8' }
      );
      const lines = currentFileContents.split('\n');

      // need to start bottom up so the lines aren't changed prematurely
      const sortedMessages = resultToBeInlineDisabled.messages.sort(
        (a, b) => b.line - a.line
      );
      sortedMessages.forEach((message) => {
        // Errors only, not warnings
        if (message.severity !== 2) {
          return;
        }
        let disabledRulesForLine = processedLinesAndRules.get(message.line);

        if (!disabledRulesForLine) {
          disabledRulesForLine = new Set();
          processedLinesAndRules.set(message.line, disabledRulesForLine);
        }

        disabledRulesForLine.add(message.ruleId);
      });

      for (const [line, rules] of Array.from(
        processedLinesAndRules.entries()
      )) {
        lines.splice(
          line - 1,
          0,
          `// eslint-disable-next-line ${Array.from(rules).join(', ')}`
        );
      }
      writeFileSync(resultToBeInlineDisabled.filePath, lines.join('\n'));
    }
  }

  for (const result of lintResults) {
    if (result.errorCount || result.warningCount) {
      totalErrors += result.errorCount;
      totalWarnings += result.warningCount;
    }
  }

  const formattedResults = formatter.format(lintResults);

  if (options.outputFile) {
    const pathToOutputFile = join(context.root, options.outputFile);
    createDirectory(dirname(pathToOutputFile));
    writeFileSync(pathToOutputFile, formattedResults);
  } else {
    console.info(formattedResults);
  }

  if (totalWarnings > 0 && printInfo) {
    console.warn('Lint warnings found in the listed files.\n');
  }

  if (totalErrors > 0 && printInfo) {
    console.error('Lint errors found in the listed files.\n');
  }

  if (totalWarnings === 0 && totalErrors === 0 && printInfo) {
    console.info('All files pass linting.\n');
  }

  return {
    success:
      options.force ||
      (totalErrors === 0 &&
        (options.maxWarnings === -1 || totalWarnings <= options.maxWarnings)),
  };
}
