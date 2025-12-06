import mongoose from "mongoose";
import dotenv from "dotenv";
import Zone from "./models/Zone.js"; // percorso corretto del tuo schema

dotenv.config();

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const zones = await Zone.find();
  console.log("🛰️ Zone trovate:", zones.length);
  zones.forEach((z) => {
    console.log("\n📍", z.name);
    console.log(JSON.stringify(z.coordinates, null, 2));
  });
  mongoose.disconnect();
};

run().catch((err) => console.error(err));