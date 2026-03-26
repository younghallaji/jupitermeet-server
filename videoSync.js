/*jshint esversion: 6 */
/*jshint node: true */
"use strict";

const INTERSTITIAL_DURATION = 4000; // ms shown between segments

module.exports = function (io) {
    const namespace = io.of('/video-sync');

    /**
     * roomStates[meetingId] = {
     *   playlist    : [{ moderatorName, videoUrl }, ...],
     *   currentIndex: number,
     *   startedAt   : Date.now() timestamp when current segment started playing,
     *   isPaused    : bool,
     *   pausedAt    : elapsed ms when paused,
     *   isPlaying   : bool,
     * }
     */
    const roomStates = {};
    const roomParticipants = {}; // meetingId -> Set of socket.ids

    function getParticipantCount(meetingId) {
        return roomParticipants[meetingId] ? roomParticipants[meetingId].size : 0;
    }

    function getState(meetingId) {
        return roomStates[meetingId] || null;
    }

    function currentElapsed(state) {
        if (!state || !state.isPlaying) return state ? state.pausedAt || 0 : 0;
        if (state.isPaused) return state.pausedAt;
        return Date.now() - state.startedAt;
    }

    namespace.on('connection', (socket) => {

        socket.on('joinRoom', ({ meetingId, isModerator }) => {
            socket.join(meetingId);
            socket.meetingId   = meetingId;
            socket.isModerator = isModerator;

            if (!roomParticipants[meetingId]) roomParticipants[meetingId] = new Set();
            roomParticipants[meetingId].add(socket.id);

            // Broadcast updated count to everyone in the room
            namespace.to(meetingId).emit('participantCount', { count: getParticipantCount(meetingId) });

            const state = getState(meetingId);

            if (state && state.isPlaying) {
                // Send late-joiner the current playback state
                socket.emit('videoState', {
                    playlist    : state.playlist,
                    currentIndex: state.currentIndex,
                    elapsed     : currentElapsed(state),
                    isPaused    : state.isPaused,
                });
            }
        });

        // Moderator starts the playlist
        socket.on('playVideo', ({ meetingId, playlist }) => {
            if (!socket.isModerator) return;
            if (!Array.isArray(playlist) || playlist.length === 0) return;

            roomStates[meetingId] = {
                playlist    : playlist,
                currentIndex: 0,
                startedAt   : Date.now(),
                isPaused    : false,
                pausedAt    : 0,
                isPlaying   : true,
            };

            namespace.to(meetingId).emit('videoPlay', {
                playlist    : playlist,
                currentIndex: 0,
                elapsed     : 0,
            });
        });

        // Moderator pauses
        socket.on('pauseVideo', ({ meetingId }) => {
            if (!socket.isModerator) return;
            const state = getState(meetingId);
            if (!state || state.isPaused) return;

            state.pausedAt  = currentElapsed(state);
            state.isPaused  = true;

            namespace.to(meetingId).emit('videoPause', { elapsed: state.pausedAt });
        });

        // Moderator resumes
        socket.on('resumeVideo', ({ meetingId }) => {
            if (!socket.isModerator) return;
            const state = getState(meetingId);
            if (!state || !state.isPaused) return;

            state.startedAt = Date.now() - state.pausedAt;
            state.isPaused  = false;

            namespace.to(meetingId).emit('videoResume', { elapsed: state.pausedAt });
        });

        // Advance to next segment (called by server timer OR moderator manually)
        function advanceToNext(meetingId) {
            const state = getState(meetingId);
            if (!state) return;

            const nextIndex = state.currentIndex + 1;

            if (nextIndex >= state.playlist.length) {
                // Playlist finished
                delete roomStates[meetingId];
                namespace.to(meetingId).emit('videoStop', { reason: 'ended' });
                return;
            }

            const nextModerator = state.playlist[nextIndex].moderatorName;

            // Broadcast interstitial first
            namespace.to(meetingId).emit('videoInterstitial', {
                nextIndex      : nextIndex,
                moderatorName  : nextModerator,
                durationMs     : INTERSTITIAL_DURATION,
            });

            // After interstitial, start next segment
            setTimeout(() => {
                const s = getState(meetingId);
                if (!s) return; // meeting may have ended during interstitial

                s.currentIndex = nextIndex;
                s.startedAt    = Date.now();
                s.isPaused     = false;
                s.pausedAt     = 0;

                namespace.to(meetingId).emit('videoNext', {
                    currentIndex: nextIndex,
                    elapsed     : 0,
                });
            }, INTERSTITIAL_DURATION);
        }

        socket.on('nextVideo', ({ meetingId }) => {
            if (!socket.isModerator) return;
            advanceToNext(meetingId);
        });

        // Client reports video ended naturally
        socket.on('videoEnded', ({ meetingId, index }) => {
            const state = getState(meetingId);
            if (!state || state.currentIndex !== index) return;
            // Only process once (first reporter triggers it)
            advanceToNext(meetingId);
        });

        // Moderator stops everything
        socket.on('stopVideo', ({ meetingId }) => {
            if (!socket.isModerator) return;
            delete roomStates[meetingId];
            namespace.to(meetingId).emit('videoStop', { reason: 'moderator' });
        });

        socket.on('disconnect', () => {
            const mid = socket.meetingId;
            if (mid && roomParticipants[mid]) {
                roomParticipants[mid].delete(socket.id);
                namespace.to(mid).emit('participantCount', { count: getParticipantCount(mid) });
                if (roomParticipants[mid].size === 0) delete roomParticipants[mid];
            }
        });
    });
};
