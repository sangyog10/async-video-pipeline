const fs=require('fs/promises')

const util={};

//delete the folder if exit, if doesnot exist,funciton doesnot throw error
util.deleteFolder=async(path)=>{
    try {
        await fs.rm(path,{recursive:true})
    } catch (error) {
        
    }
}

util.deleteFile=async(path)=>{
    try {
        await fs.unlink(path)
    } catch (error) {
        
    }
}

module.exports=util;