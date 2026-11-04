import * as THREE from 'three';
import { gridCellPosition, isDetailedArea, SEJONG_IN_SEOUL } from './area/coordinates.ts';
// [서울 GIS 개요 / Seoul GIS overview]
// 50m 평균 높이이며 상세 회관 자리에 격자를 겹치지 않습니다.
// The grid shows 50m average heights and leaves the detailed campus unobstructed.
export function createCityLayer(data) {
    if (data?.version !== 1 || !Array.isArray(data.cells)) throw new Error('서울 자료 형식이 올바르지 않습니다.');
    const buckets = [[], [], []];
    for (const row of data.cells) {
        if (!Array.isArray(row) || row.length !== 4 || !row.every(Number.isFinite) || row[2] <= 0 || !Number.isInteger(row[3]) || row[3] < 0 || row[3] > 2) throw new Error('서울 격자 값이 올바르지 않습니다.');
        const pos = gridCellPosition(row[0], row[1], row[2]);
        if (!isDetailedArea(pos.x, pos.z)) buckets[row[3]].push(row);
    }
    const group = new THREE.Group(); group.name = '서울 50m 격자';
    const colors = [0xe2e9e6, 0xd2c6ae, 0xc89473];
    for (let index = 0; index < buckets.length; index++) {
        const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(47,1,47), new THREE.MeshStandardMaterial({color:colors[index],roughness:0.9}), buckets[index].length);
        const matrix = new THREE.Matrix4(), scale = new THREE.Vector3(), position = new THREE.Vector3(), rotation = new THREE.Quaternion();
        buckets[index].forEach((row,i)=>{ const pos=gridCellPosition(row[0],row[1],row[2]); position.set(pos.x,pos.y,pos.z); scale.set(1,row[2],1); matrix.compose(position,rotation,scale); mesh.setMatrixAt(i,matrix); });
        mesh.instanceMatrix.needsUpdate = true; if (mesh.count) mesh.computeBoundingSphere(); group.add(mesh);
    }
    const base = new THREE.Mesh(new THREE.PlaneGeometry(44000,34000),new THREE.MeshStandardMaterial({color:0x4c6470,roughness:1}));
    base.rotation.x = -Math.PI / 2; base.position.set(0,-1,-2000);
    base.userData.cityBase = true; base.material.depthWrite = false; base.renderOrder = -1; group.add(base);
    const marker = new THREE.Mesh(new THREE.RingGeometry(250,350,48),new THREE.MeshBasicMaterial({color:0xf7d549,side:THREE.DoubleSide}));
    marker.rotation.x = -Math.PI / 2; marker.position.set(SEJONG_IN_SEOUL.x,100,SEJONG_IN_SEOUL.z); group.add(marker);
    return group;
}
export function disposeCityLayer(group) {
    group.traverse(object => { if (object.geometry) object.geometry.dispose(); if (object.material) object.material.dispose(); });
    group.removeFromParent();
}
