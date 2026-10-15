import {realpath, stat} from 'node:fs/promises';
import {isAbsolute, relative, resolve, sep} from 'node:path';

/** Public roots are application-owned and not writable by request handlers. */
export const containedFile = async (root: string, name: string): Promise<string | null> =>
{
    if (isAbsolute(name) || name.includes('\0') || name.includes('\\')) return null;
    try
    {
        const canonicalRoot = await realpath(root);
        const canonicalFile = await realpath(resolve(canonicalRoot, name));
        const child = relative(canonicalRoot, canonicalFile);
        if (!child || child === '..' || child.startsWith(`..${sep}`) || isAbsolute(child)) return null;
        return (await stat(canonicalFile)).isFile() ? canonicalFile : null;
    }
    catch (error)
    {
        if (['ENOENT', 'ENOTDIR', 'ELOOP', 'EACCES', 'EPERM'].includes((error as NodeJS.ErrnoException).code ?? '')) return null;
        throw error;
    }
};

/** Decode segments independently: an encoded slash must not create a new path. */
export const decodeFilePath = (pathname: string): string | null =>
{
    try
    {
        const parts = pathname.split('/').map((part) => decodeURIComponent(part));
        if (parts.some((part) => part === '.' || part === '..' || /[\\/\0]/.test(part))) return null;
        return parts.filter(Boolean).join('/');
    }
    catch
    {
        return null;
    }
};
