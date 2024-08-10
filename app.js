import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { Server } from 'socket.io'
import { createServer } from 'http'
import basics from './routes/basics.js'
dotenv.config()
const port = 3001
const app = express()
const server = createServer(app)

const io = new Server(
  server,
  {
    cors: {
      origin: process.env.LIVE_CLIENT,
      methods: ['GET', 'POST'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
    },
  },
  { maxHttpBufferSize: 1e8 }
)
app.use(
  cors({
    origin: process.env.LIVE_CLIENT,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'], //
    credentials: true,
  })
)
app.use(express.json())
app.use('/api/v1', basics)
const rooms = {}
io.on('connection', (socket) => {
  socket.on('joinGroup', (m) => {
    if (!rooms[m.roomID]) {
      rooms[m.roomID] = {
        creator: socket.id,
      }
      console.log('new owner created')
      console.log(rooms)
      socket.join(m.roomID)
    } else {
      console.log('targeting owner')
      console.log(rooms[m.roomID])
      io.to(rooms[m.roomID].creator).emit('allowPermission',socket.id)
      io.to(rooms[m.roomID].creator).emit('getCurrData')
    }

    console.log('joined')
    console.log(m)
    socket.join(m.roomID)

    const room = io.sockets.adapter.rooms.get(m.roomID)
    const numClients = room ? room.size : 0
    console.log(numClients)
    socket.to(m.roomID).emit('joinGroup', { length: numClients })
  })
  // socket.on('getCurrData',()=>{

  // })
  socket.on('generateRoomRequest', (m) => {
    console.log('generating room id')
    socket.emit('generateRoomRequest', { roomID: socket.id })
  })
  socket.on('sendSignal', (m) => {
    console.log(m)
    const room = io.sockets.adapter.rooms.get(m.roomID)
    const numClients = room ? room.size : 0
    console.log(`curr room id ${m.roomID} -- ${numClients}`)
    socket
      .to(m.roomID)
      .emit('getResponse', {
        value: m.value,
        position: m.position,
        id: socket.id,
      })
  })
  socket.on('disconnect', () => {
    // If the creator leaves, remove the room's entry or handle it accordingly
    for (const roomID in rooms) {
      if (rooms[roomID].creator === socket.id) {
        delete rooms[roomID] // You might want to handle this differently
        console.log(`Creator left, room ${roomID} is now without a creator.`)
      }
    }
  })
})

const start = async () => {
  try {
    server.listen(port, () => {
      console.log(`server is listening port ${port}`)
    })
  } catch (error) {
    console.log(error)
  }
}
start()
