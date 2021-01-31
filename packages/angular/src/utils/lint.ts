import { Rule } from '@angular-devkit/schematics';
import { Linter, NxJson, updateJsonInTree } from '@nrwl/workspace';
import { angularEslintVersion } from './versions';

export const extraEslintDependencies = {
  dependencies: {},
  devDependencies: {
    '@angular-eslint/eslint-plugin': angularEslintVersion,
    '@angular-eslint/eslint-plugin-template': angularEslintVersion,
    '@angular-eslint/template-parser': angularEslintVersion,
  },
};

/**
 * Utility Rule to only include tslint.json in implicitDependencies if TSLint is
 * actually chosen by the user as part of a schematic/generator execution.
 */
export function updateNxJson(options: { linter: Linter }): Rule {
  return updateJsonInTree<NxJson>('nx.json', (json) => {
    if (options.linter === Linter.TsLint) {
      json.implicitDependencies = json.implicitDependencies || {};
      if (!json.implicitDependencies['tslint.json']) {
        json.implicitDependencies['tslint.json'] = '*';
      }
    }
    return json;
  });
}

export const createAngularEslintJson = (
  projectRoot: string,
  prefix: string
) => ({
  overrides: [
    {
      files: ['*.ts'],
      extends: [
        'plugin:@nrwl/nx/angular',
        'plugin:@angular-eslint/template/process-inline-templates',
      ],
      parserOptions: {
        project: [`${projectRoot}/tsconfig.*?.json`],
      },
      rules: {
        '@angular-eslint/directive-selector': [
          'error',
          { type: 'attribute', prefix, style: 'camelCase' },
        ],
        '@angular-eslint/component-selector': [
          'error',
          { type: 'element', prefix, style: 'kebab-case' },
        ],
      },
    },
    {
      files: ['*.html'],
      extends: ['plugin:@nrwl/nx/angular-template'],
      /**
       * Having an empty rules object present makes it more obvious to the user where they would
       * extend things from if they needed to
       */
      rules: {},
    },
  ],
});
