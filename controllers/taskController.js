import Task from "../models/task.js";
import User from "../models/user.js";
import { createNotification } from "./notificationHelper.js";

// taskController.js



// export const createTask = async (req, res) => {
//     try {
//         console.log("createTask called at", new Date().toISOString());
//         console.log("req.body:", JSON.stringify(req.body, null, 2));
//         console.log("req.files:", JSON.stringify(req.files, null, 2));
//         console.log("req.body.estimatedTime:", req.body.estimatedTime);
//         console.log("Type of req.body.estimatedTime:", typeof req.body.estimatedTime);

//         const {
//             serviceId,
//             serviceTitle,
//             taskTitle,
//             taskDescription,
//             estimatedTime,
//             location,
//             schedule,
//             additionalInfo,
//             price,
//             offerDeadline,
//             client,
//         } = req.body;

//         if (!estimatedTime || estimatedTime.trim() === "" || estimatedTime === "undefined") {
//             console.log("Validation failed: estimatedTime is", estimatedTime);
//             return res.status(400).json({
//                 error: "Bad Request",
//                 message: "estimatedTime is required and cannot be empty or undefined",
//             });
//         }

//         console.log("Creating Task with estimatedTime:", estimatedTime);
//         console.log("Type of estimatedTime (destructured):", typeof estimatedTime);

//         const photos = Array.isArray(req.files?.photos)
//             ? req.files.photos.map((file) => file.path)
//             : [];
//         const video = Array.isArray(req.files?.video) && req.files.video.length > 0
//             ? req.files.video[0].path
//             : null;

//         const newTask = new Task({
//             serviceId,
//             serviceTitle,
//             taskTitle,
//             taskDescription,
//             estimatedTime: String(estimatedTime), // Ensure string
//             location,
//             schedule,
//             extraCharge: schedule === "Urgent",
//             additionalInfo,
//             offerDeadline,
//             photos,
//             price,
//             video,
//             client: req.user.id,
//         });

//         console.log("Task object before save:", JSON.stringify(newTask, null, 2));

//         await newTask.save();
//         console.log("Saved task:", JSON.stringify(newTask, null, 2));
//         const dbTask = await Task.findById(newTask._id);
//         console.log("Database task:", JSON.stringify(dbTask, null, 2));

//         res.status(201).json({ message: "Task created successfully", task: newTask });
//     } catch (error) {
//         console.error("❌ Error creating task:", error);
//         if (error.name === "ValidationError") {
//             return res.status(400).json({
//                 error: "Validation Error",
//                 message: "Invalid data provided",
//                 details: error.errors,
//             });
//         }
//         res.status(500).json({
//             error: "Internal server error",
//             message: "Something went wrong",
//             details: error.message,
//         });
//     }
// };
export const createTask = async (req, res) => {
    try {
        console.log("createTask called at", new Date().toISOString());
        console.log("req.body:", JSON.stringify(req.body, null, 2));
        console.log("req.files:", JSON.stringify(req.files, null, 2));
        console.log("req.body.estimatedTime:", req.body.estimatedTime);
        console.log("Type of req.body.estimatedTime:", typeof req.body.estimatedTime);

        const {
            serviceId,
            serviceTitle,
            taskTitle,
            taskDescription,
            estimatedTime,
            location,
            schedule,
            additionalInfo,
            price,
            offerDeadline,
            client,
        } = req.body;

        if (!estimatedTime || estimatedTime.trim() === "" || estimatedTime === "undefined") {
            console.log("Validation failed: estimatedTime is", estimatedTime);
            return res.status(400).json({
                error: "Bad Request",
                message: "estimatedTime is required and cannot be empty or undefined",
            });
        }

        console.log("Creating Task with estimatedTime:", estimatedTime);
        console.log("Type of estimatedTime (destructured):", typeof estimatedTime);

        const photos = Array.isArray(req.files?.photos)
            ? req.files.photos.map((file) => file.path)
            : [];
        const video = Array.isArray(req.files?.video) && req.files.video.length > 0
            ? req.files.video[0].path
            : null;

        const newTask = new Task({
            serviceId,
            serviceTitle,
            taskTitle,
            taskDescription,
            estimatedTime: String(estimatedTime), // Ensure string
            location,
            schedule,
            extraCharge: schedule === "Urgent",
            additionalInfo,
            offerDeadline,
            photos,
            price,
            video,
            client: req.user.id,
        });

        console.log("Task object before save:", JSON.stringify(newTask, null, 2));

        await newTask.save();
        console.log("Saved task:", JSON.stringify(newTask, null, 2));
        const dbTask = await Task.findById(newTask._id);
        console.log("Database task:", JSON.stringify(dbTask, null, 2));

        // Create notification for the client (task poster) - non-blocking
        try {
            await createNotification(
                req.user.id, // Client ID
                "Task Created Successfully",
                `Your task "${newTask.taskTitle}" is now live and waiting for tasker bids.`,
                "task-posted",
                newTask._id // Link to task
            );
            console.log("Notification created for new task"); // Debug
        } catch (notifErr) {
            console.error("Failed to create notification (non-blocking):", notifErr); // Log but don't crash
        }

        res.status(201).json({ message: "Task created successfully", task: newTask });
    } catch (error) {
        console.error("❌ Error creating task:", error);
        if (error.name === "ValidationError") {
            return res.status(400).json({
                error: "Validation Error",
                message: "Invalid data provided",
                details: error.errors,
            });
        }
        res.status(500).json({
            error: "Internal server error",
            message: "Something went wrong",
            details: error.message,
        });
    }
};
// export const addTaskReview = async (req, res) => {


