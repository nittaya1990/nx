import { chain, SchematicContext, Tree } from '@angular-devkit/schematics';
import { updatePackagesInPackageJson } from '@nrwl/workspace';
import { basename, join } from 'path';
import { readJsonInTree } from '../../utils/ast-utils';
import { serializeJson } from '../../utils/fileutils';
import { formatFiles } from '../../utils/rules/format-files';
import { visitNotIgnoredFiles } from '../../utils/rules/visit-not-ignored-files';
import { updateBuilderOptions } from '../../utils/workspace';

function updateESLintConfigFiles(host: Tree, context: SchematicContext) {
  return visitNotIgnoredFiles((file, host, context) => {
    if (basename(file) !== '.eslintrc') {
      return;
    }

    // Using .eslintrc without an explicit file extension is deprecated
    const newFilePath = `${file}.json`;
    context.logger.info(`Updating ${file}, and renaming to ${newFilePath}`);

    try {
      const eslintConfig = readJsonInTree(host, file);

      eslintConfig.changed = true;

      host.create(newFilePath, serializeJson(eslintConfig));
      host.delete(file);
    } catch (e) {
      context.logger.warn(
        `${file} could not be migrated because it is not valid JSON`
      );
      context.logger.error(e);
    }
  });
}

function updateESLintBuilder(host: Tree, context: SchematicContext) {
  const builders = ['@nrwl/linter:lint'];
  return updateBuilderOptions((options, project) => {
    return options;
  }, ...builders);
}

export default function () {
  return chain([
    updateESLintBuilder,
    updateESLintConfigFiles,
    updatePackagesInPackageJson(
      join(__dirname, '../../../migrations.json'),
      '10.3.0'
    ),
    formatFiles(),
  ]);
}

// "use strict";
// Object.defineProperty(exports, "__esModule", { value: true });
// const schematics_1 = require("@angular-devkit/schematics");
// const workspace_1 = require("@nrwl/workspace");
// const path_1 = require("path");
// const ast_utils_1 = require("../../utils/ast-utils");
// const fileutils_1 = require("../../utils/fileutils");
// const format_files_1 = require("../../utils/rules/format-files");
// const visit_not_ignored_files_1 = require("../../utils/rules/visit-not-ignored-files");
// const workspace_2 = require("../../utils/workspace");
// function updateESLintConfigFiles(host, context) {
//     return visit_not_ignored_files_1.visitNotIgnoredFiles((file, host, context) => {
//         if (path_1.basename(file) !== '.eslintrc') {
//             return;
//         }
//         // Using .eslintrc without an explicit file extension is deprecated
//         const newFilePath = `${file}.json`;
//         context.logger.info(`Updating ${file}, and renaming to ${newFilePath}`);
//         try {
//             const eslintConfig = ast_utils_1.readJsonInTree(host, file);
//             eslintConfig.changed = true;
//             host.create(newFilePath, fileutils_1.serializeJson(eslintConfig));
//             host.delete(file);
//         }
//         catch (e) {
//             context.logger.warn(`${file} could not be migrated because it is not valid JSON`);
//             context.logger.error(e);
//         }
//     });
// }

// // 'next' | 'react' | 'angular' | 'node' | 'web' | 'workspace'
// function inferProjectType(projectConfig) {
//     for (const [targetName, targetConfig] of Object.entries(projectConfig.architect || {})) {
//         console.log('  targetName', targetName);
//         if (targetName === 'build' && targetConfig.builder === '@nrwl/next:build') {
//             return 'next';
//         }

//         if (targetName === 'build' && targetConfig.builder === '@nrwl/web:build') {
//             if (targetConfig.options.main.endsWith('main.tsx')){
//                 return 'react';
//             }
//         }
//     }
//     return 'unknown';
// }

// function updateESLintBuilder(host, context) {
//     const workspace = ast_utils_1.readJsonInTree(host, 'workspace.json');
//     // console.log('workspace',workspace);
//     for (const [projectName, projectConfig] of Object.entries(workspace.projects)) {
//         console.log('projectName', projectName);
//         console.log(  '> projectType', inferProjectType(projectConfig));
//     }
    
// }
// function default_1() {
//     return schematics_1.chain([
//         updateESLintBuilder,
//         updateESLintConfigFiles,
//         workspace_1.updatePackagesInPackageJson(path_1.join(__dirname, '../../../migrations.json'), '10.3.0'),
//         format_files_1.formatFiles(),
//     ]);
// }
// exports.default = default_1;
// //# sourceMappingURL=update-eslint-builder-and-config.js.map