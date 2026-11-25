import * as THREE from "three";
import { loadNationalBuildingPoints } from "../nationalBuildingPoints.js";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { BuildingStore } from "./building-store";
import { geoToWorld, nearbyBuildings, worldToGeo } from "./buildings";
import type { AreaMode, Building, BuildingHit } from "./buildings";

type ChangeBuilding = Pick<Building, "id" | "easting" | "northing" | "fields">;
export type Inspection = { hits: BuildingHit[]; easting: number; northing: number; kind: "click" | "view"; visibleCount?: number };
export type InspectionState = { state: "idle" | "loading" | "ready" | "error"; message: string; kind?: "click" | "view" };

// [돋보기와 전시천리안 투사 / Magnifier and all-seeing projection]
// 원본 폴리곤을 공간 타일에서 읽고, 화면에 보이는 점과 읽을 수 있는 레이블을 투사합니다.
// Query source footprints by spatial tile and project visible points with readable labels.
export function createBuildingExplorer(options: {
    host: HTMLElement; element: HTMLCanvasElement; camera: THREE.Camera; controls: OrbitControls;
    detail: THREE.Group; city: () => THREE.Group | null; mode: () => AreaMode; draw: () => void;
    onStart: (kind: "click" | "view") => number; onInspection: (result: Inspection, token: number) => void; onState: (state: InspectionState, token?: number) => void;
    onProjection: (message: string) => void;
    geographyLabels?: () => { x: number; z: number; name: string; category: string }[];
}) {
    const { host, element, camera, controls, detail, city, mode, draw, onStart, onInspection, onState, onProjection, geographyLabels } = options;
    const abort = new AbortController();
    const store = new BuildingStore(abort.signal);
    const overlay = document.createElement("canvas");
    overlay.className = "area-projection";
    overlay.setAttribute("aria-hidden", "true");
    host.appendChild(overlay);
    const context = overlay.getContext("2d")!;
    let sight = false, magnifier = false, destroyed = false, sequence = 0, clickPending = false;
    let features: Building[] = [];
    let changeFeatures: ChangeBuilding[] = [];
    let changePoints: THREE.Points | null = null, changeLocalPoints: THREE.Points | null = null;
    let changePromise: Promise<void> | null = null, changePointCount = 0, changeError = false;
    let points: THREE.Points | null = null;
    let localPoints: THREE.Points | null = null;
    let pointPromise: Promise<void> | null = null;
    let timer = 0;
    let reservedAt = 0, reserved: {left:number;top:number;right:number;bottom:number}[] = [];
    const frame = host.closest(".view-frame");
    let down: { x: number; y: number } | null = null;
    const raycaster = new THREE.Raycaster();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    const reportProjection = () => onProjection(`${mode() === "local" ? "서울 건물 중 광화문 범위" : "서울 건물 위치 695,753건"} · ${changeError ? "전국 변경 위치를 불러오지 못했습니다. 전시천리안을 다시 켜 주세요." : changePoints ? `분홍색 전국 변경 건물 ${changePointCount.toLocaleString("ko-KR")}건 · 확대해 이름과 지번을 확인하고 돋보기로 상세 조회` : "전국 변경 건물 위치를 불러오는 중"}`);
    // 전국 변경분은 중심점만 불러오고 속성은 선택 주변 타일에서 가져옵니다.
    // Load compact nationwide centroids; detailed fields remain in selected tiles.
    const loadChangePoints = () => {
        if (changePoints || changePromise) return;
        changeError = false;
        changePromise = loadNationalBuildingPoints(abort.signal).then(data => {
            if (destroyed) return;
            const make = (positions: Float32Array, name: string) => {
                const geometry = new THREE.BufferGeometry(); geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
                const material = new THREE.PointsMaterial({ color: 0xe965d3, size: 2.5, sizeAttenuation: false, depthTest: false, transparent: true, opacity: .8 });
                const result = new THREE.Points(geometry, material); result.name = name; result.frustumCulled = false; result.renderOrder = 1001; detail.parent!.add(result); return result;
            };
            changePoints = make(data.seoul, "전국 건물 변경 위치"); changeLocalPoints = make(data.local, "광화문 건물 변경 위치");
            changePointCount = data.count; changePoints.visible = sight && mode() === "seoul"; changeLocalPoints.visible = sight && mode() === "local";
            if (sight) reportProjection(); draw();
        }).catch(() => { if (!destroyed) { changeError = true; if (sight) reportProjection(); } }).finally(() => { changePromise = null; });
    };
    const loadPoints = () => {
        if (points) { points.visible = sight && mode() === "seoul"; if (localPoints) localPoints.visible = sight && mode() === "local"; return; }
        if (pointPromise) return;
        onProjection("전시천리안 위치를 불러오고 있습니다.");
        pointPromise = fetch("/area/building-points.bin", { signal: abort.signal }).then(async response => {
            if (!response.ok) throw new Error("point download failed");
            const buffer = await response.arrayBuffer();
            const header = new DataView(buffer);
            if (buffer.byteLength < 8 || String.fromCharCode(...new Uint8Array(buffer, 0, 4)) !== "GSP1") throw new Error("invalid point header");
            const count = header.getUint32(4, true);
            if (count !== 695753 || buffer.byteLength !== 8 + count * 12) throw new Error("invalid point count");
            if (destroyed) return;
            const positions = new Float32Array(buffer, 8);
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
            const material = new THREE.PointsMaterial({ color: 0xf7d549, size: 1.5, sizeAttenuation: false, depthTest: false, transparent: true, opacity: 0.5 });
            points = new THREE.Points(geometry, material);
            points.name = "전시천리안 서울 건물 위치";
            points.frustumCulled = false; points.renderOrder = 1000; points.visible = sight && mode() === "seoul";
            detail.add(points);
            const local: number[] = [];
            for (let i = 0; i < positions.length; i += 3) {
                if (positions[i] >= -210 && positions[i] <= 240 && positions[i + 2] >= -200 && positions[i + 2] <= 260) local.push(positions[i], positions[i + 1], positions[i + 2]);
            }
            const localGeometry = new THREE.BufferGeometry();
            localGeometry.setAttribute("position", new THREE.Float32BufferAttribute(local, 3));
            localPoints = new THREE.Points(localGeometry, material.clone());
            localPoints.name = "전시천리안 광화문 건물 위치";
            localPoints.frustumCulled = false; localPoints.renderOrder = 1000; localPoints.visible = sight && mode() === "local";
            detail.add(localPoints);
            if (sight) reportProjection();
            draw();
        }).catch(() => { if (!destroyed && sight) onProjection("건물 위치 투사에 실패했습니다. 전시천리안을 다시 켜 주세요."); }).finally(() => { pointPromise = null; });
    };
    const inspect = async (easting: number, northing: number, kind: "click" | "view") => {
        if (kind === "view" && clickPending) return;
        const token = ++sequence;
        if (kind === "click") clickPending = true;
        const selectionToken = onStart(kind);
        onState({ state: "loading", message: "건물 정보를 불러오고 있습니다.", kind }, selectionToken);
        try {
            const data = await store.around(easting, northing);
            if (destroyed || token !== sequence) return;
            const radius = kind === "click" ? (mode() === "seoul" ? 150 : 75) : 600;
            const hits = nearbyBuildings(data, easting, northing, radius);
            if (kind === "view") features = hits.map(hit => hit.building);
            onInspection({ hits, easting, northing, kind }, selectionToken);
            onState({ state: "ready", message: kind === "click" ? `선택 지점 주변 건물 ${hits.length}건` : `중심 주변 건물 ${hits.length}건`, kind }, selectionToken);
            draw();
        } catch {
            if (!destroyed && token === sequence) onState({ state: "error", message: "건물 정보를 불러오지 못했습니다. 다시 선택해 주세요.", kind }, selectionToken);
        } finally {
            if (kind === "click" && token === sequence) clickPending = false;
        }
    };
    const atCenter = () => {
        const point = worldToGeo(mode(), controls.target.x, controls.target.z);
        void inspect(point.easting, point.northing, "view");
    };
    const schedule = () => {
        if (!sight) return;
        window.clearTimeout(timer);
        timer = window.setTimeout(atCenter, 450);
    };
    const pointerDown = (event: PointerEvent) => { down = { x: event.clientX, y: event.clientY }; };
    const pointerUp = (event: PointerEvent) => {
        if (!magnifier || !down || Math.hypot(event.clientX - down.x, event.clientY - down.y) > 6) { down = null; return; }
        down = null;
        window.clearTimeout(timer);
        const rect = element.getBoundingClientRect();
        const pointer = new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
        raycaster.setFromCamera(pointer, camera as THREE.PerspectiveCamera);
        const models = detail.children.filter(child => child.userData.inspectionModel);
        const grid = mode() === "seoul" ? city() : null;
        const candidates = [...models, ...(grid ? grid.children.filter(child => child instanceof THREE.InstancedMesh) : [])];
        let point: THREE.Vector3 | null = raycaster.intersectObjects(candidates, true)[0]?.point || null;
        if (!point) point = raycaster.ray.intersectPlane(plane, new THREE.Vector3());
        if (!point) { onState({ state: "error", message: "지면을 선택해 주세요." }); return; }
        const geo = worldToGeo(mode(), point.x, point.z);
        void inspect(geo.easting, geo.northing, "click");
    };
    element.addEventListener("pointerdown", pointerDown);
    element.addEventListener("pointerup", pointerUp);
    controls.addEventListener("end", schedule);

    return {
        configure(nextSight: boolean, nextMagnifier: boolean) {
            sight = nextSight; magnifier = nextMagnifier;
            overlay.hidden = !sight;
            element.style.cursor = magnifier ? "crosshair" : "";
            if (sight) {
                loadChangePoints();
                if (changePoints) changePoints.visible = mode() === "seoul"; if (changeLocalPoints) changeLocalPoints.visible = mode() === "local";
                if (points) { points.visible = mode() === "seoul"; if (localPoints) localPoints.visible = mode() === "local"; reportProjection(); draw(); }
                else loadPoints();
                schedule();
            } else { sequence++; clickPending = false; if (points) points.visible = false; if (localPoints) localPoints.visible = false; if (changePoints) changePoints.visible = false; if (changeLocalPoints) changeLocalPoints.visible = false; onProjection(""); window.clearTimeout(timer); features = []; draw(); }
        },
        setChangeFeatures(next: ChangeBuilding[]) { changeFeatures = next; draw(); },
        center: atCenter,
        modeChanged() { if (changePoints) changePoints.visible = sight && mode() === "seoul"; if (changeLocalPoints) changeLocalPoints.visible = sight && mode() === "local"; if (points) points.visible = sight && mode() === "seoul"; if (localPoints) localPoints.visible = sight && mode() === "local"; if (points && sight) reportProjection(); schedule(); },
        paint() {
            const width = host.clientWidth, height = host.clientHeight;
            if (overlay.width !== width || overlay.height !== height) { overlay.width = width; overlay.height = height; reservedAt = 0; }
            context.clearRect(0, 0, width, height);
            if (!sight) { overlay.dataset.geographyLabels = "0"; overlay.dataset.nationalLabels = "0"; overlay.dataset.changeLabels = "0"; return; }
            // 지도 출처·조작부와도 이름이 겹치지 않도록 화면 영역을 예약합니다.
            // Reserve attribution and controls as well as previously drawn labels.
            if (performance.now() - reservedAt > 500 || !reservedAt) {
                const origin = host.getBoundingClientRect(); reserved = [];
                for (const element of frame?.querySelectorAll(".map-attribution, .viewer-label, .view-actions, .viewer-hint") || []) {
                    const box = element.getBoundingClientRect();
                    if (box.width && box.height) reserved.push({left:box.left-origin.left,top:box.top-origin.top,right:box.right-origin.left,bottom:box.bottom-origin.top});
                }
                reservedAt = performance.now();
            }
            const occupied: { left: number; top: number; right: number; bottom: number }[] = [...reserved];
            let geographicCount = 0, nationalCount = 0;
            const geographicNames = new Set<string>();
            // 행정구역과 건물 이름은 같은 화면 공간에서 겹치지 않도록 배치합니다.
            // Place administrative and building labels in the same collision space.
            const distance = controls.getDistance();
            const priority = distance > 400000 ? ["province", "national-feature"] : distance > 120000 ? ["province", "national-feature", "district-detail"] : ["district-detail", "admin-detail", "national-feature", "province"];
            const geography = geographyLabels?.() || [];
            const point = new THREE.Vector3();
            for (const category of priority) for (const label of geography) {
                if (label.category !== category || geographicCount >= 36 || (category === "national-feature" && nationalCount >= 16) || geographicNames.has(`${category}:${label.name}`)) continue;
                if (Math.abs(label.x - controls.target.x) > distance * 2 || Math.abs(label.z - controls.target.z) > distance * 2) continue;
                point.set(label.x, 4, label.z).project(camera);
                if (point.z < -1 || point.z > 1 || Math.abs(point.x) > 1 || Math.abs(point.y) > 1) continue;
                const x = (point.x + 1) * width / 2, y = (1 - point.y) * height / 2;
                const text = category === "admin-detail" ? label.name.split(" ").slice(-1)[0] : label.name;
                context.font = "16px sans-serif";
                const textWidth = Math.min(220, context.measureText(text).width + 16), cardHeight = 26;
                const placements = [[0,0],[0,-30],[0,30],[textWidth/2+8,0],[-textWidth/2-8,0],[0,-60]];
                let rect: {left:number;top:number;right:number;bottom:number} | null = null;
                for (const [dx,dy] of placements) {
                    const left = Math.max(0, Math.min(width - textWidth, x - textWidth / 2 + dx));
                    const top = Math.max(0, Math.min(height - cardHeight, y - cardHeight / 2 + dy));
                    const candidate = {left, top, right:left + textWidth, bottom:top + cardHeight};
                    if (!occupied.some(other => candidate.left < other.right + 4 && candidate.right + 4 > other.left && candidate.top < other.bottom + 4 && candidate.bottom + 4 > other.top)) {rect = candidate;break;}
                }
                if (!rect) continue;
                occupied.push(rect); geographicNames.add(`${category}:${label.name}`); geographicCount++; if (category === "national-feature") nationalCount++;
                context.fillStyle = "rgba(28, 47, 43, .9)"; context.fillRect(rect.left, rect.top, textWidth, cardHeight);
                context.fillStyle = "#fff4c7"; context.fillText(text, rect.left + 8, rect.top + 18, textWidth - 16);
            }
            overlay.dataset.geographyLabels = String(geographicCount - nationalCount);
            overlay.dataset.nationalLabels = String(nationalCount);
            overlay.dataset.changeLabels = "0";
            if (distance > 6000) return;
            let labels = 0, changeLabels = 0;
            let buildingIndex = 0;
            for (const building of [...changeFeatures, ...features]) {
                const isChange = buildingIndex++ < changeFeatures.length;
                const point = geoToWorld(mode(), building.easting, building.northing);
                if (mode() === "local" && (point.x < -210 || point.x > 240 || point.z < -200 || point.z > 260)) continue;
                const rawHeight = building.fields[16];
                const h = typeof rawHeight === "number" && rawHeight > 0 && rawHeight < 500 ? rawHeight : 3;
                const projected = new THREE.Vector3(point.x, h + 2, point.z).project(camera);
                if (projected.z < -1 || projected.z > 1 || Math.abs(projected.x) > 1 || Math.abs(projected.y) > 1) continue;
                const x = (projected.x + 1) * width / 2, y = (1 - projected.y) * height / 2;
                context.fillStyle = isChange ? "#e965d3" : "#f7d549"; context.fillRect(x - 2, y - 2, 4, 4);
                if (labels >= 25) continue;
                const address = [building.fields[4], building.fields[5]].filter(value => value !== null && value !== "").join(" ") || "주소 미기재";
                const name = String(building.fields[24] || "건물");
                const use = String(building.fields[9] || "용도 미기재");
                const floors = typeof building.fields[26] === "number" && building.fields[26] > 0 ? `${building.fields[26]}층` : "층수 미기재";
                const heightInfo = typeof rawHeight === "number" && rawHeight > 0 ? `${rawHeight}m` : "높이 미기재";
                const lines = (isChange ? [`${name} · 변경분`, address] : [name, address, `${use} · ${floors} · ${heightInfo}`]).map(line => line.length > 23 ? line.slice(0, 22) + "…" : line);
                context.font = "16px sans-serif";
                const textWidth = Math.min(260, Math.max(...lines.map(line => context.measureText(line).width)) + 12);
                const cardHeight = lines.length * 20 + 8;
                const left = Math.max(0, Math.min(width - textWidth, x + 4));
                const top = Math.max(0, Math.min(height - cardHeight, y - cardHeight));
                const rect = { left, top, right: left + textWidth, bottom: top + cardHeight };
                if (occupied.some(other => rect.left < other.right + 4 && rect.right + 4 > other.left && rect.top < other.bottom + 4 && rect.bottom + 4 > other.top)) continue;
                occupied.push(rect); labels++; if (isChange) changeLabels++;
                context.fillStyle = "rgba(20, 22, 22, .88)"; context.fillRect(left, top, textWidth, cardHeight);
                context.fillStyle = "#ffffff";
                lines.forEach((line, index) => context.fillText(line, left + 6, top + 19 + index * 20, 248));
            }
            overlay.dataset.changeLabels = String(changeLabels);
        },
        dispose() {
            destroyed = true; sequence++; abort.abort(); window.clearTimeout(timer);
            element.removeEventListener("pointerdown", pointerDown); element.removeEventListener("pointerup", pointerUp);
            controls.removeEventListener("end", schedule); overlay.remove();
            if (points) { detail.remove(points); points.geometry.dispose(); (points.material as THREE.Material).dispose(); }
            if (localPoints) { detail.remove(localPoints); localPoints.geometry.dispose(); (localPoints.material as THREE.Material).dispose(); }
            for (const entry of [changePoints, changeLocalPoints]) if (entry) { entry.removeFromParent(); entry.geometry.dispose(); (entry.material as THREE.Material).dispose(); }
        },
    };
}
