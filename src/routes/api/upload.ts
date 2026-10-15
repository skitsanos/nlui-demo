import {resolve} from 'node:path';
import type {RouteHandler} from '../../core/types.ts';
import Logger from '../../utils/logger.ts';
import {saveUpload} from '../../utils/uploadStorage.ts';

const logger = new Logger('Upload');

export const createUploadHandler = (options: {directory?: string; createId?: () => string} = {}): RouteHandler =>
{
    const directory = options.directory ?? resolve(process.cwd(), 'uploads');
    return async ({req}) =>
    {
        const startedAt = Bun.nanoseconds();
        const contentType = req.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
        if (contentType !== 'multipart/form-data')
        {
            return Response.json({success: false, message: 'Expected multipart form data'}, {status: 415});
        }

        let data: FormData;
        try
        {
            data = await req.formData();
        }
        catch
        {
            return Response.json({success: false, message: 'Invalid multipart request body'}, {status: 400});
        }
        const file = data.get('file');
        if (!(file instanceof File))
        {
            return Response.json({success: false, message: 'No file uploaded'}, {status: 400});
        }

        try
        {
            const fileName = await saveUpload(file, directory, options.createId);
            return Response.json({
                success: true,
                message: 'File uploaded successfully',
                fileName,
                time: (Bun.nanoseconds() - startedAt) / 1_000_000
            });
        }
        catch (error)
        {
            logger.error('Error saving upload', {error});
            return Response.json({success: false, message: 'Error saving file'}, {status: 500});
        }
    };
};

export const POST = createUploadHandler();
