import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";

// --- TYPES AND DATA ---

type Color = { id: string; l: number; a: number; b: number };
type ColorData = Record<string, Color[]>;

type SvgArea = {
  id: string;
  points: string;
  labelPos: { x: number; y: number };
};

type PredefinedImage = {
  id: string;
  name: string;
  url: string;
  viewBox: string;
  areas: SvgArea[];
};

// Access the global color data from index.html
const colorData: ColorData = (window as any).colorData;

// Predefined images for users to choose from
const predefinedImages: PredefinedImage[] = [
 {
  id: 'interior-lavis-auto',
  name: 'Phòng Lavis AI tự nhận diện',
  url: '/interior-lavis-auto.jpg',
  viewBox: '0 0 1920 1280',
  areas: [
      { id: 'ceiling', points: '18.64,-6.45 1830.64,-1.79 1480.83,243.08 410.42,240.75', labelPos: { x: 933.97, y: 108.35 } },
      { id: 'left-wall', points: '-4.67,56.33 380.10,261.74 382.44,777.12 -4.67,893.33', labelPos: { x: 172.99, y: 495.78 } },
      { id: 'back-wall', points: '382.44,271.06 1490.16,271.06 1490.16,765.46 382.44,770.12', labelPos: { x: 935.43, y: 519.43 } },
      { id: 'right-wall', points: '1916.92,21.53 1487.83,275.73 1490.16,763.12 1928.58,926.37', labelPos: { x: 1727.58, y: 495.10 } },
      { id: 'floor', points: '317,773 1240,759 1920,1280 0,1280', labelPos: { x: 960, y: 1180 } }
    ]
},
];

// --- UTILITY FUNCTIONS ---

function lab2rgb(l: number, a: number, b: number) {
    let y = (l + 16) / 116, x = a / 500 + y, z = y - b / 200, r, g, b_val;
    x = 0.95047 * (x * x * x > 0.008856 ? x * x * x : (x - 16 / 116) / 7.787);
    y = 1.00000 * (y * y * y > 0.008856 ? y * y * y : (y - 16 / 116) / 7.787);
    z = 1.08883 * (z * z * z > 0.008856 ? z * z * z : (z - 16 / 116) / 7.787);
    r = x * 3.2406 + y * -1.5372 + z * -0.4986;
    g = x * -0.9689 + y * 1.8758 + z * 0.0415;
    b_val = x * 0.0557 + y * -0.2040 + z * 1.0570;
    r = r > 0.0031308 ? 1.055 * Math.pow(r, 1 / 2.4) - 0.055 : 12.92 * r;
    g = g > 0.0031308 ? 1.055 * Math.pow(g, 1 / 2.4) - 0.055 : 12.92 * g;
    b_val = b_val > 0.0031308 ? 1.055 * Math.pow(b_val, 1 / 2.4) - 0.055 : 12.92 * b_val;
    const toHex = (c: number) => ('0' + Math.round(Math.max(0, Math.min(1, c)) * 255).toString(16)).slice(-2);
    return `#${toHex(r)}${toHex(g)}${toHex(b_val)}`;
}

// Convert a hex color string to an RGBA string with a specified alpha
function hexToRgba(hex: string, alpha: number = 1) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return hex;
    const r = parseInt(result[1], 16);
    const g = parseInt(result[2], 16);
    const b = parseInt(result[3], 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// FIX: New utility function to convert image URL to base64 using a canvas, which is more robust against CORS issues than fetch.
async function urlToBase64(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Không tạo được context'));
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = (err) => reject(err);
    img.src = url;
  });
}


