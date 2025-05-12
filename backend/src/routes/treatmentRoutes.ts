import { Router } from 'express';
const router = Router();
// Sample route to ensure router is functional
router.get('/', (req, res) => {
  res.json({ message: 'Treatment route is working' });
});
// Define treatment routes here
export default router;
