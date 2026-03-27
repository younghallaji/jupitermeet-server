/*jshint esversion: 6 */
/*jshint node: true */
"use strict";

module.exports = function (io) {
    const namespace = io.of('/reactions');

    // { meetingId: Set<socketId> }
    const rooms = {};

    namespace.on('connection', (socket) => {

        socket.on('joinRoom', ({ meetingId, username }) => {
            socket.join(meetingId);
            socket.meetingId = meetingId;
            socket.username = username;

            if (!rooms[meetingId]) rooms[meetingId] = new Set();
            rooms[meetingId].add(socket.id);
        });

        socket.on('sendReaction', ({ emoji }) => {
            const { meetingId, username } = socket;
            if (!meetingId || !emoji) return;

            // Broadcast to everyone in the room including sender
            namespace.to(meetingId).emit('reaction', {
                username,
                emoji,
            });
        });

        socket.on('disconnect', () => {
            const { meetingId } = socket;
            if (!meetingId || !rooms[meetingId]) return;
            rooms[meetingId].delete(socket.id);
            if (rooms[meetingId].size === 0) delete rooms[meetingId];
        });
    });
};
