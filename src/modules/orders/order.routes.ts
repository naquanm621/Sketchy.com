import { Router } from 'express';
import { OrderController } from './order.controller';
import { authenticate, authorize } from '../../common/middleware/auth.middleware';

const router = Router();
const orderController = new OrderController();

router.post('/checkout', authenticate, authorize(['BUYER']), orderController.checkout);
router.get('/my-orders', authenticate, authorize(['BUYER']), orderController.getMyOrders);
router.get('/:id', authenticate, authorize(['BUYER']), orderController.getOrder);

export default router;
