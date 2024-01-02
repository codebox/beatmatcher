import {buildPlayerView} from "./playerView.js";
import {buildPlayerAudio} from "./playerAudio.js";
import {buildEventSource} from "../event.js";

const changeSpeed = (() => {
    const intervalIds = {}, updateInterval = 1000/60;
    return (type, playerId, getRpm, setRpm, targetRpm, rpmChangePerSec) => {
        const intervalId = `${type}-${playerId}`;
        if (intervalIds[intervalId]) {
            clearInterval(intervalIds[intervalId]);
        }
        if (getRpm() === targetRpm) {
            return;
        }

        const totalRpmDiff = targetRpm - getRpm(),
            totalDecayTimeSeconds = Math.abs(totalRpmDiff) / rpmChangePerSec,
            rpmDelta = totalRpmDiff / totalDecayTimeSeconds * updateInterval / 1000;
        intervalIds[intervalId] = setInterval(() => {
            const newRpm = rpmDelta > 0 ?
                Math.min(targetRpm, getRpm() + rpmDelta) :
                Math.max(targetRpm, getRpm() + rpmDelta);
            setRpm(newRpm);
            if (newRpm === targetRpm) {
                clearInterval(intervalIds[intervalId]);
                delete intervalIds[intervalId];
            }
        }, updateInterval);
    };
})();

let nextPlayerId = 0;
export function buildPlayer(config) {
    const view = buildPlayerView(config),
        model = {
            platterRpm: 0,
            recordRpm: 0,
            trackLoaded: false,
            powerOn: false,
            motorOn: false,
            holding: false
        },
        eventSource = buildEventSource();

    let audioPlayer, playerId = nextPlayerId++;

    function initAudioIfRequired() {
        if (!audioPlayer) {
            return buildPlayerAudio(config).then(audio => {
                // audio.volume = 1;
                view.on('speedChange').then(event => {
                    const {recordRpm, totalRotation} = event.data,
                        totalRevolutions = totalRotation / 360,
                        totalPlayTimeInSeconds = totalRevolutions / (config.baseRpm / 60),
                        newPlaybackRate = recordRpm / config.baseRpm;
                    audio.updatePlaybackRate(newPlaybackRate, totalPlayTimeInSeconds);
                });
                audioPlayer = audio;
            });
        }
        return Promise.resolve();
    }

    function onPlatterSpeedChanged(newPlatterSpeed) {
        view.setPlatterRpm(model.platterRpm = newPlatterSpeed);
        if (!model.holding) {
            onRecordSpeedChanged(newPlatterSpeed);
        }
        eventSource.trigger('speedChange', newPlatterSpeed / config.baseRpm);
    }

    function onRecordSpeedChanged(newRecordSpeed) {
        view.setRecordRpm(model.recordRpm = newRecordSpeed);
    }

    view.on('manualRotation').then(event => {
        onRecordSpeedChanged(event.data);
    });
    view.on('holdOn').then(event => {
        onRecordSpeedChanged(0);
    });
    view.on('holdOff').then(event => {
        const finalRpm = model.platterRpm,
            rpmChangePerSecond = 1 / (1 - config.recordFriction) - 1;

        changeSpeed('record', playerId,() => model.recordRpm, onRecordSpeedChanged, finalRpm, rpmChangePerSecond);
    });

    let sliderRpm = config.baseRpm;
    view.on('pitchChange').then(event => {
        const pitch = event.data;
        sliderRpm = config.baseRpm * pitch;
        if (model.motorOn) {
            onPlatterSpeedChanged(sliderRpm);
        }
    });

    const nudgeAmount = 0.0005;
    view.on('nudgePitchDown').then(() => {
        player.pitch -= nudgeAmount;
    });
    view.on('nudgePitchUp').then(() => {
        player.pitch += nudgeAmount;
    });

    function onStartStopClick(motorOn) {
        if (!model.powerOn) {
            return;
        }
        const newMotorOnValue = motorOn === undefined ? !model.motorOn : motorOn,
            finalRpm = newMotorOnValue ? sliderRpm : 0,
            rpmChangePerSecond = 1 / config.platterInertia;
        changeSpeed('platter', playerId,() => model.platterRpm, onPlatterSpeedChanged, finalRpm, rpmChangePerSecond);

        model.motorOn = newMotorOnValue;
    }
    view.on('startStopClick').then(() => onStartStopClick());

    function onPowerClick(powerOn) {
        view.powerOn = model.powerOn = (powerOn === undefined ? !model.powerOn : powerOn);
        model.motorOn = false;

        const rpmChangePerSecond = 1 / (1 - config.platterFriction) - 1;
        changeSpeed('platter', playerId, () => model.platterRpm, onPlatterSpeedChanged, 0, rpmChangePerSecond);

        return initAudioIfRequired();
    }
    view.on('powerClick').then(() => onPowerClick());

    function setVolume(volume) {
        audioPlayer.volume = volume * 2;
        view.setVolume(volume);
    }
    view.on('volumeChange').then(e => setVolume(e.data));

    const player = {
        get pitch() {
            return model.platterRpm / config.baseRpm;
        },
        set pitch(value) {
            view.setPitchSlider(value);
            if (model.powerOn && model.motorOn) {
                onPlatterSpeedChanged(sliderRpm = config.baseRpm * value);
            }
        },
        get duration() {
            return audioPlayer.duration;
        },
        get offset() {
            if (audioPlayer){
                return audioPlayer.offset;
            }
        },
        set offset(value) {
            if (audioPlayer) {
                audioPlayer.offset = value;
            }
        },
        powerOn() {
            return onPowerClick(true);
        },
        motorOn() {
            onStartStopClick(true);
        },
        on(eventName) {
            return eventSource.on(eventName);
        },
        load(loop) {
            const audioFilePath = loop.file,
                labelText = loop.title;
            view.setAudioFileLoading();
            this.pitch = 1;
            return initAudioIfRequired().then(() => {
                return audioPlayer.setAudioFilePath(audioFilePath).then(() => {
                    view.setAudioFilePath(audioFilePath, labelText);
                    setVolume(0.5);
                });
            });
        }
    }

    return player;
}

export const LEFT_CHANNEL = 0,
    RIGHT_CHANNEL = 1;
//
// window.onload = function() {
//     const el = document.getElementById('container');
//     buildPlayer({
//         audioFilePath: 'audio/count.mp3',
//         audioChannel: LEFT_CHANNEL,
//         parentElement: el,
//         pitchRangePercent: 10,
//         baseRpm: 100/3,
//         recordFriction: 0.999,  // 0-1 0 = no friction, 1 = max friction (don't set it to 0)
//         platterInertia: 0.01, // 0-1 0 = no inertia, 1 = max inertia (don't set it to 1)
//         platterFriction: 0.9  // 0-1 0 = no friction, 1 = max friction (don't set it to 0) takes effect when power is turned off while deck is moving
//     });
// }