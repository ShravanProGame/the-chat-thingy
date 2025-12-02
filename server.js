const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Serve static files
app.use(express.static('public'));

// Game state
const players = {};
const entities = [];
const MAX_ENTITIES = 5;

// Initialize entities
function initEntities() {
  for (let i = 0; i < MAX_ENTITIES; i++) {
    entities.push({
      id: `entity_${i}`,
      x: Math.random() * 40 - 20,
      y: 1.25,
      z: Math.random() * 40 - 20,
      speed: 0.02 + Math.random() * 0.02,
      waitTime: Math.random() * 3
    });
  }
}

initEntities();

// Socket.IO connection handler
io.on('connection', (socket) => {
  console.log(`✅ Player connected: ${socket.id}`);
  
  // Initialize new player
  players[socket.id] = {
    id: socket.id,
    x: Math.random() * 10 - 5,
    y: 1.6,
    z: Math.random() * 10 - 5,
    rotation: 0,
    health: 100,
    username: `Player_${Math.random().toString(36).substr(2, 4)}`
  };

  // Send init data to new player
  socket.emit('init', {
    id: socket.id,
    players: players,
    entities: entities
  });

  // Notify others about new player
  socket.broadcast.emit('playerJoined', players[socket.id]);

  console.log(`👥 Total players: ${Object.keys(players).length}`);

  // Handle player movement
  socket.on('move', (data) => {
    if (players[socket.id]) {
      players[socket.id].x = data.x;
      players[socket.id].y = data.y;
      players[socket.id].z = data.z;
      players[socket.id].rotation = data.rotation;

      // Broadcast to other players
      socket.broadcast.emit('playerMoved', {
        id: socket.id,
        x: data.x,
        y: data.y,
        z: data.z,
        rotation: data.rotation
      });
    }
  });

  // Handle chat messages
  socket.on('chat', (message) => {
    if (players[socket.id]) {
      console.log(`💬 ${players[socket.id].username}: ${message}`);
      
      io.emit('chatMessage', {
        id: socket.id,
        username: players[socket.id].username,
        message: message,
        timestamp: Date.now()
      });
    }
  });

  // Handle flashlight toggle
  socket.on('flashlight', (isOn) => {
    socket.broadcast.emit('playerFlashlight', {
      id: socket.id,
      isOn: isOn
    });
  });

  // Handle player disconnect
  socket.on('disconnect', () => {
    console.log(`❌ Player disconnected: ${socket.id}`);
    
    if (players[socket.id]) {
      delete players[socket.id];
      socket.broadcast.emit('playerLeft', socket.id);
      console.log(`👥 Total players: ${Object.keys(players).length}`);
    }
  });
});

// Entity AI update loop
function updateEntities() {
  if (Object.keys(players).length === 0) return;

  entities.forEach(entity => {
    entity.waitTime -= 0.016; // ~60fps

    if (entity.waitTime <= 0) {
      // Find nearest player
      let nearestPlayer = null;
      let nearestDistance = Infinity;

      for (let id in players) {
        const player = players[id];
        const dx = player.x - entity.x;
        const dz = player.z - entity.z;
        const distance = Math.sqrt(dx * dx + dz * dz);

        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestPlayer = player;
        }
      }

      if (nearestPlayer) {
        // Move toward nearest player
        const dx = nearestPlayer.x - entity.x;
        const dz = nearestPlayer.z - entity.z;
        const distance = Math.sqrt(dx * dx + dz * dz);

        if (distance > 0) {
          entity.x += (dx / distance) * entity.speed;
          entity.z += (dz / distance) * entity.speed;
        }

        // Check collision with players
        for (let id in players) {
          const player = players[id];
          const dx = player.x - entity.x;
          const dz = player.z - entity.z;
          const dist = Math.sqrt(dx * dx + dz * dz);

          if (dist < 1.5 && player.health > 0) {
            player.health = Math.max(0, player.health - 1);
            
            io.to(id).emit('damage', player.health);

            if (player.health <= 0) {
              io.to(id).emit('death');
              console.log(`💀 Player ${id} died`);
            }

            entity.waitTime = 1; // Cooldown after attack
            break;
          }
        }
      }
    }
  });

  // Broadcast entity positions
  io.emit('entitiesUpdate', entities);
}

// Start entity update loop (60 FPS)
setInterval(updateEntities, 16);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    players: Object.keys(players).length,
    entities: entities.length,
    uptime: process.uptime()
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║     🎮 BACKROOMS SERVER RUNNING 🎮     ║
╠════════════════════════════════════════╣
║  Port: ${PORT}                           ║
║  Players: 0                            ║
║  Entities: ${entities.length}                          ║
║                                        ║
║  Open: http://localhost:${PORT}        ║
╚════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM signal received: closing server');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n🛑 SIGINT signal received: closing server');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});