//     try {
//         const { taskId, rating, message } = req.body;
//         const clientId = req.user._id;

//         console.log('Client ID:', clientId, 'Task ID:', taskId); // Debug: Log IDs

//         // Validate input
//         if (!taskId || !rating || !message) {
//             return res.status(400).json({ message: "Task ID, rating, and message are required" });
//         }

//         if (rating < 0 || rating > 5) {
//             return res.status(400).json({ message: "Rating must be between 0 and 5" });
//         }

//         // Find the task
//         const task = await Task.findById(taskId);
//         if (!task) {
//             return res.status(404).json({ message: "Task not found" });
//         }

//         console.log('Task Client ID:', task.client.toString()); // Debug: Log task client ID

//         // Check if the task is completed and the client is authorized
//         if (task.status !== "completed") {
//             return res.status(400).json({ message: "Reviews can only be added for completed tasks" });
//         }
//         if (task.client.toString() !== clientId.toString()) {
//             return res.status(403).json({ message: "You are not authorized to review this task" });
//         }

//         // Find the tasker
//         const tasker = await User.findById(task.acceptedBy);
//         if (!tasker || tasker.role !== "tasker") {
//             return res.status(404).json({ message: "Tasker not found" });
//         }

//         // Check if a review already exists for this task in tasker's reviews
//         const existingReview = tasker.reviews.find(
//             (review) => review.taskId === taskId
//         );
//         if (existingReview) {
//             return res.status(400).json({ message: "A review has already been submitted for this task" });
//         }

//         // Add the review to the tasker's reviews array
//         tasker.reviews.push({
//             reviewer: clientId,
//             rating,
//             message,
//             taskId, // Link review to task
//             createdAt: new Date(),
//         });

//         // Update tasker's rating and review count
//         const totalReviews = tasker.reviews.length;
//         const averageRating =
//             tasker.reviews.reduce((sum, rev) => sum + rev.rating, 0) / totalReviews;

//         tasker.rating = parseFloat(averageRating.toFixed(2));
//         tasker.reviewCount = totalReviews;

//         await tasker.save();

//         res.status(201).json({
//             message: "Review added successfully",
//             review: { reviewer: clientId, rating, message, createdAt: new Date() },
//         });
//     } catch (error) {
//         console.error("Error adding task review:", error);
//         res.status(500).json({ message: "Server error" });
//     }
// };

export const addTaskReview = async (req, res) => {
    try {
        const { taskId, rating, message } = req.body;
        const clientId = req.user._id;

        console.log('Client ID:', clientId, 'Task ID:', taskId); // Debug: Log IDs

        // Validate input
        if (!taskId || !rating || !message) {
            return res.status(400).json({ message: "Task ID, rating, and message are required" });
        }

        if (rating < 0 || rating > 5) {
            return res.status(400).json({ message: "Rating must be between 0 and 5" });
        }

        // Find the task
        const task = await Task.findById(taskId);
        if (!task) {
            return res.status(404).json({ message: "Task not found" });
        }

        console.log('Task Client ID:', task.client.toString()); // Debug: Log task client ID

        // Check if the task is completed and the client is authorized
        if (task.status !== "completed") {
            return res.status(400).json({ message: "Reviews can only be added for completed tasks" });
        }
        if (task.client.toString() !== clientId.toString()) {
            return res.status(403).json({ message: "You are not authorized to review this task" });
        }

        // Find the tasker
        const tasker = await User.findById(task.acceptedBy);
        if (!tasker || tasker.role !== "tasker") {
            return res.status(404).json({ message: "Tasker not found" });
        }

        // Check if a review already exists for this task in tasker's reviews
        const existingReview = tasker.reviews.find(
            (review) => review.taskId === taskId
        );
        if (existingReview) {
            return res.status(400).json({ message: "A review has already been submitted for this task" });
        }

        // Add the review to the tasker's reviews array
        tasker.reviews.push({
            reviewer: clientId,
            rating,
            message,
            taskId, // Link review to task
            createdAt: new Date(),
        });

        // Update tasker's rating and review count
        const totalReviews = tasker.reviews.length;
        const averageRating =
            tasker.reviews.reduce((sum, rev) => sum + rev.rating, 0) / totalReviews;

        tasker.rating = parseFloat(averageRating.toFixed(2));
        tasker.reviewCount = totalReviews;

        await tasker.save();

        // Create notification for the tasker (new review) - non-blocking
        try {
            const client = await User.findById(clientId); // Fetch client name
            await createNotification(
                tasker._id, // Tasker ID
                "New Review Received",
                `You received a ${rating}-star review from ${client.firstName} ${client.lastName} for task "${task.taskTitle}". "${message}"`,
                "review",
                taskId // Link to task
            );
            console.log("Notification created for new review"); // Debug
        } catch (notifErr) {
            console.error("Failed to create notification (non-blocking):", notifErr); // Log but don't crash
        }

        res.status(201).json({
            message: "Review added successfully",
            review: { reviewer: clientId, rating, message, createdAt: new Date() },
        });
    } catch (error) {
        console.error("Error adding task review:", error);
        res.status(500).json({ message: "Server error" });
            }
        };




