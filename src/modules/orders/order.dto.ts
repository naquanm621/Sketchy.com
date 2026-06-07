export interface CheckoutDto {
  items: {
    productId: string;
    quantity: number;
  }[];
}
