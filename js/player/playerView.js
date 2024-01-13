import {cyrb53, mulberry32, polarToCartesian, toRange} from "./utils.js";
import {buildEventSource} from "../event.js";

function buildLabelSvg(audioFileName, labelText) {
    const
        seed = cyrb53(audioFileName),
        rnd = mulberry32(seed),
        viewBoxSize = 100,
        labelRadius = viewBoxSize / 2,
        arcCount = Math.floor(toRange(rnd(), 3, 9)),
        paths = [],
        margin = labelRadius / 20,
        drawRegionWidth = (labelRadius - 2 * margin),
        arcWidth = drawRegionWidth / arcCount;

    function buildPath(radius, width, startAngle, endAngle, colour){
        const x = viewBoxSize / 2,
            y = viewBoxSize / 2,
            start = polarToCartesian(x, y, radius, endAngle),
            end = polarToCartesian(x, y, radius, startAngle),
            arcSweep = (endAngle > startAngle) ? endAngle - startAngle : endAngle - startAngle + 360,
            largeArcFlag = arcSweep <= 180 ? "0" : "1",
            d = `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;

        return `<path d="${d}" stroke="${colour}" stroke-width="${width}" fill="transparent"/>`;
    }

    const hue = toRange(rnd(), 0, 360),
        backgroundColor = `hsl(${hue}, 100%, 70%)`,
        patternColor = `hsl(${hue}, 100%, 40%)`,
        c = viewBoxSize / 2;
    paths.push(`<circle cx="${c}" cy="${c}" r="${labelRadius}" fill="${backgroundColor}"></circle>`)

    const arcWidthDelta = toRange(rnd(), -2, 2);
    for (let i=0; i<arcCount; i++) {
        const r = margin + arcWidth * i,
            startAngle = toRange(rnd(), 0, 360),
            endAngle = startAngle + toRange(rnd(), 60,  300);
        paths.push(buildPath(r, arcWidth + arcWidthDelta, startAngle, endAngle, patternColor));
    }

    paths.push(`<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="10px" textLength="80%" lengthAdjust="spacingAndGlyphs">${labelText}</text>`);

    return `<svg viewBox="0 0 ${viewBoxSize} ${viewBoxSize}" >${paths.join('')}</svg>`;
}

function buildLoadingSvg() {
    return `<svg viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="50" fill="black"></circle>
        <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="10px" textLength="80%" fill="white" lengthAdjust="spacingAndGlyphs">Loading...</text>
    </svg>`;
}

function buildVolumeScaleSvg(intermediateDotCount) {
    const viewBoxSize = 100,
        dotCount = intermediateDotCount + 2,
        dotAngleDelta = 180 / (dotCount - 1),
        markInnerRadius = (viewBoxSize/2) * 0.85,
        markOuterRadius = (viewBoxSize/2) * 0.95;

    function buildMark(angle){
        const x1 = Math.sin(angle * Math.PI / 180) * markInnerRadius + viewBoxSize / 2,
            y1 = Math.cos(angle * Math.PI / 180) * markInnerRadius + viewBoxSize / 2,
            x2 = Math.sin(angle * Math.PI / 180) * markOuterRadius + viewBoxSize / 2,
            y2 = Math.cos(angle * Math.PI / 180) * markOuterRadius + viewBoxSize / 2;
        return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="volumeControlMark" stroke-width="1"/>`;
    }

    const paths = [];
    let angle = 90;
    for (let i=0; i<dotCount; i++) {
        paths.push(buildMark(angle));
        angle += dotAngleDelta;
    }

    return `<svg viewBox="0 0 ${viewBoxSize} ${viewBoxSize}" >${paths.join('')}</svg>`;
}

