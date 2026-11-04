// [내장 프레임 크기 통신 / Embedded frame sizing]
// 허용된 리뉴얼 사이트에만 내용 높이를 알려 내부 이중 스크롤을 줄입니다.
// Send content height only to known parent origins to avoid nested scrolling.
const PARENTS = ['https://renewsejongpac.rhee.life','http://127.0.0.1:3137','http://127.0.0.1:8137'];
export function createEmbedBridge({ root, parent, Observer = ResizeObserver, requestFrame = requestAnimationFrame }) {
    let active = true, pending = false, last = 0;
    const notify = () => {
        if (!active || pending) return;
        pending = true;
        requestFrame(() => {
            pending = false;
            if (!active) return;
            const height = Math.max(200, Math.min(20000, Math.ceil(root.scrollHeight)));
            if (!Number.isFinite(height) || height === last) return;
            last = height;
            for (const origin of PARENTS) parent.postMessage({ type:'sejong3d:height', version:1, height }, origin);
        });
    };
    const observer = new Observer(notify);
    observer.observe(root); notify();
    return () => { active = false; observer.disconnect(); };
}
