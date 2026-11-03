// 숨긴 시간은 기기 성능 측정에서 제외합니다. / Exclude paused time from device frame-rate sampling.
export function createSlowFrameDetector() {
    let started = null; let frames = 0;
    return {
        sample(time, active = true) {
            if (!active) { started = null; frames = 0; return false; }
            if (started === null) { started = time; return false; }
            const elapsed = time - started - 4000;
            if (elapsed <= 0) return false;
            frames += 1;
            if (elapsed < 3000) return false;
            const slow = frames * 1000 / elapsed < 25;
            started = time; frames = 0;
            return slow;
        },
    };
}
