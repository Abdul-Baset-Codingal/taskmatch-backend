// controllers/blogController.js
import Blog from "../models/Blog.js";
import mongoose from "mongoose";

// ==========================================
// CREATE BLOG
// ==========================================
export const createBlog = async (req, res) => {
    try {
        const {
            title,
            content,
            excerpt,
            featuredImage,
            category,
            tags,
            status,
            isFeatured,
            metaTitle,
            metaDescription,
        } = req.body;

        // Validate required fields
        if (!title || !content || !category) {
            return res.status(400).json({
                success: false,
                message: "Title, content, and category are required",
            });
        }

        const blogData = {
            title,
            content,
            excerpt,
            featuredImage,
            category,
            tags: tags || [],
            status: status || "draft",
            isFeatured: isFeatured || false,
            metaTitle: metaTitle || title,
            metaDescription: metaDescription || excerpt,
            author: req.user._id, // Assuming auth middleware sets req.user
        };

        // Set publishedAt if status is published
        if (status === "published") {
            blogData.publishedAt = new Date();
        }

        const blog = await Blog.create(blogData);

        res.status(201).json({
            success: true,
            message: "Blog created successfully",
            data: blog,
        });
    } catch (error) {
        console.error("Create blog error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create blog",
            error: error.message,
        });
    }
};

// ==========================================
// GET ALL BLOGS (Admin)
// ==========================================
export const getAllBlogs = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            status,
            category,
            search,
            sortBy = "createdAt",
            sortOrder = "desc",
            isFeatured,
        } = req.query;

        const query = {};

        // Filter by status
        if (status) {
            query.status = status;
        }

        // Filter by category
        if (category) {
            query.category = category;
        }

        // Filter by featured
        if (isFeatured !== undefined) {
            query.isFeatured = isFeatured === "true";
        }

        // Search
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: "i" } },
                { content: { $regex: search, $options: "i" } },
                { tags: { $in: [new RegExp(search, "i")] } },
            ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const sortOptions = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

        const [blogs, totalCount] = await Promise.all([
            Blog.find(query)
                .populate("author", "name email avatar")
                .sort(sortOptions)
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            Blog.countDocuments(query),
        ]);

        res.status(200).json({
            success: true,
            data: blogs,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalCount / parseInt(limit)),
                totalBlogs: totalCount,
                hasMore: skip + blogs.length < totalCount,
            },
        });
    } catch (error) {
        console.error("Get all blogs error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch blogs",
            error: error.message,
        });
    }
};

// ==========================================
// GET PUBLISHED BLOGS (Public)
// ==========================================
export const getPublishedBlogs = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            category,
            tag,
            search,
            sortBy = "publishedAt",
            sortOrder = "desc",
        } = req.query;

        const query = { status: "published" };

        if (category) {
            query.category = category;
        }

        if (tag) {
            query.tags = { $in: [tag] };
        }

        if (search) {
            query.$text = { $search: search };
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const sortOptions = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

        const [blogs, totalCount] = await Promise.all([
            Blog.find(query)
                .populate("author", "name avatar")
                .select("-metaTitle -metaDescription")
                .sort(sortOptions)
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            Blog.countDocuments(query),
        ]);

        res.status(200).json({
            success: true,
            data: blogs,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalCount / parseInt(limit)),
                totalBlogs: totalCount,
                hasMore: skip + blogs.length < totalCount,
            },
        });
    } catch (error) {
        console.error("Get published blogs error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch blogs",
            error: error.message,
        });
    }
};

// ==========================================
// GET SINGLE BLOG BY ID (Admin)
// ==========================================
export const getBlogById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid blog ID",
            });
        }

        const blog = await Blog.findById(id)
            .populate("author", "name email avatar")
            .lean();

        if (!blog) {
            return res.status(404).json({
                success: false,
                message: "Blog not found",
            });
        }

        res.status(200).json({
            success: true,
            data: blog,
        });
    } catch (error) {
        console.error("Get blog by ID error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch blog",
            error: error.message,
        });
    }
};

