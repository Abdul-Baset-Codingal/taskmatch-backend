// serviceController.js
import Service from "../models/service.js";

// 🔹 CREATE a new service
export const createService = async (req, res) => {
  try {
    const newService = new Service(req.body);
    console.log(req.body)
    await newService.save();
    res.status(201).json(newService);
  } catch (error) {
    res.status(400).json({ error: "Failed to create service", details: error });
  }
};

// 🟩 READ all services
export const getAllServices = async (req, res) => {
  try {
    const services = await Service.find();
    res.status(200).json(services);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch services" });
  }
};

// // 🟩 READ one service by ID
// export const getServiceById = async (req, res) => {
//   try {
//     const service = await Service.findOne({ id: req.params.id });
//     if (!service) return res.status(404).json({ error: "Service not found" });
//     res.status(200).json(service);
//   } catch (error) {
//     res.status(500).json({ error: "Failed to fetch service" });
//   }
// };


// // ✏️ UPDATE a service by ID
// export const updateService = async (req, res) => {
//   try {
//     const updated = await Service.findOneAndUpdate(
//       { id: req.params.id },
//       req.body,
//       { new: true }
//     );
//     if (!updated) return res.status(404).json({ error: "Service not found" });
//     res.status(200).json(updated);
//   } catch (error) {
//     res.status(400).json({ error: "Failed to update service", details: error });
//   }
// };

// // ❌ DELETE a service by ID
// export const deleteService = async (req, res) => {
//   try {
//     const deleted = await Service.findOneAndDelete({ id: req.params.id });
//     if (!deleted) return res.status(404).json({ error: "Service not found" });
//     res.status(200).json({ message: "Service deleted successfully" });
//   } catch (error) {
//     res.status(500).json({ error: "Failed to delete service" });
//   }
// };


// UPDATE service by ID
export const updateService = async (req, res) => {
  try {
    const updated = await Service.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ error: "Service not found" });
    res.status(200).json(updated);
  } catch (error) {
    res.status(400).json({ error: "Failed to update service", details: error });
  }
};

// DELETE service by ID
export const deleteService = async (req, res) => {
  try {
    const deleted = await Service.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Service not found" });
    res.status(200).json({ message: "Service deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete service" });
  }
};

export const getServiceById = async (req, res) => {
  try {
    const service = await Service.findById(req.params.id); // use findById
    if (!service) return res.status(404).json({ error: "Service not found" });
    res.status(200).json(service);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch service" });
  }
};