import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BuildingInformationPanel, useBuildingInformation } from '../src/area/BuildingInformation.jsx';
import { BuildingStore } from '../src/area/building-store.ts';
function Harness(){
 const [sight,setSight]=useState(true);const info=useBuildingInformation();
 const delayed=async()=>{const token=info.onStart('click');const store=new BuildingStore(new AbortController().signal);const building=(await store.tile(197,552))[0];setTimeout(()=>info.onInspection({hits:[{building,contains:true,distance:0}],easting:building.easting,northing:building.northing,kind:'click'},token),1800)};
 return <><button onClick={()=>setSight(v=>!v)}>toggle sight</button><button onClick={delayed}>delayed prior click</button><BuildingInformationPanel sight={sight} inspection={info.inspection} onSelectBuilding={info.onSelectBuilding}/></>;
}
createRoot(document.getElementById('root')).render(<Harness/>);