// FIX: Define the styles object that was missing, causing numerous errors.
const styles: { [key: string]: React.CSSProperties } = {
    container: {
        fontFamily: "'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        color: '#333',
        backgroundColor: '#f4f7f6',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
    },
    main: {
        flex: 1,
        width: '100%',
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '20px',
        boxSizing: 'border-box',
    },
    header: {
        backgroundColor: '#ffffff',
        padding: '15px 30px',
        borderBottom: '1px solid #e0e0e0',
        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
        textAlign: 'center',
    },
    headerTitle: {
        margin: 0,
        fontSize: '24px',
        fontWeight: 600,
        color: '#005a9e',
    },
    footer: {
        backgroundColor: '#333',
        color: '#fff',
        textAlign: 'center',
        padding: '15px',
        fontSize: '14px',
    },
    stepIndicatorContainer: {
        display: 'flex',
        justifyContent: 'space-around',
        marginBottom: '40px',
        border: '1px solid #ddd',
        borderRadius: '8px',
        overflow: 'hidden',
    },
    step: {
        flex: 1,
        padding: '15px',
        textAlign: 'center',
        backgroundColor: '#f0f0f0',
        color: '#666',
        borderRight: '1px solid #ddd',
    },
    stepActive: {
        backgroundColor: '#007bff',
        color: 'white',
        fontWeight: 'bold',
    },
    stepContainer: {
        backgroundColor: 'white',
        padding: '40px',
        borderRadius: '8px',
        boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
        textAlign: 'center',
    },
    stepTitle: {
        fontSize: '28px',
        marginBottom: '10px',
        color: '#333',
    },
    stepDescription: {
        fontSize: '16px',
        color: '#666',
        marginBottom: '30px',
        maxWidth: '600px',
        marginLeft: 'auto',
        marginRight: 'auto',
    },
    imageSelectionContainer: {
        display: 'flex',
        justifyContent: 'center',
        gap: '30px',
        flexWrap: 'wrap',
    },
    imageCard: {
        cursor: 'pointer',
        border: '1px solid #ddd',
        borderRadius: '8px',
        overflow: 'hidden',
        transition: 'transform 0.3s, box-shadow 0.3s',
        width: '350px',
        backgroundColor: '#fff',
    },
    imageCardHover: {
        transform: 'translateY(-5px)',
        boxShadow: '0 8px 16px rgba(0,0,0,0.15)',
    },
    imageThumbnail: {
        width: '100%',
        height: '220px',
        objectFit: 'cover',
    },
    imageName: {
        padding: '15px',
        margin: 0,
        fontSize: '18px',
        fontWeight: 500,
    },
    colorSelector: {
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        overflow: 'hidden',
        marginBottom: '30px',
    },
    tabs: {
        display: 'flex',
        backgroundColor: '#f9f9f9',
        flexWrap: 'wrap',
    },
    tabButton: {
        flex: '1 1 auto',
        padding: '15px',
        border: 'none',
        borderBottom: '2px solid transparent',
        borderRight: '1px solid #e0e0e0',
        background: 'none',
        cursor: 'pointer',
        fontSize: '16px',
        fontWeight: 500,
        color: '#555',
    },
    tabButtonActive: {
        color: '#007bff',
        borderBottom: '2px solid #007bff',
        backgroundColor: '#fff',
    },
    palette: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, 100px)',
        justifyContent: 'center',
        gap: '15px',
        padding: '20px',
        maxHeight: '400px',
        overflowY: 'auto',
        backgroundColor: '#fff',
    },
    swatchContainer: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        padding: '5px 0',
    },
    swatch: {
        width: '70px',
        height: '70px',
        borderRadius: '8px',
        cursor: 'pointer',
        border: '2px solid #ccc',
        transition: 'transform 0.2s',
    },
    swatchSelected: {
        border: '3px solid #007bff',
        transform: 'scale(1.1)',
        boxShadow: '0 0 10px rgba(0, 123, 255, 0.5)',
    },
    swatchLabel: {
        marginTop: '8px',
        fontSize: '14px',
        fontWeight: 'bold',
    },
    loadMoreButton: {
        marginTop: '20px',
        padding: '10px 20px',
        fontSize: '16px',
        cursor: 'pointer',
        backgroundColor: '#f0f0f0',
        border: '1px solid #ccc',
        borderRadius: '5px',
    },
    selectedColorsTray: {
        marginTop: '30px',
        padding: '20px',
        backgroundColor: '#f9f9f9',
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
    },
    selectedColorsTitle: {
        textAlign: 'left',
        margin: '0 0 15px 0',
    },
    selectedColorsGrid: {
        display: 'flex',
        gap: '15px',
        flexWrap: 'wrap',
        minHeight: '100px',
    },
    primaryButton: {
        marginTop: '30px',
        padding: '15px 30px',
        fontSize: '18px',
        fontWeight: 'bold',
        cursor: 'pointer',
        backgroundColor: '#28a745',
        color: 'white',
        border: 'none',
        borderRadius: '5px',
        transition: 'background-color 0.3s',
    },
    mixingContainer: {
        backgroundColor: 'white',
        padding: '30px',
        borderRadius: '8px',
        boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
    },
    mixingLayout: {
        display: 'grid',
        gridTemplateColumns: '2fr 1fr',
        gap: '30px',
    },
    imageDisplayContainer: {
        textAlign: 'center',
    },
    imageWrapper: {
        position: 'relative',
        maxWidth: '100%',
        display: 'inline-block',
    },
    svgOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
    },
    clickableArea: {
        cursor: 'pointer',
        transition: 'fill 0.2s, stroke 0.2s, stroke-width 0.2s',
        mixBlendMode: 'overlay',
    },
    areaLabel: {
        fill: 'red',
        fontSize: '60px',
        fontWeight: 'bold',
        textAnchor: 'middle',
        pointerEvents: 'none',
        textShadow: '0 1px 3px rgba(0,0,0,0.5)',
    },
    colorTools: {
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
    },
    toolSection: {
        border: '1px solid #ddd',
        borderRadius: '8px',
        padding: '15px',
    },
    toolTitle: {
        margin: '0 0 15px 0',
        fontSize: '18px',
    },
    paletteGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(60px, 1fr))',
        gap: '10px',
    },
    suggestionCard: {
        border: '1px solid #ccc',
        borderRadius: '5px',
        padding: '10px',
        marginBottom: '10px',
        cursor: 'pointer',
    },
    suggestionColors: {
        display: 'flex',
        gap: '5px',
        marginBottom: '10px',
    },
    suggestionColorDot: {
        width: '25px',
        height: '25px',
        borderRadius: '50%',
    },
    suggestionReason: {
        fontSize: '14px',
        color: '#555',
    },
    actionButtons: {
        marginTop: '20px',
        display: 'flex',
        justifyContent: 'space-between',
        gap: '10px',
    },
    secondaryButton: {
        padding: '12px 25px',
        fontSize: '16px',
        cursor: 'pointer',
        backgroundColor: '#6c757d',
        color: 'white',
        border: 'none',
        borderRadius: '5px',
    },
    loader: {
        border: '5px solid #f3f3f3',
        borderTop: '5px solid #3498db',
        borderRadius: '50%',
        width: '50px',
        height: '50px',
        animation: 'spin 1s linear infinite',
        margin: '20px auto',
    },
    swatchContainerRelative: {
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        padding: '5px 0',
    },
    removeButton: {
        position: 'absolute',
        top: -5,
        right: -5,
        width: '24px',
        height: '24px',
        borderRadius: '50%',
        border: '1px solid #ddd',
        backgroundColor: 'white',
        color: '#888',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '20px',
        lineHeight: '22px',
        padding: 0,
        fontWeight: 'bold',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        transition: 'background-color 0.2s, color 0.2s',
        zIndex: 10,
    },
};

