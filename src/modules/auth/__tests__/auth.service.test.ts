import { PrismaClient } from '@prisma/client';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import prisma from '../../../common/database/prisma';
import { AuthService } from '../auth.service';
import bcrypt from 'bcryptjs';

jest.mock('../../../common/database/prisma', () => ({
  __esModule: true,
  default: mockDeep<PrismaClient>(),
}));

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
const authService = new AuthService();

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should register a new user', async () => {
    const userData = { email: 'test@example.com', password: 'password123', role: 'BUYER' as const };
    const hashedPassword = 'hashed_password';
    
    jest.spyOn(bcrypt, 'hash').mockImplementation(() => Promise.resolve(hashedPassword));
    
    const mockUser = {
      id: '1',
      ...userData,
      password: hashedPassword,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    prismaMock.user.create.mockResolvedValue(mockUser);

    const result = await authService.register(userData);

    expect(result).not.toHaveProperty('password');
    expect(result.email).toBe(userData.email);
    expect(prismaMock.user.create).toHaveBeenCalled();
  });

  it('should login a user and return a token', async () => {
    const loginData = { email: 'test@example.com', password: 'password123' };
    const mockUser = {
      id: '1',
      email: loginData.email,
      password: 'hashed_password',
      role: 'BUYER' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    prismaMock.user.findUnique.mockResolvedValue(mockUser);
    jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));

    const result = await authService.login(loginData);

    expect(result).toHaveProperty('token');
    expect(result.user.email).toBe(loginData.email);
  });
});
