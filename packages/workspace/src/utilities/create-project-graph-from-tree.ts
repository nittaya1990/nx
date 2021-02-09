import {
  getWorkspacePath,
  readJson,
  Tree,
  visitNotIgnoredFiles,
} from '@nrwl/devkit';
import { createProjectGraph } from '../core/project-graph/project-graph';
import { ProjectGraph } from '../core/project-graph/project-graph-models';
import { FileData } from '../core/file-utils';
import { extname } from 'path';

export async function createProjectGraphFromTree(
  tree: Tree
): Promise<ProjectGraph> {
  const workspaceJson = readJson(tree, getWorkspacePath(tree));
  const nxJson = readJson(tree, 'nx.json');

  const files: FileData[] = [];

  visitNotIgnoredFiles(tree, '', (file) => {
    files.push({
      file: file,
      ext: extname(file),
      hash: '',
    });
  });

  const readFile = (path) => {
    return tree.read(path).toString('utf-8');
  };

  return await createProjectGraph(
    workspaceJson,
    nxJson,
    files,
    readFile,
    false,
    false
  );
}
