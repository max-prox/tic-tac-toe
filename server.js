const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*', // Allow all origins (update in production)
    },
});

app.use(cors());

// Store active rooms and their game states
const rooms = new Map();

// Generate a unique 6-digit room code
function generateRoomCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Handle creating a room
    socket.on('createRoom', () => {
        const roomCode = generateRoomCode();
        rooms.set(roomCode, { players: [], gameState: ['', '', '', '', '', '', '', '', ''], currentPlayer: 'X' });
        socket.join(roomCode);
        rooms.get(roomCode).players.push(socket.id);
        socket.emit('roomCreated', roomCode);
        console.log(`Room created: ${roomCode}`);
    });

    // Handle joining a room
    socket.on('joinRoom', (roomCode) => {
        if (rooms.has(roomCode)) {
            const room = rooms.get(roomCode);
            if (room.players.length < 2) {
                socket.join(roomCode);
                room.players.push(socket.id);
                socket.emit('roomJoined', roomCode);
                io.to(roomCode).emit('playerJoined', room.players.length);

                // Start the game if two players are in the room
                if (room.players.length === 2) {
                    io.to(roomCode).emit('gameStarted', room.currentPlayer);
                }
            } else {
                socket.emit('roomFull');
            }
        } else {
            socket.emit('roomNotFound');
        }
    });

    // Handle player moves
    socket.on('makeMove', (roomCode, index, player) => {
        const room = rooms.get(roomCode);
        if (room && room.gameState[index] === '' && room.currentPlayer === player) {
            room.gameState[index] = player;
            room.currentPlayer = player === 'X' ? 'O' : 'X';
            io.to(roomCode).emit('moveMade', room.gameState, room.currentPlayer);

            // Check for a winner
            const winner = checkWinner(room.gameState);
            if (winner) {
                io.to(roomCode).emit('gameOver', winner);
            } else if (!room.gameState.includes('')) {
                io.to(roomCode).emit('gameOver', 'draw');
            }
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('A user disconnected:', socket.id);
        for (const [roomCode, room] of rooms.entries()) {
            if (room.players.includes(socket.id)) {
                room.players = room.players.filter((id) => id !== socket.id);
                if (room.players.length === 0) {
                    rooms.delete(roomCode);
                } else {
                    io.to(roomCode).emit('playerLeft');
                }
            }
        }
    });
});

// Check for a winner
function checkWinner(gameState) {
    const winningConditions = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
        [0, 4, 8], [2, 4, 6], // Diagonals
    ];

    for (const condition of winningConditions) {
        const [a, b, c] = condition;
        if (gameState[a] && gameState[a] === gameState[b] && gameState[a] === gameState[c]) {
            return gameState[a];
        }
    }
    return null;
}

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
