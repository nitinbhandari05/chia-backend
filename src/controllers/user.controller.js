import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from '../utils/ApiResponse.js';

const generateAccessTokenAndRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        user.save({ validateBeforeSave: false })

        return { refreshToken, accessToken }


    } catch {
        throw new ApiError(500, "Something went wrong while generation tokens")
    }
}

const registerUser = asyncHandler(async (req, res) => {
    // get user from forntend
    // validation - not null 
    // check if user alredy exists : username and email
    // check for images , check for avatar 
    // upload them to cloudinary , avatar 
    // create user object - create entry in db 
    // remove password and refreshtoken field
    // check for cration 
    // return res

    const { fullname, username, email, password } = req.body
    console.log("email:", email);
    console.log("FILES:", req.files);

    if (
        [fullname, email, username, password].some((field) =>
            field?.trim() == "")
    ) {
        throw new ApiError(400, " All fields are req ")
    }

    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (existedUser) {
        throw new ApiError(409, " User with email or username alredy exists")
    }

    const avatarLocalPath = req.files?.avatar?.[0]?.path;
    const coverImageLocalPath = req.files?.coverImage?.[0]?.path;

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if (!avatar) {
        throw new ApiError(400, "Avatar file is required");

    }
    const user = await User.create({
        username,
        email,
        fullname,
        password,
        avatar: avatar?.url || "",
        coverImage: coverImage?.url || ""
    });

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )
    if (!createdUser) {
        throw new ApiError(500, "something went wrong while registering the user")
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered successfully")
    )

})

const loginUser = asyncHandler(async (req, res) => {
    // get data from req body
    // username or email base access
    // find the user 
    // password check 
    //access and refresh token 
    //sned cookie 
    // login done 

    const { email, username, password } = req.body

    if (!username || !email) {
        throw new ApiError(400, "username or email is required ")
    }

    const user = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (!user) {
        throw new ApiError(404, "user does not exist")
    }

    const isPasswordValid = await user.isPasswordCorrect(password)

    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid user credential")
    }

    const { accessToken, refreshToken } = await generateAccessTokenAndRefreshToken(user._id)

    const loggedInUser = await User.findById(user._id)
        .select("-password -refreshToken")

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    user: loggedInUser, accessToken, refreshToken
                },
                "user logged In Successfully"
            )
        )

})

const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id, {
        $set: {
            refreshToken: undefined
        }
    },
        {
            new: true
        }
    
)

  const options = {
        httpOnly: true,
        secure: true
    }

    return res.status(200)
    .clearCookie("accessToken")
    .clearCookie("refreshToken")
    .json(new ApiResponse(200,{},"User logged Out"))


})

export {
    registerUser,
    loginUser,
    logoutUser

} 