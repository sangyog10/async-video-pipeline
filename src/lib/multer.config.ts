import multer  from 'multer'
import path from 'path'
import fs from 'fs'
import type { Request } from 'express'

const UPLOAD_DIR = "./uploads/"

//check if upload directory exists, if not ,create new
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true })
}

//How multer stores file in disk
const storage = multer.diskStorage({
    destination: (req: Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
        cb(null, UPLOAD_DIR)
    },
    filename: (req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const fileExtension = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + fileExtension);
    }
})



// This function controls which files should be uploaded.
const videoFileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (file.mimetype.startsWith('video/')) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only video files are allowed!'));
    }
};


const upload = multer({
    storage:storage,
    fileFilter: videoFileFilter,
    limits:{
        fileSize: 500 * 1024 * 1024
    }
})


export default upload