import type {
  AddProjectDependency,
  ProjectGraphContext,
  ProjectGraphNodeRecords,
} from '../project-graph-models';
import type { FileRead } from '../../file-utils';

interface BuildDependencies {
  (
    ctx: ProjectGraphContext,
    nodes: ProjectGraphNodeRecords,
    addDependency: AddProjectDependency,
    fileRead: FileRead
  ): void;
}

export interface ProjectGraphPlugin {
  buildDependencies: BuildDependencies;
}