function getDisplayRefreshRate() {
    let count = 0, maxCount=100, startTs;
    return new Promise(resolve => {
        function update() {
            count++;
            if (count < maxCount) {
                requestAnimationFrame(update);
            } else {
                const endTs = performance.now(),
                    intervalSeconds = (endTs - startTs) / 1000,
                    exactRefreshRate = maxCount / intervalSeconds,
                    roundedRefreshRate = Math.round(exactRefreshRate / 10) * 10;
                resolve(roundedRefreshRate);
            }
        }

        startTs = performance.now();
        requestAnimationFrame(update);
    });
}

function buildStrobeDotsSvg(displayRefreshRate) {
    const dotColour = 'white',
        viewBoxSize = 100;
    function addStrobeDots(radius, dotCount, dotSize) {
        const circles = [];
        for (let i=0; i<dotCount; i++) {
            const angle = i * 360 / dotCount,
                cx = viewBoxSize /2 + radius * Math.cos(angle * Math.PI / 180),
                cy = viewBoxSize /2 + radius * Math.sin(angle * Math.PI / 180);
            circles.push(`<circle cx="${cx}" cy="${cy}" r="${dotSize}" fill="${dotColour}"></circle>`);
        }
        return circles;
    }
    const paths = [];
    function getDotCount(stationaryAt) {
        const baseRpm = 100 / 3,
            stationaryRpm = baseRpm * stationaryAt,
            stationaryRps = stationaryRpm / 60;
            return Math.round(displayRefreshRate / stationaryRps);
    }
    paths.push(...addStrobeDots(46, getDotCount(1.064),  0.3));
    paths.push(...addStrobeDots(47, getDotCount(1.033),  0.3));
    paths.push(...addStrobeDots(48, getDotCount(1),  0.5));
    paths.push(...addStrobeDots(49, getDotCount(0.967),  0.3));

    return `<svg viewBox="0 0 ${viewBoxSize} ${viewBoxSize}" style="border-radius: 50%">${paths.join('')}</svg>`;
}