// Enhanced getAllTasks controller with pagination and search
export const getAllTasks = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            search = '',
            status = '',
            priority = '',
            category = '',
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        // Convert page and limit to numbers
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        // Build search query
        let searchQuery = {};

        // Text search across multiple fields
        if (search) {
            searchQuery.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { type: { $regex: search, $options: 'i' } },
                { category: { $regex: search, $options: 'i' } }
            ];
        }

        // Filter by status
        if (status) {
            searchQuery.status = status;
        }

        // Filter by priority  
        if (priority) {
            searchQuery.priority = priority;
        }

        // Filter by category
        if (category) {
            searchQuery.category = category;
        }

        // Build sort object
        const sortObj = {};
        sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;

        // Execute queries
        const [tasks, totalTasks] = await Promise.all([
            Task.find(searchQuery)
                .populate("client", "fullName email")
                .sort(sortObj)
                .skip(skip)
                .limit(limitNum),
            Task.countDocuments(searchQuery)
        ]);

        // Calculate pagination info
        const totalPages = Math.ceil(totalTasks / limitNum);
        const hasNextPage = pageNum < totalPages;
        const hasPrevPage = pageNum > 1;

        res.status(200).json({
            tasks,
            pagination: {
                currentPage: pageNum,
                totalPages,
                totalTasks,
                hasNextPage,
                hasPrevPage,
                limit: limitNum
            }
        });
    } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).json({ error: "Failed to fetch tasks" });
    }
};


// Get filter options (for dropdowns)
export const getTaskFilters = async (req, res) => {
    try {
        const [statuses, priorities, categories] = await Promise.all([
            Task.distinct('status'),
            Task.distinct('priority'),
            Task.distinct('category')
        ]);

        res.status(200).json({
            statuses,
            priorities,
            categories
        });
    } catch (error) {
        console.error('Error fetching filter options:', error);
        res.status(500).json({ error: "Failed to fetch filter options" });
    }
};

export const getCompletedAndInProgressTasks = async (req, res) => {
    try {
        // Query for tasks with status "in progress" or "completed"
        const tasks = await Task.find({
            status: { $in: ['in progress', 'completed'] }
        })
            .populate("client", "fullName email")
            .limit(8)
            .sort({ createdAt: -1 }); // Optional: sort by newest first

        res.status(200).json({
            tasks
        });
    } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).json({ error: "Failed to fetch tasks" });
    }
};


// ✅ 3. Get Task by ID (with bid privacy logic)
export const getTaskById = async (req, res) => {
    try {
        const task = await Task.findById(req.params.id)
            .populate("client", "firstName lastName email")
            .populate("acceptedBy", "firstName lastName email profilePicture phone")
            .populate("bids.taskerId", "firstName lastName email profilePicture phone")
            .populate("comments.userId", "firstName lastName email profilePicture phone")
            .populate("comments.replies.userId", "firstName lastName email");

        if (!task) return res.status(404).json({ error: "Task not found" });

        const userId = req.user?.id;

        // 🛡️ Privacy for bids
        let filteredBids = [];
        // Convert ObjectId to string safely
        const clientIdStr = task.client?._id?.toString();

        if (clientIdStr === userId) {
            filteredBids = task.bids;
        } else {
            filteredBids = task.bids.filter(
                (bid) => bid.taskerId?._id.toString() === userId
            );
        }

        res.status(200).json({
            ...task.toObject(),
            bids: filteredBids,
        });

    } catch (error) {
        res.status(500).json({
            error: "Failed to fetch task",
            details: error.message,
        });
    }
};


export const getTasksByTaskerIdAndStatus = async (req, res) => {
    try {
        const { id } = req.params; // Tasker ID from route param
        const { status } = req.query; // Status from query param (e.g., ?status=completed)

        // Build the query object - filter by acceptedBy (tasker who accepted the task)
        const query = { acceptedBy: id };

        if (status) {
            query.status = status; // Filter by status if provided
        }

        // Fetch tasks from the database
        const tasks = await Task.find(query)
            .populate('client', 'firstName lastName email'); // Populate client details

        res.status(200).json(tasks);
    } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).json({
            message: 'Server error while fetching tasks',
            error: error.message
        });
    }
};


// ✅ 4. Get Tasks by User (Client)
export const getTasksByClient = async (req, res) => {
    try {
        console.log(req.user.id)
        const clientId = req.user.id;
        console.log(clientId)
        const tasks = await Task.find({ client: clientId })
            .populate("client", "fullName email")
            .sort({ createdAt: -1 });
        res.status(200).json(tasks);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch user's tasks" });
    }
};

// ✅ 5. Get Urgent Tasks (Optionally by Status)
export const getUrgentTasksByStatus = async (req, res) => {
    try {
        const { status } = req.query;

        const query = { schedule: "Urgent" };
        if (status) {
            query.status = status;
        }

        const urgentTasks = await Task.find(query)
            .populate("client", "firstName lastName email")
            .populate("comments.userId", "firstName lastName email profilePicture")
            .populate("comments.replies.userId", "firstName lastName email profilePicture")
            .sort({ createdAt: -1 });

        res.status(200).json(urgentTasks);
    } catch (error) {
        console.error("❌ Failed to fetch urgent tasks:", error);
        res.status(500).json({ error: "Failed to fetch urgent tasks" });
    }
};


