import { Profile } from "../models/profile.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Follow } from "../models/follow.model.js";
import { User } from "../models/user.model.js";
import { Message } from "../models/message.model.js";
import { generateStats } from "../utils/Profile.utils.js";

const getAllUserProfiles = asyncHandler(async (req, res, next) => {
  // get paginated user profiles

  try {
    let { page = 1, limit = 10, search = "" } = req.query;

    page = parseInt(page, 10);
    limit = parseInt(limit, 10);

    const user = req.user;

    const options = {
      page,
      limit,
    };

    const profiles = await Profile.aggregatePaginate(
      Profile.aggregate([
        {
          $match: {
            $or: [
              { fName: { $regex: search, $options: "i" } },
              { lName: { $regex: search, $options: "i" } },
              { username: { $regex: search, $options: "i" } },
            ],
            user: { $ne: req.user._id },
          },
        },
        {
          $lookup: {
            from: "follows",
            let: { userId: "$user" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$follower", user._id] },
                      { $eq: ["$following", "$$userId"] },
                    ],
                  },
                },
              },
            ],
            as: "following",
          },
        },

        // count followers
        {
          $lookup: {
            from: "follows",
            localField: "user",
            foreignField: "following",
            as: "followers",
          },
        },
        {
          $addFields: {
            followers: { $size: "$followers" },
          },
        },

        {
          $addFields: {
            isFollowing: {
              $cond: {
                if: { $eq: [{ $size: "$following" }, 0] },
                then: false,
                else: true,
              },
            },
          },
        },
        {
          $project: {
            fName: 1,
            lName: 1,
            username: 1,
            avatar: 1,
            bio: 1,
            user: 1,
            followers: 1,
            isFollowing: 1,
          },
        },
      ]),
      options
    );

    return res
      .status(200)
      .json(new ApiResponse(200, profiles, "Users fetched successfully"));
  } catch (err) {
    console.log(err);
    return res.status(500).json(new ApiError(500, "Users cannot be Fetched"));
  }
});

const getProfile = asyncHandler(async (req, res, next) => {
  try {
    const { username } = req.params;

    let profile = await Profile.findOne({ username: username }).select(
      "-__v -createdAt -updatedAt"
    );

    if (!profile) {
      return res.status(404).json(new ApiError(404, "Profile not found"));
    }

    profile = profile.toObject();

    let follow = await Follow.findOne({
      follower: req.user._id,
      following: profile.user,
    });

    let isFollowing = false;
    if (follow) {
      isFollowing = true;
    }

    let followers = await Follow.find({
      following: profile.user,
    }).countDocuments();

    let following = await Follow.find({
      follower: profile.user,
    }).countDocuments();

    let messages = await Message.find({
      profile: profile._id,
    }).countDocuments();

    const { seekerScore, interactiveScore, position } = generateStats(
      followers,
      messages,
      messages
    );
    let collegeName = await User.findOne({
      _id: profile.user,
    }).select("collegeName -_id");

    collegeName = collegeName.collegeName;

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          ...profile,
          isFollowing,
          followers,
          following,
          seekerScore,
          interactiveScore,
          position,
          collegeName,
        },
        "Profile fetched successfully"
      )
    );
  } catch (err) {
    console.log(err);
    return res.status(500).json(new ApiError(500, "Profile cannot be Fetched"));
  }
});

export { getAllUserProfiles, getProfile };
