const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

const players = {};
const entities = [];

// Spawn some entities
for (let i = 0; i < 3; i++) {
  entities.push({
    id: `entity_${i}`,
    x: Math.random() * 100 - 50,
    y: 0.5,
    z: Math.random() * 100 - 50,
    targetPlayer: null
  });
}

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);
  
  // Initialize player
  players[socket.id] = {
    id: socket.id,
    x: Math.random() * 20 - 10,
    y: 0.5,
    z: Math.random() * 20 - 10,
    rotation: 0,
    health: 100
  };
  
  // Send current game state to new player
  socket.emit('init', {
    id: socket.id,
    players: players,
    entities: entities
  });
  
  // Notify other players
  socket.broadcast.emit('playerJoined', players[socket.id]);
  
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
    io.emit('chat', {
      id: socket.id,
      message: message
    });
  });
  
  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    delete players[socket.id];
    socket.broadcast.emit('playerLeft', socket.id);
  });
});

// Entity AI loop
setInterval(() => {
  entities.forEach(entity => {
    // Simple AI: move towards nearest player
    let nearestPlayer = null;
    let nearestDist = Infinity;
    
    for (let id in players) {
      const player = players[id];
      const dx = player.x - entity.x;
      const dz = player.z - entity.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestPlayer = player;
      }
    }
    
    if (nearestPlayer && nearestDist < 30) {
      const dx = nearestPlayer.x - entity.x;
      const dz = nearestPlayer.z - entity.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      
      // Move towards player
      const speed = 0.05;
      entity.x += (dx / dist) * speed;
      entity.z += (dz / dist) * speed;
      
      // Check collision with player
      if (dist < 2) {
        nearestPlayer.health -= 1;
        if (nearestPlayer.health <= 0) {
          io.to(nearestPlayer.id).emit('death');
        } else {
          io.to(nearestPlayer.id).emit('damage', nearestPlayer.health);
        }
      }
    } else {
      // Random wandering
      entity.x += (Math.random() - 0.5) * 0.1;
      entity.z += (Math.random() - 0.5) * 0.1;
    }
  });
  
  // Broadcast entity positions
  io.emit('entitiesUpdate', entities);
}, 50);

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
