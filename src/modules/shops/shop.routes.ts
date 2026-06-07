import { Router } from 'express';
import { ShopController } from './shop.controller';
import { authenticate, authorize } from '../../common/middleware/auth.middleware';

const router = Router();
const shopController = new ShopController();

router.post('/', authenticate, authorize(['SELLER']), shopController.createShop);
router.get('/me', authenticate, authorize(['SELLER']), shopController.getMyShop);

export default router;