// ==========================================
// GET SINGLE BLOG BY SLUG (Public)
// ==========================================
export const getBlogBySlug = async (req, res) => {
    try {
        const { slug } = req.params;

        const blog = await Blog.findOneAndUpdate(
            { slug, status: "published" },
            { $inc: { views: 1 } }, // Increment views
            { new: true }
        )
            .populate("author", "name avatar")
            .lean();

        if (!blog) {
            return res.status(404).json({
                success: false,
                message: "Blog not found",
            });
        }

        // Get related blogs
        const relatedBlogs = await Blog.find({
            _id: { $ne: blog._id },
            status: "published",
            $or: [
                { category: blog.category },
                { tags: { $in: blog.tags } },
            ],
        })
            .select("title slug featuredImage excerpt publishedAt readTime")
            .limit(3)
            .lean();

        res.status(200).json({
            success: true,
            data: blog,
            relatedBlogs,
        });
    } catch (error) {
        console.error("Get blog by slug error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch blog",
            error: error.message,
        });
    }
};

// ==========================================
// UPDATE BLOG
// ==========================================
export const updateBlog = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid blog ID",
            });
        }

        const existingBlog = await Blog.findById(id);

        if (!existingBlog) {
            return res.status(404).json({
                success: false,
                message: "Blog not found",
            });
        }

        // Handle status change to published
        if (updateData.status === "published" && existingBlog.status !== "published") {
            updateData.publishedAt = new Date();
        }

        // Update slug if title is changed
        if (updateData.title && updateData.title !== existingBlog.title) {
            updateData.slug = updateData.title
                .toLowerCase()
                .replace(/[^a-zA-Z0-9 ]/g, "")
                .replace(/\s+/g, "-")
                .substring(0, 100) + `-${Date.now().toString(36)}`;
        }

        // Recalculate read time if content changes
        if (updateData.content) {
            const wordCount = updateData.content.split(/\s+/).length;
            updateData.readTime = Math.ceil(wordCount / 200);
        }

        const updatedBlog = await Blog.findByIdAndUpdate(
            id,
            { $set: updateData },
            { new: true, runValidators: true }
        ).populate("author", "name email avatar");

        res.status(200).json({
            success: true,
            message: "Blog updated successfully",
            data: updatedBlog,
        });
    } catch (error) {
        console.error("Update blog error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update blog",
            error: error.message,
        });
    }
};

// ==========================================
// DELETE BLOG
// ==========================================
export const deleteBlog = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid blog ID",
            });
        }

        const blog = await Blog.findByIdAndDelete(id);

        if (!blog) {
            return res.status(404).json({
                success: false,
                message: "Blog not found",
            });
        }

        res.status(200).json({
            success: true,
            message: "Blog deleted successfully",
        });
    } catch (error) {
        console.error("Delete blog error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete blog",
            error: error.message,
        });
    }
};

// ==========================================
// TOGGLE BLOG STATUS
// ==========================================
export const toggleBlogStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!["draft", "published", "archived"].includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid status. Must be draft, published, or archived",
            });
        }

        const updateData = { status };

        // Set publishedAt when publishing
        if (status === "published") {
            const blog = await Blog.findById(id);
            if (!blog.publishedAt) {
                updateData.publishedAt = new Date();
            }
        }

        const updatedBlog = await Blog.findByIdAndUpdate(
            id,
            { $set: updateData },
            { new: true }
        );

        if (!updatedBlog) {
            return res.status(404).json({
                success: false,
                message: "Blog not found",
            });
        }

        res.status(200).json({
            success: true,
            message: `Blog ${status} successfully`,
            data: updatedBlog,
        });
    } catch (error) {
        console.error("Toggle blog status error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update blog status",
            error: error.message,
        });
    }
};

// ==========================================
// TOGGLE FEATURED STATUS
// ==========================================
export const toggleFeatured = async (req, res) => {
    try {
        const { id } = req.params;

        const blog = await Blog.findById(id);

        if (!blog) {
            return res.status(404).json({
                success: false,
                message: "Blog not found",
            });
        }

        blog.isFeatured = !blog.isFeatured;
        await blog.save();

        res.status(200).json({
            success: true,
            message: `Blog ${blog.isFeatured ? "featured" : "unfeatured"} successfully`,
            data: blog,
        });
    } catch (error) {
        console.error("Toggle featured error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to toggle featured status",
            error: error.message,
        });
    }
};

