import { Request, Response } from 'express';
import { AuthRequest } from '../../common/middleware/auth.middleware';
import { ProductService } from './product.service';

const productService = new ProductService();

export class ProductController {
  async createProduct(req: AuthRequest, res: Response) {
    try {
      const ownerId = req.user!.id;
      const productData = {
        ...req.body,
        price: Number(req.body.price),
        stock: Number(req.body.stock),
        imageUrl: req.file ? `/uploads/products/${req.file.filename}` : req.body.imageUrl,
      };
      const product = await productService.createProduct(ownerId, productData);
      res.status(201).json(product);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  async getMyProducts(req: AuthRequest, res: Response) {
    try {
      const ownerId = req.user!.id;
      const products = await productService.getMyProducts(ownerId);
      res.status(200).json(products);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  async updateProduct(req: AuthRequest, res: Response) {
    try {
      const ownerId = req.user!.id;
      const { id } = req.params;
      const updateData = {
        ...req.body,
      };

      if (req.body.price) updateData.price = Number(req.body.price);
      if (req.body.stock) updateData.stock = Number(req.body.stock);
      if (req.file) updateData.imageUrl = `/uploads/products/${req.file.filename}`;

      const product = await productService.updateProduct(ownerId, id as string, updateData);
      res.status(200).json(product);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  async deleteProduct(req: AuthRequest, res: Response) {
    try {
      const ownerId = req.user!.id;
      const { id } = req.params;
      await productService.deleteProduct(ownerId, id as string);
      res.status(204).send();
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  async getAllProducts(req: Request, res: Response) {
    try {
      const { keyword } = req.query;
      const products = await productService.getAllProducts({ keyword: keyword as string });
      res.status(200).json(products);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }
}
