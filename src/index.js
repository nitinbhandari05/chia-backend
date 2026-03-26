import dotenv from "dotenv";
import connectDB from "./db/index.js";
import app from "./app.js";

dotenv.config({
    path: './.env'
});

connectDB()
.then(() => {
    app.listen(process.env.PORT || 8000, () => {
        console.log(`Server is running at port: ${process.env.PORT || 8000}`);
    });
})
.catch((err) => {
    console.log("Server startup failed:", err);
});





















/*
import express from "express";
(async () => {
    try {
        await mongoose.connect('${process.env.MONGO_URI}/${DB_NAME}')
        app.on("error", (error) => {
            console.error("Error connecting to MongoDB:", error);
        });

        app.listen(process.env.PORT,()=>{
            console.log("app is listening on PORT $ {process.env.PORT}")
        })

    } catch (error) {
        console.error("Error connecting to MongoDB:", error);
    }
})()*/