export const getScheduledTasksByStatus = async (req, res) => {
    try {
        const query = {
            schedule: "Schedule",
            status: "pending" 
        };

        const scheduleTasks = await Task.find(query)
            .populate("client", "firstName lastName email")
            .populate("comments.userId", "firstName lastName email profilePicture")
            .populate("comments.replies.userId", "firstName lastName email profilePicture")
            .sort({ createdAt: -1 });

        res.status(200).json(scheduleTasks);
    } catch (error) {
        console.error("❌ Failed to fetch pending tasks:", error);
        res.status(500).json({ error: "Failed to fetch pending tasks" });
    }
};

export const getFlexibleTasksByStatus = async (req, res) => {
    try {
        const query = {
            schedule: "Flexible",
            status: "pending"
        };

        const scheduleTasks = await Task.find(query)
            .populate("client", "firstName lastName email")
            .populate("comments.userId", "firstName lastName email profilePicture")
            .populate("comments.replies.userId", "firstName lastName email profilePicture")
            .sort({ createdAt: -1 });

        res.status(200).json(scheduleTasks);
    } catch (error) {
        console.error("❌ Failed to fetch pending tasks:", error);
        res.status(500).json({ error: "Failed to fetch pending tasks" });
    }
};


// ✅ Get Tasks by Status (Flexible for all statuses)
export const getTasksByStatus = async (req, res) => {
    try {
        const { status } = req.query;
        const query = {};

        if (status) {
            query.status = status.toLowerCase();
        }

        const tasks = await Task.find(query)
            .populate("client", "firstName lastName email")
            .populate("acceptedBy", "firstName lastName email")
            .sort({ createdAt: -1 });

        res.status(200).json(tasks);
    } catch (error) {
        console.error("❌ Failed to fetch tasks by status:", error);
        res.status(500).json({ error: "Failed to fetch tasks", details: error.message });
    }
};

// ✅ Get Tasks excluding a Status
// export const getTasksExcludingStatus = async (req, res) => {
//     try {
//         const { excludeStatus } = req.query;
//         const query = {};

//         if (excludeStatus) {
//             query.status = { $ne: excludeStatus.toLowerCase() };
//         }

//         const tasks = await Task.find(query)
//             .populate("client", "fullName email")
//             .sort({ createdAt: -1 });
//         res.status(200).json(tasks);
//     } catch (error) {
//         console.error("❌ Failed to fetch filtered tasks:", error);
//         res.status(500).json({ error: "Failed to fetch tasks", details: error.message });
//     }
// };

export const getTasksExcludingStatus = async (req, res) => {
    try {
        const query = {
            status: "pending",
            schedule: "Schedule"
        };

        const tasks = await Task.find(query)
            .populate("client", "firstName lastName email")
            .sort({ createdAt: -1 });
        res.status(200).json(tasks);
    } catch (error) {
        console.error("❌ Failed to fetch filtered tasks:", error);
        res.status(500).json({ error: "Failed to fetch tasks", details: error.message });
    }
};

export const getScheduledPendingTasks = async (req, res) => {
    try {
        const tasks = await Task.find({
            schedule: "Schedule",    // Only tasks with schedule 'Schedule'
            status: "pending"        // Only tasks with status 'pending'
        })
            .populate("client", "firstName lastName email")
            .sort({ createdAt: -1 });

        res.status(200).json(tasks);
    } catch (error) {
        console.error("❌ Failed to fetch scheduled pending tasks:", error);
        res.status(500).json({ error: "Failed to fetch tasks", details: error.message });
    }
};


// ✅ 6. Add Bid to Task
// export const addBidToTask = async (req, res) => {
//     try {
//         const { id: taskId } = req.params;
//         const { offerPrice, message } = req.body;

//         const newBid = {
//             taskerId: req.user.id,
//             offerPrice,
//             message,
//             createdAt: new Date(),
//         };

//         const updatedTask = await Task.findByIdAndUpdate(
//             taskId,
//             { $push: { bids: newBid } },
//             { new: true }
//         );

//         if (!updatedTask) {
//             return res.status(404).json({ error: "Task not found" });
//         }

//         res.status(200).json({ message: "Bid added successfully", task: updatedTask });
//     } catch (error) {
//         res.status(500).json({ error: "Failed to add bid", details: error.message });
//     }
// };

// export const addCommentToTask = async (req, res) => {
//     try {
//         const taskId = req.params.id;
//         const userId = req.user._id;
//         const { message } = req.body;

//         if (!message || message.trim() === "") {
//             return res.status(400).json({ error: "Comment message cannot be empty" });
//         }

//         const userRole = req.user.role;

//         if (!["tasker", "client"].includes(userRole)) {
//             return res.status(400).json({ error: "Invalid user role" });
//         }

//         // Fetch the user details from DB
//         const user = await User.findById(userId).select("fullName email profilePicture");
//         if (!user) {
//             return res.status(404).json({ error: "User not found" });
//         }

