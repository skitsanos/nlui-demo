import {mkdir, open, unlink} from 'node:fs/promises';
import {basename, join, resolve} from 'node:path';

const safeFileName = (name: string): string =>
    basename(name).replace(/[^a-zA-Z0-9._-]/g, '_').replace(/\.{2,}/g, '_').replace(/^\.+/, '').slice(0, 128) || 'file';

export const saveUpload = async (
    file: File,
    directory: string,
    createId: () => string = () => crypto.randomUUID()
): Promise<string> =>
{
    await mkdir(directory, {recursive: true});
    for (let attempt = 0; attempt < 3; attempt += 1)
    {
        const id = createId();
        if (!/^[a-zA-Z0-9-]{1,64}$/.test(id)) throw new Error('Invalid upload identifier');
        const fileName = `uploaded_${id}_${safeFileName(file.name)}`;
        const destination = join(resolve(directory), fileName);
        // Exclusive creation rejects existing files and symlinks. Never overwrite.
        const handle = await open(destination, 'wx', 0o600).catch((error) =>
        {
            if (error.code === 'EEXIST') return null;
            throw error;
        });
        if (!handle) continue;
        try
        {
            await handle.writeFile(new Uint8Array(await file.arrayBuffer()));
            await handle.close();
            return fileName;
        }
        catch (error)
        {
            await handle.close().catch(() => undefined);
            // Only a file successfully created by this attempt may be removed.
            await unlink(destination).catch(() => undefined);
            throw error;
        }
    }
    throw new Error('Could not allocate a unique upload destination');
};
