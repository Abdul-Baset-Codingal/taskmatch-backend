import Task from "../models/task.js";
import User from "../models/user.js";
import stripe from '../utils/stripeConfig.js';
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

//         // Create notification for the client (task poster) - non-blocking
//         try {
//             await createNotification(
//                 req.user.id, // Client ID
//                 "Task Created Successfully",
//                 `Your task "${newTask.taskTitle}" is now live and waiting for tasker bids.`,
//                 "task-posted",
//                 newTask._id // Link to task
//             );
//             console.log("Notification created for new task"); // Debug
//         } catch (notifErr) {
//             console.error("Failed to create notification (non-blocking):", notifErr); // Log but don't crash
//         }

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


// In taskController.js (Express) or route.ts (Next.js)
export const checkPaymentMethod = async (req, res) => {
    try {
        const userId = req.user.id; // From auth middleware
        const user = await User.findById(userId).select('defaultPaymentMethod');
        res.json({ hasPaymentMethod: !!user?.defaultPaymentMethod });
    } catch (err) {
        res.status(500).json({ error: 'Check failed' });
    }
};

export const createSetupIntent = async (req, res) => {
    try {
        const stripe = (await import('../utils/stripeConfig.js')).default;
        const intent = await stripe.setupIntents.create({
            usage: 'off_session', // For future holds
            customer: req.user.stripeCustomerId || undefined,
        });
        res.json({ clientSecret: intent.client_secret });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};


export const savePaymentMethod = async (req, res) => {
    try {
        const userId = req.user.id;
        const { paymentMethodId } = req.body;
        const stripe = (await import('../utils/stripeConfig.js')).default;

        let customer = req.user.stripeCustomerId
            ? await stripe.customers.retrieve(req.user.stripeCustomerId)
            : await stripe.customers.create({ email: req.user.email });

        await stripe.paymentMethods.attach(paymentMethodId, { customer: customer.id });
        await stripe.customers.update(customer.id, {
            invoice_settings: { default_payment_method: paymentMethodId },
        });

        const user = await User.findByIdAndUpdate(userId, {
            stripeCustomerId: customer.id,
            defaultPaymentMethod: paymentMethodId,
        }, { new: true });

        res.json({ message: 'Saved', hasPaymentMethod: true });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

export const createTask = async (req, res) => {
    try {
        console.log("createTask called at", new Date().toISOString());
        console.log("req.body:", JSON.stringify(req.body, null, 2));
        console.log("req.files:", JSON.stringify(req.files, null, 2));

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
        } = req.body;

        const budget = parseFloat(price) || 0;
        const isUrgent = schedule === "Urgent";
        const urgentFee = isUrgent ? budget * 0.20 : 0;
        const subtotal = budget + urgentFee;
        const serviceFee = subtotal * 0.08;
        const tax = subtotal * 0.13;
        const totalDollars = subtotal + serviceFee + tax;
        const totalAmount = Math.round(totalDollars * 100); // Cents for Stripe

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
            estimatedTime: String(estimatedTime),
            location,
            schedule,
            extraCharge: isUrgent,
            additionalInfo,
            offerDeadline,
            photos,
            price: budget, // Store base price
            totalAmount, // New: Full amount in cents
            video,
            client: req.user.id,
            stripeStatus: 'pending', // New
        });

        console.log("Task object before save:", JSON.stringify(newTask, null, 2));

        await newTask.save();
        console.log("Saved task:", JSON.stringify(newTask, null, 2));

        // Create notification for the client (task poster) - non-blocking
        try {
            await createNotification(
                req.user.id,
                "Task Created Successfully",
                `Your task "${newTask.taskTitle}" is now live and waiting for tasker bids. Total: $${totalDollars.toFixed(2)}.`,
                "task-posted",
                newTask._id
            );
            console.log("Notification created for new task");
        } catch (notifErr) {
            console.error("Failed to create notification (non-blocking):", notifErr);
        }

        res.status(201).json({
            message: "Task created successfully",
            task: newTask,
            totalAmount: totalDollars.toFixed(2) // For frontend display
        });
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
        if (!tasker || tasker.currentRole !== "tasker") {
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


// Add this to your taskController.js
export const getTaskMessages = async (req, res) => {
    try {
        const { taskId } = req.params;
        const userId = req.user.id;

        const task = await Task.findById(taskId)
            .populate("messages.sender", "firstName lastName profilePicture currentRole")
            .select("messages client acceptedBy status");

        if (!task) {
            return res.status(404).json({ error: "Task not found" });
        }

        // Verify user has access to this task
        const isClient = task.client.toString() === userId;
        const isTasker = task.acceptedBy && task.acceptedBy.toString() === userId;

        if (!isClient && !isTasker) {
            return res.status(403).json({ error: "Not authorized to view messages for this task" });
        }

        // Return messages sorted by creation date (oldest first)
        const sortedMessages = task.messages.sort((a, b) =>
            new Date(a.createdAt) - new Date(b.createdAt)
        );

        res.status(200).json(sortedMessages);
    } catch (error) {
        console.error("Error fetching task messages:", error);
        res.status(500).json({ error: "Failed to fetch messages", details: error.message });
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
            .populate("messages.sender", "firstName lastName profilePicture email") // Add this

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
            .populate("messages.sender", "firstName lastName profilePicture email") // Add this

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

// code of messages 

// In addMessage controller - update the response
// export const addMessage = async (req, res) => {
//     try {
//         const { taskId } = req.params;
//         const { message } = req.body;
//         const senderId = req.user.id;
//         const senderRole = req.user.currentRole || req.user.role;

//         if (!message || message.trim() === "") {
//             return res.status(400).json({ error: "Message cannot be empty" });
//         }

//         if (message.trim().length > 5000) {
//             return res.status(400).json({ error: "Message too long (max 5000 characters)" });
//         }

//         // First, get the task without population to add the message
//         const task = await Task.findById(taskId);
//         if (!task) {
//             return res.status(404).json({ error: "Task not found" });
//         }

//         // ANY tasker can message
//         const isClient = task.client.toString() === senderId;
//         const isTasker = senderRole === "tasker";

//         if (!isClient && !isTasker) {
//             return res.status(403).json({ error: "You are not authorized to message" });
//         }

//         const newMessage = {
//             sender: senderId,
//             senderRole: isClient ? "client" : "tasker",
//             message: message.trim(),
//             isRead: false,
//         };

//         task.messages.push(newMessage);
//         await task.save();

//         // NOW populate the task to get user data
//         const populatedTask = await Task.findById(taskId)
//             .populate("client", "firstName lastName profilePicture")
//             .populate("acceptedBy", "firstName lastName profilePicture")
//             .populate("messages.sender", "firstName lastName profilePicture email"); // IMPORTANT: Populate sender

//         // Get the newly added message (last one)
//         const addedMessage = populatedTask.messages[populatedTask.messages.length - 1];

//         // Create notification for the other participant
//         try {
//             const recipientId = isClient ? task.acceptedBy?._id : task.client._id;
//             if (recipientId) {
//                 const senderName = `${req.user.firstName} ${req.user.lastName}`;
//                 await createNotification(
//                     recipientId,
//                     "New Message",
//                     `${senderName}: ${message.trim().substring(0, 60)}${message.length > 60 ? "..." : ""}`,
//                     "new-message",
//                     taskId
//                 );
//             }
//         } catch (notifErr) {
//             console.error("Failed to send message notification:", notifErr);
//         }

//         res.status(201).json({
//             message: "Message sent successfully",
//             newMessage: addedMessage, // This now has populated sender data
//         });
//     } catch (error) {
//         console.error("Error sending message:", error);
//         res.status(500).json({ error: "Failed to send message", details: error.message });
//     }
// };

export const addMessage = async (req, res) => {
    try {
        const { taskId } = req.params;
        const { message } = req.body;
        const senderId = req.user.id;
        const senderRole = req.user.currentRole || req.user.role;

        if (!message || message.trim() === "") {
            return res.status(400).json({ error: "Message cannot be empty" });
        }

        if (message.trim().length > 5000) {
            return res.status(400).json({ error: "Message too long (max 5000 characters)" });
        }

        const task = await Task.findById(taskId);
        if (!task) {
            return res.status(404).json({ error: "Task not found" });
        }

        const isClient = task.client.toString() === senderId;
        const isTasker = senderRole === "tasker";

        if (!isClient && !isTasker) {
            return res.status(403).json({ error: "You are not authorized to message" });
        }

        const newMessage = {
            sender: senderId,
            senderRole: isClient ? "client" : "tasker",
            message: message.trim(),
            isRead: false,
        };

        task.messages.push(newMessage);
        await task.save();

        const populatedTask = await Task.findById(taskId)
            .populate("client", "firstName lastName profilePicture")
            .populate("acceptedBy", "firstName lastName profilePicture")
            .populate("messages.sender", "firstName lastName profilePicture email");

        const addedMessage = populatedTask.messages[populatedTask.messages.length - 1];

        // FIX: Determine recipient correctly - notify the OTHER person
        try {
            let recipientId;
            if (isClient) {
                // Client sent message, notify tasker (if task has been accepted)
                recipientId = task.acceptedBy;
            } else {
                // Tasker sent message, notify client
                recipientId = task.client;
            }

            if (recipientId) {
                const sender = await User.findById(senderId).select("firstName lastName");
                const senderName = sender ? `${sender.firstName} ${sender.lastName}` : "Someone";

                await createNotification(
                    recipientId,
                    "New Message",
                    `${senderName}: ${message.trim().substring(0, 60)}${message.length > 60 ? "..." : ""}`,
                    "new-message",
                    taskId
                );
                console.log("Message notification created for:", recipientId);
            } else {
                console.log("No recipient found for message notification");
            }
        } catch (notifErr) {
            console.error("Failed to send message notification:", notifErr);
        }

        res.status(201).json({
            message: "Message sent successfully",
            newMessage: addedMessage,
        });
    } catch (error) {
        console.error("Error sending message:", error);
        res.status(500).json({ error: "Failed to send message", details: error.message });
    }
};


export const getMessageStatus = async (req, res) => {
    try {
        const { taskId } = req.params;
        const userId = req.user.id;

        const task = await Task.findById(taskId)
            .populate("messages.sender", "firstName lastName");

        if (!task) {
            return res.status(404).json({ error: "Task not found" });
        }

        const messageStatus = task.messages.map((msg, index) => {
            const senderId = msg.sender?._id?.toString() || msg.sender?.toString();
            return {
                index,
                senderId,
                senderName: msg.sender?.firstName || 'Unknown',
                isFromMe: senderId === userId.toString(),
                isRead: msg.isRead,
                readAt: msg.readAt,
                message: msg.message?.substring(0, 50),
                createdAt: msg.createdAt
            };
        });

        res.json({
            taskId,
            currentUserId: userId,
            totalMessages: task.messages.length,
            messages: messageStatus
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

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

//         // Create notification for the client (new bid received) - non-blocking
//         try {
//             await createNotification(
//                 updatedTask.client, // Client ID (task owner)
//                 "New Bid Received",
//                 `Tasker "${req.user.firstName} ${req.user.lastName}" placed a bid of $${offerPrice} for "${updatedTask.taskTitle}". Check details.`,
//                 "new-bid",
//                 updatedTask._id // Link to task
//             );
//             console.log("Notification created for new bid"); // Debug
//         } catch (notifErr) {
//             console.error("Failed to create notification (non-blocking):", notifErr); // Log but don't crash
//         }

//         res.status(200).json({ message: "Bid added successfully", task: updatedTask });
//     } catch (error) {
//         console.error("Error adding bid:", error);
//         res.status(500).json({ error: "Failed to add bid", details: error.message });
//     }
// };

// Add comment to task
// export const addCommentToTask = async (req, res) => {
//     try {
//         const taskId = req.params.id;
//         const userId = req.user._id;
//         const { message } = req.body;

//         if (!message || message.trim() === "") {
//             return res.status(400).json({ error: "Comment message cannot be empty" });
//         }

//         const userRole = req.user.currentRole;

//         if (!["tasker", "client"].includes(userRole)) {
//             return res.status(400).json({ error: "Invalid user role" });
//         }

//         // Fetch the user details from DB
//         const user = await User.findById(userId).select("firstName lastName email profilePicture");
//         if (!user) {
//             return res.status(404).json({ error: "User not found" });
//         }

//         // Store snapshot of user details along with comment
//         const newComment = {
//             userId: userId,
//             role: userRole,
//             firstName: user.firstName, // Use firstName instead of fullName
//             lastName: user.lastName,
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

//         // Create notification for the task owner or other participants - non-blocking
//         try {
//             await createNotification(
//                 updatedTask.client, // Notify the client (task owner)
//                 "New Comment Added",
//                 `"${user.firstName} ${user.lastName}" added a comment to your task "${updatedTask.taskTitle}": "${message.substring(0, 50)}..."`,
//                 "new-comment",
//                 updatedTask._id // Link to task
//             );
//             console.log("Notification created for new comment"); // Debug
//         } catch (notifErr) {
//             console.error("Failed to create notification (non-blocking):", notifErr); // Log but don't crash
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
            // FIX: Get tasker details from database to ensure we have the name
            const tasker = await User.findById(req.user.id).select("firstName lastName");

            if (!tasker) {
                console.error("Tasker not found for notification");
            }

            const taskerName = tasker
                ? `${tasker.firstName} ${tasker.lastName}`
                : "A tasker";

            // Debug: Log notification details
            console.log("Creating bid notification:", {
                clientId: updatedTask.client,
                taskerName,
                offerPrice,
                taskTitle: updatedTask.taskTitle
            });

            await createNotification(
                updatedTask.client, // Client ID (task owner)
                "New Bid Received",
                `${taskerName} placed a bid of $${offerPrice} for "${updatedTask.taskTitle}". Check details.`,
                "new-bid",
                updatedTask._id // Link to task
            );
            console.log("✅ Notification created for new bid");
        } catch (notifErr) {
            console.error("❌ Failed to create notification (non-blocking):", notifErr);
        }

        // Optional: Also notify the tasker that their bid was submitted successfully
        try {
            await createNotification(
                req.user.id, // Tasker ID
                "Bid Submitted",
                `Your bid of $${offerPrice} for "${updatedTask.taskTitle}" has been submitted successfully.`,
                "bid-submitted",
                updatedTask._id
            );
            console.log("✅ Confirmation notification sent to tasker");
        } catch (notifErr) {
            console.error("❌ Failed to create tasker confirmation notification:", notifErr);
        }

        res.status(200).json({ message: "Bid added successfully", task: updatedTask });
    } catch (error) {
        console.error("Error adding bid:", error);
        res.status(500).json({ error: "Failed to add bid", details: error.message });
    }
};



export const addCommentToTask = async (req, res) => {
    try {
        const taskId = req.params.id;
        const userId = req.user._id;
        const { message } = req.body;

        if (!message || message.trim() === "") {
            return res.status(400).json({ error: "Comment message cannot be empty" });
        }

        const userRole = req.user.currentRole;

        if (!["tasker", "client"].includes(userRole)) {
            return res.status(400).json({ error: "Invalid user role" });
        }

        const user = await User.findById(userId).select("firstName lastName email profilePicture");
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const newComment = {
            userId: userId,
            role: userRole,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            profilePicture: user.profilePicture || null,
            message: message.trim(),
            createdAt: new Date(),
            replies: [],
        };

        const updatedTask = await Task.findByIdAndUpdate(
            taskId,
            { $push: { comments: newComment } },
            { new: true, runValidators: false }
        );

        if (!updatedTask) {
            return res.status(404).json({ error: "Task not found" });
        }

        // FIX: Notify the appropriate person based on who commented
        try {
            const commenterName = `${user.firstName} ${user.lastName}`;
            const notificationMessage = `"${commenterName}" commented on "${updatedTask.taskTitle}": "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`;

            // If tasker commented, notify client
            if (userRole === "tasker") {
                await createNotification(
                    updatedTask.client,
                    "New Comment on Your Task",
                    notificationMessage,
                    "new-comment",
                    updatedTask._id
                );
                console.log("Notification sent to client for new comment");
            }
            // If client commented, notify tasker (if one is assigned)
            else if (userRole === "client" && updatedTask.acceptedBy) {
                await createNotification(
                    updatedTask.acceptedBy,
                    "New Comment on Task",
                    notificationMessage,
                    "new-comment",
                    updatedTask._id
                );
                console.log("Notification sent to tasker for new comment");
            }
            // Also notify if client comments on their own task (for other bidders visibility)
            // You might want to notify all bidders here
        } catch (notifErr) {
            console.error("Failed to create notification (non-blocking):", notifErr);
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

//         // Create notification for the client (task accepted) - non-blocking
//         try {
//             const tasker = await User.findById(req.user.id).select("firstName lastName");
//             await createNotification(
//                 task.client, // Client ID (task owner)
//                 "Task Accepted",
//                 `Tasker "${tasker.firstName} ${tasker.lastName}" has accepted your task "${task.taskTitle}". Communication will start soon.`,
//                 "task-accepted",
//                 task._id // Link to task
//             );
//             console.log("Notification created for task accepted"); // Debug
//         } catch (notifErr) {
//             console.error("Failed to create notification (non-blocking):", notifErr); // Log but don't crash
//         }

//         res.status(200).json({ message: "Task accepted successfully", task });
//     } catch (error) {
//         console.error("Error accepting task:", error);
//         res.status(500).json({ error: "Failed to accept task", details: error.message });
//     }
// };


// export const acceptTaskByTasker = async (req, res) => {
//     try {
//         const { id: taskId } = req.params;

//         const task = await Task.findById(taskId).populate('client');
//         if (!task) return res.status(404).json({ error: "Task not found" });

//         if (task.status !== "pending") {
//             return res.status(400).json({ error: "Task already accepted or completed" });
//         }

//         const client = task.client;
//         if (!client.stripeCustomerId || !client.defaultPaymentMethod) {
//             return res.status(400).json({ message: 'Client has no saved payment method. Please ask them to add one.' });
//         }

//         // Authorize (hold) funds
//         const paymentIntent = await stripe.paymentIntents.create({
//             amount: task.totalAmount,
//             currency: 'usd', // Or 'cad'
//             customer: client.stripeCustomerId,
//             payment_method: client.defaultPaymentMethod,
//             confirmation_method: 'manual',
//             confirm: true,
//             capture_method: 'manual',
//             description: `Authorization for Task ${task._id}`,
//             metadata: { taskId: task._id.toString() },
//         });

//         if (paymentIntent.status !== 'requires_capture') {
//             return res.status(400).json({
//                 message: 'Payment authorization failed',
//                 error: paymentIntent.last_payment_error?.message
//             });
//         }

//         task.acceptedBy = req.user.id;
//         task.status = "in progress";
//         task.paymentIntentId = paymentIntent.id;
//         task.stripeStatus = 'authorized';
//         await task.save();

//         // Create notification...
//         try {
//             const tasker = await User.findById(req.user.id).select("firstName lastName");
//             await createNotification(
//                 task.client,
//                 "Task Accepted",
//                 `Tasker "${tasker.firstName} ${tasker.lastName}" has accepted your task "${task.taskTitle}". Funds held: $${(task.totalAmount / 100).toFixed(2)}.`,
//                 "task-accepted",
//                 task._id
//             );
//             console.log("Notification created for task accepted");
//         } catch (notifErr) {
//             console.error("Failed to create notification (non-blocking):", notifErr);
//         }

//         res.status(200).json({ message: "Task accepted successfully", task });
//     } catch (error) {
//         console.error("Error accepting task:", error);
//         res.status(500).json({ error: "Failed to accept task", details: error.message });
//     }
// };

export const acceptTaskByTasker = async (req, res) => {
    try {
        const { id: taskId } = req.params;

        const task = await Task.findById(taskId).populate('client');
        if (!task) return res.status(404).json({ error: "Task not found" });

        if (task.status !== "pending") {
            return res.status(400).json({ error: "Task already accepted or completed" });
        }

        const client = task.client;
        if (!client.stripeCustomerId || !client.defaultPaymentMethod) {
            return res.status(400).json({ message: 'Client has no saved payment method. Please ask them to add one.' });
        }

        // Authorize (hold) funds
        const paymentIntent = await stripe.paymentIntents.create({
            amount: task.totalAmount,
            currency: 'usd',
            customer: client.stripeCustomerId,
            payment_method: client.defaultPaymentMethod,
            confirmation_method: 'manual',
            confirm: true,
            capture_method: 'manual',
            description: `Authorization for Task ${task._id}`,
            metadata: { taskId: task._id.toString() },
        });

        if (paymentIntent.status !== 'requires_capture') {
            return res.status(400).json({
                message: 'Payment authorization failed',
                error: paymentIntent.last_payment_error?.message
            });
        }

        task.acceptedBy = req.user.id;
        task.status = "in progress";
        task.paymentIntentId = paymentIntent.id;
        task.stripeStatus = 'authorized';
        await task.save();

        // FIX: Get tasker details from database
        const tasker = await User.findById(req.user.id).select("firstName lastName");

        if (!tasker) {
            console.error("Tasker not found for notification");
        }

        const taskerName = tasker
            ? `${tasker.firstName} ${tasker.lastName}`
            : "A tasker";

        const paymentAmount = task.totalAmount ? (task.totalAmount / 100).toFixed(2) : '0.00';

        // Get client ID safely (since client is populated)
        const clientId = task.client._id || task.client;

        // Create notification for the client (task accepted)
        try {
            // Debug: Log notification details
            console.log("Creating task accepted notification:", {
                clientId,
                taskerName,
                taskTitle: task.taskTitle,
                paymentAmount
            });

            await createNotification(
                clientId, // Client ID (task owner)
                "Task Accepted! 🎉",
                `${taskerName} has accepted your task "${task.taskTitle}". A hold of $${paymentAmount} has been placed on your payment method. Work will begin soon!`,
                "task-accepted",
                task._id
            );
            console.log("✅ Notification created for client - task accepted");

        } catch (notifErr) {
            console.error("❌ Failed to create client notification (non-blocking):", notifErr);
        }

        // Send confirmation notification to tasker
        try {
            await createNotification(
                req.user.id, // Tasker ID
                "Task Accepted Successfully",
                `You have accepted the task "${task.taskTitle}". A payment of $${paymentAmount} has been authorized. You can now start working on this task!`,
                "task-accept-confirmed",
                task._id
            );
            console.log("✅ Confirmation notification sent to tasker");

        } catch (notifErr) {
            console.error("❌ Failed to create tasker confirmation notification:", notifErr);
        }

        // Optional: Notify other bidders that task has been assigned
        try {
            if (task.bids && task.bids.length > 0) {
                // Get unique tasker IDs from bids (excluding the one who accepted)
                const otherBidderIds = [...new Set(
                    task.bids
                        .map(bid => bid.taskerId.toString())
                        .filter(id => id !== req.user.id)
                )];

                console.log("Notifying other bidders about task assignment:", otherBidderIds);

                for (const bidderId of otherBidderIds) {
                    await createNotification(
                        bidderId,
                        "Task Assigned to Another Tasker",
                        `The task "${task.taskTitle}" has been assigned to another tasker. Keep an eye out for other opportunities!`,
                        "task-assigned-other",
                        task._id
                    );
                }
                console.log(`✅ Notified ${otherBidderIds.length} other bidders`);
            }
        } catch (notifErr) {
            console.error("❌ Failed to notify other bidders (non-blocking):", notifErr);
        }

        res.status(200).json({ message: "Task accepted successfully", task });
    } catch (error) {
        console.error("Error accepting task:", error);
        res.status(500).json({ error: "Failed to accept task", details: error.message });
    }
};


// Accept bid by client
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

//         // Create notification for the tasker (bid accepted) - non-blocking
//         try {
//             const client = await User.findById(req.user.id).select("firstName lastName");
//             await createNotification(
//                 taskerId, // Tasker ID
//                 "Bid Accepted",
//                 `Client "${client.firstName} ${client.lastName}" has accepted your bid for "${task.taskTitle}". Get ready to start!`,
//                 "bid-accepted",
//                 task._id // Link to task
//             );
//             console.log("Notification created for bid accepted"); // Debug
//         } catch (notifErr) {
//             console.error("Failed to create notification (non-blocking):", notifErr); // Log but don't crash
//         }

//         res.status(200).json({ message: "Bid accepted successfully", task });
//     } catch (error) {
//         console.error("Error accepting bid:", error);
//         res.status(500).json({ error: "Failed to accept bid", details: error.message });
//     }
// };

// Add this endpoint to your taskController.js
export const createPaymentIntent = async (req, res) => {
    try {
        const { amount, taskId, taskerId, description } = req.body;
        const userId = req.user.id;

        // Validate required fields
        if (!amount || !taskId || !taskerId) {
            return res.status(400).json({
                error: "Amount, taskId, and taskerId are required"
            });
        }

        // Verify the task exists and user is authorized
        const task = await Task.findById(taskId);
        if (!task) {
            return res.status(404).json({ error: "Task not found" });
        }

        // Check if user is the client who owns the task
        if (task.client.toString() !== userId) {
            return res.status(403).json({
                error: "You are not authorized to create payment for this task"
            });
        }

        // Check if user has payment method set up
        const user = await User.findById(userId);
        if (!user.stripeCustomerId || !user.defaultPaymentMethod) {
            return res.status(400).json({
                error: "No payment method found. Please add a payment method first."
            });
        }

        // Create payment intent with manual capture (to hold funds)
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount, // Amount in cents
            currency: 'usd',
            customer: user.stripeCustomerId,
            payment_method: user.defaultPaymentMethod,
            capture_method: 'manual', // This holds funds until captured
            description: description || `Payment hold for task: ${taskId}`,
            metadata: {
                taskId: taskId,
                taskerId: taskerId,
                clientId: userId
            },
            // Optional: Setup future usage for off-session payments
            setup_future_usage: 'off_session',
        });

        res.status(200).json({
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
            amount: paymentIntent.amount,
            status: paymentIntent.status
        });

    } catch (error) {
        console.error("Error creating payment intent:", error);
        res.status(500).json({
            error: "Failed to create payment intent",
            details: error.message
        });
    }
};




// export const acceptBidByClient = async (req, res) => {
//     try {
//         const { id: taskId } = req.params;
//         const { taskerId } = req.body;

//         const task = await Task.findById(taskId).populate('client');
//         if (!task) return res.status(404).json({ error: "Task not found" });

//         if (task.client._id.toString() !== req.user.id) {
//             return res.status(403).json({ error: "You are not authorized to accept bids for this task" });
//         }

//         if (task.status !== "pending") {
//             return res.status(400).json({ error: "Task already accepted or completed" });
//         }

//         const client = task.client;
//         if (!client.stripeCustomerId || !client.defaultPaymentMethod) {
//             return res.status(400).json({ message: 'No saved payment method. Please add one.' });
//         }

//         // Authorize (hold) funds - UPDATED: Use only automatic_payment_methods
//         const paymentIntent = await stripe.paymentIntents.create({
//             amount: task.totalAmount,
//             currency: 'usd',
//             customer: client.stripeCustomerId,
//             payment_method: client.defaultPaymentMethod,
//             capture_method: 'manual', // This holds funds until captured
//             description: `Authorization for Task ${task._id}`,
//             metadata: { taskId: task._id.toString() },
//             // Use automatic_payment_methods instead of confirmation_method
//             automatic_payment_methods: {
//                 enabled: true,
//                 allow_redirects: 'never' // This prevents redirect-based methods
//             },
//             // Remove confirmation_method since we're using automatic_payment_methods
//             // confirmation_method: 'manual', // REMOVE THIS LINE
//             confirm: true, // Keep this to confirm immediately
//         });

//         if (paymentIntent.status !== 'requires_capture') {
//             return res.status(400).json({
//                 message: 'Payment authorization failed',
//                 error: paymentIntent.last_payment_error?.message
//             });
//         }

//         task.acceptedBy = taskerId;
//         task.status = "in progress";
//         task.paymentIntentId = paymentIntent.id;
//         task.stripeStatus = 'authorized';
//         await task.save();

//         // Create notification...
//         try {
//             const clientUser = await User.findById(req.user.id).select("firstName lastName");
//             await createNotification(
//                 taskerId,
//                 "Bid Accepted",
//                 `Client "${clientUser.firstName} ${clientUser.lastName}" has accepted your bid for "${task.taskTitle}". Funds held: $${(task.totalAmount / 100).toFixed(2)}.`,
//                 "bid-accepted",
//                 task._id
//             );
//             console.log("Notification created for bid accepted");
//         } catch (notifErr) {
//             console.error("Failed to create notification (non-blocking):", notifErr);
//         }

//         res.status(200).json({ message: "Bid accepted successfully", task });
//     } catch (error) {
//         console.error("Error accepting bid:", error);
//         res.status(500).json({ error: "Failed to accept bid", details: error.message });
//     }
// };


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

//         // Create notification for the client (completion requested) - non-blocking
//         try {
//             const tasker = await User.findById(req.user.id).select("firstName lastName");
//             await createNotification(
//                 task.client, // Client ID (task owner)
//                 "Completion Requested",
//                 `Tasker "${tasker.firstName} ${tasker.lastName}" has requested completion for "${task.taskTitle}". Please review and approve.`,
//                 "completion-requested",
//                 task._id // Link to task
//             );
//             console.log("Notification created for completion request"); // Debug
//         } catch (notifErr) {
//             console.error("Failed to create notification (non-blocking):", notifErr); // Log but don't crash
//         }

//         res.status(200).json({ message: "Completion requested", task });
//     } catch (error) {
//         console.error("Error requesting completion:", error);
//         res.status(500).json({ error: "Failed to request completion", details: error.message });
//     }
// };

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

//         // Create notification...
//         try {
//             const tasker = await User.findById(req.user.id).select("firstName lastName");
//             await createNotification(
//                 task.client,
//                 "Completion Requested",
//                 `Tasker "${tasker.firstName} ${tasker.lastName}" has requested completion for "${task.taskTitle}". Please review and approve to release payment.`,
//                 "completion-requested",
//                 task._id
//             );
//             console.log("Notification created for completion request");
//         } catch (notifErr) {
//             console.error("Failed to create notification (non-blocking):", notifErr);
//         }

//         res.status(200).json({ message: "Completion requested", task });
//     } catch (error) {
//         console.error("Error requesting completion:", error);
//         res.status(500).json({ error: "Failed to request completion", details: error.message });
//     }
// };

export const acceptBidByClient = async (req, res) => {
    try {
        const { id: taskId } = req.params;
        const { taskerId } = req.body;

        const task = await Task.findById(taskId).populate('client');
        if (!task) return res.status(404).json({ error: "Task not found" });

        if (task.client._id.toString() !== req.user.id) {
            return res.status(403).json({ error: "You are not authorized to accept bids for this task" });
        }

        if (task.status !== "pending") {
            return res.status(400).json({ error: "Task already accepted or completed" });
        }

        const client = task.client;
        if (!client.stripeCustomerId || !client.defaultPaymentMethod) {
            return res.status(400).json({ message: 'No saved payment method. Please add one.' });
        }

        // Authorize (hold) funds
        const paymentIntent = await stripe.paymentIntents.create({
            amount: task.totalAmount,
            currency: 'usd',
            customer: client.stripeCustomerId,
            payment_method: client.defaultPaymentMethod,
            capture_method: 'manual',
            description: `Authorization for Task ${task._id}`,
            metadata: { taskId: task._id.toString() },
            automatic_payment_methods: {
                enabled: true,
                allow_redirects: 'never'
            },
            confirm: true,
        });

        if (paymentIntent.status !== 'requires_capture') {
            return res.status(400).json({
                message: 'Payment authorization failed',
                error: paymentIntent.last_payment_error?.message
            });
        }

        task.acceptedBy = taskerId;
        task.status = "in progress";
        task.paymentIntentId = paymentIntent.id;
        task.stripeStatus = 'authorized';
        await task.save();

        // FIX: Get client details from database
        const clientUser = await User.findById(req.user.id).select("firstName lastName");
        const clientName = clientUser
            ? `${clientUser.firstName} ${clientUser.lastName}`
            : "The client";

        // FIX: Get tasker details from database
        const tasker = await User.findById(taskerId).select("firstName lastName");
        const taskerName = tasker
            ? `${tasker.firstName} ${tasker.lastName}`
            : "The tasker";

        const paymentAmount = task.totalAmount ? (task.totalAmount / 100).toFixed(2) : '0.00';

        // Find the accepted bid to get the offer price
        const acceptedBid = task.bids.find(bid => bid.taskerId.toString() === taskerId);
        const bidAmount = acceptedBid ? acceptedBid.offerPrice : paymentAmount;

        // Create notification for the tasker (bid accepted)
        try {
            // Debug: Log notification details
            console.log("Creating bid accepted notification:", {
                taskerId,
                clientName,
                taskTitle: task.taskTitle,
                bidAmount,
                paymentAmount
            });

            await createNotification(
                taskerId, // Tasker ID
                "🎉 Congratulations! Your Bid Was Accepted!",
                `${clientName} has accepted your bid of $${bidAmount} for "${task.taskTitle}". A payment of $${paymentAmount} has been authorized. You can now start working!`,
                "bid-accepted",
                task._id
            );
            console.log("✅ Notification created for tasker - bid accepted");

        } catch (notifErr) {
            console.error("❌ Failed to create tasker notification (non-blocking):", notifErr);
        }

        // Send confirmation notification to client
        try {
            await createNotification(
                req.user.id, // Client ID
                "Bid Accepted Successfully",
                `You have accepted ${taskerName}'s bid for "${task.taskTitle}". A hold of $${paymentAmount} has been placed on your payment method.`,
                "bid-accept-confirmed",
                task._id
            );
            console.log("✅ Confirmation notification sent to client");

        } catch (notifErr) {
            console.error("❌ Failed to create client confirmation notification:", notifErr);
        }

        // Notify other bidders that their bid was not selected
        try {
            if (task.bids && task.bids.length > 1) {
                // Get unique tasker IDs from bids (excluding the accepted one)
                const rejectedBidderIds = [...new Set(
                    task.bids
                        .map(bid => bid.taskerId.toString())
                        .filter(id => id !== taskerId)
                )];

                console.log("Notifying rejected bidders:", rejectedBidderIds);

                for (const bidderId of rejectedBidderIds) {
                    await createNotification(
                        bidderId,
                        "Bid Not Selected",
                        `Unfortunately, your bid for "${task.taskTitle}" was not selected. Don't give up - keep bidding on other tasks!`,
                        "bid-rejected",
                        task._id
                    );
                }
                console.log(`✅ Notified ${rejectedBidderIds.length} rejected bidders`);
            }
        } catch (notifErr) {
            console.error("❌ Failed to notify rejected bidders (non-blocking):", notifErr);
        }

        res.status(200).json({ message: "Bid accepted successfully", task });
    } catch (error) {
        console.error("Error accepting bid:", error);
        res.status(500).json({ error: "Failed to accept bid", details: error.message });
    }
};





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
            // FIX: Get tasker details from database to ensure we have the name
            const tasker = await User.findById(req.user.id).select("firstName lastName");

            if (!tasker) {
                console.error("Tasker not found for notification");
            }

            const taskerName = tasker
                ? `${tasker.firstName} ${tasker.lastName}`
                : "The tasker";

            // Debug: Log notification details
            console.log("Creating completion request notification:", {
                clientId: task.client,
                taskerName,
                taskTitle: task.taskTitle,
                taskId: task._id
            });

            // Notify the client about completion request
            await createNotification(
                task.client, // Client ID (task owner)
                "Completion Requested",
                `${taskerName} has requested completion for "${task.taskTitle}". Please review the work and approve to release payment.`,
                "completion-requested",
                task._id
            );
            console.log("✅ Notification created for client - completion request");

        } catch (notifErr) {
            console.error("❌ Failed to create client notification (non-blocking):", notifErr);
        }

        // Optional: Send confirmation notification to tasker
        try {
            await createNotification(
                req.user.id, // Tasker ID
                "Completion Request Sent",
                `Your completion request for "${task.taskTitle}" has been sent to the client. Waiting for approval.`,
                "completion-request-sent",
                task._id
            );
            console.log("✅ Confirmation notification sent to tasker");
        } catch (notifErr) {
            console.error("❌ Failed to create tasker confirmation notification:", notifErr);
        }

        res.status(200).json({ message: "Completion requested", task });
    } catch (error) {
        console.error("Error requesting completion:", error);
        res.status(500).json({ error: "Failed to request completion", details: error.message });
    }
};


// Decline by tasker
// export const declineByTasker = async (req, res) => {
//     try {
//         const { id: taskId } = req.params;

//         const task = await Task.findById(taskId);
//         if (!task) return res.status(404).json({ error: "Task not found" });

//         if (task.status !== "in progress") {
//             return res.status(400).json({ error: "Task is not in progress" });
//         }

//         task.status = "pending";
//         await task.save();

//         // Create notification for the client (task declined) - non-blocking
//         try {
//             const tasker = await User.findById(req.user.id).select("firstName lastName");
//             await createNotification(
//                 task.client, // Client ID (task owner)
//                 "Task Declined",
//                 `Tasker "${tasker.firstName} ${tasker.lastName}" has declined "${task.taskTitle}". Please assign another tasker.`,
//                 "task-declined",
//                 task._id // Link to task
//             );
//             console.log("Notification created for task decline"); // Debug
//         } catch (notifErr) {
//             console.error("Failed to create notification (non-blocking):", notifErr); // Log but don't crash
//         }

//         res.status(200).json({ message: "Task Declined", task });
//     } catch (error) {
//         console.error("Error declining task:", error);
//         res.status(500).json({ error: "Failed to decline task", details: error.message });
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

//         const previousStripeStatus = task.stripeStatus;
//         task.status = "pending";
//         if (task.paymentIntentId && task.stripeStatus === 'authorized') {
//             const paymentIntent = await stripe.paymentIntents.cancel(task.paymentIntentId);
//             if (paymentIntent.status === 'canceled') {
//                 task.stripeStatus = 'canceled';
//             } else {
//                 return res.status(400).json({ message: 'Cancellation failed on decline' });
//             }
//         }
//         await task.save();

//         // Create notification...
//         try {
//             const tasker = await User.findById(req.user.id).select("firstName lastName");
//             await createNotification(
//                 task.client,
//                 "Task Declined",
//                 `Tasker "${tasker.firstName} ${tasker.lastName}" has declined "${task.taskTitle}". Funds released.${previousStripeStatus === 'authorized' ? ' Hold canceled.' : ''}`,
//                 "task-declined",
//                 task._id
//             );
//             console.log("Notification created for task decline");
//         } catch (notifErr) {
//             console.error("Failed to create notification (non-blocking):", notifErr);
//         }

//         res.status(200).json({ message: "Task Declined", task });
//     } catch (error) {
//         console.error("Error declining task:", error);
//         res.status(500).json({ error: "Failed to decline task", details: error.message });
//     }
// };

export const declineByTasker = async (req, res) => {
    try {
        const { id: taskId } = req.params;

        const task = await Task.findById(taskId);
        if (!task) return res.status(404).json({ error: "Task not found" });

        if (task.status !== "in progress") {
            return res.status(400).json({ error: "Task is not in progress" });
        }

        const previousStripeStatus = task.stripeStatus;
        const previousAcceptedBy = task.acceptedBy; // Store before clearing

        task.status = "pending";
        task.acceptedBy = null; // Clear the assigned tasker so task can be reassigned

        if (task.paymentIntentId && task.stripeStatus === 'authorized') {
            const paymentIntent = await stripe.paymentIntents.cancel(task.paymentIntentId);
            if (paymentIntent.status === 'canceled') {
                task.stripeStatus = 'canceled';
                task.paymentIntentId = null; // Clear the payment intent
            } else {
                return res.status(400).json({ message: 'Cancellation failed on decline' });
            }
        }
        await task.save();

        // FIX: Get tasker details from database to ensure we have the name
        const tasker = await User.findById(req.user.id).select("firstName lastName");

        if (!tasker) {
            console.error("Tasker not found for notification");
        }

        const taskerName = tasker
            ? `${tasker.firstName} ${tasker.lastName}`
            : "The tasker";

        // Build payment status message
        let paymentMessage = "";
        if (previousStripeStatus === 'authorized') {
            paymentMessage = " The payment hold has been canceled and funds have been released.";
        }

        // Create notification for the client (task declined) - non-blocking
        try {
            // Debug: Log notification details
            console.log("Creating task decline notification:", {
                clientId: task.client,
                taskerName,
                taskTitle: task.taskTitle,
                taskId: task._id,
                previousStripeStatus
            });

            await createNotification(
                task.client, // Client ID (task owner)
                "Task Declined by Tasker",
                `${taskerName} has declined to continue with "${task.taskTitle}".${paymentMessage} Your task is now available for other taskers to accept.`,
                "task-declined",
                task._id
            );
            console.log("✅ Notification created for client - task decline");

        } catch (notifErr) {
            console.error("❌ Failed to create client notification (non-blocking):", notifErr);
        }

        // Send confirmation notification to tasker
        try {
            await createNotification(
                req.user.id, // Tasker ID
                "Task Declined Successfully",
                `You have declined the task "${task.taskTitle}". The client has been notified and the task is now available for other taskers.`,
                "task-decline-confirmed",
                task._id
            );
            console.log("✅ Confirmation notification sent to tasker");

        } catch (notifErr) {
            console.error("❌ Failed to create tasker confirmation notification:", notifErr);
        }

        // Optional: Notify other taskers who previously bid on this task
        try {
            if (task.bids && task.bids.length > 0) {
                // Get unique tasker IDs from bids (excluding the one who just declined)
                const otherBidderIds = [...new Set(
                    task.bids
                        .map(bid => bid.taskerId.toString())
                        .filter(id => id !== req.user.id)
                )];

                // Debug: Log other bidders
                console.log("Notifying other bidders:", otherBidderIds);

                // Send notification to each previous bidder
                for (const bidderId of otherBidderIds) {
                    await createNotification(
                        bidderId,
                        "Task Available Again",
                        `The task "${task.taskTitle}" is available again! The previous tasker has declined. Your bid is still active.`,
                        "task-available-again",
                        task._id
                    );
                }
                console.log(`✅ Notified ${otherBidderIds.length} previous bidders`);
            }
        } catch (notifErr) {
            console.error("❌ Failed to notify other bidders (non-blocking):", notifErr);
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

// code of marks as read messages

// controllers/messageController.js

// controllers/messageController.js

/**
 * Mark messages as read - New simplified logic
 * Only marks messages from OTHER users as read (not your own messages)
 */
// controllers/messageController.js

export const markMessagesAsRead = async (req, res) => {
    // Return immediately for testing
    try {
        // Step 1: Log and validate
        const taskId = req.params.taskId;
        const userId = req.user?.id || req.user?._id;

        console.log(req)

        if (!taskId) {
            return res.status(400).json({ success: false, error: 'No taskId' });
        }

        if (!userId) {
            return res.status(401).json({ success: false, error: 'No userId' });
        }

        // Step 2: Import mongoose
        const mongoose = await import('mongoose');

        // Step 3: Validate ObjectId
        if (!mongoose.default.Types.ObjectId.isValid(taskId)) {
            return res.status(400).json({ success: false, error: 'Invalid taskId' });
        }

        // Step 4: Import Task model

        // Step 5: Direct MongoDB update using native driver
        // This bypasses Mongoose validation issues
        const result = await Task.collection.updateOne(
            { _id: new mongoose.default.Types.ObjectId(taskId) },
            {
                $set: {
                    'messages.$[elem].isRead': true,
                    'messages.$[elem].readAt': new Date()
                }
            },
            {
                arrayFilters: [
                    {
                        'elem.sender': { $ne: new mongoose.default.Types.ObjectId(userId) },
                        'elem.isRead': false
                    }
                ]
            }
        );

        return res.status(200).json({
            success: true,
            modifiedCount: result.modifiedCount,
            matchedCount: result.matchedCount
        });

    } catch (error) {
        console.error('markMessagesAsRead error:', error);
        return res.status(500).json({
            success: false,
            error: error.message,
            name: error.name
        });
    }
};

/**
 * Alternative: Mark messages as read using simple loop
 * Use this if the arrayFilters approach doesn't work
 */
export const markMessagesAsReadSimple = async (req, res) => {
    try {
        const { taskId } = req.params;
        const userId = req.user?.id || req.user?._id;

        if (!taskId || !userId) {
            return res.status(400).json({
                success: false,
                error: 'Missing taskId or userId'
            });
        }

        // Find the task with messages
        const task = await Task.findById(taskId).select('messages');

        if (!task) {
            return res.status(404).json({
                success: false,
                error: 'Task not found'
            });
        }

        if (!task.messages || task.messages.length === 0) {
            return res.status(200).json({
                success: true,
                updatedCount: 0,
                message: 'No messages to mark as read'
            });
        }

        const userIdStr = userId.toString();
        const now = new Date();
        const updateOperations = {};
        let updateCount = 0;

        // Build update operations for each message
        task.messages.forEach((msg, index) => {
            // Get sender ID as string
            const senderId = msg.sender?._id?.toString() || msg.sender?.toString();

            // Only mark as read if:
            // 1. Message is from someone else (not me)
            // 2. Message is not already read
            if (senderId && senderId !== userIdStr && msg.isRead === false) {
                updateOperations[`messages.${index}.isRead`] = true;
                updateOperations[`messages.${index}.readAt`] = now;
                updateCount++;
            }
        });

        // Apply updates if any
        if (updateCount > 0) {
            await Task.updateOne(
                { _id: taskId },
                { $set: updateOperations }
            );
        }

        return res.status(200).json({
            success: true,
            updatedCount: updateCount,
            message: `${updateCount} messages marked as read`
        });

    } catch (error) {
        console.error('markMessagesAsReadSimple error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to mark messages as read',
            details: error.message
        });
    }
};

/**
 * Get unread message count for a user in a task
 */
export const getUnreadCount = async (req, res) => {
    try {
        const { taskId } = req.params;
        const userId = req.user?.id || req.user?._id;

        if (!taskId || !userId) {
            return res.status(400).json({
                success: false,
                error: 'Missing taskId or userId'
            });
        }

        const task = await Task.findById(taskId).select('messages').lean();

        if (!task) {
            return res.status(404).json({
                success: false,
                error: 'Task not found'
            });
        }

        const userIdStr = userId.toString();
        let unreadCount = 0;

        (task.messages || []).forEach(msg => {
            const senderId = msg.sender?._id?.toString() || msg.sender?.toString();
            // Count unread messages from others
            if (senderId && senderId !== userIdStr && msg.isRead === false) {
                unreadCount++;
            }
        });

        return res.status(200).json({
            success: true,
            unreadCount,
            totalMessages: task.messages?.length || 0
        });

    } catch (error) {
        console.error('getUnreadCount error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get unread count',
            details: error.message
        });
    }
};
// In your routes file


// Update task status by client
// export const updateTaskStatusByClient = async (req, res) => {
//     try {
//         const { taskId } = req.params;
//         const { status } = req.body;

//         if (!["completed", "not completed"].includes(status)) {
//             return res.status(400).json({ error: "Invalid status value" });
//         }

//         const task = await Task.findById(taskId);
//         if (!task) return res.status(404).json({ error: "Task not found" });

//         const previousStatus = task.status;
//         task.status = status;
//         await task.save();

//         // Create notification for the tasker (status updated) - non-blocking
//         try {
//             const tasker = await User.findById(task.acceptedBy).select("firstName lastName");
//             await createNotification(
//                 task.acceptedBy, // Tasker ID
//                 "Task Status Updated",
//                 `Client has updated the status of "${task.taskTitle}" to "${status}" (from ${previousStatus}).`,
//                 "status-updated",
//                 task._id // Link to task
//             );
//             console.log("Notification created for status update"); // Debug
//         } catch (notifErr) {
//             console.error("Failed to create notification (non-blocking):", notifErr); // Log but don't crash
//         }

//         res.status(200).json({ message: `Task marked as ${status}`, task });
//     } catch (error) {
//         console.error("Error updating task status:", error);
//         res.status(500).json({ error: "Failed to update status", details: error.message });
//     }
// };


// export const updateTaskStatusByClient = async (req, res) => {
//     try {
//         const { taskId } = req.params;
//         const { status } = req.body;

//         if (!["completed", "not completed"].includes(status)) {
//             return res.status(400).json({ error: "Invalid status value" });
//         }

//         const task = await Task.findById(taskId).populate('acceptedBy');
//         if (!task) return res.status(404).json({ error: "Task not found" });

//         const previousStatus = task.status;
//         task.status = status;

//         let stripeActionMsg = '';
//         if (task.paymentIntentId) {
//             if (status === "completed") {
//                 // Capture full amount
//                 const paymentIntent = await stripe.paymentIntents.capture(task.paymentIntentId);
//                 if (paymentIntent.status === 'succeeded') {
//                     task.stripeStatus = 'captured';
//                     stripeActionMsg = `Payment captured: $${(task.totalAmount / 100).toFixed(2)}.`;
//                     // Optional: Payout to tasker via Stripe Connect if set up
//                     // if (task.acceptedBy.stripeAccountId) { await stripe.transfers.create({...}); }
//                 } else {
//                     return res.status(400).json({ message: 'Capture failed' });
//                 }
//             } else if (status === "not completed") {
//                 // Cancel and release hold
//                 const paymentIntent = await stripe.paymentIntents.cancel(task.paymentIntentId);
//                 if (paymentIntent.status === 'canceled') {
//                     task.stripeStatus = 'canceled';
//                     stripeActionMsg = 'Funds released (no charge).';
//                 } else {
//                     return res.status(400).json({ message: 'Cancellation failed' });
//                 }
//             }
//         }

//         await task.save();

//         // Create notification...
//         try {
//             const tasker = await User.findById(task.acceptedBy?._id).select("firstName lastName");
//             await createNotification(
//                 task.acceptedBy?._id,
//                 "Task Status Updated",
//                 `Client has updated "${task.taskTitle}" to "${status}" (from ${previousStatus}). ${stripeActionMsg}`,
//                 "status-updated",
//                 task._id
//             );
//             console.log("Notification created for status update");
//         } catch (notifErr) {
//             console.error("Failed to create notification (non-blocking):", notifErr);
//         }

//         res.status(200).json({ message: `Task marked as ${status}`, task });
//     } catch (error) {
//         console.error("Error updating task status:", error);
//         res.status(500).json({ error: "Failed to update status", details: error.message });
//     }
// };


export const updateTaskStatusByClient = async (req, res) => {
    try {
        const { taskId } = req.params;
        const { status } = req.body;

        if (!["completed", "not completed"].includes(status)) {
            return res.status(400).json({ error: "Invalid status value" });
        }

        const task = await Task.findById(taskId).populate('acceptedBy');
        if (!task) return res.status(404).json({ error: "Task not found" });

        // Verify the client is the task owner
        if (task.client.toString() !== req.user.id) {
            return res.status(403).json({ error: "You are not authorized to update this task status" });
        }

        const previousStatus = task.status;
        task.status = status;

        let stripeActionMsg = '';
        let paymentAmount = task.totalAmount ? (task.totalAmount / 100).toFixed(2) : '0.00';

        if (task.paymentIntentId) {
            if (status === "completed") {
                // Capture full amount
                const paymentIntent = await stripe.paymentIntents.capture(task.paymentIntentId);
                if (paymentIntent.status === 'succeeded') {
                    task.stripeStatus = 'captured';
                    stripeActionMsg = `Payment of $${paymentAmount} has been captured and will be transferred to your account.`;
                } else {
                    return res.status(400).json({ message: 'Capture failed' });
                }
            } else if (status === "not completed") {
                // Cancel and release hold
                const paymentIntent = await stripe.paymentIntents.cancel(task.paymentIntentId);
                if (paymentIntent.status === 'canceled') {
                    task.stripeStatus = 'canceled';
                    stripeActionMsg = 'The payment hold has been canceled and funds released.';
                } else {
                    return res.status(400).json({ message: 'Cancellation failed' });
                }
            }
        }

        await task.save();

        // FIX: Get client details from database
        const client = await User.findById(req.user.id).select("firstName lastName");
        const clientName = client
            ? `${client.firstName} ${client.lastName}`
            : "The client";

        // Get tasker ID safely
        const taskerId = task.acceptedBy?._id || task.acceptedBy;

        // Create notification for tasker based on status
        try {
            if (taskerId) {
                // Debug: Log notification details
                console.log("Creating status update notification:", {
                    taskerId,
                    clientName,
                    status,
                    previousStatus,
                    taskTitle: task.taskTitle,
                    stripeActionMsg
                });

                if (status === "completed") {
                    // Task completed - positive notification 🎉
                    await createNotification(
                        taskerId,
                        "🎉 Task Completed Successfully!",
                        `Great news! ${clientName} has approved your work for "${task.taskTitle}". ${stripeActionMsg}`,
                        "task-completed",
                        task._id
                    );
                    console.log("✅ Task completed notification sent to tasker");

                } else if (status === "not completed") {
                    // Task not completed - rejection notification
                    await createNotification(
                        taskerId,
                        "Task Marked as Not Completed",
                        `${clientName} has marked "${task.taskTitle}" as not completed. ${stripeActionMsg} Please contact the client for more details.`,
                        "completion-declined",
                        task._id
                    );
                    console.log("✅ Completion declined notification sent to tasker");
                }
            } else {
                console.error("No tasker ID found for notification");
            }
        } catch (notifErr) {
            console.error("❌ Failed to create tasker notification (non-blocking):", notifErr);
        }

        // Send confirmation notification to client
        try {
            let clientConfirmationMsg = "";
            let clientConfirmationTitle = "";

            if (status === "completed") {
                clientConfirmationTitle = "Task Approved Successfully";
                clientConfirmationMsg = `You have approved the completion of "${task.taskTitle}". Payment of $${paymentAmount} has been processed.`;
            } else {
                clientConfirmationTitle = "Task Marked as Incomplete";
                clientConfirmationMsg = `You have marked "${task.taskTitle}" as not completed. ${stripeActionMsg} The task has been updated.`;
            }

            await createNotification(
                req.user.id, // Client ID
                clientConfirmationTitle,
                clientConfirmationMsg,
                "status-update-confirmed",
                task._id
            );
            console.log("✅ Confirmation notification sent to client");

        } catch (notifErr) {
            console.error("❌ Failed to create client confirmation notification:", notifErr);
        }

        // Optional: If task completed, prompt client to leave a review
        if (status === "completed") {
            try {
                await createNotification(
                    req.user.id, // Client ID
                    "Leave a Review",
                    `How was your experience with the tasker for "${task.taskTitle}"? Leave a review to help others!`,
                    "review-prompt",
                    task._id
                );
                console.log("✅ Review prompt notification sent to client");

            } catch (notifErr) {
                console.error("❌ Failed to create review prompt notification:", notifErr);
            }
        }

        res.status(200).json({ message: `Task marked as ${status}`, task });
    } catch (error) {
        console.error("Error updating task status:", error);
        res.status(500).json({ error: "Failed to update status", details: error.message });
    }
};

// code of update messages 

export const updateMessage = async (req, res) => {
    try {
        const { taskId, messageId } = req.params;
        const { message } = req.body;
        const userId = req.user.id;

        if (!message || message.trim() === "") {
            return res.status(400).json({ error: "Message cannot be empty" });
        }

        const task = await Task.findById(taskId);
        if (!task) return res.status(404).json({ error: "Task not found" });

        const msg = task.messages.id(messageId);
        if (!msg) return res.status(404).json({ error: "Message not found" });

        // Only sender can edit their message
        if (msg.sender.toString() !== userId) {
            return res.status(403).json({ error: "You can only edit your own messages" });
        }

        // Optional: Don't allow editing after 15 minutes
        const timeDiff = (Date.now() - msg.createdAt) / (1000 * 60);
        if (timeDiff > 15) {
            return res.status(400).json({ error: "You can no longer edit this message" });
        }

        msg.message = message.trim();
        msg.edited = true; // optional flag if you want to show "edited"

        await task.save();

        res.status(200).json({ message: "Message updated", updatedMessage: msg });
    } catch (error) {
        console.error("Error updating message:", error);
        res.status(500).json({ error: "Failed to update message" });
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
// export const deleteTask = async (req, res) => {
//     try {
//         const taskId = req.params.id;
//         const task = await Task.findById(taskId);
//         if (!task) return res.status(404).json({ error: "Task not found" });
//         if (task.client.toString() !== req.user.id) {
//             return res.status(403).json({ error: "Unauthorized to delete this task" });
//         }

//         const deletedTask = await Task.findByIdAndDelete(taskId);

//         // Create notification for the tasker (if assigned) - non-blocking
//         if (task.acceptedBy) { // Only if a tasker was assigned
//             try {
//                 const client = await User.findById(req.user.id).select("firstName lastName");
//                 await createNotification(
//                     task.acceptedBy, // Tasker ID
//                     "Task Deleted",
//                     `Client "${client.firstName} ${client.lastName}" has deleted "${task.taskTitle}".`,
//                     "task-deleted",
//                     taskId // Link to task (even if deleted)
//                 );
//                 console.log("Notification created for task deletion"); // Debug
//             } catch (notifErr) {
//                 console.error("Failed to create notification (non-blocking):", notifErr); // Log but don't crash
//             }
//         }

//         res.status(200).json({ message: "Task deleted successfully" });
//     } catch (error) {
//         console.error("Error deleting task:", error);
//         res.status(500).json({ error: "Failed to delete task", details: error.message });
//     }
// };

export const deleteTask = async (req, res) => {
    try {
        const taskId = req.params.id;
        const task = await Task.findById(taskId);
        if (!task) return res.status(404).json({ error: "Task not found" });

        if (task.client.toString() !== req.user.id) {
            return res.status(403).json({ error: "Unauthorized to delete this task" });
        }

        // Store task details before deletion for notifications
        const taskTitle = task.taskTitle;
        const taskAcceptedBy = task.acceptedBy;
        const taskBids = task.bids || [];

        // FIX: Cancel payment hold if exists before deleting
        if (task.paymentIntentId && task.stripeStatus === 'authorized') {
            try {
                await stripe.paymentIntents.cancel(task.paymentIntentId);
                console.log("✅ Payment hold canceled for deleted task");
            } catch (stripeErr) {
                console.error("❌ Failed to cancel payment hold:", stripeErr);
                // Continue with deletion even if stripe fails
            }
        }

        // Delete the task
        await Task.findByIdAndDelete(taskId);

        // FIX: Get client details from database
        const client = await User.findById(req.user.id).select("firstName lastName");
        const clientName = client
            ? `${client.firstName} ${client.lastName}`
            : "The client";

        // Create notification for the assigned tasker (if exists)
        if (taskAcceptedBy) {
            try {
                // Debug: Log notification details
                console.log("Creating task deleted notification for assigned tasker:", {
                    taskerId: taskAcceptedBy,
                    clientName,
                    taskTitle
                });

                await createNotification(
                    taskAcceptedBy, // Tasker ID
                    "Task Has Been Deleted",
                    `${clientName} has deleted the task "${taskTitle}" that was assigned to you. Any payment hold has been released. We apologize for the inconvenience.`,
                    "task-deleted",
                    taskId
                );
                console.log("✅ Notification created for assigned tasker - task deleted");

            } catch (notifErr) {
                console.error("❌ Failed to create tasker notification (non-blocking):", notifErr);
            }
        }

        // Notify all bidders that the task has been deleted
        try {
            if (taskBids.length > 0) {
                // Get unique tasker IDs from bids (excluding the assigned tasker if any)
                const bidderIds = [...new Set(
                    taskBids
                        .map(bid => bid.taskerId.toString())
                        .filter(id => id !== (taskAcceptedBy ? taskAcceptedBy.toString() : ''))
                )];

                console.log("Notifying bidders about task deletion:", bidderIds);

                for (const bidderId of bidderIds) {
                    await createNotification(
                        bidderId,
                        "Task Deleted",
                        `The task "${taskTitle}" that you bid on has been deleted by the client. Keep looking for other opportunities!`,
                        "task-deleted-bidder",
                        taskId
                    );
                }
                console.log(`✅ Notified ${bidderIds.length} bidders about task deletion`);
            }
        } catch (notifErr) {
            console.error("❌ Failed to notify bidders (non-blocking):", notifErr);
        }

        // Send confirmation notification to client
        try {
            await createNotification(
                req.user.id, // Client ID
                "Task Deleted Successfully",
                `Your task "${taskTitle}" has been deleted successfully.${task.paymentIntentId ? ' Any payment hold has been released.' : ''}`,
                "task-delete-confirmed",
                taskId
            );
            console.log("✅ Confirmation notification sent to client");

        } catch (notifErr) {
            console.error("❌ Failed to create client confirmation notification:", notifErr);
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


// code of delete messages 
export const deleteMessage = async (req, res) => {
    try {
        const { taskId, messageId } = req.params;
        const userId = req.user.id;

        const task = await Task.findById(taskId);
        if (!task) return res.status(404).json({ error: "Task not found" });

        const msgIndex = task.messages.findIndex(m => m._id.toString() === messageId);
        if (msgIndex === -1) return res.status(404).json({ error: "Message not found" });

        const message = task.messages[msgIndex];

        // Only sender can delete
        if (message.sender.toString() !== userId) {
            return res.status(403).json({ error: "You can only delete your own messages" });
        }

        // Option 1: Soft delete (recommended)
        message.isDeleted = true;
        message.message = "[This message was deleted]";
        message.isRead = true;

        // Option 2: Hard delete (uncomment if preferred)
        // task.messages.splice(msgIndex, 1);

        await task.save();

        res.status(200).json({ message: "Message deleted successfully" });
    } catch (error) {
        console.error("Error deleting message:", error);
        res.status(500).json({ error: "Failed to delete message" });
    }
};