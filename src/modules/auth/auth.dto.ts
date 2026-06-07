export interface RegisterDto {
  email: string;
  password: string;
  role?: 'BUYER' | 'SELLER';
}

export interface LoginDto {
  email: string;
  password: string;
}
