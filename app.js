import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { Server } from "socket.io";
import { createServer } from "http";
import basics from "./routes/basics.js";
dotenv.config();
const port = 3001;
const app = express();
const server = createServer(app);

const io = new Server(
  server,
  {
    cors: {
      origin: "*",
      // methods: ["GET", "POST", "OPTIONS"],
      // allowedHeaders: ["Content-Type", "Authorization"],
      credentials: true,
    },
  },
  { maxHttpBufferSize: 1e8 }
);
app.use(
  cors({
    origin: "*",
    // methods: ["GET", "POST"],
    // allowedHeaders: ["Content-Type", "Authorization"], //
    credentials: true,
  })
);

app.use(express.json());
app.use("/api/v1", basics);
const rooms = {};
function addUserToRoom(socket, userData, roomID, idx) {
  if (!rooms[idx]) {
    rooms[idx] = {
      creator: { clrkID: userData.user.clerkId, socketID: socket.id },
      totalMute: 0,
      totalKeyboard: 0,
      users: [
        {
          socketID: socket.id,
          userData: userData,
          roomID: roomID,
          audioStatus: true,
          accessEditor: true,
          accessAudio: true,
        },
      ],
    };
  } else {
    // console.log(rooms)
    const foundObject = rooms[idx].users.find(
      (item) => item.clerkId === userData.user.clerkId
    );
    if (!foundObject)
      rooms[idx].users.push({
        socketID: socket.id,
        userData,
        roomID: roomID,
        audioStatus: true,
        accessEditor: true,
        accessAudio: true,
      });
    if (userData.user.clerkId === rooms[idx].creator.clrkID) {
      rooms[idx].creator.socketID = socket.id;
    }
  }
}
function removeUserFromRoom(socket, roomID) {
  if (rooms[roomID]) {
    const index = rooms[roomID].users.findIndex(
      (user) => user.socketID === socket.id
    );

    if (index !== -1) {
      rooms[roomID].users.splice(index, 1);
    }

    if (
      rooms[roomID].creator === socket.id ||
      rooms[roomID].users.length === 0
    ) {
      delete rooms[roomID];
    }
  }
}
io.on("connection", (socket) => {
  socket.on("checkForRoom", (m) => {
    let idx = m.roomID;
    socket.roomID = m.roomID;
    // console.log(rooms[idx])
    // console.log(m)
    if (
      !rooms[idx] ||
      (rooms[idx] && rooms[idx].creator.clrkID === m.userData.user.clerkId)
    ) {
      console.log("allowed");
      socket.emit("feedback", { msg: "accepted", socketID: socket.id });
    } else {
      // addUserToRoom(socket, m.userData, m.roomID, idx)

      io.to(rooms[idx].creator.socketID).emit("allowPermission", {
        userData: m.userData,
        clientSocketID: socket.id,
      });
    }
  });
  socket.on("responseFromOwner", (m) => {
    if (m.msg === "allowed") {
      socket
        .to(m.clientSocketID)
        .emit("feedback", { msg: "accepted", socketID: socket.id });
      io.to(rooms[m.roomID].creator.socketID).emit("getCurrData");
    } else {
      socket.to(m.clientSocketID).emit("feedback", { msg: "rejected" });
    }
  });
  socket.on("sendAllAudioMute", (m) => {
    rooms[m.roomID].totalMute = !m.toggleAccessAudioAll
      ? rooms[m.roomID].users.length - 1
      : 0;
    rooms[m.roomID].users.map((user, i) => {
      if (user.socketID !== rooms[m.roomID].creator.socketID) {
        user.accessAudio = m.toggleAccessAudioAll;
      }
    });
    const newUsers = rooms[m.roomID].users.filter(
      (user, i) => user.socketID !== rooms[m.roomID].creator.socketID
    );

    io.to(rooms[m.roomID].creator.socketID).emit("getAudioPermissionStatus", {
      newUsers: rooms[m.roomID],
      toggleAccessAudioAll: m.toggleAccessAudioAll,
    });
    io.to(m.roomID).emit("getAudioStatusAll", {
      newUsers,
      toggleAccessAudioAll: m.toggleAccessAudioAll,
    });
    console.log("from whole room-----------------------");
    console.log(rooms[m.roomID].totalMute);
  });
  socket.on("sendAudioStatus", (m) => {
    rooms[m.roomID].users.map((user, i) => {
      if (user.socketID === m.socketID) {
        user.audioStatus = m.toggleMicrophone;
      }
    });
    rooms[m.roomID].users.map((user, i) => {});
    io.to(m.roomID).emit("getAudioStatus", rooms[m.roomID]);
  });
  socket.on("sendEditorAccess", (m) => {
    const roomID = m.roomID;
    if (m.toggleAccessEditor === true) rooms[roomID].totalKeyboard = 0;
    else {
      rooms[roomID].totalKeyboard = rooms[roomID].users.length - 1;
    }
    const socketID = m.socketID;
    if (rooms[roomID].creator.socketID === socketID) {
      rooms[roomID].users.map((user, i) => {
        if (user.socketID !== socketID)
          user.accessEditor = m.toggleAccessEditor;
      });
    }
    io.to(m.roomID).emit("getEditorAccess", {
      users: rooms[roomID].users,
      userList: rooms[roomID],
      creator: rooms[roomID].creator.socketID,
    });
  });
  socket.on("sendSingleUserKeyboardAccess", (m) => {
    const users = rooms[m.roomID]?.users;
    users.map((user, i) => {
      if (user.socketID === m.socketID) {
        rooms[m.roomID].totalKeyboard += m.keyboardAccess ? -1 : 1;
        user.accessEditor = m.keyboardAccess;
        if (
          rooms[m.roomID].totalKeyboard ===
          rooms[m.roomID].users.length - 1
        ) {
          io.to(rooms[m.roomID].creator.socketID).emit(
            "singleUserKeyboardFull",
            { msg: "keyboardFull" }
          );
        } else {
          io.to(rooms[m.roomID].creator.socketID).emit(
            "singleUserKeyboardFull",
            { msg: "keyboardNotFull" }
          );
        }
      }
    });
    io.to(m.roomID).emit("getEditorAccess", {
      users: rooms[m.roomID].users,
      userList: rooms[m.roomID],
      creator: rooms[m.roomID].creator.socketID,
    });
  });
  socket.on("sendSingleUserAudiodAccess", (m) => {
    const users = rooms[m.roomID]?.users;
    rooms[m.roomID].totalMute += m.accessAudio ? -1 : 1;
    if (rooms[m.roomID].totalMute === rooms[m.roomID].users.length - 1) {
      io.to(rooms[m.roomID].creator.socketID).emit("singleUserAudioFull", {
        msg: "audioFull",
      });
    } else {
      io.to(rooms[m.roomID].creator.socketID).emit("singleUserAudioFull", {
        msg: "audioNotFull",
      });
    }
    console.log("changing----------------");
    console.log(rooms[m.roomID].totalMute);
    users.map((user, i) => {
      if (user.socketID === m.socketID) {
        user.accessAudio = m.accessAudio;
      }
    });
    const found = users.find((user, i) => user.socketID === m.socketID);
    io.to(m.roomID).emit("getAudioStatusAll", { newUsers: [found] });
  });
  socket.on("joinGroup", (m) => {
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
    let idx = m.roomID;
    // console.log(m)
    // console.log(rooms)
    addUserToRoom(socket, m.userData, m.roomID, idx);
    // console.log('joining')
    socket.join(m.roomID);
    const usersInThisRoom = rooms[idx].users.filter(
      (id) => id.socketID !== socket.id
    );
    socket.emit("allUsers", usersInThisRoom);
    io.to(m.roomID).emit("joinGroup", {
      length: rooms[idx].users.length,
      userData: rooms[idx],
      socketID: socket.id,
    });
  });

  // socket.on('getCurrData',()=>{

  // })
  socket.on("sending signal", (payload) => {
    io.to(payload.userToSignal).emit("user joined", {
      signal: payload.signal,
      callerID: payload.callerID,
    });
  });

  socket.on("returning signal", (payload) => {
    io.to(payload.callerID).emit("receiving returned signal", {
      signal: payload.signal,
      id: socket.id,
    });
  });

  socket.on("generateRoomRequest", (m) => {
    socket.emit("generateRoomRequest", { roomID: socket.id });
  });
  socket.on("sendSignal", (m) => {
    const room = io.sockets.adapter.rooms.get(m.roomID);
    const numClients = room ? room.size : 0;
    socket.to(m.roomID).emit("getResponse", {
      value: m.value,
      position: m.position,
      id: socket.id,
      userData: m.userData,
      language: m.language,
      version: m.version,
    });
  });
  socket.on("disconnect", () => {
    const roomID = socket.roomID;
    removeUserFromRoom(socket, roomID);

    if (rooms[roomID]) {
      io.to(roomID).emit("joinGroup", {
        length: rooms[roomID].users.length,
        userData: rooms[roomID],
      });
    }
    // console.log('leaving')
    // console.log(rooms)
  });
});

const start = async () => {
  try {
    server.listen(port, () => {
      console.log(`server is listening port ${port}`);
    });
  } catch (error) {
    console.log(error);
  }
};
start();
