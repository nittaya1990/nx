import {
  ExecutorContext,
  joinPathFragments,
  normalizePath,
} from '@nrwl/devkit';
import { ESLint } from 'eslint';
import { resolve } from 'path';
import { Schema } from '../schema';
import { loadESLint } from '../utility/eslint-utils';

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
    context: { root: systemRoot, cwd, workspace },
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

  const batchRunOutput: Partial<BatchRunOutput> = {};
  const lintResultsByProject: {
    [projectName: string]: ESLint.LintResult[];
  } = {};
  const allProjectNamesInBatch = Object.entries(input).map(
    ([projectName]) => projectName
  );

  for (const projectName of allProjectNamesInBatch) {
    // Used to keep track of lint results per project in order to generate final terminalOutput
    lintResultsByProject[projectName] = [];
    batchRunOutput[projectName] = {
      terminalOutput: ``, // unknown at this point
      success: false, // unknown at this point
    };
  }

  // TODO: Figure out the right way to actually derive/configure these options for the batch
  const firstProjectEntry = Object.entries(input)[0];
  const optionsForBatch = {
    noEslintrc: firstProjectEntry[1].options.noEslintrc,
    eslintConfig: firstProjectEntry[1].options.eslintConfig,
    ignorePath: firstProjectEntry[1].options.ignorePath,
    fix: firstProjectEntry[1].options.fix,
    cache: firstProjectEntry[1].options.cache,
    cacheLocation: firstProjectEntry[1].options.cacheLocation,
    lintFilePatterns: firstProjectEntry[1].options.lintFilePatterns,
  };

  /**
   * We want users to have the option of not specifying the config path, and let
   * eslint automatically resolve the `.eslintrc.json` files in each folder.
   */
  const eslintConfigPath = optionsForBatch.eslintConfig
    ? resolve(systemRoot, optionsForBatch.eslintConfig)
    : undefined;

  const eslint = new projectESLint.ESLint({
    /**
     * If "noEslintrc" is set to `true` (and therefore here "useEslintrc" will be `false`), then ESLint will not
     * merge the provided config with others it finds automatically.
     */
    useEslintrc: !optionsForBatch.noEslintrc,
    overrideConfigFile: eslintConfigPath,
    ignorePath: optionsForBatch.ignorePath || undefined,
    fix: !!optionsForBatch.fix,
    cache: !!optionsForBatch.cache,
    cacheLocation: optionsForBatch.cacheLocation || undefined,
    /**
     * Default is `true` and if not overridden the eslint.lintFiles() method will throw an error
     * when no target files are found.
     *
     * We don't want ESLint to throw an error if a user has only just created
     * a project and therefore doesn't necessarily have matching files, for example.
     */
    errorOnUnmatchedPattern: false,
  });

  let lintResults: ESLint.LintResult[] = await eslint.lintFiles(
    optionsForBatch.lintFilePatterns
  );
  if (lintResults.length === 0) {
    throw new Error(`Invalid lint configuration for batch. Nothing to lint.`);
  }

  // Organize lint results by project
  for (const lintResult of lintResults) {
    // Infer project for lint result
    const lintResultProjectEntry = Object.entries(workspace.projects).find(
      ([, projectConfig]) => {
        if (
          lintResult.filePath.startsWith(
            normalizePath(joinPathFragments(systemRoot, projectConfig.root))
          )
        ) {
          return true;
        }
        return false;
      }
    );
    if (!lintResultProjectEntry) {
      throw new Error(
        `Could not infer project for linted file: ${lintResult.filePath}`
      );
    }
    lintResultsByProject[lintResultProjectEntry[0]].push(lintResult);
  }

  let finalLintResults: ESLint.LintResult[] = [];

  for (const [projectName, lintResults] of Object.entries(
    lintResultsByProject
  )) {
    const { options: projectOptions } = input[projectName];

    let finalLintResultsForProject = lintResults;
    // if quiet, only show errors for project
    if (projectOptions.quiet) {
      finalLintResultsForProject = ESLint.getErrorResults(lintResults);
    }
    lintResultsByProject[projectName] = finalLintResultsForProject;
    finalLintResults = [...finalLintResults, ...finalLintResultsForProject];

    let totalErrors = 0;
    let totalWarnings = 0;
    for (const result of lintResults) {
      if (result.errorCount || result.warningCount) {
        totalErrors += result.errorCount;
        totalWarnings += result.warningCount;
      }
    }

    let terminalOutputForProject = '';
    const printInfo = projectOptions.format && !projectOptions.silent;

    if (printInfo) {
      terminalOutputForProject += `\n\nLinting ${JSON.stringify(
        projectName
      )}...\n`;
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

    const formatter = await eslint.loadFormatter(projectOptions.format);
    const formattedResults = formatter.format(lintResults);
    terminalOutputForProject += `\n${formattedResults}\n`;

    batchRunOutput[projectName] = {
      terminalOutput: terminalOutputForProject,
      success:
        projectOptions.force ||
        (totalErrors === 0 &&
          (projectOptions.maxWarnings === -1 ||
            totalWarnings <= projectOptions.maxWarnings)),
    };
  }

  // output fixes to disk, if applicable based on the options
  await projectESLint.ESLint.outputFixes(finalLintResults);

  return batchRunOutput;
}
