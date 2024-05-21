import { JoinRoom, Room } from "../models/room.model.js";
import { Profile } from "../models/profile.model.js";
import { Message } from "../models/message.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import mongoose from "mongoose";

// this route is for backend use only.
const createPrivateRoom = asyncHandler(async (req, res, next) => {
  try {
    const { roomName, description, roomUsername } = req.body;

    const roomDPPath = req.file?.path;

    if (!roomDPPath) {
      return res
        .status(501)
        .json(new ApiError(501, "The file could not be uploaded on server"));
    }

    const roomDPUploaded = await uploadOnCloudinary(roomDPPath);

    if (!roomDPUploaded.url) {
      res
        .status(501)
        .json(
          new ApiError(501, "The file could not be uploaded on cloudinary")
        );
    }

    const roomDP = roomDPUploaded.url;

    const room = await Room.create({
      roomType: "College",
      roomName: roomName,
      roomDP: roomDP,
      description: description,
      roomUsername: roomUsername,
    });

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          room,
        },
        "Room Created Successfully"
      )
    );
  } catch (err) {
    return res.status(501).json(new ApiError(501, "Something went wrong"));
  }
});

// @POST /api/v1/rooms/create-public-room
const createPublicRoom = asyncHandler(async (req, res, next) => {
  const { roomName, description, tags } = req.body;

  try {
    const user = req.user;
    // checking if user already has a public room created

    const presentRoom = await Room.findOne({
      admin: user._id,
    });

    // console.log(presentRoom)

    if (presentRoom) {
      return res
        .status(400)
        .json(new ApiResponse(400, "You already have a public room created"));
    }

    // check if there is another room from same name
    const presentRoomName = await Room.findOne({
      roomName: roomName,
    });

    if (presentRoomName) {
      return res
        .status(400)
        .json(new ApiResponse(400, "Room with same name already exists"));
    }

    const roomDPPath = req.file?.path;

    if (!roomDPPath) {
      return res
        .status(501)
        .json(new ApiResponse(501, "The file could not be uploaded on server"));
    }

    const roomDPUploaded = await uploadOnCloudinary(roomDPPath);

    if (!roomDPUploaded.url) {
      res
        .status(501)
        .json(
          new ApiResponse(501, "The file could not be uploaded on cloudinary")
        );
    }

    const roomDP = roomDPUploaded.url;

    const profile = await Profile.findOne({
      user: user._id,
    });

    const room = await Room.create({
      roomType: "User",
      roomName: roomName,
      roomDP: roomDP,
      tags: tags,
      description: description,
      adminProfile: profile._id,
    });

    await JoinRoom.create({
      user: user._id,
      room: room._id,
    });

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          room,
        },
        "Room Created Successfully"
      )
    );
  } catch (err) {
    return res.status(501).json(new ApiError(501, err.message));
  }
});

const createAdminPublicRoom = asyncHandler(async (req, res, next) => {
  const { roomName, description, roomUsername, tags } = req.body;

  try {
    const user = req.user;
    // checking if user already has a public room created
    const roomDPPath = req.file?.path;

    if (!roomDPPath) {
      return res
        .status(501)
        .json(new ApiResponse(501, "The file could not be uploaded on server"));
    }

    const roomDPUploaded = await uploadOnCloudinary(roomDPPath);

    if (!roomDPUploaded.url) {
      res
        .status(501)
        .json(
          new ApiResponse(501, "The file could not be uploaded on cloudinary")
        );
    }

    const roomDP = roomDPUploaded.url;

    const profile = await Profile.findOne({
      user: user._id,
    });

    const room = await Room.create({
      roomType: "Admin",
      roomName: roomName,
      roomDP: roomDP,
      tags: tags,
      roomUsername: roomUsername,
      description: description,
      adminProfile: profile._id,
    });

    await JoinRoom.create({
      user: user._id,
      room: room._id,
    });

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          room,
        },
        "Room Created Successfully"
      )
    );
  } catch (err) {
    console.log(err);
    return res.status(501).json(new ApiError(501, err.message));
  }
});

