import prisma from '../../common/database/prisma';
import { CreateProductDto, UpdateProductDto } from '../shops/shop.dto';

export class ProductService {
  async createProduct(ownerId: string, data: CreateProductDto) {
    const shop = await prisma.shop.findUnique({
      where: { ownerId },
    });

    if (!shop) {
      throw new Error('User does not have a shop. Create a shop first.');
    }

    return prisma.product.create({
      data: {
        ...data,
        shopId: shop.id,
      },
    });
  }

  async getMyProducts(ownerId: string) {
    const shop = await prisma.shop.findUnique({
      where: { ownerId },
    });

    if (!shop) {
      return [];
    }

    return prisma.product.findMany({
      where: { shopId: shop.id },
    });
  }

  async updateProduct(ownerId: string, productId: string, data: UpdateProductDto) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { shop: true },
    });

    if (!product || product.shop.ownerId !== ownerId) {
      throw new Error('Product not found or unauthorized');
    }

    return prisma.product.update({
      where: { id: productId },
      data,
    });
  }

  async deleteProduct(ownerId: string, productId: string) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { shop: true },
    });

    if (!product || product.shop.ownerId !== ownerId) {
      throw new Error('Product not found or unauthorized');
    }

    return prisma.product.delete({
      where: { id: productId },
    });
  }

  async getAllProducts(filters?: { keyword?: string }) {
    return prisma.product.findMany({
      where: filters?.keyword ? {
        OR: [
          { name: { contains: filters.keyword, mode: 'insensitive' } },
          { description: { contains: filters.keyword, mode: 'insensitive' } },
        ],
      } : {},
      include: { shop: { select: { name: true } } },
    });
  }
}
