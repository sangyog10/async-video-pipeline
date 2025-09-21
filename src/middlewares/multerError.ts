import type { Request, Response, NextFunction } from "express"
import multer from "multer"

export const handleUploadErrors = (err: any, req: Request, res: Response, next: NextFunction) => {
     if (err instanceof multer.MulterError) {
        // A Multer-specific error occurred (e.g., file too large).
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ message: 'File is too large. Max size is 500MB.' });
        }
        return res.status(400).json({ message: err.message });
    } else if (err) {
        // An error from our custom file filter (e.g., wrong file type).
        return res.status(400).json({ message: err.message });
    }

    // If the code reaches this point and there's no file, it means the user
    // didn't include a file in their request.
    if (!req.file) {
        return res.status(400).json({ message: 'No file was provided in the request.' });
    }

    // everything ok 
    next();
};