const toggleJoinRoom = asyncHandler(async (req, res, next) => {
  try {
    const user = req.user;
    const { roomId } = req.params;

    const room = await Room.findById(roomId);

    if (!room) {
      return res.status(501).json(new ApiError(501, "Room not found"));
    }

    const isJoined = await JoinRoom.findOne({
      user: user._id,
      room: roomId,
    });

    if (isJoined) {
      await JoinRoom.deleteOne({
        user: user._id,
        room: roomId,
      });

      return res.status(200).json(
        new ApiResponse(
          200,
          {
            isJoined: false,
          },
          "Room Unfollowed Successfully"
        )
      );
    }

    await JoinRoom.create({
      user: user._id,
      room: roomId,
    });

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          isJoined: true,
        },
        "Room Followed Successfully"
      )
    );
  } catch (err) {
    return res.status(501).json(new ApiError(501, "Something went wrong"));
  }
});

const getPublicJoinedRooms = asyncHandler(async (req, res, next) => {
  try {
    // using aggregation pipelines and also count the number of participants in each room
    const rooms = await Room.aggregate([
      // Stage 1: Match rooms where the user participates
      {
        $lookup: {
          from: "joinrooms", // Join with the 'JoinRoom' collection
          localField: "_id", // Room's '_id'
          foreignField: "room", // 'room' field in JoinRoom
          as: "joinData", // Store result in 'joinData' array
        },
      },
      {
        $unwind: "$joinData", // Unwind to get individual join info
      },
      {
        $match: {
          "joinData.user": req.user._id,
        },
      },

      // Stage 2: Project necessary fields (Customize as needed)
      {
        $project: {
          roomType: 1,
          roomName: 1,
          description: 1,
          roomDP: 1,
          roomUsername: 1,
          adminProfile: 1, // Include admin since you want to populate
        },
      },

      // Stage 3: Populate the 'adminProfile' field
      {
        $lookup: {
          from: "profiles", // Join with 'users' collection
          localField: "adminProfile", // 'adminProfile' field in Room
          foreignField: "_id", // '_id' field in profiles
          as: "adminProfile", // Store result in 'adminProfile' array
        },
      },
      {
        $unwind: "$adminProfile", // Unwind to get single admin object
      },
      {
        $project: {
          roomType: 1,
          roomName: 1,
          description: 1,
          roomDP: 1,
          roomUsername: 1,
          "adminProfile._id": 1,
          "adminProfile.fName": 1,
          "adminProfile.lName": 1,
          "adminProfile.avatar": 1,
          "adminProfile.username": 1,
        },
      },
      {
        $lookup: {
          from: "joinrooms",
          localField: "_id",
          foreignField: "room",
          as: "joinData",
        },
      },
      {
        $addFields: {
          totalParticipants: {
            $size: "$joinData",
          },
        },
      },
      {
        $project: {
          joinData: 0,
        },
      },
    ]);

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          rooms,
        },
        "Public Rooms Fetched Successfully"
      )
    );
  } catch (error) {
    console.log(error);
    return res.status(501).json(new ApiError(501, "Something went wrong"));
  }
});

const getPrivateJoinedRoom = asyncHandler(async (req, res, next) => {
  try {
    const user = req.user;

    // get only sinlge private room for the user
    const room = await Room.findById(user.collegeRoom).select(
      "-createdAt -updatedAt -__v"
    );

    const totalParticipants = await JoinRoom.find({
      room: room._id,
    }).countDocuments();

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          room: {
            ...room._doc,
            totalParticipants: totalParticipants,
          },
        },
        "Private Room Fetched Successfully"
      )
    );
  } catch (error) {
    return res.status(501).json(new ApiError(501, "Something went wrong"));
  }
});

