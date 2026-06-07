import { Router } from 'express';
import { ProductController } from './product.controller';
import { authenticate, authorize } from '../../common/middleware/auth.middleware';
import { upload } from '../../common/middleware/upload.middleware';

const router = Router();
const productController = new ProductController();

// Discovery (Public)
router.get('/', productController.getAllProducts);

// Management (Seller Only)
router.post('/', authenticate, authorize(['SELLER']), upload.single('image'), productController.createProduct);
router.get('/my-products', authenticate, authorize(['SELLER']), productController.getMyProducts);
router.patch('/:id', authenticate, authorize(['SELLER']), upload.single('image'), productController.updateProduct);
router.delete('/:id', authenticate, authorize(['SELLER']), productController.deleteProduct);

export default router;
