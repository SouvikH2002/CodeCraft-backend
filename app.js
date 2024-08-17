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
function addUserToRoom(socket, userData, roomID, idx) {
  if (rooms[idx]) {
    rooms[idx].users.push({ socketID: socket.id, userData, roomID: roomID })
  }
}
function removeUserFromRoom(socket, roomID) {
  if (rooms[roomID]) {
    const index = rooms[roomID].users.findIndex(
      (user) => user.socketID === socket.id
    )

    if (index !== -1) {
      rooms[roomID].users.splice(index, 1)
    }

    if (
      rooms[roomID].creator === socket.id ||
      rooms[roomID].users.length === 0
    ) {
      delete rooms[roomID]
    }
  }
}
io.on('connection', (socket) => {
  socket.on('joinGroup', (m) => {
    // if (!rooms[m.userData.user.clerkId]) {
    //   rooms[m.userData.user.clerkId] = {
    //     creator: socket.id,
    //   }
    //   console.log('new owner created')
    //   console.log(rooms)
    //   socket.join(m.roomID)
    // } else {
    //   console.log('targeting owner')
    //   console.log(rooms[m.roomID])
    //   io.to(rooms[m.roomID].creator).emit('allowPermission',socket.id)
    //   io.to(rooms[m.roomID].creator).emit('getCurrData')
    // }

    // console.log('joined')
    // console.log(m)
    // socket.join(m.roomID)

    // const room = io.sockets.adapter.rooms.get(m.roomID)
    // const numClients = room ? room.size : 0
    // console.log(numClients)
    // socket.to(m.roomID).emit('joinGroup', { length: numClients, userData:m.userData })
    socket.roomID = m.roomID

    let idx = m.roomID
    if (!rooms[idx]) {
      rooms[idx] = {
        creator: { clrkID: m.userData.user.clerkId, socketID: socket.id },
        users: [
          { socketID: socket.id, userData: m.userData, roomID: m.roomID },
        ],
      }
    } else {
      addUserToRoom(socket, m.userData, m.roomID, idx)
      io.to(rooms[idx].creator.socketID).emit('getCurrData')
    }
    socket.join(m.roomID)
    io.to(m.roomID).emit('joinGroup', {
      length: rooms[idx].users.length,
      userData: rooms[idx],
    })
    console.log(rooms)
  })
  // socket.on('getCurrData',()=>{

  // })
  socket.on('generateRoomRequest', (m) => {
    socket.emit('generateRoomRequest', { roomID: socket.id })
  })
  socket.on('sendSignal', (m) => {
    const room = io.sockets.adapter.rooms.get(m.roomID)
    const numClients = room ? room.size : 0
    socket.to(m.roomID).emit('getResponse', {
      value: m.value,
      position: m.position,
      id: socket.id,
      userData: m.userData,
    })
  })
  socket.on('disconnect', () => {
    const roomID = socket.roomID
    console.log(roomID)
    removeUserFromRoom(socket, roomID)

    if(rooms[roomID]){
      io.to(roomID).emit('joinGroup', {
        length: rooms[roomID].users.length,
        userData: rooms[roomID],
      })
    }
    console.log('leaving')
    console.log(roomID)
    console.log(rooms)
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
