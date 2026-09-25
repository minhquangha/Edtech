import dotenv from "dotenv";
dotenv.config();

import bcrypt from "bcrypt";
import prisma from "@/config/prisma.js";

async function createAdmin() {
  const username = process.env.ADMIN_USERNAME || "admin";
  const password = process.env.ADMIN_PASSWORD || "Admin@123456";

  console.log(`Checking if admin account '${username}' exists...`);

  const existing = await prisma.user.findUnique({
    where: { username },
  });

  if (existing) {
    console.log(`Admin account '${username}' already exists.`);
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const admin = await prisma.user.create({
    data: {
      username,
      password: hashedPassword,
      name: "System Administrator",
      role: "TEACHER",
    },
    select: {
      id: true,
      username: true,
      role: true,
      created_at: true,
    },
  });

  console.log(`Successfully created admin account:`, admin);
}

createAdmin()
  .catch((err) => {
    console.error("Failed to create admin:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
