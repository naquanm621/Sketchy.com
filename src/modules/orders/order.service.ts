import prisma from '../../common/database/prisma';
import { CheckoutDto } from './order.dto';

export class OrderService {
  async checkout(buyerId: string, data: CheckoutDto) {
    return await prisma.$transaction(async (tx) => {
      let total = 0;
      const orderItemsData = [];

      for (const item of data.items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
        });

        if (!product) {
          throw new Error(`Product with ID ${item.productId} not found`);
        }

        if (product.stock < item.quantity) {
          throw new Error(`Insufficient stock for product: ${product.name}`);
        }

        // Decrement stock
        await tx.product.update({
          where: { id: product.id },
          data: { stock: product.stock - item.quantity },
        });

        const itemTotal = Number(product.price) * item.quantity;
        total += itemTotal;

        orderItemsData.push({
          productId: product.id,
          quantity: item.quantity,
          priceAtPurchase: product.price,
        });
      }

      // Create Order
      const order = await tx.order.create({
        data: {
          buyerId,
          total,
          items: {
            create: orderItemsData,
          },
        },
        include: {
          items: {
            include: {
              product: {
                select: { name: true }
              }
            }
          },
        },
      });

      return order;
    });
  }

  async getMyOrders(buyerId: string) {
    return prisma.order.findMany({
      where: { buyerId },
      include: {
        items: {
          include: {
            product: {
              select: { name: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOrderById(buyerId: string, orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: {
              select: { name: true }
            }
          }
        }
      },
    });

    if (!order || order.buyerId !== buyerId) {
      throw new Error('Order not found');
    }

    return order;
  }
}
