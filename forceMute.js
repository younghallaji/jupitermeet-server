/*jshint esversion: 6 */
/*jshint node: true */
"use strict";

module.exports = function (io) {
    const namespace = io.of('/force-mute');

    // { meetingId: Set<username> }
    const forceMutedUsers = {};

    // { meetingId: Map<socketId, username> }
    const roomParticipants = {};

    function getParticipantList(meetingId) {
        if (!roomParticipants[meetingId]) return [];
        return Array.from(roomParticipants[meetingId].values());
    }

    function broadcastParticipantList(meetingId) {
        namespace.to(meetingId).emit('participantList', {
            participants: getParticipantList(meetingId),
            forceMuted: forceMutedUsers[meetingId]
                ? Array.from(forceMutedUsers[meetingId])
                : []
        });
    }

    namespace.on('connection', (socket) => {

        socket.on('joinRoom', ({ meetingId, username, isModerator }) => {
            socket.join(meetingId);
            socket.meetingId = meetingId;
            socket.username = username;
            socket.isModerator = isModerator;

            if (!roomParticipants[meetingId]) {
                roomParticipants[meetingId] = new Map();
            }
            roomParticipants[meetingId].set(socket.id, username);

            // Tell this user if they are already force-muted
            if (forceMutedUsers[meetingId] && forceMutedUsers[meetingId].has(username)) {
                socket.emit('youAreForceMuted');
            }

            broadcastParticipantList(meetingId);
        });

        socket.on('forceMute', ({ targetUsername, meetingId }) => {
            if (!socket.isModerator) return;

            if (!forceMutedUsers[meetingId]) {
                forceMutedUsers[meetingId] = new Set();
            }
            forceMutedUsers[meetingId].add(targetUsername);

            namespace.to(meetingId).emit('forceMuteTarget', { username: targetUsername });
            broadcastParticipantList(meetingId);
        });

        socket.on('endMeeting', ({ meetingId }) => {
            if (!socket.isModerator) return;
            namespace.to(meetingId).emit('meetingEnded');
        });

        socket.on('forceUnmute', ({ targetUsername, meetingId }) => {
            if (!socket.isModerator) return;

            if (forceMutedUsers[meetingId]) {
                forceMutedUsers[meetingId].delete(targetUsername);
            }

            namespace.to(meetingId).emit('forceUnmuteTarget', { username: targetUsername });
            broadcastParticipantList(meetingId);
        });

        socket.on('disconnect', () => {
            const { meetingId, username } = socket;
            if (!meetingId) return;

            if (roomParticipants[meetingId]) {
                roomParticipants[meetingId].delete(socket.id);
                if (roomParticipants[meetingId].size === 0) {
                    delete roomParticipants[meetingId];
                    delete forceMutedUsers[meetingId];
                } else {
                    broadcastParticipantList(meetingId);
                }
            }
        });
    });
};
