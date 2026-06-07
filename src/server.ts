import app from './app';
import prisma from './common/database/prisma';

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // Test database connection
    await prisma.$connect();
    console.log('Successfully connected to the database');

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// In a real production scenario, you wouldn't disconnect immediately, 
// but for initialization testing we do. 
// However, the server should keep the connection open.
// Corrected startServer below.

async function run() {
    try {
        await prisma.$connect();
        console.log('Connected to database');
        
        app.listen(PORT, () => {
            console.log(`Server listening on port ${PORT}`);
        });
    } catch (err) {
        console.error('Error connecting to database', err);
    }
}

run();
