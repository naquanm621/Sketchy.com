import prisma from '../../common/database/prisma';
import { CreateShopDto } from './shop.dto';

export class ShopService {
  async createShop(ownerId: string, data: CreateShopDto) {
    // Check if user already has a shop
    const existingShop = await prisma.shop.findUnique({
      where: { ownerId },
    });

    if (existingShop) {
      throw new Error('User already has a shop');
    }

    return prisma.shop.create({
      data: {
        ...data,
        ownerId,
      },
    });
  }

  async getShopByOwner(ownerId: string) {
    return prisma.shop.findUnique({
      where: { ownerId },
      include: { products: true },
    });
  }
}
