import {buildView, uiStates} from "./view.js";
import {buildPlayer} from "./player/playerMain.js";
import {baseConfig} from "./config.js";
import {buildLoopLibrary} from "./loops.js";

const LEFT_CHANNEL = 0,
    RIGHT_CHANNEL = 1;

function setup(loopLibrary) {
    const view = buildView(),
        model = {};

    let leftPlayer = buildPlayer({
        ...baseConfig,
        audioChannel: LEFT_CHANNEL,
        parentElement: view.leftPlayer,
    }),
    rightPlayer = buildPlayer({
        ...baseConfig,
        audioChannel: RIGHT_CHANNEL,
        parentElement: view.rightPlayer,
    });

    function loadRandomTracks() {
        const [leftLoop, rightLoop] = loopLibrary.getMixablePair();

        return Promise.all([
            leftPlayer.load(model.leftLoop = leftLoop),
            rightPlayer.load(model.rightLoop = rightLoop)
        ]);
    }

    function setPlayerPitch(targetPitch, player) {
        player.pitch = targetPitch;
    }
    function autoMatchPitch() {
        const leftBpm = model.leftLoop.bpm,
            rightBpm = model.rightLoop.bpm,
            avgBpm = loopLibrary.getBestMixBpm(model.leftLoop, model.rightLoop),
            leftPitch = avgBpm / leftBpm,
            rightPitch = avgBpm / rightBpm;
        setPlayerPitch(leftPitch, leftPlayer);
        setPlayerPitch(rightPitch, rightPlayer);
    }
    function autoMatchPosition() {
        leftPlayer.offset = rightPlayer.offset = 0;
    }
    view.on('autoMatchAll').then(() => {
        autoMatchPitch();
        autoMatchPosition();
    });
    view.on('autoMatchPitch').then(() => {
        autoMatchPitch();
    });
    view.on('autoMatchPosition').then(() => {
        autoMatchPosition();
    });
    leftPlayer.on('speedChange').then(event => {
       view.leftBpm = (model.leftLoop.bpm * event.data).toFixed(1);
    });
    rightPlayer.on('speedChange').then(event => {
        view.rightBpm = (model.rightLoop.bpm * event.data).toFixed(1);
    });
    function start(uiState) {
        view.uiState = uiState;
        loadRandomTracks().then(() => {
            leftPlayer.powerOn().then(() => {
                leftPlayer.motorOn();
            });
            rightPlayer.powerOn().then(() => {
                rightPlayer.motorOn();
            });
        });
    }
    view.on('startFreestyle').then(() => {
        start(uiStates.FREESTYLE_NO_BPMS);
    });
    view.on('startTraining').then(() => {
        start(uiStates.TRAINING_IN_PROGRESS);
    });
    view.on('newBeatsLeft').then(() => {
        const newTrack = loopLibrary.getMixableTrack(model.rightLoop);
        leftPlayer.load(model.leftLoop = newTrack);
    });
    view.on('newBeatsRight').then(() => {
        const newTrack = loopLibrary.getMixableTrack(model.leftLoop);
        rightPlayer.load(model.rightLoop = newTrack);
    });
    view.on('toggleBpms').then(() => {
        if (view.uiState === uiStates.FREESTYLE_WITH_BPMS) {
            view.uiState = uiStates.FREESTYLE_NO_BPMS;
        } else if (view.uiState === uiStates.FREESTYLE_NO_BPMS) {
            view.uiState = uiStates.FREESTYLE_WITH_BPMS;
        }
    });
    function calculateBeatTimes(bpm, offset, maxTime) {
        const beatTimes = [], beatInterval = 60 / bpm;
        let t = offset;
        while (t <= maxTime) {
            beatTimes.push(t);
            t += beatInterval;
        }
        return beatTimes;
    }
    function findNearestValue(arr, value) {
        if (!arr || arr.length === 0) {
            return;
        }
        return arr.reduce((prev, curr) => {
            return (Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev);
        });
    }


    function buildBeatPairs(leftBeatTimes, rightBeatTimes) {
        const fewerBeats = leftBeatTimes.length < rightBeatTimes.length ? leftBeatTimes : rightBeatTimes,
            moreBeats = leftBeatTimes.length < rightBeatTimes.length ? rightBeatTimes : leftBeatTimes,
            pairs = moreBeats.map(t => [t, findNearestValue(fewerBeats, t)]).sort(v => Math.min(...v));

        function contiguous(firstPair, secondPair) {
            return Math.max(...firstPair) === Math.min(...secondPair);
        }

        if (contiguous(pairs[0], pairs[1])) {
            pairs.shift();
        }
        if (contiguous(pairs[pairs.length-2], pairs[pairs.length-1])) {
            pairs.pop();
        }
        return pairs;
    }
    function updateStats() {
        const maxTime = 10,
            leftBaseBpm = model.leftLoop.bpm,
            rightBaseBpm = model.rightLoop.bpm,
            leftBpm = leftBaseBpm * leftPlayer.pitch,
            rightBpm = rightBaseBpm * rightPlayer.pitch,
            leftOffset = leftPlayer.offset,
            rightOffset = rightPlayer.offset,
            medianBpm = (leftBpm + rightBpm) / 2,
            bpmDiff = Math.abs(leftBpm - rightBpm),
            bpmDiffPercent = 100 * bpmDiff / medianBpm,
            leftBeatOffset = (leftOffset * leftBaseBpm / leftBpm) % (60 / leftBpm),
            leftBeatTimes = calculateBeatTimes(leftBpm, leftBeatOffset, maxTime),
            rightBeatOffset = (rightOffset * rightBaseBpm / rightBpm) % (60 / rightBpm),
            rightBeatTimes = calculateBeatTimes(rightBpm, rightBeatOffset, maxTime),
            beatPairs = buildBeatPairs(leftBeatTimes, rightBeatTimes),
            totalMismatch = beatPairs.reduce((total, pair) => total + Math.abs(pair[0] - pair[1]), 0),
            totalMismatchPercent = 100 * totalMismatch / maxTime;

        view.showStats({bpmDiff, bpmDiffPercent, leftBeatTimes, rightBeatTimes, beatPairs, totalMismatchPercent, maxTime});
    }
    function beginStatsUpdates() {
        function autoStatsUpdate() {
            updateStats();
            if (view.uiState === uiStates.TRAINING_RESULTS) {
                requestAnimationFrame(autoStatsUpdate);
            }
        }
        autoStatsUpdate();
    }
    view.on('scoreBeats').then(() => {
        view.uiState = uiStates.TRAINING_RESULTS;
        beginStatsUpdates();
    });
    view.on('nextBeats').then(() => {
        view.uiState = uiStates.TRAINING_IN_PROGRESS;
        loadRandomTracks();
    });
    view.on('tryAgain').then(() => {
        view.uiState = uiStates.TRAINING_IN_PROGRESS;
    });

    view.uiState = uiStates.INTRO;
}

window.onload = buildLoopLibrary()
    .then(loopLibrary => setup(loopLibrary));