//         // Store snapshot of user details along with comment
//         const newComment = {
//             userId: userId,
//             role: userRole,
//             fullName: user.fullName,
//             email: user.email,
//             profilePicture: user.profilePicture || null,
//             message: message.trim(),
//             createdAt: new Date(),
//             replies: [],
//         };

//         // Update the task by pushing the new comment to the comments array
//         const updatedTask = await Task.findByIdAndUpdate(
//             taskId,
//             { $push: { comments: newComment } },
//             { new: true, runValidators: false } // Skip full document validation
//         );

//         if (!updatedTask) {
//             return res.status(404).json({ error: "Task not found" });
//         }

//         res.status(201).json({
//             message: "Comment added successfully",
//             task: updatedTask,
//         });
//     } catch (error) {
//         console.error("Error adding comment:", error);
//         res.status(500).json({ error: "Failed to add comment", details: error.message });
//     }
// };

// // ✅ 7. Accept Task
// export const acceptTaskByTasker = async (req, res) => {
//     try {
//         const { id: taskId } = req.params;
//         console.log(req)

//         const task = await Task.findById(taskId);
//         if (!task) return res.status(404).json({ error: "Task not found" });

//         if (task.status !== "pending") {
//             return res.status(400).json({ error: "Task already accepted or completed" });
//         }

//         task.acceptedBy = req.user.id;
//         task.status = "in progress";

//         await task.save();

//         res.status(200).json({ message: "Task accepted successfully", task });
//     } catch (error) {
//         res.status(500).json({ error: "Failed to accept task", details: error.message });
//     }
// };

// // accept bid by client
// export const acceptBidByClient = async (req, res) => {
//     try {
//         const { id: taskId } = req.params;
//         const { taskerId } = req.body;

//         const task = await Task.findById(taskId);
//         if (!task) return res.status(404).json({ error: "Task not found" });

//         // Check if the authenticated user is the client who posted the task
//         if (task.client._id.toString() !== req.user.id) {
//             return res.status(403).json({ error: "You are not authorized to accept bids for this task" });
//         }

//         if (task.status !== "pending") {
//             return res.status(400).json({ error: "Task already accepted or completed" });
//         }

//         task.acceptedBy = taskerId;
//         task.status = "in progress";

//         await task.save();

//         res.status(200).json({ message: "Bid accepted successfully", task });
//     } catch (error) {
//         res.status(500).json({ error: "Failed to accept bid", details: error.message });
//     }
// };

export const addBidToTask = async (req, res) => {
    try {
        const { id: taskId } = req.params;
        const { offerPrice, message } = req.body;

        const newBid = {
            taskerId: req.user.id,
            offerPrice,
            message,
            createdAt: new Date(),
        };

        const updatedTask = await Task.findByIdAndUpdate(
            taskId,
            { $push: { bids: newBid } },
            { new: true }
        );

        if (!updatedTask) {
            return res.status(404).json({ error: "Task not found" });
        }

        // Create notification for the client (new bid received) - non-blocking
        try {
            await createNotification(
                updatedTask.client, // Client ID (task owner)
                "New Bid Received",
                `Tasker "${req.user.firstName} ${req.user.lastName}" placed a bid of $${offerPrice} for "${updatedTask.taskTitle}". Check details.`,
                "new-bid",
                updatedTask._id // Link to task
            );
            console.log("Notification created for new bid"); // Debug
        } catch (notifErr) {
            console.error("Failed to create notification (non-blocking):", notifErr); // Log but don't crash
        }

        res.status(200).json({ message: "Bid added successfully", task: updatedTask });
    } catch (error) {
        console.error("Error adding bid:", error);
        res.status(500).json({ error: "Failed to add bid", details: error.message });
    }
};

// Add comment to task
export const addCommentToTask = async (req, res) => {
    try {
        const taskId = req.params.id;
        const userId = req.user._id;
        const { message } = req.body;

        if (!message || message.trim() === "") {
            return res.status(400).json({ error: "Comment message cannot be empty" });
        }

        const userRole = req.user.role;

        if (!["tasker", "client"].includes(userRole)) {
            return res.status(400).json({ error: "Invalid user role" });
        }

        // Fetch the user details from DB
        const user = await User.findById(userId).select("firstName lastName email profilePicture");
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        // Store snapshot of user details along with comment
        const newComment = {
            userId: userId,
            role: userRole,
            firstName: user.firstName, // Use firstName instead of fullName
            lastName: user.lastName,
            email: user.email,
            profilePicture: user.profilePicture || null,
            message: message.trim(),
            createdAt: new Date(),
            replies: [],
        };

        // Update the task by pushing the new comment to the comments array
        const updatedTask = await Task.findByIdAndUpdate(
            taskId,
            { $push: { comments: newComment } },
            { new: true, runValidators: false } // Skip full document validation
        );

        if (!updatedTask) {
            return res.status(404).json({ error: "Task not found" });
        }

        // Create notification for the task owner or other participants - non-blocking
        try {
            await createNotification(
                updatedTask.client, // Notify the client (task owner)
                "New Comment Added",
                `"${user.firstName} ${user.lastName}" added a comment to your task "${updatedTask.taskTitle}": "${message.substring(0, 50)}..."`,
                "new-comment",
                updatedTask._id // Link to task
            );
            console.log("Notification created for new comment"); // Debug
        } catch (notifErr) {
            console.error("Failed to create notification (non-blocking):", notifErr); // Log but don't crash
        }

        res.status(201).json({
            message: "Comment added successfully",
            task: updatedTask,
        });
    } catch (error) {
        console.error("Error adding comment:", error);
        res.status(500).json({ error: "Failed to add comment", details: error.message });
    }
};

