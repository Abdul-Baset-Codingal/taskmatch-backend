// models/Blog.js
import mongoose from "mongoose";

const blogSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, "Blog title is required"],
            trim: true,
            maxlength: [200, "Title cannot exceed 200 characters"],
        },
        slug: {
            type: String,
            unique: true,
            lowercase: true,
        },
        content: {
            type: String,
            required: [true, "Blog content is required"],
        },
        excerpt: {
            type: String,
            maxlength: [500, "Excerpt cannot exceed 500 characters"],
        },
        featuredImage: {
            url: { type: String },
            publicId: { type: String }, // For cloudinary or similar
            alt: { type: String },
        },
        author: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        category: {
            type: String,
            required: [true, "Category is required"],
            enum: [
                "Tips & Tricks",
                "How-To Guides",
                "Industry News",
                "Company Updates",
                "Success Stories",
                "Tasker Spotlight",
                "Other",
            ],
        },
        tags: [
            {
                type: String,
                trim: true,
            },
        ],
        status: {
            type: String,
            enum: ["draft", "published", "archived"],
            default: "draft",
        },
        publishedAt: {
            type: Date,
        },
        views: {
            type: Number,
            default: 0,
        },
        likes: {
            type: Number,
            default: 0,
        },
        isFeatured: {
            type: Boolean,
            default: false,
        },
        metaTitle: {
            type: String,
            maxlength: [70, "Meta title cannot exceed 70 characters"],
        },
        metaDescription: {
            type: String,
            maxlength: [160, "Meta description cannot exceed 160 characters"],
        },
        readTime: {
            type: Number, // in minutes
        },
    },
    {
        timestamps: true,
    }
);

// Generate slug before saving
blogSchema.pre("save", function (next) {
    if (this.isModified("title")) {
        this.slug = this.title
            .toLowerCase()
            .replace(/[^a-zA-Z0-9 ]/g, "")
            .replace(/\s+/g, "-")
            .substring(0, 100);

        // Add timestamp to make slug unique
        this.slug = `${this.slug}-${Date.now().toString(36)}`;
    }

    // Calculate read time (average 200 words per minute)
    if (this.isModified("content")) {
        const wordCount = this.content.split(/\s+/).length;
        this.readTime = Math.ceil(wordCount / 200);
    }

    // Generate excerpt if not provided
    if (this.isModified("content") && !this.excerpt) {
        this.excerpt = this.content.replace(/<[^>]*>/g, "").substring(0, 200) + "...";
    }

    next();
});

// Index for search
blogSchema.index({ title: "text", content: "text", tags: "text" });

const Blog = mongoose.model("Blog", blogSchema);

export default Blog;