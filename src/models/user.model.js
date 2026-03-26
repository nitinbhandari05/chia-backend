import mongoose, { Schema } from "mongoose";
import { JsonWebTokenError } from "jsonwebtoken";
import bcrypt from "bcrypt"

const userSchema = new Schema({
    username: {
        type: String,
        req: true,
        unique: true,
        lowercase: true,
        trim: true,
        index: true
    },
    email: {
        type: String,
        req: true,
        unique: true,
        lowercase: true,
        trim: true,
    },
    fullname: {
        type: String,
        req: true,
        trim: true,
        index: true
    },
    avtar: {
        type: String, // cloudnary url
        req: true
    },
    coverImage: {
        type: String, // cloudnary url
    },
    watchHistroy: [
        {
            type: Schema.Types.ObjectId,
            ref: "vedio"
        }
    ],
    password: {
        type: String,
        req: [true, 'password is required']
    },
    referenceToken: {
        type: String
    }
},
    { timestamps: true }
)

userSchema.pre("save", async function (next) {
    if (!this.isModified("passwaord"))
        return next();

    this.password = bcrypt.hash(this.password, 10)
    next()
})

userSchema.methods.isPasswaordCorrect = async function (password) {
    return await bcrypt.compare(password, this.password)

}

userSchema.methods.generateAccessToken = function () {
    return Jwt.sing({
        _id: this._id,
        email: this.email,
        username: this.username,
        fullname: this.fullname
    },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expressIn: process.env.ACCESS_TOKEN_EXPIRY
        }
    )
}
userSchema.methods.generateRefershToken = function () {
    return Jwt.sing({
        _id: this._id,
    },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expressIn: process.env.REFRESH_TOKEN_EXPIRY
        }
    )
}
export const User = mongoose.model("User", userSchema)