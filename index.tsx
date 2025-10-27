
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, GenerateContentResponse, Type, Chat } from "@google/genai";

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
  name: 'Không gian nội thất - Mẫu 1',
  url: 'https://simplythebest.vn/wp-content/uploads/2025/10/—Pngtree—immaculate-interiors-and-decor-a_15228478-scaled.jpg',
  viewBox: '0 0 1920 1080',
  areas: [
      { id: 'ceiling', points: '18.64,-6.45 1830.64,-1.79 1480.83,243.08 410.42,240.75', labelPos: { x: 933.97, y: 108.35 } },
      { id: 'left-wall', points: '-4.67,56.33 380.10,261.74 382.44,777.12 -4.67,893.33', labelPos: { x: 172.99, y: 495.78 } },
      { id: 'back-wall', points: '382.44,271.06 1490.16,271.06 1490.16,765.46 382.44,770.12', labelPos: { x: 935.43, y: 519.43 } },
      { id: 'right-wall', points: '1916.92,21.53 1487.83,275.73 1490.16,763.12 1928.58,926.37', labelPos: { x: 1727.58, y: 495.10 } },
      { id: 'floor', points: '317,773 1240,759 1920,1280 0,1280', labelPos: { x: 960, y: 1180 } }
    ]
},
{
  id: 'interior-lavis-auto-2',
  name: 'Không gian nội thất - Mẫu 2',
  url: 'https://simplythebest.vn/wp-content/uploads/2025/10/minimalist-white-living-room.jpg',
  viewBox: '0 0 1920 1080',
  areas: [
    { id: 'left-wall', points: '4.78,1115.38 2.39,-189.26 527.12,249.59 524.73,492.87 519.96,686.06 190.82,729.00 145.50,209.04 66.79,1098.68', labelPos: { x: 147.89715832621144, y: 526.1809556736165 } },
    { id: 'back-wall', points: '524.72,247.21 1397.66,247.21 1400.05,843.48 1099.53,824.40 777.54,824.40 765.62,774.33 634.44,767.17 519.96,686.07', labelPos: { x: 880.440026158362, y: 544.9357206357013 } },
    { id: 'right-wall', points: '1395.27,247.21 1841.29,-136.79 1915.22,-139.17 1905.68,430.86 1908.07,843.48 1905.68,1110.61 1397.66,845.87 1397.65,471.41', labelPos: { x: 1708.2465674323519, y: 522.9635313118794 } },
    { id: 'floor', points: '-4.77,1875.97 645.23,1795.97 1345.23,1795.97 1915.23,1875.97 1915.23,2245.97 -4.77,2245.97', labelPos: { x: 973, y: 1006 } },
    { id: 'ceiling', points: '-149.27,9.88 59.63,-143.94 1843.68,-141.56 1581.32,85.02 1395.28,249.60 934.96,251.98 522.34,249.60 71.55,-129.63', labelPos: { x: 870.4544988733553, y: 124.65243410426255 } }
  ]
},
{
  id: 'exterior-lavis-auto',
  name: 'Ngoại thất - Mẫu 1',
  url: 'https://simplythebest.vn/wp-content/uploads/2025/10/z7091425106635_707168f0bb36a92828c2596d0529f5de.jpg',
  viewBox: '0 0 2560 1440',
  areas: [
    { id: 'roof', points: '1116.25,230.13 1464.50,481.99 1455.17,942.17 1116.25,976.37', labelPos: { x: 1274.65, y: 651.74 } },
    { id: 'main-wall', points: '1461.39,628.13 2225.71,481.94 2229.39,873.77 1455.17,942.17', labelPos: { x: 1857.30, y: 729.89 } },
    { id: 'side-wall', points: '220.76,404.26 939.02,80.89 945.24,942.17 226.98,1016.80', labelPos: { x: 603.15, y: 605.27 } },
    { id: 'foundation', points: '2223.17,1309.07 2232.50,264.34 2338.22,230.13 2335.11,1290.42', labelPos: { x: 2282.37, y: 778.55 } }
  ]
},
{
  id: 'exterior-lavis-auto-2',
  name: 'Ngoại thất - Mẫu 2',
  url: 'https://simplythebest.vn/wp-content/uploads/2025/10/hinh-ngoai-that-2-7469-scaled.jpg',
  viewBox: '0 0 2560 1440',
  areas: [
    { id: 'main-wall', points: '2058.38,990.46 2562.09,1142.82 1971.32,1189.46 1588.87,1055.76', labelPos: { x: 2055.8176128712284, y: 1094.9267830860053 } },
    { id: 'garage-wall', points: '310.93,707.51 581.44,573.81 578.34,900.29 320.26,981.14', labelPos: { x: 451.2246590450268, y: 788.0450716115596 } },
    { id: 'balcony-wall', points: '873.72,303.30 1041.63,365.49 342.03,701.30 254.97,663.98', labelPos: { x: 659.90569816736, y: 491.81563095892085 } },
    { id: 'roof-trim', points: '1159.78,744.83 1156.67,1086.85 1427.18,1046.43 1616.85,1077.52 1626.18,741.72 1427.18,670.20', labelPos: { x: 1390.1807099758198, y: 884.8988151869524 } },
    { id: 'accent-panels', points: '771.11,586.25 1026.08,471.20 1029.19,981.14 771.11,1027.78', labelPos: { x: 902.4884201177965, y: 766.057875778678 } },
    { id: 'pillar', points: '1103.81,238.01 1436.51,54.55 1433.40,629.78 1106.92,729.28', labelPos: { x: 1274.347012980372, y: 410.27020083288 } }
  ]
}
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

