import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../../common/database/prisma';
import { RegisterDto, LoginDto } from './auth.dto';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key';

export class AuthService {
  async register(data: RegisterDto) {
    const hashedPassword = await bcrypt.hash(data.password, 10);
    
    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        role: data.role || 'BUYER',
      },
    });

    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async login(data: LoginDto) {
    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      throw new Error('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(data.password, user.password);
    if (!isPasswordValid) {
      throw new Error('Invalid credentials');
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    return { token, user: { id: user.id, email: user.email, role: user.role } };
  }
}
