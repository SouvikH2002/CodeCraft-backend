import express from 'express'
import { getRoomId } from '../controller/getRoomId.js'
const router = express.Router()

router.route('/getRoomId').get(getRoomId)

export default router
