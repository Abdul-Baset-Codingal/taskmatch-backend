import Task from "../models/task.js";
import User from "../models/user.js";

// ✅ 1. Create a Task
export const createTask = async (req, res) => {
    try {
        const {
            serviceId,
            serviceTitle,
            taskTitle,
            taskDescription,
            location,
            schedule,
            additionalInfo,
            price,
            offerDeadline
        } = req.body;

        console.log(req.body)

        const photos = req.files?.photos?.map((file) => file.filename) || [];
        const video = req.files?.video?.[0]?.filename || null;

        const newTask = new Task({
            serviceId,
            serviceTitle,
            taskTitle,
            taskDescription,
            location,
            schedule,
            extraCharge: schedule === "Urgent",
            additionalInfo,
            offerDeadline,
            photos,
            price,
            video,
            client: req.user.id, // Save only user ID as ObjectId
        });

        await newTask.save();
        res.status(201).json({ message: "Task created successfully", task: newTask });
    } catch (error) {
        console.error("❌ Error creating task:", error);
        res.status(500).json({ error: "Failed to create task", details: error.message });
    }
};

// ✅ 2. Get All Tasks (populate client info)
export const getAllTasks = async (req, res) => {
    try {
        const tasks = await Task.find()
            .populate("client", "fullName email")
            .sort({ createdAt: -1 });
        res.status(200).json(tasks);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch tasks" });
    }
};

// ✅ 3. Get Task by ID (with bid privacy logic)
export const getTaskById = async (req, res) => {
    try {
        const task = await Task.findById(req.params.id)
            .populate("client", "fullName email")
            .populate("acceptedBy", "fullName email profilePicture phone")
            .populate("bids.taskerId", "fullName email profilePicture phone")
            .populate("comments.userId", "fullName email profilePicture phone")
            .populate("comments.replies.userId", "fullName email");

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

// ✅ 4. Get Tasks by User (Client)
export const getTasksByClient = async (req, res) => {
    try {
        const clientId = req.user.id;
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
            .populate("client", "fullName email")
            .sort({ createdAt: -1 });

        res.status(200).json(urgentTasks);
    } catch (error) {
        console.error("❌ Failed to fetch urgent tasks:", error);
        res.status(500).json({ error: "Failed to fetch urgent tasks" });
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
            .populate("client", "fullName email")
            .populate("acceptedBy", "fullName email")
            .sort({ createdAt: -1 });

        res.status(200).json(tasks);
    } catch (error) {
        console.error("❌ Failed to fetch tasks by status:", error);
        res.status(500).json({ error: "Failed to fetch tasks", details: error.message });
    }
};

// ✅ Get Tasks excluding a Status
export const getTasksExcludingStatus = async (req, res) => {
    try {
        const { excludeStatus } = req.query;
        const query = {};

        if (excludeStatus) {
            query.status = { $ne: excludeStatus.toLowerCase() };
        }

        const tasks = await Task.find(query)
            .populate("client", "fullName email")
            .sort({ createdAt: -1 });
        res.status(200).json(tasks);
    } catch (error) {
        console.error("❌ Failed to fetch filtered tasks:", error);
        res.status(500).json({ error: "Failed to fetch tasks", details: error.message });
    }
};

// ✅ 6. Add Bid to Task
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

        res.status(200).json({ message: "Bid added successfully", task: updatedTask });
    } catch (error) {
        res.status(500).json({ error: "Failed to add bid", details: error.message });
    }
};

export const addCommentToTask = async (req, res) => {
    try {
        const taskId = req.params.id;
        const userId = req.user.id;
        const { message } = req.body;

        if (!message || message.trim() === "") {
            return res.status(400).json({ error: "Comment message cannot be empty" });
        }

        // Assuming your auth middleware sets the role on req.user
        const userRole = req.user.role; // should be "tasker" or "client"

        if (!["tasker", "client"].includes(userRole)) {
            return res.status(400).json({ error: "Invalid user role" });
        }

        const newComment = {
            userId,
            role: userRole,
            message: message.trim(),
            createdAt: new Date(),
            replies: [],
        };

        const task = await Task.findById(taskId);
        if (!task) return res.status(404).json({ error: "Task not found" });

        task.comments.push(newComment);
        await task.save();

        // Optionally, populate user info for response (if needed)
        const populatedTask = await Task.findById(taskId)
            .populate("comments.userId", "fullName email")
            .populate("comments.replies.userId", "fullName email");

        res.status(201).json({ message: "Comment added successfully", task: populatedTask });
    } catch (error) {
        console.error("Error adding comment:", error);
        res.status(500).json({ error: "Failed to add comment", details: error.message });
    }
};
// ✅ 7. Accept Task
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

        res.status(200).json({ message: "Task accepted successfully", task });
    } catch (error) {
        res.status(500).json({ error: "Failed to accept task", details: error.message });
    }
};

// ✅ Tasker requests to mark as completed
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

        res.status(200).json({ message: "Completion requested", task });
    } catch (error) {
        res.status(500).json({ error: "Failed to request completion", details: error.message });
    }
};


// PATCH /tasks/:taskId/comments/:commentId/reply
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

        res.status(200).json({ message: "Reply added", task });
    } catch (error) {
        res.status(500).json({ error: "Failed to reply", details: error.message });
    }
};

// PATCH /tasks/:taskId/status
export const updateTaskStatusByClient = async (req, res) => {
    try {
        const { taskId } = req.params;
        const { status } = req.body;

        if (!["completed", "not completed"].includes(status)) {
            return res.status(400).json({ error: "Invalid status value" });
        }

        const task = await Task.findById(taskId);
        if (!task) return res.status(404).json({ error: "Task not found" });

        task.status = status;
        await task.save();

        res.status(200).json({ message: `Task marked as ${status}`, task });
    } catch (error) {
        res.status(500).json({ error: "Failed to update status", details: error.message });
    }
};

// ✅ 8. Update Task (Only by Client)
export const updateTask = async (req, res) => {
    try {
        const taskId = req.params.id;

        const task = await Task.findById(taskId);
        if (!task) return res.status(404).json({ error: "Task not found" });

        if (task.client.toString() !== req.user.id) {
            return res.status(403).json({ error: "Unauthorized to update this task" });
        }

        const updatedTask = await Task.findByIdAndUpdate(taskId, req.body, { new: true });
        res.status(200).json({ message: "Task updated", task: updatedTask });
    } catch (error) {
        res.status(500).json({ error: "Failed to update task", details: error.message });
    }
};

// ✅ 9. Delete Task (Only by Client)
export const deleteTask = async (req, res) => {
    try {
        const taskId = req.params.id;

        const task = await Task.findById(taskId);
        if (!task) return res.status(404).json({ error: "Task not found" });

        if (task.client.toString() !== req.user.id) {
            return res.status(403).json({ error: "Unauthorized to delete this task" });
        }

        await Task.findByIdAndDelete(taskId);
        res.status(200).json({ message: "Task deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete task", details: error.message });
    }
};
