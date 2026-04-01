import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from '../utils/ApiResponse.js';
import jwt from 'jsonwebtoken';


// ✅ TOKEN GENERATION
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


// ✅ REGISTER
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
    const incommingrefreshAccessToken = req.cookies
        .refreshToken || req.body.refreshToken

    if (!incommingrefreshAccessToken) {

        throw new ApiError(401, "unauthozied request")

    }

try {
        const decodedToken = jwt.verify(
            incommingrefreshAccessToken,
            process.env.REFRESH_TOKEN_SECRET
        )
    
        const user = User.findById(decodedToken?._id)
    
          if (!user) {
    
            throw new ApiError(401, "Invalid refresh token")
    
        }
    
        if(incommingrefreshAccessToken == user?.refreshToken){
            throw new ApiError(401, "refresh token in expired ")
        }
    
        const options ={
            httpOnly:true,
            secure:true
        }
    
        const {accessToken ,newRefreshToken} =await generateAccessTokenAndRefreshToken(user._id)
    
        return res
        .status(200)
        .cookies("accessToken",accessToken,options)
        .cookies("refreshToken",newRefreshToken,options)
        .json(
            new ApiResponse(
                200,
                {accessToken,refreshToken : newRefreshToken},
                "Access Token refreshed"
            )
        )
    
} catch (error) {

    throw new ApiError(401,error?.message ||"Invalid refresh token")
    
}
})



export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken
};