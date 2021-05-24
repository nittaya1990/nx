import { ExecutorContext } from '@nrwl/devkit';
import { ESLint } from 'eslint';
import { resolve } from 'path';
import { Schema } from '../schema';
import { lint, loadESLint } from '../utility/eslint-utils';

type BatchRunInput = Record<
  string,
  { options: Schema; context: ExecutorContext }
>;

type BatchRunOutput = Promise<
  Record<string, { success: boolean; terminalOutput: string }>
>;

function verifyOptionsCompatibleWithBatchRun(
  projectName: string,
  options: Schema
): void | never {
  for (const optionName of Object.keys(options)) {
    switch (true) {
      // Given we are collecting up terminal output, we can't support outputFile from the standard lint executor
      case optionName === 'outputFile' && Boolean(options[optionName]):
        throw new Error(
          `Error: @nrwl/linter:eslint executor option "${optionName}" (set on project "${projectName}") is not compatible with batch runs`
        );
    }
  }
}

export default async function batchRun(input: BatchRunInput): BatchRunOutput {
  // Ensure that all the provided projects are compatible with running as a batch
  for (const [projectName, { options }] of Object.entries(input)) {
    verifyOptionsCompatibleWithBatchRun(projectName, options);
  }

  // Resolve "global" context from batch run input by grabbing any project
  const projectNames = Object.keys(input);
  if (projectNames.length === 0) {
    throw new Error('Error: No projects were provided for the batch run');
  }
  const {
    context: { root: systemRoot, cwd },
  } = input[projectNames[0]];

  process.chdir(cwd);

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

  const batchRunOutput = {};

  for (const [projectName, { options }] of Object.entries(input)) {
    let terminalOutputForProject = '';
    const printInfo = options.format && !options.silent;

    if (printInfo) {
      terminalOutputForProject += `\n\nLinting ${JSON.stringify(
        projectName
      )}...\n`;
    }

    /**
     * We want users to have the option of not specifying the config path, and let
     * eslint automatically resolve the `.eslintrc.json` files in each folder.
     */
    const eslintConfigPath = options.eslintConfig
      ? resolve(systemRoot, options.eslintConfig)
      : undefined;

    let lintResults: ESLint.LintResult[] = await lint(
      eslintConfigPath,
      options
    );

    if (lintResults.length === 0) {
      throw new Error(
        `Invalid lint configuration for project ${projectName}. Nothing to lint.`
      );
    }

    // if quiet, only show errors
    if (options.quiet) {
      lintResults = ESLint.getErrorResults(lintResults);
    }

    let totalErrors = 0;
    let totalWarnings = 0;

    // output fixes to disk, if applicable based on the options
    await projectESLint.ESLint.outputFixes(lintResults);

    for (const result of lintResults) {
      if (result.errorCount || result.warningCount) {
        totalErrors += result.errorCount;
        totalWarnings += result.warningCount;
      }
    }

    if (totalWarnings > 0 && printInfo) {
      terminalOutputForProject +=
        '\nLint warnings found in the listed files.\n\n';
    }

    if (totalErrors > 0 && printInfo) {
      terminalOutputForProject +=
        '\nLint errors found in the listed files.\n\n';
    }

    if (totalWarnings === 0 && totalErrors === 0 && printInfo) {
      terminalOutputForProject += '\nAll files pass linting.\n';
    }

    const formatter = await eslint.loadFormatter(options.format);
    const formattedResults = formatter.format(lintResults);
    terminalOutputForProject += `\n${formattedResults}\n`;

    batchRunOutput[projectName] = {
      terminalOutput: terminalOutputForProject,
      success:
        options.force ||
        (totalErrors === 0 &&
          (options.maxWarnings === -1 || totalWarnings <= options.maxWarnings)),
    };
  }

  return batchRunOutput;
}