// --- REACT COMPONENTS ---

const Header = () => (
    <header style={styles.header}>
        <h1 style={styles.headerTitle}>Phối màu Lavis Brothers Coating</h1>
    </header>
);

const StepIndicator = ({ currentStep, onStepClick }: { currentStep: number; onStepClick: (step: number) => void; }) => {
    const steps = ['1. Chọn ảnh', '2. Chọn màu', '3. Phối màu & Tải về'];
    return (
        <div style={styles.stepIndicatorContainer}>
            {steps.map((step, index) => {
                const stepNumber = index + 1;
                const isClickable = stepNumber < currentStep;
                return (
                    <div
                        key={step}
                        style={{
                            ...styles.step,
                            ...(currentStep === stepNumber ? styles.stepActive : {}),
                            cursor: isClickable ? 'pointer' : 'default',
                        }}
                        onClick={() => isClickable && onStepClick(stepNumber)}
                    >
                        {step}
                    </div>
                );
            })}
        </div>
    );
};

const Step1_ImageSelection = ({ onImageSelect }: { onImageSelect: (image: PredefinedImage) => void }) => {
    const [hoveredImageId, setHoveredImageId] = useState<string | null>(null);
    return (
        <div style={styles.stepContainer}>
            <h2 style={styles.stepTitle}>Bước 1: Chọn không gian của bạn</h2>
            <p style={styles.stepDescription}>Chọn một trong các không gian nội thất hoặc ngoại thất có sẵn để bắt đầu phối màu.</p>
            <div style={styles.imageSelectionContainer}>
                {predefinedImages.map(image => (
                    <div
                        key={image.id}
                        style={{
                            ...styles.imageCard,
                            ...(hoveredImageId === image.id ? styles.imageCardHover : {})
                        }}
                        onClick={() => onImageSelect(image)}
                        onMouseEnter={() => setHoveredImageId(image.id)}
                        onMouseLeave={() => setHoveredImageId(null)}
                    >
                        <img src={image.url} alt={image.name} style={styles.imageThumbnail} />
                        <h3 style={styles.imageName}>{image.name}</h3>
                    </div>
                ))}
            </div>
        </div>
    );
};


