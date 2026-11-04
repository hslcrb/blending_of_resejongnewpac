import React from 'react';
import { createRoot } from 'react-dom/client';
import NationalCulturalExplorer from '../src/NationalCulturalExplorer.jsx';
function TestPage() {
 const [selected, setSelected] = React.useState(null);
 return <><NationalCulturalExplorer onSelectLocation={setSelected} /><output style={{display:"block",overflowWrap:"anywhere"}} aria-label="선택 좌표">{selected ? JSON.stringify(selected) : ''}</output></>;
}
createRoot(document.getElementById('root')).render(<TestPage />);
