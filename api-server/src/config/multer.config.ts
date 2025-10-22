import multer from 'multer'
import type { Request } from 'express'


// This function controls which files should be uploaded.
const videoFileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (file.mimetype.startsWith('video/')) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only video files are allowed!'));
    }
};

//Directly streaming by storing in RAM( set storage to LocalDiskStorage for storing locally)
const upload = multer({
    storage: multer.memoryStorage(),
    fileFilter: videoFileFilter,
    limits: {
        fileSize: 500 * 1024 * 1024 //500mb limit
    }
})


export default upload


/** For storing in the disk
const UPLOAD_DIR = "./uploads/"

//check if upload directory exists, if not ,create new(This is for storing in the disk)
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true })
}

//How multer stores file in disk
const LocalDiskStorage = multer.diskStorage({
    destination: (req: Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
        cb(null, UPLOAD_DIR)
    },
    filename: (req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const fileExtension = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + fileExtension);
    }
})

const upload = multer({
    storage: LocalDiskStorage ,
    fileFilter: videoFileFilter,
    limits: {
        fileSize: 500 * 1024 * 1024 //500mb limit
    }
})
 */