// Accept task by tasker
export const acceptTaskByTasker = async (req, res) => {
    try {
        const { id: taskId } = req.params;
        console.log(req)

        const task = await Task.findById(taskId);
        if (!task) return res.status(404).json({ error: "Task not found" });

        if (task.status !== "pending") {
            return res.status(400).json({ error: "Task already accepted or completed" });
        }

        task.acceptedBy = req.user.id;
        task.status = "in progress";

        await task.save();

        // Create notification for the client (task accepted) - non-blocking
        try {
            const tasker = await User.findById(req.user.id).select("firstName lastName");
            await createNotification(
                task.client, // Client ID (task owner)
                "Task Accepted",
                `Tasker "${tasker.firstName} ${tasker.lastName}" has accepted your task "${task.taskTitle}". Communication will start soon.`,
                "task-accepted",
                task._id // Link to task
            );
            console.log("Notification created for task accepted"); // Debug
        } catch (notifErr) {
            console.error("Failed to create notification (non-blocking):", notifErr); // Log but don't crash
        }

        res.status(200).json({ message: "Task accepted successfully", task });
    } catch (error) {
        console.error("Error accepting task:", error);
        res.status(500).json({ error: "Failed to accept task", details: error.message });
    }
};

// Accept bid by client
export const acceptBidByClient = async (req, res) => {
    try {
        const { id: taskId } = req.params;
        const { taskerId } = req.body;

        const task = await Task.findById(taskId);
        if (!task) return res.status(404).json({ error: "Task not found" });

        // Check if the authenticated user is the client who posted the task
        if (task.client._id.toString() !== req.user.id) {
            return res.status(403).json({ error: "You are not authorized to accept bids for this task" });
        }

        if (task.status !== "pending") {
            return res.status(400).json({ error: "Task already accepted or completed" });
        }

        task.acceptedBy = taskerId;
        task.status = "in progress";

        await task.save();

        // Create notification for the tasker (bid accepted) - non-blocking
        try {
            const client = await User.findById(req.user.id).select("firstName lastName");
            await createNotification(
                taskerId, // Tasker ID
                "Bid Accepted",
                `Client "${client.firstName} ${client.lastName}" has accepted your bid for "${task.taskTitle}". Get ready to start!`,
                "bid-accepted",
                task._id // Link to task
            );
            console.log("Notification created for bid accepted"); // Debug
        } catch (notifErr) {
            console.error("Failed to create notification (non-blocking):", notifErr); // Log but don't crash
        }

        res.status(200).json({ message: "Bid accepted successfully", task });
    } catch (error) {
        console.error("Error accepting bid:", error);
        res.status(500).json({ error: "Failed to accept bid", details: error.message });
    }
};

// ✅ Tasker requests to mark as completed
// export const requestCompletionByTasker = async (req, res) => {
//     try {
//         const { id: taskId } = req.params;

//         const task = await Task.findById(taskId);
//         if (!task) return res.status(404).json({ error: "Task not found" });

//         if (task.status !== "in progress") {
//             return res.status(400).json({ error: "Task is not in progress" });
//         }

//         task.status = "requested";
//         await task.save();

//         res.status(200).json({ message: "Completion requested", task });
//     } catch (error) {
//         res.status(500).json({ error: "Failed to request completion", details: error.message });
//     }
// };



// export const declineByTasker = async (req, res) => {
//     try {
//         const { id: taskId } = req.params;

//         const task = await Task.findById(taskId);
//         if (!task) return res.status(404).json({ error: "Task not found" });

//         if (task.status !== "in progress") {
//             return res.status(400).json({ error: "Task is not in progress" });
//         }

//         task.status = "declined";
//         await task.save();

//         res.status(200).json({ message: "Task Declined", task });
//     } catch (error) {
//         res.status(500).json({ error: "Failed to deline task", details: error.message });
//     }
// };




// // PATCH /tasks/:taskId/comments/:commentId/reply
// export const replyToComment = async (req, res) => {
//     try {
//         const { taskId, commentId } = req.params;
//         const { message } = req.body;

//         const task = await Task.findById(taskId);
//         if (!task) return res.status(404).json({ error: "Task not found" });

//         const comment = task.comments.id(commentId);
//         if (!comment) return res.status(404).json({ error: "Comment not found" });

//         const reply = {
//             userId: req.user.id,
//             role: req.user.role, // "client" or "tasker"
//             message,
//             createdAt: new Date(),
//         };

//         comment.replies.push(reply);
//         await task.save();

//         res.status(200).json({ message: "Reply added", task });
//     } catch (error) {
//         res.status(500).json({ error: "Failed to reply", details: error.message });
//     }
// };

// // PATCH /tasks/:taskId/status
// export const updateTaskStatusByClient = async (req, res) => {
//     try {
//         const { taskId } = req.params;
//         const { status } = req.body;

//         if (!["completed", "not completed"].includes(status)) {
//             return res.status(400).json({ error: "Invalid status value" });
//         }

