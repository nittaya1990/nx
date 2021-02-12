import { TargetProjectLocator } from '../../../target-project-locator';
import { DependencyType } from '../../project-graph-models';
import { ProjectGraphPlugin } from '../types';
import { TypeScriptImportLocator } from './typescript-import-locator';

const typescriptProjectGraphPlugin: ProjectGraphPlugin = {
  buildDependencies: (ctx, nodes, addDependency, fileRead) => {
    const importLocator = new TypeScriptImportLocator(fileRead);
    const targetProjectLocator = new TargetProjectLocator(nodes, fileRead);
    Object.keys(ctx.fileMap).forEach((source) => {
      Object.values(ctx.fileMap[source]).forEach((f) => {
        importLocator.fromFile(
          f.file,
          (importExpr: string, _filePath: string, type: DependencyType) => {
            const target = targetProjectLocator.findProjectWithImport(
              importExpr,
              f.file,
              ctx.nxJson.npmScope
            );
            if (source && target) {
              addDependency(type, source, target);
            }
          }
        );
      });
    });
  },
};

export default typescriptProjectGraphPlugin;
