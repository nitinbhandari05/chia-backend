import mongoose, { Schema } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const vedioSchema = new Schema(
    {
        videoFile: {
            type: String, //cloudnary url
            req: true
        },
        thumbnail: {
            type: String, //cloudnary url
            req: true
        },

        title: {
            type: String, 
            req: true
        },
        discription: {
            type: String, 
            req: true
        },
          duration: {
            type: Number, 
            req: true
        },
        views:{
            type:Number,
            default:0
        },
        isPublic:{
            type:Boolean,
            default:true
        },
        owner:{
            type:Schema.Types.ObjectId,
            ref:"User"
        }

    },
    { timestamps: true })

    vedioSchema.plugin(mongooseAggregatePaginate)

export const Video = mongoose.model("Video", vedioSchema)