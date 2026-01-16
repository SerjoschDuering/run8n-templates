import { PrismaClient } from '@prisma/client'
import * as wmill from 'windmill-client'

/**
 * Example Windmill script
 *
 * This script demonstrates how to:
 * 1. Get database URL from Windmill variables
 * 2. Connect to PostgreSQL via Prisma
 * 3. Query data and return it
 */
export async function main() {
  // Get database URL from Windmill variable
  const dbUrl = await wmill.getVariable('f/myapp/database_url')

  // Initialize Prisma client
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: dbUrl
      }
    }
  })

  try {
    // Example: Get all users (replace with your actual query)
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      }
    })

    return {
      success: true,
      data: users,
      count: users.length,
    }
  } finally {
    await prisma.$disconnect()
  }
}