const styles: { [key: string]: React.CSSProperties } = {
    container: {
        fontFamily: "'Be Vietnam Pro', sans-serif",
        color: '#333',
        backgroundColor: '#f4f7f6',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
    },
    main: {
        flex: 1,
        width: '100%',
        maxWidth: '1600px',
        margin: '0 auto',
        padding: '20px',
        boxSizing: 'border-box',
    },
    header: {
        backgroundColor: '#005a9e',
        padding: '10px 30px',
        borderBottom: '1px solid #e0e0e0',
        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
    },
    logo: {
      height: '60px',
      width: 'auto',
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
        backgroundColor: 'white',
        borderRadius: '50px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        padding: '5px',
        position: 'relative',
    },
    step: {
        flex: 1,
        padding: '12px 20px',
        textAlign: 'center',
        backgroundColor: 'transparent',
        color: '#666',
        borderRadius: '50px',
        fontWeight: 500,
        transition: 'color 0.3s, background-color 0.3s',
        zIndex: 2,
        border: 'none',
        fontSize: '16px',
    },
    stepActive: {
        backgroundColor: '#007bff',
        color: 'white',
        boxShadow: '0 2px 5px rgba(0,123,255,0.3)',
    },
    stepContainer: {
        backgroundColor: 'white',
        padding: '40px',
        borderRadius: '12px',
        boxShadow: '0 6px 16px rgba(0,0,0,0.07)',
        textAlign: 'center',
    },
    stepTitle: {
        fontSize: '28px',
        marginBottom: '10px',
        color: '#333',
        fontWeight: 600,
    },
    stepDescription: {
        fontSize: '16px',
        color: '#666',
        marginBottom: '40px',
        maxWidth: '700px',
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
        border: '1px solid #e0e0e0',
        borderRadius: '12px',
        overflow: 'hidden',
        transition: 'transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease',
        width: '350px',
        backgroundColor: '#fff',
    },
    imageCardHover: {
        transform: 'translateY(-8px)',
        boxShadow: '0 12px 24px rgba(0,0,0,0.1)',
        borderColor: '#007bff',
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
        borderRadius: '12px',
        overflow: 'hidden',
        marginBottom: '30px',
    },
    tabs: {
        display: 'flex',
        backgroundColor: '#f9f9f9',
        flexWrap: 'wrap',
        borderBottom: '1px solid #e0e0e0',
    },
    tabButton: {
        flex: '1 1 auto',
        padding: '15px',
        border: 'none',
        borderBottom: '3px solid transparent',
        background: 'none',
        cursor: 'pointer',
        fontSize: '16px',
        fontWeight: 500,
        color: '#555',
        transition: 'color 0.3s, border-bottom-color 0.3s',
    },
    tabButtonActive: {
        color: '#007bff',
        borderBottomColor: '#007bff',
        backgroundColor: '#fff',
    },
    palette: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
        justifyContent: 'center',
        gap: '20px',
        padding: '25px',
        maxHeight: '450px',
        overflowY: 'auto',
        backgroundColor: '#fff',
    },
    swatchContainer: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        cursor: 'pointer',
    },
    swatch: {
        width: '60px',
        height: '60px',
        borderRadius: '50%',
        cursor: 'pointer',
        border: '3px solid #f0f0f0',
        transition: 'transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
    },
    swatchHover: {
        borderColor: '#007bff',
        transform: 'scale(1.08)',
    },
    swatchSelected: {
        borderColor: '#007bff',
        transform: 'scale(1.15)',
        boxShadow: '0 0 12px rgba(0, 123, 255, 0.6)',
    },
    swatchLabel: {
        marginTop: '8px',
        fontSize: '13px',
        fontWeight: '500',
        color: '#444'
    },
    loadMoreButton: {
        marginTop: '20px',
        padding: '10px 20px',
        fontSize: '16px',
        cursor: 'pointer',
        backgroundColor: '#f0f0f0',
        border: '1px solid #ccc',
        borderRadius: '5px',
        transition: 'background-color 0.2s, border-color 0.2s',
    },
    selectedColorsTray: {
        marginTop: '30px',
        padding: '20px',
        backgroundColor: '#f9f9f9',
        border: '1px solid #e0e0e0',
        borderRadius: '12px',
    },
    selectedColorsTitle: {
        textAlign: 'left',
        margin: '0 0 15px 0',
        fontWeight: 600,
    },
    selectedColorsGrid: {
        display: 'flex',
        gap: '20px',
        flexWrap: 'wrap',
        minHeight: '80px',
        alignItems: 'center',
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
        borderRadius: '8px',
        transition: 'background-color 0.3s, transform 0.2s, filter 0.2s',
    },
    mixingContainer: {
        backgroundColor: 'white',
        padding: '30px',
        borderRadius: '12px',
        boxShadow: '0 6px 16px rgba(0,0,0,0.07)',
    },
    mixingLayout: {
        display: 'grid',
        gridTemplateColumns: '1fr 420px',
        gap: '40px',
    },
    imageDisplayContainer: {
        textAlign: 'center',
    },
    imageWrapper: {
        position: 'relative',
        maxWidth: '100%',
        display: 'inline-block',
        borderRadius: '8px',
        overflow: 'hidden',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
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
        mixBlendMode: 'multiply',
    },
    areaLabel: {
        fill: '#fff',
        fontSize: '60px',
        fontWeight: 'bold',
        textAnchor: 'middle',
        pointerEvents: 'none',
        textShadow: '0 1px 5px rgba(0,0,0,0.7)',
    },
    colorTools: {
        display: 'flex',
        flexDirection: 'column',
        gap: '25px',
    },
    toolSection: {
        border: '1px solid #ddd',
        borderRadius: '12px',
        padding: '20px',
        backgroundColor: '#fdfdfd',
        display: 'flex',
        flexDirection: 'column',
    },
    toolTitle: {
        margin: '0 0 15px 0',
        fontSize: '20px',
        fontWeight: 600,
        borderBottom: '1px solid #eee',
        paddingBottom: '10px'
    },
    paletteGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(65px, 1fr))',
        gap: '15px',
    },
    secondaryButton: {
        padding: '12px 25px',
        fontSize: '16px',
        cursor: 'pointer',
        backgroundColor: '#6c757d',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        transition: 'background-color 0.3s, transform 0.2s',
    },
    loader: {
        border: '4px solid #f3f3f3',
        borderTop: '4px solid #3498db',
        borderRadius: '50%',
        width: '24px',
        height: '24px',
        animation: 'spin 1s linear infinite',
        margin: '10px auto',
    },
    swatchContainerRelative: {
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
    },
    removeButton: {
        position: 'absolute',
        top: -8,
        right: -8,
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
    aiStyleGrid: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '10px',
        marginBottom: '10px',
    },
    aiStyleButton: {
        padding: '8px 15px',
        fontSize: '14px',
        border: '1px solid #ccc',
        borderRadius: '20px',
        background: '#f5f5f5',
        cursor: 'pointer',
        transition: 'background-color 0.2s, border-color 0.2s, color 0.2s',
    },
    chatContainer: {
      display: 'flex',
      flexDirection: 'column',
      height: '350px',
      flex: '1 1 auto'
    },
    chatHistory: {
        flex: 1,
        overflowY: 'auto',
        padding: '10px',
        border: '1px solid #eee',
        borderRadius: '8px',
        marginBottom: '15px',
        backgroundColor: '#f9f9f9',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
    },
    chatMessage: {
        padding: '10px 15px',
        borderRadius: '18px',
        maxWidth: '85%',
        wordWrap: 'break-word',
        lineHeight: 1.4,
    },
    userMessage: {
        backgroundColor: '#007bff',
        color: 'white',
        alignSelf: 'flex-end',
        borderBottomRightRadius: '4px',
    },
    modelMessage: {
        backgroundColor: '#e9e9eb',
        color: '#333',
        alignSelf: 'flex-start',
        borderBottomLeftRadius: '4px',
    },
    systemMessage: {
        fontSize: '13px',
        fontStyle: 'italic',
        color: '#6c757d',
        textAlign: 'center',
        width: '100%',
        padding: '5px 0',
    },
    chatInputForm: {
        display: 'flex',
        gap: '10px',
        marginTop: '10px',
    },
    chatInput: {
        flex: 1,
        padding: '12px',
        fontSize: '14px',
        borderRadius: '20px',
        border: '1px solid #ccc',
        outline: 'none',
    },
    chatSubmitButton: {
        padding: '10px 20px',
        fontSize: '14px',
        fontWeight: 'bold',
        backgroundColor: '#007bff',
        color: 'white',
        border: 'none',
        borderRadius: '20px',
        cursor: 'pointer',
        transition: 'background-color 0.2s',
    },
};