const getPublicRooms = asyncHandler(async (req, res, next) => {
  // need to send room with paginations
  try {
    const { page = 1, limit = 10, search = "" } = req.query;

    const options = {
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 10,
    };

    const rooms = await Room.aggregatePaginate(
      Room.aggregate([
        {
          $match: {
            $or: [
              {
                roomType: "User",
              },
              {
                roomType: "Admin",
              },
            ],
            roomName: {
              $regex: search,
              $options: "i",
            },
          },
        },
        {
          $lookup: {
            from: "joinrooms",
            localField: "_id",
            foreignField: "room",
            as: "joinData",
          },
        },
        {
          $addFields: {
            isCurrentUserFollowing: {
              $in: [
                new mongoose.Types.ObjectId(req.user._id),
                "$joinData.user",
              ],
            },
          },
        },
        {
          $match: {
            isCurrentUserFollowing: false,
          },
        },
        {
          $addFields: {
            totalParticipants: {
              $size: "$joinData",
            },
          },
        },

        {
          $project: {
            joinData: 0,
          },
        },
        {
          $lookup: {
            from: "profiles",
            localField: "adminProfile",
            foreignField: "_id",
            as: "adminProfile",
          },
        },
        {
          $unwind: "$adminProfile",
        },
        {
          $project: {
            roomType: 1,
            roomName: 1,
            description: 1,
            roomDP: 1,
            roomUsername: 1,
            "adminProfile._id": 1,
            "adminProfile.fName": 1,
            "adminProfile.lName": 1,
            "adminProfile.avatar": 1,
            "adminProfile.username": 1,
            totalParticipants: 1,
          },
        },
      ]),
      options
    );

    return res
      .status(200)
      .json(new ApiResponse(200, rooms, "Public Rooms Fetched Successfully"));
  } catch (err) {
    console.log(err);
    return res.status(501).json(new ApiError(501, "Something went wrong"));
  }
});

const getRoomDetails = asyncHandler(async (req, res, next) => {
  try {
    const { roomId } = req.params;

    if (!roomId) {
      return res.status(501).json(new ApiError(501, "Room Id is required"));
    }

    const room = await Room.findById(roomId).select(
      "-__v -updatedAt -createdAt -adminProfile"
    );

    if (!room) {
      return res.status(501).json(new ApiError(501, "Room not found"));
    }
    return res
      .status(200)
      .json(new ApiResponse(200, room, "Room fetched Successfully"));
  } catch (err) {
    console.log(err);
    return res.status(501).json(new ApiError(501, "Something went wrong"));
  }
});

const getAllCollegeRooms = asyncHandler(async (req, res, next) => {
  const { page = "1", limit = "10", search = "" } = req.query;

  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
  };

  try {
    const rooms = await Room.aggregatePaginate(
      Room.aggregate([
        {
          $match: {
            roomType: "College",
            $or: [
              {
                roomName: {
                  $regex: search,
                  $options: "i",
                },
                roomUsername: {
                  $regex: search,
                  $options: "i",
                },
              },
            ],
          },
        },
        {
          $lookup: {
            from: "joinrooms",
            localField: "_id",
            foreignField: "room",
            as: "joinData",
          },
        },
        {
          $addFields: {
            totalParticipants: {
              $size: "$joinData",
            },
          },
        },
        {
          $project: {
            joinData: 0,
            createdAt: 0,
            updatedAt: 0,
            __v: 0,
          },
        },
      ]),
      options
    );

    return res
      .status(200)
      .json(new ApiResponse(200, rooms, "College Rooms Fetched Successfully"));
  } catch (err) {
    return res.status(501).json(new ApiError(501, err));
  }
});

