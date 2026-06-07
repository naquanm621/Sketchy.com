export interface CreateShopDto {
  name: string;
  description?: string;
}

export interface CreateProductDto {
  name: string;
  description?: string;
  price: number;
  stock: number;
  imageUrl?: string;
}

export interface UpdateProductDto {
  name?: string;
  description?: string;
  price?: number;
  stock?: number;
  imageUrl?: string;
}