// --- REACT COMPONENTS ---

const Header = () => (
    <header style={styles.header}>
        <img 
            src="https://coating.lavisbrothers.com/wp-content/uploads/2022/08/cropped-coating-white-288x77.png" 
            alt="Lavis Brothers Coating Logo" 
            style={styles.logo}
        />
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
                    <button
                        key={step}
                        style={{
                            ...styles.step,
                            ...(currentStep === stepNumber ? styles.stepActive : {}),
                            cursor: isClickable ? 'pointer' : 'default',
                        }}
                        onClick={() => isClickable && onStepClick(stepNumber)}
                        disabled={!isClickable && currentStep !== stepNumber}
                    >
                        {step}
                    </button>
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
    const [hoveredColor, setHoveredColor] = useState<string | null>(null);
    const [isButtonHovered, setIsButtonHovered] = useState(false);
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
            <p style={styles.stepDescription}>Bạn có thể chọn một hoặc nhiều màu để bắt đầu phối. Màu đã chọn sẽ xuất hiện ở khay bên dưới.</p>
            
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
                        const isHovered = hoveredColor === color.id;
                        return (
                            <div 
                                key={color.id} 
                                style={styles.swatchContainer} 
                                onClick={() => onToggleColor(color)}
                                onMouseEnter={() => setHoveredColor(color.id)}
                                onMouseLeave={() => setHoveredColor(null)}
                            >
                                <div style={{ 
                                    ...styles.swatch, 
                                    backgroundColor: hex, 
                                    ...(isSelected ? styles.swatchSelected : {}),
                                    ...(isHovered && !isSelected ? styles.swatchHover : {})
                                }}></div>
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
            
            <button 
              onClick={handleNextStep} 
              style={{ ...styles.primaryButton, ...(isButtonHovered ? { filter: 'brightness(90%)' } : {}) }}
              onMouseEnter={() => setIsButtonHovered(true)}
              onMouseLeave={() => setIsButtonHovered(false)}
            >Tiếp tục</button>
        </div>
    );
};

