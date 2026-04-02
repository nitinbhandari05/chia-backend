import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from '../utils/ApiResponse.js';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { Video } from '../models/video.model.js';


//  TOKEN GENERATION
const generateAccessTokenAndRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId);

        if (!user) {
            throw new ApiError(404, "User not found");
        }

        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;


        await user.save({ validateBeforeSave: false });

        return { refreshToken, accessToken };

    } catch (error) {
        console.log("TOKEN ERROR:", error)
        throw new ApiError(500, "Something went wrong while generating tokens");
    }
};


//  REGISTER
const registerUser = asyncHandler(async (req, res) => {

    const { fullname, username, email, password } = req.body || {};

    if ([fullname, email, username, password].some((field) => !field || field.trim() === "")) {
        throw new ApiError(400, "All fields are required");
    }

    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    });

    if (existedUser) {
        throw new ApiError(409, "User already exists");
    }

    const avatarLocalPath = req.files?.avatar?.[0]?.path;
    const coverImageLocalPath = req.files?.coverImage?.[0]?.path;

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = coverImageLocalPath
        ? await uploadOnCloudinary(coverImageLocalPath)
        : null;

    if (!avatar) {
        throw new ApiError(400, "Avatar upload failed");
    }

    const user = await User.create({
        username,
        email,
        fullname,
        password,
        avatar: avatar.url,
        coverImage: coverImage?.url || ""
    });

    const createdUser = await User.findById(user._id)
        .select("-password -refreshToken");

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered successfully")
    );
});


// ✅ LOGIN
const loginUser = asyncHandler(async (req, res) => {

    const { email, username, password } = req.body || {};

    //if(!(username && email))// alternative
    if (!(username || email)) {
        throw new ApiError(400, "username or email is required");
    }

    if (!password) {
        throw new ApiError(400, "password is required");
    }

    const user = await User.findOne({
        $or: [{ username }, { email }]
    });

    if (!user) {
        throw new ApiError(404, "User does not exist");
    }

    const isPasswordValid = await user.isPasswordCorrect(password);

    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid credentials");
    }

    const { accessToken, refreshToken } =
        await generateAccessTokenAndRefreshToken(user._id);

    const loggedInUser = await User.findById(user._id)
        .select("-password -refreshToken");

    const options = {
        httpOnly: true,
        secure: true
    };

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                { user: loggedInUser, accessToken, refreshToken },
                "User logged in successfully"
            )
        );
});


//  LOGOUT
const logoutUser = asyncHandler(async (req, res) => {

    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: { refreshToken: 1 }
        },
        {
            returnDocument: "after"
        }
    );

    const options = {
        httpOnly: true,
        secure: true
    };

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, {}, "User logged out"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingToken =
        req.cookies?.refreshToken || req.body?.refreshToken;

    if (!incomingToken) {
        throw new ApiError(401, "Unauthorized request");
    }

    try {
        const decodedToken = jwt.verify(
            incomingToken,
            process.env.REFRESH_TOKEN_SECRET
        );

        const user = await User.findById(decodedToken?._id);

        // ✅ FIXED
        if (!user || incomingToken !== user.refreshToken) {
            throw new ApiError(401, "Invalid or expired refresh token");
        }

        const { accessToken, refreshToken } =
            await generateAccessTokenAndRefreshToken(user._id);

        const options = {
            httpOnly: true,
            secure: true
        };

        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", refreshToken, options)
            .json(
                new ApiResponse(
                    200,
                    { accessToken, refreshToken },
                    "Access token refreshed"
                )
            );

    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token");
    }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;

    const user = await User.findById(req.user?._id);

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

    if (!isPasswordCorrect) {
        throw new ApiError(400, "Invalid Password");
    }

    user.password = newPassword;
    await user.save({ validateBeforeSave: false });

    return res.status(200).json(
        new ApiResponse(200, {}, "Password changed successfully")
    );
});

const getCurrentUser = asyncHandler(async (req, res) => {
    return res
        .status(200)
        .json(200, req.user, "current user fetched successfully")
})

const updateAccountDetails = asyncHandler(async (req, res) => {
    const { fullname, email } = req.body

    if (!fullname || email) {
        throw new ApiError(400, "All fields are required")
    }
    const user = await User.findByIdAndDelete(req.user?._id,
        {
            $set: {
                fullname: fullname,
                email: email,

            }
        },
        { new: true }
    ).select("-password")

    return res
        .status(200)
        .json(new ApiResponse(200, user, "Account Detail Updated"))


})

const updatUserAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is missing")
    }

    const avatar = await uploadOnCloudinary
    if (!avatar.url) {
        throw new ApiError(400, "Error while uploading on avatar")

    }


    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar: avatar.url
            }
        },
        { new: true }
    ).select("-password")
    return res
        .status(200)
        .json(new ApiResponse(200, user, "avatarImage updated successfully"))
})

const deleteOldAvatar = asyncHandler(async (req, res) => {

    const avatarLocalPath = req.file?.path


    if (!avatarLocalPath) {
        throw new ApiError(400, "avatar file is required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if (!avatar) {
        throw new ApiError(400, "Error uploading")
    }

    const user = await User.findByIdAndUpdate(
        req.body._id, {
        $set: {
            avatar: avatar.url
        }
    },
        {
            returnDocument: "after"
        }
    ).select("-password -refreshToken")

    return res.status(200)
        .json(new ApiResponse(200, user, "Avatar updated successfully"))

})


const updatUserCoverImage = asyncHandler(async (req, res) => {
    const coverImageLocalPath = req.file?.path

    if (!coverImageLocalPath) {
        throw new ApiError(400, "coverImager file is missing")
    }

    const coverImager = await uploadOnCloudinary
    if (!coverImager.url) {
        throw new ApiError(400, "Error while uploading on coverImager")

    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                coverImager: coverImager.url
            }
        },
        { new: true }
    ).select("-password")
    return res
        .status(200)
        .json(new ApiResponse(200, user, "coverImage updated successfully"))
})

const getUserChannelProfile = asyncHandler(async (req, res) => {
    const { username } = req.params

    if (!username) {
        throw new ApiError(400, "username is missing")
    }

    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase()
            }
        },
        {
            $lookup: {
                from: "Subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from: "Subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscriberTo"
            }
        },
        {
    $addFields: {
        subscriberCount: {
            $size: "$subscribers"
        },
        channelSubscribedToCount: {
            $size: "$subscriberTo"
        },
        isSubscribed: {
            $cond: {
                if: {
                    $in: [
                        new mongoose.Types.ObjectId(req.user?._id),
                        "$subscribers.subscriber"
                    ]
                },
                then: true,
                else: false
            }
        }
    }
},
        {
            $project: {
                fullname: 1,
                username: 1,
                subscriberCount: 1,
                channelSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1
            }
        }
    ])

    if (!channel?.length) {
        throw new ApiError(404, "channel does not exists")
    }

    return res.status(200)
        .json(
            new ApiResponse(200, channel[0], "user channel fetched successfully")
        )


})

const getWatchHistroy = asyncHandler(async (req, res) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup: {
                from: "Video",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullname: 1,
                                        username: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields: {
                            owner: {
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                user[0].watchHistory, "watch history fetched successefully"
            )
        )
})

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updatUserAvatar,
    updatUserCoverImage,
    deleteOldAvatar,
    getUserChannelProfile,
    getWatchHistroy

};