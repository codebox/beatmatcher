import {buildEventSource} from "./event.js";

export const uiStates = {
    INTRO: 'intro',
    FREESTYLE_NO_BPMS: 'freestyleNoBpms',
    FREESTYLE_WITH_BPMS: 'freestyleWithBpms',
    TRAINING_IN_PROGRESS: 'trainingInProgress',
    TRAINING_RESULTS: 'trainingResults'
};

function buildBeatMap(elCanvas, elCanvasContainer) {
    const ctx = elCanvas.getContext('2d'),
        beatCircleColour = 'black',
        guideLineColour = 'grey',
        mismatchFillColour = 'rgba(255, 0, 0, 0.5)',
        mismatchStrokeColour = 'rgba(255, 0, 0, 0.8)',
        beatCircleRadiusPercent = 5,
        paddingPercent = 10,
        dpr = window.devicePixelRatio;

    ctx.imageSmoothingEnabled = false;
    function getX(x) {
        const padding = paddingPercent / 100 * elCanvas.height;
        return (x * (elCanvas.width - 3 * padding) + 2 * padding) / dpr;
    }
    function getY(y) {
        const padding = paddingPercent / 100 * elCanvas.height;
        return (y * (elCanvas.height - 2 * padding) + padding) / dpr;
    }
    function length(l) {
        return l / dpr;
    }

    function updateCanvasSize() {
        elCanvas.width = dpr * elCanvasContainer.clientWidth;
        elCanvas.height = dpr * elCanvasContainer.clientHeight / 2;
        elCanvas.style.width = elCanvasContainer.clientWidth + 'px';
        elCanvas.style.height = elCanvasContainer.clientHeight / 2 + 'px';
        ctx.scale(dpr, dpr);
    }

    function drawBeatMismatches(leftBeatsY, rightBeatsY, beatPairs, maxTime) {
        ctx.beginPath();
        ctx.strokeStyle = mismatchStrokeColour;

        ctx.fillStyle = mismatchFillColour;

        beatPairs.forEach(([t, nearestTime]) => {
            ctx.fillRect(getX(t / maxTime), getY(leftBeatsY), getX(nearestTime / maxTime) - getX(t / maxTime), getY(rightBeatsY) - getY(leftBeatsY));
            ctx.strokeRect(getX(t / maxTime), getY(leftBeatsY), getX(nearestTime / maxTime) - getX(t / maxTime), getY(rightBeatsY) - getY(leftBeatsY));
        });

        ctx.fill();
    }

    function drawBeats(y, beatTimes, maxTime) {
        ctx.fillStyle = 'black';
        const beatCircleRadius = elCanvas.height * beatCircleRadiusPercent / 100;

        ctx.beginPath();
        ctx.strokeStyle = guideLineColour;
        ctx.strokeWidth = 0.2;
        ctx.moveTo(getX(0), getY(y));
        ctx.lineTo(getX(1), getY(y));
        ctx.stroke();

        ctx.fillStyle = beatCircleColour;
        beatTimes.forEach(t => {
            ctx.moveTo(getX(t / maxTime), getY(y));
            ctx.arc(getX(t / maxTime), getY(y), length(beatCircleRadius), 0, Math.PI * 2, true);
            ctx.fill();
        })
    }

    function drawTimeLine() {
        ctx.beginPath();
        ctx.strokeStyle = guideLineColour;
        ctx.strokeWidth = 0.2;
        ctx.moveTo(getX(0), getY(0.5));
        ctx.lineTo(getX(1), getY(0.5));

        for(let i=0; i<100; i+=1) {
            const lineLength = i % 10 === 0 ? 0.1 : 0.05;
            ctx.moveTo(getX(i/100), getY(0.5 - lineLength));
            ctx.lineTo(getX(i/100), getY(0.5 + lineLength));
        }

        ctx.moveTo(getX(1), getY(0.5));
        ctx.lineTo(getX(1 - 0.006), getY(0.4));
        ctx.moveTo(getX(1), getY(0.5));
        ctx.lineTo(getX(1 - 0.006), getY(0.6));

        ctx.stroke();
    }

    updateCanvasSize();

    return {
        draw(beatData) {
            updateCanvasSize();
            const {leftBeatTimes, rightBeatTimes, beatPairs, maxTime} = beatData,
                leftBeatsY = 0.1,
                rightBeatsY = 0.9;

            ctx.clearRect(0, 0, elCanvas.width, elCanvas.height);
            drawBeatMismatches(leftBeatsY, rightBeatsY, beatPairs, maxTime);
            drawBeats(leftBeatsY, leftBeatTimes, maxTime);
            drawBeats(rightBeatsY, rightBeatTimes, maxTime);
            ctx.font = "10px sans-serif";
            ctx.fillText("L", getX(0) - 10, getY(leftBeatsY) + 5);
            ctx.fillText("R", getX(0) - 10, getY(rightBeatsY) + 3);
            ctx.fill();

            drawTimeLine();
        },
        onresize() {
            updateCanvasSize();
        }
    };
}
export function buildView() {
    const [
            elLeftPlayerParent, elRightPlayerParent, elBpmLeft, elBpmRight, elBpmLeftContainer, elBpmRightContainer,
            elAutoMatchAll, elAutoMatchPitch, elAutoMatchPosition, elStartFreestyle, elStartTraining, elOverlay,
            elNewBeatsLeft, elNewBeatsRight, elToggleBpms, elScoreBeatsBtn, elNextBeatsBtn, elFreestylePanel, elTrainingPanel,
            elBeatMap, elTryAgain, elBpmDiff, elBpmDiffPercentage, elBeatPeriod, elStats, elTotalMismatch
        ] = [
            'leftPlayer', 'rightPlayer', 'bpmLeft', 'bpmRight', 'bpmLeftContainer', 'bpmRightContainer',
            'autoMatchAll', 'autoMatchPitch', 'autoMatchPosition', 'startFreestyle', 'startTraining', 'overlay',
            'newBeatsLeft', 'newBeatsRight', 'toggleBpms', 'scoreBeats', 'nextBeats', 'freestylePanel', 'trainingPanel',
            'beatMap', 'tryAgain', 'bpmDiff', 'bpmDiffPercentage', 'beatPeriod', 'stats', 'totalMismatch'
        ].map(id => document.getElementById(id)),
        beatMap = buildBeatMap(elBeatMap, elTrainingPanel),
        eventSource = buildEventSource();

    let uiState;

    elAutoMatchAll.addEventListener('click', () => {
        eventSource.trigger('autoMatchAll');
    });
    elAutoMatchPitch.addEventListener('click', () => {
        eventSource.trigger('autoMatchPitch');
    });
    elAutoMatchPosition.addEventListener('click', () => {
        eventSource.trigger('autoMatchPosition');
    });
    elStartFreestyle.addEventListener('click', () => {
        eventSource.trigger('startFreestyle');
    });
    elStartTraining.addEventListener('click', () => {
        eventSource.trigger('startTraining');
    });
    elNewBeatsLeft.addEventListener('click', () => {
        eventSource.trigger('newBeatsLeft');
    });
    elNewBeatsRight.addEventListener('click', () => {
        eventSource.trigger('newBeatsRight');
    });
    elToggleBpms.addEventListener('click', () => {
        eventSource.trigger('toggleBpms');
    });
    elScoreBeatsBtn.addEventListener('click', () => {
        eventSource.trigger('scoreBeats');
    });
    elNextBeatsBtn.addEventListener('click', () => {
        eventSource.trigger('nextBeats');
    });
    elTryAgain.addEventListener('click', () => {
        eventSource.trigger('tryAgain');
    });

    return {
        get leftPlayer() {
            return elLeftPlayerParent;
        },
        get rightPlayer() {
            return elRightPlayerParent;
        },
        set leftBpm(value) {
            elBpmLeft.innerText = value;
        },
        set rightBpm(value) {
            elBpmRight.innerText = value;
        },
        get uiState() {
            return uiState;
        },
        set uiState(newState) {
            function setHidden(el, ...visibleStates) {
                const isHidden = !visibleStates.includes(newState);
                el.classList.toggle('hidden', isHidden);
            }
            setHidden(elOverlay, uiStates.INTRO);
            setHidden(elToggleBpms, uiStates.FREESTYLE_WITH_BPMS, uiStates.FREESTYLE_NO_BPMS);
            setHidden(elBpmLeftContainer, uiStates.FREESTYLE_WITH_BPMS, uiStates.TRAINING_RESULTS);
            setHidden(elBpmRightContainer, uiStates.FREESTYLE_WITH_BPMS, uiStates.TRAINING_RESULTS);
            setHidden(elScoreBeatsBtn, uiStates.TRAINING_IN_PROGRESS);
            setHidden(elNextBeatsBtn, uiStates.TRAINING_RESULTS);
            setHidden(elTryAgain, uiStates.TRAINING_RESULTS);
            setHidden(elBeatMap, uiStates.TRAINING_RESULTS);
            setHidden(elNewBeatsRight, uiStates.FREESTYLE_NO_BPMS, uiStates.FREESTYLE_WITH_BPMS);
            setHidden(elNewBeatsLeft, uiStates.FREESTYLE_NO_BPMS, uiStates.FREESTYLE_WITH_BPMS);
            setHidden(elFreestylePanel, uiStates.FREESTYLE_NO_BPMS, uiStates.FREESTYLE_WITH_BPMS, uiStates.TRAINING_RESULTS);
            setHidden(elTrainingPanel, uiStates.TRAINING_IN_PROGRESS, uiStates.TRAINING_RESULTS);
            setHidden(elStats, uiStates.TRAINING_RESULTS);

            if (newState === uiStates.FREESTYLE_WITH_BPMS) {
                elToggleBpms.innerText = 'Hide BPMs';
            } else if (newState === uiStates.FREESTYLE_NO_BPMS) {
                elToggleBpms.innerText = 'Show BPMs';
            }

            uiState = newState;
        },
        showStats(stats) {
            beatMap.draw(stats);
            const {bpmDiff, bpmDiffPercent, totalMismatchPercent} = stats,
                beatPeriod = (Math.abs(stats.bpmDiff) > 0.01) ? `~${Math.round(60 / stats.bpmDiff)}s` : 'Infinite!';
            elBpmDiff.innerText = `${bpmDiff.toFixed(1)} bpm`;
            elBpmDiffPercentage.innerText = `${bpmDiffPercent.toFixed(2)}%`;
            elTotalMismatch.innerText = `${totalMismatchPercent.toFixed(1)}%`;
            elBeatPeriod.innerText = beatPeriod;
        },
        on(eventName) {
            return eventSource.on(eventName);
        }
    };
};