const Step3_ColorMixing = ({ image, selectedColors, onReset, onColorRemove, onSetSelectedColors }: {
    image: PredefinedImage,
    selectedColors: Color[],
    onReset: () => void,
    onColorRemove: (color: Color) => void,
    onSetSelectedColors: (colors: Color[]) => void,
}) => {
    const [activeColor, setActiveColor] = useState<string>(selectedColors.length > 0 ? lab2rgb(selectedColors[0].l, selectedColors[0].a, selectedColors[0].b) : '');
    const [areaColors, setAreaColors] = useState<Record<string, string>>({});
    const [draggedOverArea, setDraggedOverArea] = useState<string | null>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    
    // AI State
    const chatRef = useRef<Chat | null>(null);
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'model' | 'system'; text: string }[]>([]);
    const [userInput, setUserInput] = useState('');
    const chatHistoryRef = useRef<HTMLDivElement>(null);

    const aiStyles = [
        {id: 'hien-dai', name: 'Hiện đại'},
        {id: 'toi-gian', name: 'Tối giản'},
        {id: 'am-cung', name: 'Ấm cúng'},
        {id: 'phong-thuy', name: 'Phong thủy'},
        {id: 'tuoi-sang', name: 'Tươi sáng'},
        {id: 'sang-trong', name: 'Sang trọng'},
    ];
    
    useEffect(() => {
        const init: Record<string, string> = {};
        const firstColor = selectedColors.length > 0 ? lab2rgb(selectedColors[0].l, selectedColors[0].a, selectedColors[0].b) : '#cccccc';
        setActiveColor(firstColor);
        image.areas.forEach(a => {
            if (a.id !== 'window-area' && a.id !== 'floor') {
                init[a.id] = firstColor;
            }
        });
        setAreaColors(init);
    }, [image.id]);

    useEffect(() => {
        const activeColorExists = selectedColors.some(c => lab2rgb(c.l, c.a, c.b) === activeColor);
        if (!activeColorExists && selectedColors.length > 0) {
            setActiveColor(lab2rgb(selectedColors[0].l, selectedColors[0].a, selectedColors[0].b));
        } else if (selectedColors.length === 0) {
            setActiveColor('');
        }
    }, [selectedColors, activeColor]);
    
    useEffect(() => {
        if (chatHistoryRef.current) {
            chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
        }
    }, [chatHistory]);

    // Initialize Chat
    useEffect(() => {
        try {
            const API_KEY = 'AIzaSyCLhybte8ncn7Mu4yZkiJCYMbz79MLRDwc';
            const ai = new GoogleGenAI({ apiKey: API_KEY });
            const allColors = Object.values(colorData).flat();
            const systemInstruction = `Bạn là một chuyên gia tư vấn màu sơn của Lavis Brothers, một thương hiệu sơn cao cấp. Nhiệm vụ của bạn là trò chuyện với khách hàng một cách thân thiện và chuyên nghiệp để hiểu về không gian (hiện tại là: "${image.name}"), sở thích, và cảm xúc mong muốn của họ. Từ đó, tư vấn một bộ 5 màu sơn phù hợp.

            QUY TẮC TUYỆT ĐỐI BẠN PHẢI TUÂN THỦ:
            1. Chỉ được phép đề xuất 5 MÃ MÀU từ danh sách JSON sau đây: ${JSON.stringify(allColors.map(c => c.id))}. Không được bịa ra bất kỳ mã màu nào không có trong danh sách.
            2. Sau khi đã tư vấn và khách hàng có vẻ hài lòng, hãy kết thúc cuộc trò chuyện bằng cách trả về một đối tượng JSON DUY NHẤT chứa các màu đề xuất. Đối tượng JSON này PHẢI nằm trong một khối mã markdown riêng biệt, ví dụ: \`\`\`json ... \`\`\`.
            3. Cấu trúc của JSON phải chính xác như sau:
            {
              "suggestions": [
                { "id": "MÃ MÀU 1", "reason": "Lý do ngắn gọn tại sao màu này phù hợp." },
                { "id": "MÃ MÀU 2", "reason": "Lý do ngắn gọn." },
                { "id": "MÃ MÀU 3", "reason": "Lý do ngắn gọn." },
                { "id": "MÃ MÀU 4", "reason": "Lý do ngắn gọn." },
                { "id": "MÃ MÀU 5", "reason": "Lý do ngắn gọn." }
              ]
            }
            4. Đừng trả về JSON ngay lập tức. Hãy trò chuyện trước để thu thập đủ thông tin. Ví dụ, nếu khách hàng chọn "Phong thủy", hãy hỏi năm sinh của họ để tư vấn mệnh và màu sắc phù hợp. Nếu họ nói "không gian ấm cúng", hãy hỏi thêm về ánh sáng trong phòng hoặc đồ nội thất.
            5. Giọng văn phải chuyên nghiệp, hữu ích và mang tính thương hiệu Lavis Brothers.`;

            chatRef.current = ai.chats.create({
                model: 'gemini-2.5-flash',
                history: [{ role: 'user', parts: [{ text: systemInstruction }] }],
            });

            const initialGreeting = { role: 'model' as const, text: "Chào bạn, tôi là trợ lý màu sắc của Lavis Brothers. Tôi có thể giúp bạn chọn bộ màu ưng ý cho không gian này. Bạn đang có ý tưởng gì không, hay muốn bắt đầu với một phong cách có sẵn bên dưới?" };
            setChatHistory([initialGreeting]);
        } catch (error) {
            console.error("Failed to initialize AI assistant:", error);
            setChatHistory([{ role: 'system', text: "Không thể khởi tạo trợ lý AI. Vui lòng kiểm tra lại API Key hoặc kết nối mạng." }]);
        }
    }, [image.name]);

    const parseAndApplyColors = useCallback((text: string) => {
        try {
            const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);
            if (jsonMatch && jsonMatch[1]) {
                const resultJson = JSON.parse(jsonMatch[1]);
                if (resultJson.suggestions && resultJson.suggestions.length > 0) {
                     const allColorsFlat = Object.values(colorData).flat();
                     const newPalette: Color[] = resultJson.suggestions
                         .map((suggestion: {id: string}) => allColorsFlat.find(c => c.id === suggestion.id))
                         .filter((color: Color | undefined): color is Color => color !== undefined);
    
                     if (newPalette.length > 0) {
                         onSetSelectedColors(newPalette);
                         setChatHistory(prev => [...prev, { role: 'system', text: "Bảng màu của bạn đã được cập nhật theo gợi ý! Bạn có thể bắt đầu kéo thả màu vào không gian." }]);
                     }
                }
            }
        } catch (e) {
            console.log("Response is not a color suggestion, continuing chat.");
        }
    }, [onSetSelectedColors]);

    const handleSendMessage = useCallback(async (message: string) => {
        if (!message.trim() || isAiLoading || !chatRef.current) return;
        
        const newUserMessage = { role: 'user' as const, text: message };
        setChatHistory(prev => [...prev, newUserMessage]);
        setUserInput('');
        setIsAiLoading(true);
    
        try {
            const response = await chatRef.current.sendMessage({ message });
            const responseText = response.text;
            
            setChatHistory(prev => [...prev, { role: 'model', text: responseText }]);
            parseAndApplyColors(responseText);
    
        } catch (error) {
            console.error("Error sending message to AI:", error);
            setChatHistory(prev => [...prev, { role: 'system', text: "Xin lỗi, đã có lỗi xảy ra. Vui lòng thử lại." }]);
        } finally {
            setIsAiLoading(false);
        }
    }, [isAiLoading, parseAndApplyColors]);

    const handleStyleClick = (style: {id: string, name: string}) => {
        let prompt = `Hãy gợi ý cho tôi một bộ màu theo phong cách ${style.name.toLowerCase()}.`;
        if (style.id === 'phong-thuy') {
            prompt += ' Bạn có thể hỏi tôi năm sinh để tư vấn chính xác hơn.';
        }
        handleSendMessage(prompt);
    };

    const handleShowSaveInstructions = () => {
        alert(
`Để lưu lại ảnh phối màu, bạn có thể sử dụng các công cụ chụp màn hình có sẵn:

- Zalo: Nhấn tổ hợp phím Ctrl + Alt + A để chụp vùng bạn muốn.
- Windows: Nhấn phím Print Screen (PrtScn) rồi dán (Ctrl+V) vào Zalo, Paint, hoặc Word.

Sau đó bạn có thể lưu lại ảnh từ các ứng dụng trên.`
        );
    };

    return (
        <div style={styles.mixingContainer}>
            <div style={styles.mixingLayout}>
                <div style={styles.imageDisplayContainer}>
                    <h3 style={styles.stepTitle}>Phối màu trực tiếp</h3>
                    <p style={styles.stepDescription}>Nhấn vào một màu bên phải để chọn, sau đó nhấn vào khu vực trên ảnh để tô màu. Hoặc, kéo và thả màu vào khu vực bạn muốn.</p>
                    <div style={styles.imageWrapper}>
                        <img
                            src={image.url}
                            alt={image.name}
                            style={{
                                width: '100%',
                                height: 'auto',
                                display: 'block'
                            }}
                        />
                        <svg
                            ref={svgRef}
                            viewBox={image.viewBox}
                            preserveAspectRatio="xMidYMid meet"
                            style={styles.svgOverlay}
                        >
                            {image.areas.filter(area => area.id !== 'floor').map((area) => (
                                <g
                                    key={area.id}
                                    onClick={() => setAreaColors(prev => ({ ...prev, [area.id]: activeColor }))}
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
                                        style={{
                                            ...styles.clickableArea,
                                            fill: areaColors[area.id] || 'transparent',
                                            stroke: draggedOverArea === area.id ? '#007bff' : 'rgba(255,255,255,0.5)',
                                            strokeWidth: draggedOverArea === area.id ? 15 : 3,
                                            cursor: 'pointer',
                                        }}
                                    />
                                     {area.id !== 'window-area' && !areaColors[area.id] && (
                                        <text x={area.labelPos.x} y={area.labelPos.y} style={styles.areaLabel}>+</text>
                                    )}
                                </g>
                            ))}
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
                                            style={{ ...styles.swatch, backgroundColor: hex, cursor: 'grab', ...(activeColor === hex ? styles.swatchSelected : {}) }}
                                            onClick={() => setActiveColor(hex)}
                                        />
                                        <button onClick={() => onColorRemove(color)} style={styles.removeButton}>&times;</button>
                                        <span style={styles.swatchLabel}>{color.id}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div style={{...styles.toolSection, flex: 1}}>
                        <h4 style={styles.toolTitle}>Trợ lý màu sắc AI</h4>
                        <div style={styles.chatContainer}>
                            <div ref={chatHistoryRef} style={styles.chatHistory}>
                                {chatHistory.map((msg, index) => (
                                    <div 
                                      key={index} 
                                      style={{
                                        ...styles.chatMessage, 
                                        ...(msg.role === 'user' ? styles.userMessage : msg.role === 'model' ? styles.modelMessage : styles.systemMessage)
                                      }}
                                    >
                                        {msg.text.split(/```json[\s\S]*```/)[0]}
                                    </div>
                                ))}
                                {isAiLoading && <div style={styles.loader}></div>}
                            </div>
                            <p style={{fontSize: 14, color: '#666', margin: '0 0 10px 0', textAlign: 'center'}}>Bắt đầu nhanh bằng cách chọn một phong cách:</p>
                            <div style={styles.aiStyleGrid}>
                                {aiStyles.map(style => (
                                    <button 
                                        key={style.id}
                                        onClick={() => handleStyleClick(style)}
                                        style={styles.aiStyleButton}
                                        disabled={isAiLoading}
                                    >
                                        {style.name}
                                    </button>
                                ))}
                            </div>
                            <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(userInput); }} style={styles.chatInputForm}>
                                <input 
                                    type="text"
                                    value={userInput}
                                    onChange={e => setUserInput(e.target.value)}
                                    placeholder={"Hoặc trò chuyện về ý tưởng của bạn..."}
                                    style={styles.chatInput}
                                    disabled={isAiLoading}
                                />
                                <button type="submit" style={styles.chatSubmitButton} disabled={isAiLoading || !userInput.trim()}>Gửi</button>
                            </form>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: 10 }}>
                        <button onClick={onReset} style={styles.secondaryButton}>Làm lại từ đầu</button>
                        <button onClick={handleShowSaveInstructions} style={{ ...styles.primaryButton, flex: 1, marginTop: 0, backgroundColor: '#007bff' }}>Hướng dẫn lưu ảnh</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const BottomNavBar = ({ currentStep, onStepClick }: { currentStep: number; onStepClick: (step: number) => void; }) => {
    const navStyles: React.CSSProperties = {
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '65px',
        backgroundColor: 'rgba(255, 255, 255, 0.98)',
        backdropFilter: 'saturate(180%) blur(10px)',
        WebkitBackdropFilter: 'saturate(180%) blur(10px)',
        boxShadow: '0 -2px 10px rgba(0,0,0,0.1)',
        display: 'none', // Hidden by default, shown via media query
        justifyContent: 'space-around',
        alignItems: 'flex-start',
        zIndex: 1000,
        paddingTop: '8px',
        paddingBottom: 'calc(8px + env(safe-area-inset-bottom))', // For iPhone notches
    };

    const linkStyles: React.CSSProperties = {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textDecoration: 'none',
        color: '#555',
        fontSize: '13px',
        fontWeight: 500,
        border: 'none',
        background: 'none',
        height: '100%',
        transition: 'color 0.2s',
    };

    const activeLinkStyles: React.CSSProperties = {
        color: '#007bff',
        fontWeight: 'bold',
    };
    
    const steps = ['Chọn ảnh', 'Chọn màu', 'Phối màu'];

    return (
        <nav style={navStyles} className="mobile-nav">
            {steps.map((step, index) => {
                const stepNumber = index + 1;
                const isActive = currentStep === stepNumber;
                const isClickable = stepNumber < currentStep;
                 return (
                    <button
                        key={step}
                        style={{...linkStyles, ...(isActive ? activeLinkStyles : {})}}
                        onClick={() => {
                            if (isClickable) onStepClick(stepNumber);
                        }}
                        disabled={!isClickable && !isActive}
                    >
                        <span>{stepNumber}. {step}</span>
                    </button>
                 );
            })}
        </nav>
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
            button:hover, div[role="button"]:hover {
                filter: brightness(95%);
            }

            /* --- MOBILE STYLES (App-like experience) --- */
            @media (max-width: 768px) {
                /* Hide desktop elements */
                body > #root > main > div:first-child, /* StepIndicator */
                body > #root > footer { 
                    display: none !important; 
                }
                
                /* Show mobile elements */
                .mobile-nav { 
                    display: flex !important; 
                }

                /* General Layout & Component Adjustments */
                body { -webkit-tap-highlight-color: transparent; }
                
                body > #root > header { /* Header */
                    padding: 5px 15px !important;
                }
                body > #root > header > img { /* Logo */
                    height: 45px !important;
                }
                body > #root > main { /* Main content area */
                    padding: 15px !important;
                    padding-bottom: 90px !important; /* Space for bottom nav */
                }
                
                /* Step Containers */
                div[style*="padding: 40px"] { /* .stepContainer */
                     padding: 20px !important;
                }
                h2[style*="font-size: 28px"] { /* .stepTitle */
                    font-size: 22px !important;
                }
                p[style*="font-size: 16px"][style*="color: rgb(102, 102, 102)"] { /* .stepDescription */
                    font-size: 14px !important;
                    margin-bottom: 25px !important;
                }
                button[style*="font-size: 18px"] { /* .primaryButton */
                    padding: 12px 25px !important;
                    font-size: 16px !important;
                }

                /* Step 1: Image Selection */
                div[style*="justify-content: center"][style*="gap: 30px"] { /* .imageSelectionContainer */
                    flex-direction: column;
                    align-items: center;
                    gap: 20px !important;
                }
                 div[style*="width: 350px"] { /* .imageCard */
                    width: 95% !important;
                    max-width: 400px;
                }

                /* Step 2: Color Selection */
                div[style*="flex-wrap: wrap"][style*="background-color: rgb(249, 249, 249)"] { /* .tabs */
                    flex-wrap: nowrap !important;
                    overflow-x: auto;
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
                 div[style*="flex-wrap: wrap"][style*="background-color: rgb(249, 249, 249)"]::-webkit-scrollbar {
                      display: none;
                }
                button[style*="flex: 1 1 auto"] { /* .tabButton */
                    flex-shrink: 0 !important;
                }
                div[style*="grid-template-columns: repeat(auto-fill, minmax(80px, 1fr))"] { /* .palette */
                     grid-template-columns: repeat(auto-fill, minmax(60px, 1fr)) !important;
                     gap: 15px !important;
                     padding: 20px !important;
                }
                div[style*="padding: 20px"][style*="background-color: rgb(249, 249, 249)"] { /* .selectedColorsTray */
                     padding: 15px !important;
                }

                /* Step 3: Mixing */
                div[style*="background-color: white"][style*="padding: 30px"] { /* .mixingContainer */
                     padding: 20px 15px !important;
                }
                 div[style*="grid-template-columns: 1fr 420px"] { /* .mixingLayout */
                    display: flex !important;
                    flex-direction: column !important;
                    gap: 30px !important;
                }
                div[style*="flex-direction: column"][style*="gap: 25px"] { /* .colorTools */
                    gap: 20px !important;
                }
                 div[style*="height: 350px"] { /* .chatContainer */
                     height: 320px !important;
                }
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

    const handleSetSelectedColors = useCallback((newColors: Color[]) => {
        setSelectedColors(newColors);
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

    const handleMobileStepClick = (step: number) => {
        if (step < currentStep) {
            setCurrentStep(step);
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
                                onSetSelectedColors={handleSetSelectedColors}
                            />;
                }
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
                <p>&copy; 2025 Lavis Brothers Coating. All rights reserved.</p>
            </footer>
            <BottomNavBar currentStep={currentStep} onStepClick={handleMobileStepClick} />
        </div>
    );
};

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(<App />);
}
