import * as ipc from 'node-ipc';
import { createProjectGraphAsync } from '../project-graph/project-graph';

ipc.config.id = 'nxProjectGraphDaemon';
ipc.config.retry = 1500;
ipc.config.rawBuffer = true;
ipc.config.encoding = 'ascii';

const socketPath = ipc.config.socketRoot + ipc.config.appspace + ipc.config.id;

ipc.serve(socketPath, () => {
  ipc.server.on('connect', async (socket) => {
    ipc.log(`SERVER: Detected client connection`);
    ipc.server.emit(socket, 'SERVER: Recomputing project graph...');

    const projectGraph = await createProjectGraphAsync();

    ipc.server.emit(socket, JSON.stringify(projectGraph));
  });

  ipc.server.on('data', (data, socket) => {
    ipc.log('SERVER: Received data ->', data, data.toString());
    ipc.server.emit(socket, 'hello back from server');
  });
});

export function startIPCServer(): void {
  ipc.server.start();
}
