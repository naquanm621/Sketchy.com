import express, { Application, Request, Response } from 'express';
import path from 'path';
import authRoutes from './modules/auth/auth.routes';
import shopRoutes from './modules/shops/shop.routes';
import productRoutes from './modules/products/product.routes';
import orderRoutes from './modules/orders/order.routes';

const app: Application = express();

app.use(express.json());

// Serve static files from the uploads directory
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/shops', shopRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);

app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'OK', message: 'Etsy MVP API is running' });
});

export default app;