//         const task = await Task.findById(taskId);
//         if (!task) return res.status(404).json({ error: "Task not found" });

//         task.status = status;
//         await task.save();

//         res.status(200).json({ message: `Task marked as ${status}`, task });
//     } catch (error) {
//         res.status(500).json({ error: "Failed to update status", details: error.message });
//     }
// };


export const requestCompletionByTasker = async (req, res) => {
    try {
        const { id: taskId } = req.params;

        const task = await Task.findById(taskId);
        if (!task) return res.status(404).json({ error: "Task not found" });

        if (task.status !== "in progress") {
            return res.status(400).json({ error: "Task is not in progress" });
        }

        task.status = "requested";
        await task.save();

        // Create notification for the client (completion requested) - non-blocking
        try {
            const tasker = await User.findById(req.user.id).select("firstName lastName");
            await createNotification(
                task.client, // Client ID (task owner)
                "Completion Requested",
                `Tasker "${tasker.firstName} ${tasker.lastName}" has requested completion for "${task.taskTitle}". Please review and approve.`,
                "completion-requested",
                task._id // Link to task
            );
            console.log("Notification created for completion request"); // Debug
        } catch (notifErr) {
            console.error("Failed to create notification (non-blocking):", notifErr); // Log but don't crash
        }

        res.status(200).json({ message: "Completion requested", task });
    } catch (error) {
        console.error("Error requesting completion:", error);
        res.status(500).json({ error: "Failed to request completion", details: error.message });
    }
};

// Decline by tasker
export const declineByTasker = async (req, res) => {
    try {
        const { id: taskId } = req.params;

        const task = await Task.findById(taskId);
        if (!task) return res.status(404).json({ error: "Task not found" });

        if (task.status !== "in progress") {
            return res.status(400).json({ error: "Task is not in progress" });
        }

        task.status = "declined";
        await task.save();

        // Create notification for the client (task declined) - non-blocking
        try {
            const tasker = await User.findById(req.user.id).select("firstName lastName");
            await createNotification(
                task.client, // Client ID (task owner)
                "Task Declined",
                `Tasker "${tasker.firstName} ${tasker.lastName}" has declined "${task.taskTitle}". Please assign another tasker.`,
                "task-declined",
                task._id // Link to task
            );
            console.log("Notification created for task decline"); // Debug
        } catch (notifErr) {
            console.error("Failed to create notification (non-blocking):", notifErr); // Log but don't crash
        }

        res.status(200).json({ message: "Task Declined", task });
    } catch (error) {
        console.error("Error declining task:", error);
        res.status(500).json({ error: "Failed to decline task", details: error.message });
    }
};

// Reply to comment
export const replyToComment = async (req, res) => {
    try {
        const { taskId, commentId } = req.params;
        const { message } = req.body;

        const task = await Task.findById(taskId);
        if (!task) return res.status(404).json({ error: "Task not found" });

        const comment = task.comments.id(commentId);
        if (!comment) return res.status(404).json({ error: "Comment not found" });

        const reply = {
            userId: req.user.id,
            role: req.user.role, // "client" or "tasker"
            message,
            createdAt: new Date(),
        };

        comment.replies.push(reply);
        await task.save();

        // Create notification for the comment owner (new reply) - non-blocking
        try {
            const commenter = await User.findById(comment.userId).select("firstName lastName");
            await createNotification(
                comment.userId, // Comment owner ID
                "New Reply to Your Comment",
                `"${req.user.firstName} ${req.user.lastName}" replied to your comment on "${task.taskTitle}": "${message.substring(0, 50)}..."`,
                "new-reply",
                task._id // Link to task
            );
            console.log("Notification created for new reply"); // Debug
        } catch (notifErr) {
            console.error("Failed to create notification (non-blocking):", notifErr); // Log but don't crash
        }

        res.status(200).json({ message: "Reply added", task });
    } catch (error) {
        console.error("Error replying to comment:", error);
        res.status(500).json({ error: "Failed to reply", details: error.message });
    }
};

// Update task status by client
export const updateTaskStatusByClient = async (req, res) => {
    try {
        const { taskId } = req.params;
        const { status } = req.body;

        if (!["completed", "not completed"].includes(status)) {
            return res.status(400).json({ error: "Invalid status value" });
        }

        const task = await Task.findById(taskId);
        if (!task) return res.status(404).json({ error: "Task not found" });

        const previousStatus = task.status;
        task.status = status;
        await task.save();

        // Create notification for the tasker (status updated) - non-blocking
        try {
            const tasker = await User.findById(task.acceptedBy).select("firstName lastName");
            await createNotification(
                task.acceptedBy, // Tasker ID
                "Task Status Updated",
                `Client has updated the status of "${task.taskTitle}" to "${status}" (from ${previousStatus}).`,
                "status-updated",
                task._id // Link to task
            );
            console.log("Notification created for status update"); // Debug
        } catch (notifErr) {
            console.error("Failed to create notification (non-blocking):", notifErr); // Log but don't crash
        }

        res.status(200).json({ message: `Task marked as ${status}`, task });
    } catch (error) {
        console.error("Error updating task status:", error);
        res.status(500).json({ error: "Failed to update status", details: error.message });
    }
};





// ✅ 8. Update Task (Only by Client)
// export const updateTask = async (req, res) => {
//     try {
//         const taskId = req.params.id;