export function buildPlayerView(config) {
    const {parentElement} = config,
        eventSource = buildEventSource(),

        recordPlayerHtml = `
        <div class="recordPlayer">
            <div class="platterContainer">
                <button class="startStop"></button>
                <button class="power"></button>
                <div class="platter">
                    <div class="strobeDots"></div>
                    <div class="record">
                        <div class="recordLabel"></div>
                    </div>
                    <div class="strobeAndLighting"></div>
                </div>
            </div>
            <div class="rightControlsContainer">
                <div class="pitchSlider">
                    <div class="pitchSliderTrack"></div>
                    <div class="pitchSliderHandle">
                        <div class="pitchSliderHandleGroove"></div>
                    </div>
                </div>
                <div class="pitchScale"></div>
                <div class="volumeControlsContainer">
                    <div class="volumeControlScaleContainer"></div>
                    <div class="volumeControl"><div></div></div>                    
                </div>
            </div>
        </div>`;

    let audioFilePath, draggingVolume, draggingVolumeInitialY;
    parentElement.innerHTML = recordPlayerHtml;

    const elRecordPlayer = parentElement.querySelector('.recordPlayer'),
        elRecord = parentElement.querySelector('.record'),
        elRecordLabel = parentElement.querySelector('.recordLabel'),
        elStrobeDots = parentElement.querySelector('.strobeDots'),
        elStartStop = parentElement.querySelector('.startStop'),
        elPower = parentElement.querySelector('.power'),
        elStrokeAndLighting = parentElement.querySelector('.strobeAndLighting'),
        elPitchSlider = parentElement.querySelector('.pitchSlider'),
        elPitchSliderHandle = parentElement.querySelector('.pitchSliderHandle'),
        elPitchScale = parentElement.querySelector('.pitchScale'),
        elVolumeControl = parentElement.querySelector('.volumeControl'),
        elVolumeControlScaleContainer = parentElement.querySelector('.volumeControlScaleContainer');

    getDisplayRefreshRate().then(displayRefreshRate => {
        console.debug('Display refresh rate: ' + displayRefreshRate + 'Hz');
        elStrobeDots.innerHTML = buildStrobeDotsSvg(displayRefreshRate);
    });

    const pitchScale = [];
    for (let p=-config.pitchRangePercent; p<=config.pitchRangePercent; p+=2) {
        const top = 100 * ((p + config.pitchRangePercent) / (2 * config.pitchRangePercent));
        pitchScale.push(`<div class="pitchScaleMark" style="top: ${top}%"><span>${p}</span></div>`);
    }
    elPitchScale.innerHTML = pitchScale.join('');

    elVolumeControlScaleContainer.innerHTML = buildVolumeScaleSvg(3);

    function getEventClientCoords(e) {
        let x,y;
        if (e.touches) {
            x = e.touches[0].clientX;
            y = e.touches[0].clientY;
        } else {
            x = e.clientX;
            y = e.clientY;
        }
        return {clientX: x, clientY: y};
    }

    function getAngleFromMoveEvent(e) {
        const rect = e.currentTarget.getBoundingClientRect(),
            {clientX, clientY} = getEventClientCoords(e),
            x = clientX - rect.left - rect.width / 2,
            y = clientY - rect.top - rect.height / 2;
        return  180 + Math.atan2(y, x) * 180 / Math.PI;
    }

    let platterRpm = 0, recordRpm = 0, hold = false, previousAngle = null, previousAngleTs, pitchDrag;

    ['touchstart', 'mousedown'].forEach(evt => elRecord.addEventListener(evt, () => {
        hold = true;
        eventSource.trigger('holdOn');
    }));

    ['touchend', 'mouseup'].forEach(evt => document.addEventListener(evt, () => {
        if (hold) {
            hold = false;
            eventSource.trigger('holdOff');
            previousAngle = previousAngleTs = null;
        }
        if (pitchDrag) {
            pitchDrag = false;
        }
    }));

    let currentPitchPercentage, pitchScaleHeight, pitchSliderHeight, pitchScaleTop, pitchSliderTop;
    function setScaleAndSizeValues() {
        pitchScaleHeight = elPitchScale.clientHeight;
        pitchSliderHeight = elPitchSlider.clientHeight;
        pitchScaleTop = elPitchScale.getBoundingClientRect().top;
        pitchSliderTop = elPitchSlider.getBoundingClientRect().top;
    }
    new ResizeObserver(setScaleAndSizeValues).observe(elRecordPlayer);
    setScaleAndSizeValues();

    function getPitchPercentageFromSliderEvent(e) {
        const pitchSliderEventY = getEventClientCoords(e).clientY + window.scrollY,
            pitchScaleEventY = pitchSliderEventY - (pitchScaleTop - pitchSliderTop) / 2,
            scalePercentage = 100 * (pitchScaleEventY - pitchScaleTop) / pitchScaleHeight,
            pitchPercentage =  (scalePercentage - 50) * 2 * config.pitchRangePercent / 100;
        return Math.min(Math.max(pitchPercentage, -config.pitchRangePercent), config.pitchRangePercent);
    }
    function movePitchSlider(pitchPercentage) { // -10 to +10
        const sliderPercentage = pitchPercentage / config.pitchRangePercent * 50 + 50,
            sliderOffsetPercentage = (pitchScaleTop - pitchSliderTop) / pitchSliderHeight * 100;
        elPitchSliderHandle.style.top = (sliderOffsetPercentage + sliderPercentage * pitchScaleHeight / pitchSliderHeight ) + '%';
        currentPitchPercentage = pitchPercentage;
    }

    ['touchstart', 'mousedown'].forEach(evt => elPitchSliderHandle.addEventListener(evt, () => {
        pitchDrag = true;
    }));

    ['touchmove', 'mousemove'].forEach(evt => elPitchSlider.addEventListener(evt, e => {
        if (pitchDrag) {
            const pitchPercentage = getPitchPercentageFromSliderEvent(e);
            movePitchSlider(pitchPercentage);
            eventSource.trigger('pitchChange', 1 + pitchPercentage / 100);
        }
    }));

    elPitchSlider.addEventListener('click', e => {
        const clickPercentage = getPitchPercentageFromSliderEvent(e);
        if (clickPercentage < currentPitchPercentage) {
            eventSource.trigger('nudgePitchDown');
        } else if (clickPercentage > currentPitchPercentage) {
            eventSource.trigger('nudgePitchUp');
        }
    });

    elStartStop.addEventListener('click', () => {
       eventSource.trigger('startStopClick');
    });
    elPower.addEventListener('click', () => {
         eventSource.trigger('powerClick');
    });
    ['touchstart', 'mousedown'].forEach(evt => elVolumeControl.addEventListener(evt, e => {
        draggingVolume = true;
        draggingVolumeInitialY = getEventClientCoords(e).clientY;
    }));

    ['touchmove', 'mousemove'].forEach(evt => document.addEventListener(evt, e => {
        if (draggingVolume) {
            const dragYDistance = draggingVolumeInitialY - getEventClientCoords(e).clientY,
                dragYDistanceBounded = Math.max(Math.min(dragYDistance, 90), -90),
                volume = (dragYDistanceBounded + 90) / 180;
            eventSource.trigger('volumeChange', volume);
        }
    }));

    ['touchend', 'mouseup'].forEach(evt => document.addEventListener(evt, () => {
        draggingVolume = false;
    }));

    ['touchmove', 'mousemove'].forEach(evt => elRecord.addEventListener(evt, e => {
        if (hold) {
            const angle = getAngleFromMoveEvent(e);
            if (previousAngle === null) {
                previousAngle = angle;
                previousAngleTs = e.timeStamp;
                return;
            }
            const tsDelta = e.timeStamp - previousAngleTs;
            let angleDelta = angle - previousAngle;
            if (angleDelta > 180) {
                angleDelta = 360 - angleDelta;
            } else if (angleDelta < -180) {
                angleDelta = 360 + angleDelta;
            }
            if (tsDelta > 5) { // event timestamps are fuzzed by the browser for security reasons
                const degreesPerSecond = 1000 * angleDelta / tsDelta,
                    recordRpm = degreesPerSecond * 60 / 360;
                previousAngle = angle;
                previousAngleTs = e.timeStamp;
                eventSource.trigger('manualRotation', recordRpm);
            }
        }
    }));

    function rotate(el, getRpm) {
        let previousTs = 0, degrees = 0;
        const doRotation = ts => {
            if (!previousTs) {
                previousTs = ts;
                requestAnimationFrame(doRotation);
                return;
            }
            const delta = ts - previousTs;
            previousTs = ts;
            degrees += 360 * getRpm() * delta / (60 * 1000);
            el.style.setProperty('transform', `rotate(${degrees % 360}deg)`);
            requestAnimationFrame(doRotation);

        };
        requestAnimationFrame(doRotation);
        return () => degrees;
    }

    const getRecordRotationDegrees = rotate(elRecordLabel, () => recordRpm);
    rotate(elStrobeDots, () => platterRpm);

    return {
        set powerOn(value) {
            elStrokeAndLighting.classList.toggle('powerOn', value);
        },
        setRecordRpm(value) {
            if (value !== recordRpm) {
                recordRpm = value;
                eventSource.trigger('speedChange', {recordRpm, totalRotation: getRecordRotationDegrees()});
            }
        },
        setPlatterRpm(value) {
            platterRpm = value;
        },
        setPitchSlider(value) {
            const pitchPercentage = value * 100 - 100;
            movePitchSlider(pitchPercentage);
        },
        setVolume(value) {
            const rotation = 180 * value - 90;
            elVolumeControl.style.transform = `rotate(${rotation}deg)`;
        },
        setAudioFileLoading() {
            elRecordLabel.innerHTML = buildLoadingSvg();
        },
        setAudioFilePath(value, labelText) {
            audioFilePath = value;
            elRecordLabel.innerHTML = buildLabelSvg(audioFilePath, labelText);
        },
        on(eventName) {
            return eventSource.on(eventName);
        }
    };
}