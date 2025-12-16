const mongoose = require("mongoose");
const Administrator = require("../Model/AdminModel");

const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb+srv://samanbandara10360_db_user:SEFKnKECYxUy9BRi@cluster0.5mrgcew.mongodb.net/counters";

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB");

  const username = "admin";
  const password = "admin123";
  const role = "admin";

  const existing = await Administrator.findOne({ username }).lean();
  if (!existing) {
    await Administrator.create({ username, password, role });
    console.log("Created admin user", { username, password, role });
  } else {
    await Administrator.updateOne({ _id: existing._id }, { $set: { password, role } });
    console.log("Updated admin user", { username, password, role });
  }

  await mongoose.disconnect();
  console.log("Done");
}

main().catch((err) => {
  console.error("Seed admin error", err);
  process.exit(1);
});
