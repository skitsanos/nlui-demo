import {Database} from 'bun:sqlite';

self.onmessage = ({data}: MessageEvent<{path: string; milliseconds: number}>) =>
{
    const database = new Database(data.path);
    database.run('BEGIN EXCLUSIVE');
    postMessage('locked');
    setTimeout(() => {database.run('ROLLBACK'); database.close(); postMessage('released');}, data.milliseconds);
};