//         const task = await Task.findById(taskId);
//         if (!task) return res.status(404).json({ error: "Task not found" });

//         // if (task.client.toString() !== req.user.id) {
//         //     return res.status(403).json({ error: "Unauthorized to update this task" });
//         // }

//         const updatedTask = await Task.findByIdAndUpdate(taskId, req.body, { new: true });
//         res.status(200).json({ message: "Task updated", task: updatedTask });

//     } catch (error) {
//         res.status(500).json({ error: "Failed to update task", details: error.message });
//     }
// };

// // ✅ 9. Delete Task (Only by Client)
// export const deleteTask = async (req, res) => {
//     try {
//         const taskId = req.params.id;
//         const task = await Task.findById(taskId);
//         if (!task) return res.status(404).json({ error: "Task not found" });
//         if (task.client.toString() !== req.user.id) {
//             return res.status(403).json({ error: "Unauthorized to delete this task" });
//         }

//         await Task.findByIdAndDelete(taskId);
//         res.status(200).json({ message: "Task deleted successfully" });
//     } catch (error) {
//         res.status(500).json({ error: "Failed to delete task", details: error.message });
//     }
// };

export const updateTask = async (req, res) => {
    try {
        const taskId = req.params.id;

        const task = await Task.findById(taskId);
        if (!task) return res.status(404).json({ error: "Task not found" });

        // if (task.client.toString() !== req.user.id) {
        //     return res.status(403).json({ error: "Unauthorized to update this task" });
        // }

        const updatedTask = await Task.findByIdAndUpdate(taskId, req.body, { new: true });

        // Create notification for the tasker (task updated) - non-blocking
        if (updatedTask.acceptedBy) { // Only if a tasker is assigned
            try {
                const client = await User.findById(req.user.id).select("firstName lastName");
                await createNotification(
                    updatedTask.acceptedBy, // Tasker ID
                    "Task Updated",
                    `Client "${client.firstName} ${client.lastName}" has updated "${updatedTask.taskTitle}". Check the changes.`,
                    "task-updated",
                    updatedTask._id // Link to task
                );
                console.log("Notification created for task update"); // Debug
            } catch (notifErr) {
                console.error("Failed to create notification (non-blocking):", notifErr); // Log but don't crash
            }
        }

        res.status(200).json({ message: "Task updated", task: updatedTask });
    } catch (error) {
        console.error("Error updating task:", error);
        res.status(500).json({ error: "Failed to update task", details: error.message });
    }
};

// Delete task
export const deleteTask = async (req, res) => {
    try {
        const taskId = req.params.id;
        const task = await Task.findById(taskId);
        if (!task) return res.status(404).json({ error: "Task not found" });
        if (task.client.toString() !== req.user.id) {
            return res.status(403).json({ error: "Unauthorized to delete this task" });
        }

        const deletedTask = await Task.findByIdAndDelete(taskId);

        // Create notification for the tasker (if assigned) - non-blocking
        if (task.acceptedBy) { // Only if a tasker was assigned
            try {
                const client = await User.findById(req.user.id).select("firstName lastName");
                await createNotification(
                    task.acceptedBy, // Tasker ID
                    "Task Deleted",
                    `Client "${client.firstName} ${client.lastName}" has deleted "${task.taskTitle}".`,
                    "task-deleted",
                    taskId // Link to task (even if deleted)
                );
                console.log("Notification created for task deletion"); // Debug
            } catch (notifErr) {
                console.error("Failed to create notification (non-blocking):", notifErr); // Log but don't crash
            }
        }

        res.status(200).json({ message: "Task deleted successfully" });
    } catch (error) {
        console.error("Error deleting task:", error);
        res.status(500).json({ error: "Failed to delete task", details: error.message });
    }
};



// Delete task controller
export const deleteTaskAdnmin = async (req, res) => {
    try {
        const { id } = req.params;

        console.log(id)
        // Validate ObjectId
        if (!id.match(/^[0-9a-fA-F]{24}$/)) {
            return res.status(400).json({ error: "Invalid task ID" });
        }

        const deletedTask = await Task.findByIdAndDelete(id);

        if (!deletedTask) {
            return res.status(404).json({ error: "Task not found" });
        }

        res.status(200).json({
            message: "Task deleted successfully",
            deletedTask: deletedTask._id
        });
    } catch (error) {
        console.error('Error deleting task:', error);
        res.status(500).json({ error: "Failed to delete task" });
    }
};


export const bulkDeleteTasks = async (req, res) => {
    try {
        const { taskIds } = req.body;

        if (!Array.isArray(taskIds) || taskIds.length === 0) {
            return res.status(400).json({ error: "Task IDs array is required" });
        }

        // Validate all ObjectIds
        const invalidIds = taskIds.filter(id => !id.match(/^[0-9a-fA-F]{24}$/));
        if (invalidIds.length > 0) {
            return res.status(400).json({ error: "Invalid task IDs provided" });
        }

        const result = await Task.deleteMany({ _id: { $in: taskIds } });

        res.status(200).json({
            message: `${result.deletedCount} tasks deleted successfully`,
            deletedCount: result.deletedCount
        });
    } catch (error) {
        console.error('Error bulk deleting tasks:', error);
        res.status(500).json({ error: "Failed to delete tasks" });
    }
};
