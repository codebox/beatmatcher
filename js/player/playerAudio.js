
const getAudioContext = (() => {
    let audioCtx, merger;
    return () => {
        if (!audioCtx) {
            audioCtx = new AudioContext();
            merger = new ChannelMergerNode(audioCtx, {numberOfInputs: 2});
            merger.connect(audioCtx.destination);
        }
        return {audioCtx, merger};
    };
})();

async function getBuffers(audioCtx, filepath) {
    const response = await fetch(filepath);
    const arrayBuffer = await response.arrayBuffer();
    const forwardBuffer = await audioCtx.decodeAudioData(arrayBuffer);

    const reverseBuffer = new AudioBuffer(forwardBuffer);
    reverseBuffer.copyToChannel(forwardBuffer.getChannelData(0).slice().reverse(), 0);
    if (reverseBuffer.numberOfChannels > 1){
        reverseBuffer.copyToChannel(forwardBuffer.getChannelData(1).slice().reverse(), 1);
    }

    return [forwardBuffer, reverseBuffer];
}

export async function buildPlayerAudio(config) {
    const {audioChannel} = config;

    let audioCtx, merger, gainNode, audioFilePath, buffer, reverseBuffer, durationInSeconds, sourceNode, playbackRate = 0;
    const lastPlaybackChangeDetails = {
        ts: 0,
        offset: 0,
        playbackRate: 0,
    }

    function getSourceNode(audioCtx, audioBuffer, playbackRate) {
        return new AudioBufferSourceNode(audioCtx, {
            buffer: audioBuffer,
            loop: true,
            playbackRate,
        });
    }

    function getCurrentOffset() {
        const timeSinceSourceNodeCreated = Date.now() - lastPlaybackChangeDetails.ts,
            trackPlaytimeSinceSourceNodeCreated = timeSinceSourceNodeCreated * lastPlaybackChangeDetails.playbackRate,
            trackOffset = (lastPlaybackChangeDetails.offset + trackPlaytimeSinceSourceNodeCreated) % (durationInSeconds * 1000);
        return trackOffset;
    }

    function changePlaybackRateAndDirection(newPlaybackRate, totalPlayTimeInSeconds) {
        if (sourceNode) {
            sourceNode.disconnect();
            sourceNode.stop(0);
            sourceNode = null;
        }
        if (newPlaybackRate) {
            if (totalPlayTimeInSeconds < 0) {
                // this happens if we rewind a lot shortly after starting playback
                totalPlayTimeInSeconds = durationInSeconds - (-totalPlayTimeInSeconds % durationInSeconds);
            }
            let playOffset;
            if (newPlaybackRate < 0) {
                sourceNode = getSourceNode(audioCtx, reverseBuffer, -newPlaybackRate);
                playOffset = durationInSeconds - (totalPlayTimeInSeconds % durationInSeconds);
            } else {
                sourceNode = getSourceNode(audioCtx, buffer, newPlaybackRate);
                playOffset = totalPlayTimeInSeconds % durationInSeconds;
            }
            sourceNode.connect(gainNode);
            sourceNode.start(0, playOffset);

            lastPlaybackChangeDetails.ts = Date.now();
            lastPlaybackChangeDetails.offset = playOffset * 1000;
            lastPlaybackChangeDetails.playbackRate = newPlaybackRate;
        }
        playbackRate = newPlaybackRate;
    }

    function cleanUpPrevious() {
        if (sourceNode) {
            sourceNode.disconnect();
            sourceNode = null;
        }
        if (gainNode) {
            gainNode.disconnect();
            gainNode = null;
        }
    }

    return {
        get playbackRate() {
            return playbackRate;
        },
        updatePlaybackRate(newPlaybackRate, totalPlayTimeInSeconds) {
            const gotForwardBuffer = sourceNode && sourceNode.buffer === buffer,
                gotReverseBuffer = sourceNode && sourceNode.buffer === reverseBuffer,
                newBufferNeeded = !sourceNode || (gotForwardBuffer && newPlaybackRate < 0) || (gotReverseBuffer && newPlaybackRate > 0);
            if (newBufferNeeded) {
                changePlaybackRateAndDirection(newPlaybackRate, totalPlayTimeInSeconds);
            } else if (gotForwardBuffer) {
                sourceNode.playbackRate.value = playbackRate = newPlaybackRate;
                lastPlaybackChangeDetails.offset = getCurrentOffset();
                lastPlaybackChangeDetails.ts = Date.now();
                lastPlaybackChangeDetails.playbackRate = playbackRate;

            } else if (gotReverseBuffer) {
                playbackRate = newPlaybackRate
                sourceNode.playbackRate.value = -newPlaybackRate;
                lastPlaybackChangeDetails.offset = getCurrentOffset();
                lastPlaybackChangeDetails.ts = Date.now();
                lastPlaybackChangeDetails.playbackRate = -playbackRate;
            }
        },
        get volume() {
            return gainNode.gain.value;
        },
        set volume(volume) {
            gainNode.gain.value = volume;
        },
        get offset() {
            return getCurrentOffset() / 1000;
        },
        set offset(value) {
            changePlaybackRateAndDirection(playbackRate, value);
        },
        get duration() {
            return durationInSeconds;
        },
        async setAudioFilePath(value) {
            cleanUpPrevious();

            audioFilePath = value;
            const o = getAudioContext();
            audioCtx = o.audioCtx;
            merger = o.merger;
            gainNode = new GainNode(audioCtx);

            gainNode.connect(merger, 0, audioChannel);

            [buffer, reverseBuffer] = await getBuffers(audioCtx, audioFilePath);
            durationInSeconds = buffer.duration;

            sourceNode = getSourceNode(audioCtx, buffer, playbackRate);
            sourceNode.connect(gainNode);
            sourceNode.start(0, 0);

            lastPlaybackChangeDetails.ts = Date.now();
            lastPlaybackChangeDetails.offset = 0;
            lastPlaybackChangeDetails.playbackRate = playbackRate;
        }
    }
}