const getRecentlyAddedRooms = asyncHandler(async (req, res, next) => {
  // only send 4 most recently added rooms
  try {
    let rooms = await Room.aggregate([
      {
        $match: {
          $or: [{ roomType: "Admin" }, { roomType: "User" }],
        },
      },
      {
        $sort: {
          createdAt: -1,
        },
      },
      {
        $lookup: {
          from: "joinrooms",
          localField: "_id",
          foreignField: "room",
          as: "joinData",
        },
      },
      {
        // filter only those rooms whose user is not participant
        $addFields: {
          isCurrentUserFollowing: {
            $in: [new mongoose.Types.ObjectId(req.user._id), "$joinData.user"],
          },
        },
      },
      {
        $match: {
          isCurrentUserFollowing: false,
        },
      },
      {
        $limit: 4,
      },
      {
        $addFields: {
          totalParticipants: {
            $size: "$joinData",
          },
        },
      },
      {
        $lookup: {
          from: "profiles",
          localField: "adminProfile",
          foreignField: "_id",
          as: "adminProfile",
        },
      },
      {
        $unwind: "$adminProfile",
      },
      {
        $project: {
          roomType: 1,
          roomName: 1,
          description: 1,
          roomDP: 1,
          roomUsername: 1,
          "adminProfile._id": 1,
          "adminProfile.fName": 1,
          "adminProfile.lName": 1,
          "adminProfile.avatar": 1,
          "adminProfile.username": 1,
          totalParticipants: 1,
        },
      },
    ]);

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          rooms,
        },
        "Recently Added Rooms Fetched Successfully"
      )
    );
  } catch (err) {
    return res
      .status(501)
      .json(
        new ApiError(
          501,
          "Something went wrong while fetching recently added rooms"
        )
      );
  }
});

const getTrendingRooms = asyncHandler(async (req, res, next) => {
  try {
    // getting recent 4 rooms with maximum participants of User and Admin

    let rooms = await Room.aggregate([
      {
        $match: {
          $or: [{ roomType: "Admin" }, { roomType: "User" }],
        },
      },
      {
        $lookup: {
          from: "joinrooms",
          localField: "_id",
          foreignField: "room",
          as: "joinData",
        },
      },
      {
        // filter only those rooms whose user is not participant
        $addFields: {
          isCurrentUserFollowing: {
            $in: [new mongoose.Types.ObjectId(req.user._id), "$joinData.user"],
          },
        },
      },
      {
        $match: {
          isCurrentUserFollowing: false,
        },
      },
      {
        $addFields: {
          totalParticipants: {
            $size: "$joinData",
          },
        },
      },
      {
        $sort: {
          totalParticipants: -1,
        },
      },
      {
        $limit: 4,
      },
      {
        $lookup: {
          from: "profiles",
          localField: "adminProfile",
          foreignField: "_id",
          as: "adminProfile",
        },
      },
      {
        $unwind: "$adminProfile",
      },
      {
        $project: {
          roomType: 1,
          roomName: 1,
          description: 1,
          roomDP: 1,
          roomUsername: 1,
          "adminProfile._id": 1,
          "adminProfile.fName": 1,
          "adminProfile.lName": 1,
          "adminProfile.avatar": 1,
          "adminProfile.username": 1,
          totalParticipants: 1,
        },
      },
    ]);

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          rooms,
        },
        "Trending Rooms Fetched Successfully"
      )
    );
  } catch (err) {
    return res
      .status(501)
      .json(new ApiError(501, "Something went wrong while fetching rooms"));
  }
});

const getRoomProfileDetails = asyncHandler(async (req, res, next) => {
  try {
    const { roomId } = req.params;

    if (!roomId) {
      return res.status(501).json(new ApiError(501, "Room Id is required"));
    }

    const room = await Room.findById(roomId).select(
      "-__v -updatedAt -createdAt"
    );

    if (!room) {
      return res.status(501).json(new ApiError(501, "Room not found"));
    }

    const totalParticipants = await JoinRoom.find({
      room: room._id,
    }).countDocuments();

    const totalMessages = await Message.find({
      room: room._id,
    }).countDocuments();

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          ...room._doc,
          totalParticipants: totalParticipants,
          totalMessages: totalMessages,
          activityScore:
            totalMessages / (totalParticipants === 0 ? 1 : totalParticipants),
        },
        "Room Profile Fetched Successfully"
      )
    );
  } catch (err) {
    return res.status(501).json(new ApiError(501, "Something went wrong"));
  }
});

export {
  createPrivateRoom,
  createPublicRoom,
  toggleJoinRoom,
  getPublicJoinedRooms,
  getPublicRooms,
  getAllCollegeRooms,
  getPrivateJoinedRoom,
  createAdminPublicRoom,
  getRecentlyAddedRooms,
  getTrendingRooms,
  getRoomDetails,
  getRoomProfileDetails,
};

// public jo user rooms
// private jo college rooms