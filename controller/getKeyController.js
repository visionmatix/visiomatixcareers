import "dotenv/config"

export const getKeyController=async(req,res)=>{
    res.status(200).json({
        key:process.env.RAZOR_PAY_API,
        
    })
}