import { Tree, addProjectConfiguration, readJson } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import * as fs from 'fs';
import { Schema } from '../schema';

jest.spyOn(fs, 'writeFileSync').mockImplementation();
let mockCreateDirectory = jest.fn();
jest.mock('./utility/create-directory', () => ({
  createDirectory: mockCreateDirectory,
}));

const formattedReports = ['formatted report 1'];
const mockFormatter = {
  format: jest.fn().mockReturnValue(formattedReports),
};
const mockLoadFormatter = jest.fn().mockReturnValue(mockFormatter);
const mockOutputFixes = jest.fn();

const VALID_ESLINT_VERSION = '7.6';

class MockESLint {
  static version = VALID_ESLINT_VERSION;
  static outputFixes = mockOutputFixes;
  loadFormatter = mockLoadFormatter;
  lintFiles = mockLint;
}

const mockContextRoot = '/root';

const projectAName = 'project-a';
const projectBName = 'project-b';
const failureFileContents = `eval("");
`;
const projectAFailureFilePath = `apps/${projectAName}/src/file.ts`;
const projectBFailureFilePath = `apps/${projectBName}/src/file.ts`;

let mockReports: any[] = [
  {
    filePath: `${mockContextRoot}/${projectAFailureFilePath}`,
    source: failureFileContents,
    messages: [
      {
        ruleId: 'no-eval',
        severity: 2,
        message: 'eval can be harmful.',
        line: 1,
        column: 1,
        nodeType: 'CallExpression',
        messageId: 'unexpected',
        endLine: 1,
        endColumn: 5,
      },
    ],
    errorCount: 1,
    warningCount: 0,
    fixableErrorCount: 0,
    fixableWarningCount: 0,
    usedDeprecatedRules: [],
  },
  {
    filePath: `${mockContextRoot}/${projectBFailureFilePath}`,
    source: failureFileContents,
    messages: [
      {
        ruleId: 'no-eval',
        severity: 2,
        message: 'eval can be harmful.',
        line: 1,
        column: 1,
        nodeType: 'CallExpression',
        messageId: 'unexpected',
        endLine: 1,
        endColumn: 5,
      },
    ],
    errorCount: 1,
    warningCount: 0,
    fixableErrorCount: 0,
    fixableWarningCount: 0,
    usedDeprecatedRules: [],
  },
];
let mockLint = jest.fn().mockImplementation(() => mockReports);
jest.mock('./utility/eslint-utils', () => {
  return {
    lint: mockLint,
    loadESLint: jest.fn().mockReturnValue(
      Promise.resolve({
        ESLint: MockESLint,
      })
    ),
  };
});

function createMockContext(tree, projectName) {
  return {
    projectName,
    root: mockContextRoot,
    cwd: mockContextRoot,
    workspace: readJson(tree, 'workspace.json'),
    isVerbose: false,
  };
}

function createValidRunBuilderOptions(
  additionalOptions: Partial<Schema> = {}
): Schema {
  return {
    lintFilePatterns: [],
    eslintConfig: './.eslintrc.json',
    fix: true,
    cache: true,
    cacheLocation: 'cacheLocation1',
    format: 'stylish',
    force: false,
    silent: false,
    ignorePath: null,
    outputFile: null,
    maxWarnings: -1,
    noEslintrc: false,
    quiet: false,
    hasTypeAwareRules: false,
    ...additionalOptions,
  };
}

function setupMocks() {
  jest.resetModules();
  jest.clearAllMocks();
  jest.spyOn(process, 'chdir').mockImplementation(() => {});
  console.warn = jest.fn();
  console.error = jest.fn();
  console.info = jest.fn();
}

// Must come after the mocks above. Made it a require call so that it doesn't get hoisted up by VSCode Organize Imports.
const {
  default: batchRun,
} = require('./single-eslint-invocation-per-batch.lint.impl');

describe('Lint Executor - Batch Run - Single ESLint invocation per run', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();

    addProjectConfiguration(tree, projectAName, {
      root: `apps/${projectAName}`,
      targets: {},
    });
    tree.write(projectAFailureFilePath, failureFileContents);

    addProjectConfiguration(tree, projectBName, {
      root: `apps/${projectBName}`,
      targets: {},
    });
    tree.write(projectBFailureFilePath, failureFileContents);
  });

  it('should work', async () => {
    setupMocks();

    const input = {
      'project-a': {
        options: createValidRunBuilderOptions(),
        context: createMockContext(tree, projectAName),
      },
      'project-b': {
        options: createValidRunBuilderOptions(),
        context: createMockContext(tree, projectBName),
      },
    };
    expect(await batchRun(input)).toMatchInlineSnapshot(`
      Object {
        "project-a": Object {
          "success": false,
          "terminalOutput": "

      Linting \\"project-a\\"...

      Lint errors found in the listed files.


      formatted report 1
      ",
        },
        "project-b": Object {
          "success": false,
          "terminalOutput": "

      Linting \\"project-b\\"...

      Lint errors found in the listed files.


      formatted report 1
      ",
        },
      }
    `);
  });
});
