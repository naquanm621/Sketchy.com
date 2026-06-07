import { Response } from 'express';
import { AuthRequest } from '../../common/middleware/auth.middleware';
import { OrderService } from './order.service';

const orderService = new OrderService();

export class OrderController {
  async checkout(req: AuthRequest, res: Response) {
    try {
      const buyerId = req.user!.id;
      const order = await orderService.checkout(buyerId, req.body);
      res.status(201).json(order);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  async getMyOrders(req: AuthRequest, res: Response) {
    try {
      const buyerId = req.user!.id;
      const orders = await orderService.getMyOrders(buyerId);
      res.status(200).json(orders);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  async getOrder(req: AuthRequest, res: Response) {
    try {
      const buyerId = req.user!.id;
      const { id } = req.params;
      const order = await orderService.getOrderById(buyerId, id as string);
      res.status(200).json(order);
    } catch (error: any) {
      res.status(404).json({ message: error.message });
    }
  }
}
