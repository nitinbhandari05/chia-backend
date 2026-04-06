
import mongoose from "mongoose"
import {Video} from "../models/video.model.js"
import {Subscription} from "../models/subscription.model.js"
import {Like} from "../models/like.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const getChannelStats = asyncHandler(async (req, res) => {
    const channelId = req.user?._id

    if (!channelId) {
        throw new ApiError(401, "Unauthorized request")
    }

    const [videoStats, totalSubscribers] = await Promise.all([
        Video.aggregate([
            {
                $match: {
                    owner: new mongoose.Types.ObjectId(channelId)
                }
            },
            {
                $group: {
                    _id: null,
                    totalVideos: { $sum: 1 },
                    totalViews: { $sum: "$views" },
                    videoIds: { $push: "$_id" }
                }
            }
        ]),
        Subscription.countDocuments({
            channel: channelId
        })
    ])

    const stats = videoStats[0] || {
        totalVideos: 0,
        totalViews: 0,
        videoIds: []
    }

    const totalLikes = stats.videoIds.length
        ? await Like.countDocuments({
            video: { $in: stats.videoIds }
        })
        : 0

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                totalVideos: stats.totalVideos,
                totalViews: stats.totalViews,
                totalSubscribers,
                totalLikes
            },
            "Channel stats fetched successfully"
        )
    )
})

const getChannelVideos = asyncHandler(async (req, res) => {
    const channelId = req.user?._id

    if (!channelId) {
        throw new ApiError(401, "Unauthorized request")
    }

    const videos = await Video.find({
        owner: channelId
    }).sort({ createdAt: -1 })

    return res.status(200).json(
        new ApiResponse(
            200,
            videos,
            "Channel videos fetched successfully"
        )
    )
})

export {
    getChannelStats, 
    getChannelVideos
    }
