
import mongoose from "mongoose"
import {Comment} from "../models/comment.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const getVideoComments = asyncHandler(async (req, res) => {
    //TODO: get all comments for a video
    const {videoId} = req.params
    const {page = 1, limit = 10} = req.query

    if(!videoId){
        throw new ApiError(400,"Video ID is required")
    }

    const comments = await Comment.find({video : videoId})
    .populate("owner", "username avatar")
    .sort({ createdAt :-1})
    .skip((page -1)*limit)
    .limit(Number(limit))

    const totalComments = await Comment.countDocument({ video : videoId})

    return res.status(200).json(
        new ApiResponse(200,{
            comments,
            totalComments,
            customPage : Number(page),
            totalPage: Math.ceil(totalComments/limit)
        }),"comments fetched successfully "
    )

})

const addComment = asyncHandler(async (req, res) => {
    // TODO: add a comment to a video
})

const updateComment = asyncHandler(async (req, res) => {
    // TODO: update a comment
      const {commentId} = req.params
    const {content} = req.body

    if (!mongoose.isValidObjectId(commentId)) {
        throw new ApiError(400, "Invalid comment id")
    }

    if (!content?.trim()) {
        throw new ApiError(400, "Content is required")
    }

    const comment = await Comment.findOneAndUpdate(
        {
            _id: commentId,
            owner: req.user?._id
        },
        {
            $set: {
                content: content.trim()
            }
        },
        {
            new: true
        }
    )

    if (!comment) {
        throw new ApiError(404, "Comment not found")
    }

    return res
        .status(200)
        .json(new ApiResponse(200, comment, "Comment updated successfully"))
})

const deleteComment = asyncHandler(async (req, res) => {
    // TODO: delete a comment
})

export {
    getVideoComments, 
    addComment, 
    updateComment,
     deleteComment
    }
