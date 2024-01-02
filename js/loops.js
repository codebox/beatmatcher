import {baseConfig} from "./config.js";

function choice(arr) {
    return arr[Math.floor(Math.random() * arr.length)]
}
function getBpmRange(bpm) {
    return [bpm * (1 - baseConfig.pitchRangePercent/100), bpm * (1 + baseConfig.pitchRangePercent/100)];
}
function pitchMixable(a1, a2) {
    const [a1Min, a1Max] = getBpmRange(a1.bpm),
        [a2Min, a2Max] = getBpmRange(a2.bpm);
    return Math.max(a1Min, a2Min) < Math.min(a1Max, a2Max);
}
function categoryMixable(a1, a2) {
    return a1.category === 'Drum' || a2.category === 'Drum';
}

export async function buildLoopLibrary() {
    return fetch('audio.json')
        .then(response => response.json())
        .then(loops => {
            return {
                getMixableTrack(currentTrack) {
                    return choice(loops.filter(a => a.bpm !== currentTrack.bpm)
                        .filter(a => pitchMixable(currentTrack, a))
                        .filter(a => categoryMixable(currentTrack, a)));
                },
                getMixablePair() {
                    const audio1 = choice(loops),
                        audio2 = this.getMixableTrack(audio1);

                    return [audio1, audio2];
                },
                getBestMixBpm(a1, a2) {
                    const [slow, fast] = [a1, a2].sort((a, b) => a.bpm - b.bpm),
                        [slowMin, slowMax] = getBpmRange(slow.bpm),
                        [fastMin, fastMax] = getBpmRange(fast.bpm);
                    return (slowMax + fastMin) / 2;
                }
            };
        });
}