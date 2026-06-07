import { PrismaClient } from '@prisma/client';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import prisma from '../../../common/database/prisma';
import { OrderService } from '../order.service';
import { Decimal } from '@prisma/client/runtime/library';

jest.mock('../../../common/database/prisma', () => ({
  __esModule: true,
  default: mockDeep<PrismaClient>(),
}));

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
const orderService = new OrderService();

describe('OrderService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should process checkout and decrement stock', async () => {
    const buyerId = 'buyer-1';
    const checkoutData = {
      items: [{ productId: 'prod-1', quantity: 2 }]
    };

    const mockProduct = {
      id: 'prod-1',
      name: 'Test Product',
      description: 'Desc',
      price: new Decimal(100),
      stock: 10,
      imageUrl: null,
      shopId: 'shop-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    prismaMock.$transaction.mockImplementation(async (callback) => {
      return callback(prismaMock);
    });

    prismaMock.product.findUnique.mockResolvedValue(mockProduct);
    prismaMock.product.update.mockResolvedValue({ ...mockProduct, stock: 8 });
    
    const mockOrder = {
      id: 'order-1',
      buyerId,
      status: 'PENDING' as const,
      total: new Decimal(200),
      createdAt: new Date(),
      updatedAt: new Date(),
      items: [
        {
          id: 'item-1',
          orderId: 'order-1',
          productId: 'prod-1',
          quantity: 2,
          priceAtPurchase: new Decimal(100),
        }
      ]
    };

    prismaMock.order.create.mockResolvedValue(mockOrder as any);

    const result = await orderService.checkout(buyerId, checkoutData);

    expect(result.id).toBe('order-1');
    expect(prismaMock.product.update).toHaveBeenCalledWith({
      where: { id: 'prod-1' },
      data: { stock: 8 },
    });
  });

  it('should throw error if insufficient stock', async () => {
    const buyerId = 'buyer-1';
    const checkoutData = {
      items: [{ productId: 'prod-1', quantity: 20 }]
    };

    const mockProduct = {
      id: 'prod-1',
      name: 'Test Product',
      description: 'Desc',
      price: new Decimal(100),
      stock: 10,
      imageUrl: null,
      shopId: 'shop-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    prismaMock.$transaction.mockImplementation(async (callback) => {
      return callback(prismaMock);
    });

    prismaMock.product.findUnique.mockResolvedValue(mockProduct);

    await expect(orderService.checkout(buyerId, checkoutData)).rejects.toThrow('Insufficient stock for product: Test Product');
  });
});