const Step2_ColorSelection = ({ onNextStep, selectedColors, onToggleColor }: { 
    onNextStep: () => void; 
    selectedColors: Color[]; 
    onToggleColor: (color: Color) => void;
}) => {
    const [activeTab, setActiveTab] = useState<string>(Object.keys(colorData)[0]);
    const [visibleCount, setVisibleCount] = useState(100);
    const PALETTE_PAGE_SIZE = 100;

    useEffect(() => {
        setVisibleCount(PALETTE_PAGE_SIZE);
    }, [activeTab]);
    
    const handleNextStep = () => {
        if (selectedColors.length > 0) {
            onNextStep();
        } else {
            alert('Vui lòng chọn ít nhất một màu.');
        }
    };

    const currentPalette = colorData[activeTab] || [];

    return (
        <div style={styles.stepContainer}>
            <h2 style={styles.stepTitle}>Bước 2: Chọn màu sơn bạn yêu thích</h2>
            <p style={styles.stepDescription}>Bạn có thể chọn một hoặc nhiều màu để bắt đầu phối.</p>
            
            <div style={styles.colorSelector}>
                <div style={styles.tabs}>
                    {Object.keys(colorData).map(category => (
                        <button 
                            key={category} 
                            onClick={() => setActiveTab(category)}
                            style={{...styles.tabButton, ...(activeTab === category ? styles.tabButtonActive : {})}}
                        >
                            {category}
                        </button>
                    ))}
                </div>
                <div style={styles.palette}>
                    {currentPalette.slice(0, visibleCount).map(color => {
                        const hex = lab2rgb(color.l, color.a, color.b);
                        const isSelected = selectedColors.some(c => c.id === color.id);
                        return (
                            <div key={color.id} style={styles.swatchContainer} onClick={() => onToggleColor(color)}>
                                <div style={{ ...styles.swatch, backgroundColor: hex, ...(isSelected ? styles.swatchSelected : {}) }}></div>
                                <span style={styles.swatchLabel}>{color.id}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
            
            {visibleCount < currentPalette.length && (
                 <button 
                    onClick={() => setVisibleCount(prev => prev + PALETTE_PAGE_SIZE)} 
                    style={styles.loadMoreButton}
                >
                    Tải thêm màu
                </button>
            )}

            <div style={styles.selectedColorsTray}>
                <h3 style={styles.selectedColorsTitle}>Màu đã chọn: {selectedColors.length}</h3>
                <div style={styles.selectedColorsGrid}>
                {selectedColors.map(color => (
                     <div key={color.id} style={styles.swatchContainer}>
                        <div style={{ ...styles.swatch, backgroundColor: lab2rgb(color.l, color.a, color.b) }}></div>
                        <span style={styles.swatchLabel}>{color.id}</span>
                    </div>
                ))}
                </div>
            </div>
            
            <button onClick={handleNextStep} style={styles.primaryButton}>Tiếp tục</button>
        </div>
    );
};

const Step3_ColorMixing = ({ image, selectedColors, onReset, onColorRemove }: {
    image: PredefinedImage,
    selectedColors: Color[],
    onReset: () => void,
    onColorRemove: (color: Color) => void
}) => {
    const [activeColor, setActiveColor] = useState<string>(lab2rgb(selectedColors[0].l, selectedColors[0].a, selectedColors[0].b));
    const [isLoading, setIsLoading] = useState(false);
    const [aiSuggestions, setAiSuggestions] = useState<any[]>([]);
    const [areaColors, setAreaColors] = useState<Record<string, string>>({});
    const [draggedOverArea, setDraggedOverArea] = useState<string | null>(null);
    const finalImageRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<SVGSVGElement>(null);

    const [editableAreas, setEditableAreas] = useState<SvgArea[]>(() => JSON.parse(JSON.stringify(image.areas)));
    const [isEditMode, setIsEditMode] = useState(false);
    const [draggedItem, setDraggedItem] = useState<{
        type: 'vertex' | 'polygon';
        areaId: string;
        pointIndex?: number;
        startPos: { x: number, y: number };
        originalPoints?: { x: number, y: number }[];
    } | null>(null);
    
    useEffect(() => {
        const init: Record<string, string> = {};
        const firstColor = lab2rgb(selectedColors[0].l, selectedColors[0].a, selectedColors[0].b);
        setActiveColor(firstColor);
        image.areas.forEach(a => {
            if (a.id !== 'window-area' && a.id !== 'floor') {
                init[a.id] = firstColor;
            }
        });
        setAreaColors(init);
        setEditableAreas(JSON.parse(JSON.stringify(image.areas)));
    }, [image.id]);

    useEffect(() => {
        const activeColorExists = selectedColors.some(c => lab2rgb(c.l, c.a, c.b) === activeColor);
        if (!activeColorExists && selectedColors.length > 0) {
            setActiveColor(lab2rgb(selectedColors[0].l, selectedColors[0].a, selectedColors[0].b));
        }
    }, [selectedColors, activeColor]);

    const getSvgCoordinates = (event: MouseEvent | React.MouseEvent) => {
        if (!svgRef.current) return { x: 0, y: 0 };
        const pt = svgRef.current.createSVGPoint();
        pt.x = event.clientX;
        pt.y = event.clientY;
        const screenCTM = svgRef.current.getScreenCTM();
        return screenCTM ? pt.matrixTransform(screenCTM.inverse()) : { x: 0, y: 0 };
    };

    const parsePoints = (pointsStr: string): { x: number, y: number }[] => {
        const pairs = pointsStr.split(' ');
        return pairs.map(pair => {
            const coords = pair.split(',');
            return { x: parseFloat(coords[0]), y: parseFloat(coords[1]) };
        });
    };

    const stringifyPoints = (points: { x: number, y: number }[]): string => {
        return points.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
    };
    
    const calculateCentroid = (points: { x: number, y: number }[]): { x: number, y: number } => {
        let area = 0, cx = 0, cy = 0;
        for (let i = 0; i < points.length; i++) {
            const p1 = points[i];
            const p2 = points[(i + 1) % points.length];
            const crossProduct = (p1.x * p2.y - p2.x * p1.y);
            area += crossProduct;
            cx += (p1.x + p2.x) * crossProduct;
            cy += (p1.y + p2.y) * crossProduct;
        }
        area /= 2;
        if (Math.abs(area) < 1e-6) { // Fallback for collinear points
            return points.reduce((acc, p) => ({ x: acc.x + p.x / points.length, y: acc.y + p.y / points.length }), { x: 0, y: 0 });
        }
        return { x: cx / (6 * area), y: cy / (6 * area) };
    };

    const handleVertexMouseDown = (e: React.MouseEvent, areaId: string, pointIndex: number) => {
        if (!isEditMode) return;
        e.stopPropagation();
        setDraggedItem({ type: 'vertex', areaId, pointIndex, startPos: getSvgCoordinates(e) });
    };
    
    const handlePolygonMouseDown = (e: React.MouseEvent, areaId: string) => {
        if (!isEditMode) return;
        const currentArea = editableAreas.find(a => a.id === areaId);
        if (!currentArea) return;
        setDraggedItem({ type: 'polygon', areaId, startPos: getSvgCoordinates(e), originalPoints: parsePoints(currentArea.points) });
    };

    const handleMouseMove = useCallback((event: MouseEvent) => {
        if (!draggedItem || !isEditMode) return;
        
        const { x, y } = getSvgCoordinates(event);
        const dx = x - draggedItem.startPos.x;
        const dy = y - draggedItem.startPos.y;

        setEditableAreas(prevAreas => prevAreas.map(area => {
            if (area.id !== draggedItem.areaId) return area;

            if (draggedItem.type === 'vertex' && draggedItem.pointIndex !== undefined) {
                const points = parsePoints(area.points);
                points[draggedItem.pointIndex] = { x, y };
                return { ...area, points: stringifyPoints(points), labelPos: calculateCentroid(points) };
            }

            if (draggedItem.type === 'polygon' && draggedItem.originalPoints) {
                const newPoints = draggedItem.originalPoints.map(p => ({ x: p.x + dx, y: p.y + dy }));
                return { ...area, points: stringifyPoints(newPoints), labelPos: { x: area.labelPos.x + dx, y: area.labelPos.y + dy } };
            }
            return area;
        }));
    }, [draggedItem, isEditMode]);

    const handleMouseUp = useCallback(() => {
        setDraggedItem(null);
    }, []);

    useEffect(() => {
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [handleMouseMove, handleMouseUp]);


   const handleDownload = async () => {
  try {
    // 1️⃣ Tạo ảnh nền dưới dạng base64
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = image.url;

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = img.width;
      canvas.height = img.height;

      // 2️⃣ Vẽ ảnh nền
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // 3️⃣ Vẽ vùng phối màu (areaColors)
      editableAreas.forEach(area => {
        const color = areaColors[area.id];
        if (!color) return;

        const path = new Path2D(area.points.replace(/ /g, ' L') + ' Z');
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.4;
        ctx.fill(path);
      });

      // 4️⃣ Xuất ảnh PNG
      const link = document.createElement('a');
      link.download = `phoi-mau-lavis-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };

    img.onerror = (err) => {
      console.error('Không tải được ảnh:', err);
      alert('Ảnh bị chặn hoặc không truy cập được.');
    };
  } catch (e) {
    console.error('Lỗi khi lưu ảnh:', e);
  }
};



    const getAiSuggestions = async () => {
        setIsLoading(true);
        setAiSuggestions([]);
        try {
            // ... AI call logic would go here
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const applySuggestion = (suggestion: any) => {
        const newAreaColors = { ...areaColors };
        const suggestionHexColors = suggestion.palette;
        editableAreas
            .filter(a => a.id !== 'window-area' && a.id !== 'floor')
            .forEach((area, index) => {
                newAreaColors[area.id] = suggestionHexColors[index % suggestionHexColors.length];
            });
        setAreaColors(newAreaColors);
    };


    return (
        <div style={styles.mixingContainer}>
            <div style={styles.mixingLayout}>
                <div style={styles.imageDisplayContainer}>
                    <h3 style={styles.stepTitle}>Phối màu trực tiếp</h3>
                    <p style={styles.stepDescription}>Nhấn vào một màu bên phải để chọn, sau đó nhấn vào khu vực trên ảnh để tô màu. Hoặc, kéo và thả màu vào khu vực bạn muốn.</p>
                    <div ref={finalImageRef} style={{ display: 'grid', width: '100%', position: 'relative' }}>
                        <img
                            src={image.url}
                            alt={image.name}
                            style={{
                                gridArea: '1 / 1 / 2 / 2',
                                width: '100%',
                                height: 'auto',
                                pointerEvents: 'none',
                                userSelect: 'none',
                            }}
                        />
                        <svg
                            ref={svgRef}
                            viewBox={image.viewBox}
                            preserveAspectRatio="xMidYMid meet"
                            style={{
                                gridArea: '1 / 1 / 2 / 2',
                                width: '100%',
                                height: '100%',
                                pointerEvents: 'auto',
                                zIndex: 5,
                            }}
                        >
                            {editableAreas.filter(area => area.id !== 'floor').map(area => (
                                <g
                                    key={area.id}
                                    onClick={() => !isEditMode && setAreaColors(prev => ({ ...prev, [area.id]: activeColor }))}
                                    onDragOver={(e) => e.preventDefault()}
                                    onDragEnter={(e) => { e.preventDefault(); setDraggedOverArea(area.id); }}
                                    onDragLeave={(e) => { e.preventDefault(); setDraggedOverArea(null); }}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        setDraggedOverArea(null);
                                        document.body.style.cursor = 'default';
                                        const colorHex = e.dataTransfer.getData('colorHex');
                                        if (colorHex) {
                                            setAreaColors(prev => ({ ...prev, [area.id]: colorHex }));
                                        }
                                    }}
                                >
                                    <polygon
                                        points={area.points}
                                        onMouseDown={(e) => handlePolygonMouseDown(e, area.id)}
                                        style={{
                                            ...styles.clickableArea,
                                            fill: areaColors[area.id] ? hexToRgba(areaColors[area.id], 0.40) : 'rgba(255, 0, 0, 0.05)',
                                            stroke: draggedOverArea === area.id ? '#007bff' : (areaColors[area.id] || area.id === 'window-area' ? 'transparent' : 'red'),
                                            strokeWidth: draggedOverArea === area.id ? 15 : (areaColors[area.id] || area.id === 'window-area' ? 0 : 3),
                                            cursor: isEditMode ? 'move' : styles.clickableArea.cursor,
                                        }}
                                    />
                                    {area.id !== 'window-area' && !areaColors[area.id] && (
                                        <text x={area.labelPos.x} y={area.labelPos.y} style={styles.areaLabel}>+</text>
                                    )}
                                </g>
                            ))}
                             {isEditMode && editableAreas.filter(area => area.id !== 'floor').flatMap(area =>
                                parsePoints(area.points).map((point, index) => (
                                    <circle
                                        key={`${area.id}-p${index}`}
                                        cx={point.x}
                                        cy={point.y}
                                        r="15"
                                        fill="rgba(0, 123, 255, 0.7)"
                                        stroke="white"
                                        strokeWidth="2"
                                        cursor="move"
                                        style={{ pointerEvents: 'all' }}
                                        onMouseDown={(e) => handleVertexMouseDown(e, area.id, index)}
                                    />
                                ))
                            )}
                        </svg>
                    </div>
                </div>

                <div style={styles.colorTools}>
                    <div style={styles.toolSection}>
                        <h4 style={styles.toolTitle}>Bảng màu của bạn</h4>
                        <div style={styles.paletteGrid}>
                            {selectedColors.map(color => {
                                const hex = lab2rgb(color.l, color.a, color.b);
                                return (
                                    <div key={color.id} style={styles.swatchContainerRelative}>
                                        <div
                                            draggable="true"
                                            onDragStart={(e) => {
                                                e.dataTransfer.setData('colorHex', hex);
                                                document.body.style.cursor = 'grabbing';
                                            }}
                                            onDragEnd={() => {
                                                document.body.style.cursor = 'default';
                                                setDraggedOverArea(null);
                                            }}
                                            style={{ ...styles.swatch, backgroundColor: hex, width: 60, height: 60, cursor: 'grab', ...(activeColor === hex ? styles.swatchSelected : {}) }}
                                            onClick={() => setActiveColor(hex)}
                                        />
                                        <button onClick={() => onColorRemove(color)} style={styles.removeButton}>&times;</button>
                                        <span style={styles.swatchLabel}>{color.id}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    
                    <div style={styles.toolSection}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                            <h4 style={styles.toolTitle}>Chế độ chỉnh sửa</h4>
                            <input type="checkbox" checked={isEditMode} onChange={e => setIsEditMode(e.target.checked)} style={{ transform: 'scale(1.5)' }}/>
                        </div>
                        <p style={{fontSize: 14, color: '#666', margin: 0}}>Bật để kéo thả các điểm hoặc toàn bộ vùng phủ để điều chỉnh.</p>
                    </div>

                    {isEditMode && (
                        <div style={styles.toolSection}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                                <h4 style={styles.toolTitle}>Toạ độ các lớp phủ</h4>
                                <button onClick={() => navigator.clipboard.writeText(JSON.stringify(editableAreas, null, 2))} style={{padding: '5px 10px', cursor: 'pointer'}}>
                                    Sao chép
                                </button>
                            </div>
                            <textarea
                                readOnly
                                style={{ width: '100%', height: '150px', whiteSpace: 'pre', overflow: 'auto', fontFamily: 'monospace', fontSize: '12px', border: '1px solid #ccc', borderRadius: '4px', padding: '10px', backgroundColor: '#f9f9f9', resize: 'vertical' }}
                                value={JSON.stringify(editableAreas.map(a => ({ id: a.id, points: a.points, labelPos: {x: a.labelPos.x.toFixed(2), y: a.labelPos.y.toFixed(2)} })), null, 2)}
                            />
                        </div>
                    )}


                    <div style={styles.toolSection}>
                        <h4 style={styles.toolTitle}>Gợi ý từ AI</h4>
                        <button onClick={getAiSuggestions} disabled={isLoading} style={{ ...styles.primaryButton, width: '100%', marginTop: 0 }}>
                            {isLoading ? 'Đang xử lý...' : 'Lấy gợi ý'}
                        </button>
                        {isLoading && <div style={styles.loader}></div>}
                        <div>
                            {aiSuggestions.map((s, i) => (
                                <div key={i} style={styles.suggestionCard} onClick={() => applySuggestion(s)}>
                                    <div style={styles.suggestionColors}>
                                        {s.palette.map((hex: string) => <div key={hex} style={{ ...styles.suggestionColorDot, backgroundColor: hex }} />)}
                                    </div>
                                    <p style={styles.suggestionReason}>{s.reason}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                        <button onClick={onReset} style={styles.secondaryButton}>Làm lại từ đầu</button>
                        <button onClick={handleDownload} style={{ ...styles.primaryButton, flex: 1, backgroundColor: '#007bff' }}>Tải ảnh về</button>
                    </div>
                </div>
            </div>
        </div>
    );
};


const App = () => {
    const [currentStep, setCurrentStep] = useState(1);
    const [selectedImage, setSelectedImage] = useState<PredefinedImage | null>(null);
    const [selectedColors, setSelectedColors] = useState<Color[]>([]);

    useEffect(() => {
        const styleSheet = document.createElement("style");
        styleSheet.type = "text/css";
        styleSheet.innerText = `
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(styleSheet);
        return () => {
            document.head.removeChild(styleSheet);
        };
    }, []);
    
    useEffect(() => {
        if (currentStep === 3 && selectedColors.length === 0) {
            alert("Bạn đã xoá hết màu. Vui lòng chọn lại màu.");
            setCurrentStep(2);
        }
    }, [selectedColors, currentStep]);

    const handleImageSelect = (image: PredefinedImage) => {
        setSelectedImage(image);
        setCurrentStep(2);
    };

    const handleToggleColor = useCallback((color: Color) => {
        setSelectedColors(prev =>
            prev.find(c => c.id === color.id) 
                ? prev.filter(c => c.id !== color.id) 
                : [...prev, color]
        );
    }, []);

    const handleRemoveColor = useCallback((colorToRemove: Color) => {
        setSelectedColors(prev => prev.filter(c => c.id !== colorToRemove.id));
    }, []);

    const handleProceedToMixing = () => {
        if (selectedColors.length > 0) {
            setCurrentStep(3);
        } else {
            alert('Vui lòng chọn ít nhất một màu.');
        }
    };

    const handleReset = () => {
        setCurrentStep(1);
        setSelectedImage(null);
        setSelectedColors([]);
    };
    
    const handleStepClick = (step: number) => {
        if (step < currentStep) {
            if (step === 1) {
                handleReset();
            } else {
                setCurrentStep(step);
            }
        }
    };


    const renderStep = () => {
        switch (currentStep) {
            case 1:
                return <Step1_ImageSelection onImageSelect={handleImageSelect} />;
            case 2:
                return <Step2_ColorSelection 
                            onNextStep={handleProceedToMixing} 
                            selectedColors={selectedColors}
                            onToggleColor={handleToggleColor}
                        />;
            case 3:
                if (selectedImage && selectedColors.length > 0) {
                    return <Step3_ColorMixing 
                                image={selectedImage} 
                                selectedColors={selectedColors} 
                                onReset={handleReset} 
                                onColorRemove={handleRemoveColor}
                            />;
                }
                // If we land here without colors/image, something is wrong, reset.
                // The useEffect hook will handle navigation if colors run out.
                return null;
            default:
                return <Step1_ImageSelection onImageSelect={handleImageSelect} />;
        }
    };

    return (
        <div style={styles.container}>
            <Header />
            <main style={styles.main}>
                <StepIndicator currentStep={currentStep} onStepClick={handleStepClick} />
                {renderStep()}
            </main>
            <footer style={styles.footer}>
                <p>&copy; 2024 Lavis Brothers Coating. All rights reserved.</p>
            </footer>
        </div>
    );
};

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(<App />);
}
