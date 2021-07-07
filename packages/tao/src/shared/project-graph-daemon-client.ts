import * as ipc from 'node-ipc';

ipc.config.id = 'nxProjectGraphDaemonClient';
ipc.config.retry = 1500;
ipc.config.rawBuffer = true;
ipc.config.encoding = 'ascii';

const serverId = 'nxProjectGraphDaemon';

ipc.connectTo(serverId, () => {
  ipc.of.nxProjectGraphDaemon.on('connect', () => {
    ipc.log(`CLIENT: connected to server "${serverId}"`);
    ipc.of.nxProjectGraphDaemon.emit('hello from client');
  });

  ipc.of.nxProjectGraphDaemon.on('data', (data) => {
    ipc.log('CLIENT: Receieved data -> ', data, data.toString());
  });
});
