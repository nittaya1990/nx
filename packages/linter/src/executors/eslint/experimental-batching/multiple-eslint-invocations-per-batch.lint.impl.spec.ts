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
}

let mockReports: any[] = [{ results: [], usedDeprecatedRules: [] }];
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

function createMockContext(projectName) {
  return {
    projectName,
    root: '/root',
    cwd: '/root',
    workspace: {
      version: 2,
      projects: {},
    },
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

import batchRun from './multiple-eslint-invocations-per-batch.lint.impl';

describe('Lint Executor - Batch Run - Multiple ESLint invocations per run', () => {
  it('should work', async () => {
    setupMocks();

    const input = {
      'project-a': {
        options: createValidRunBuilderOptions(),
        context: createMockContext('project-a'),
      },
      'project-b': {
        options: createValidRunBuilderOptions(),
        context: createMockContext('project-b'),
      },
    };
    expect(await batchRun(input)).toMatchInlineSnapshot(`
      Object {
        "project-a": Object {
          "success": true,
          "terminalOutput": "

      Linting \\"project-a\\"...

      All files pass linting.

      formatted report 1
      ",
        },
        "project-b": Object {
          "success": true,
          "terminalOutput": "

      Linting \\"project-b\\"...

      All files pass linting.

      formatted report 1
      ",
        },
      }
    `);
  });
});
