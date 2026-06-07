import { Response } from 'express';
import { AuthRequest } from '../../common/middleware/auth.middleware';
import { ShopService } from './shop.service';

const shopService = new ShopService();

export class ShopController {
  async createShop(req: AuthRequest, res: Response) {
    try {
      const ownerId = req.user!.id;
      const shop = await shopService.createShop(ownerId, req.body);
      res.status(201).json(shop);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  async getMyShop(req: AuthRequest, res: Response) {
    try {
      const ownerId = req.user!.id;
      const shop = await shopService.getShopByOwner(ownerId);
      if (!shop) {
        return res.status(404).json({ message: 'Shop not found' });
      }
      res.status(200).json(shop);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }
}