// ==========================================
// GET FEATURED BLOGS (Public)
// ==========================================
export const getFeaturedBlogs = async (req, res) => {
    try {
        const { limit = 5 } = req.query;

        const blogs = await Blog.find({
            status: "published",
            isFeatured: true,
        })
            .populate("author", "name avatar")
            .select("title slug excerpt featuredImage publishedAt readTime category")
            .sort({ publishedAt: -1 })
            .limit(parseInt(limit))
            .lean();

        res.status(200).json({
            success: true,
            data: blogs,
        });
    } catch (error) {
        console.error("Get featured blogs error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch featured blogs",
            error: error.message,
        });
    }
};

// ==========================================
// GET BLOG CATEGORIES
// ==========================================
export const getBlogCategories = async (req, res) => {
    try {
        const categories = await Blog.aggregate([
            { $match: { status: "published" } },
            { $group: { _id: "$category", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
        ]);

        res.status(200).json({
            success: true,
            data: categories,
        });
    } catch (error) {
        console.error("Get categories error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch categories",
            error: error.message,
        });
    }
};

// ==========================================
// GET BLOG STATS (Admin Dashboard)
// ==========================================
export const getBlogStats = async (req, res) => {
    try {
        const [stats] = await Blog.aggregate([
            {
                $facet: {
                    totalBlogs: [{ $count: "count" }],
                    byStatus: [
                        { $group: { _id: "$status", count: { $sum: 1 } } },
                    ],
                    byCategory: [
                        { $group: { _id: "$category", count: { $sum: 1 } } },
                    ],
                    totalViews: [
                        { $group: { _id: null, total: { $sum: "$views" } } },
                    ],
                    recentBlogs: [
                        { $sort: { createdAt: -1 } },
                        { $limit: 5 },
                        {
                            $project: {
                                title: 1,
                                status: 1,
                                views: 1,
                                createdAt: 1,
                            },
                        },
                    ],
                    topViewed: [
                        { $sort: { views: -1 } },
                        { $limit: 5 },
                        {
                            $project: {
                                title: 1,
                                views: 1,
                                slug: 1,
                            },
                        },
                    ],
                },
            },
        ]);

        res.status(200).json({
            success: true,
            data: {
                totalBlogs: stats.totalBlogs[0]?.count || 0,
                totalViews: stats.totalViews[0]?.total || 0,
                byStatus: stats.byStatus,
                byCategory: stats.byCategory,
                recentBlogs: stats.recentBlogs,
                topViewed: stats.topViewed,
            },
        });
    } catch (error) {
        console.error("Get blog stats error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch blog stats",
            error: error.message,
        });
    }
};

// ==========================================
// BULK DELETE BLOGS
// ==========================================
export const bulkDeleteBlogs = async (req, res) => {
    try {
        const { ids } = req.body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Please provide an array of blog IDs",
            });
        }

        const result = await Blog.deleteMany({
            _id: { $in: ids },
        });

        res.status(200).json({
            success: true,
            message: `${result.deletedCount} blogs deleted successfully`,
        });
    } catch (error) {
        console.error("Bulk delete error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete blogs",
            error: error.message,
        });
    }
};

// ==========================================
// BULK UPDATE STATUS
// ==========================================
export const bulkUpdateStatus = async (req, res) => {
    try {
        const { ids, status } = req.body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Please provide an array of blog IDs",
            });
        }

        if (!["draft", "published", "archived"].includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid status",
            });
        }

        const updateData = { status };
        if (status === "published") {
            updateData.publishedAt = new Date();
        }

        const result = await Blog.updateMany(
            { _id: { $in: ids } },
            { $set: updateData }
        );

        res.status(200).json({
            success: true,
            message: `${result.modifiedCount} blogs updated successfully`,
        });
    } catch (error) {
        console.error("Bulk update status error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update blogs",
            error: error.message,
        });
    }
};