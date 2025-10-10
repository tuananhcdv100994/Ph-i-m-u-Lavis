
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
  url: 'https://simplythebest.vn/wp-content/uploads/2025/10/%E2%80%94Pngtree%E2%80%94immaculate-interiors-and-decor-a_15228478-scaled.jpg',
  viewBox: '0 0 1920 1280',
  areas: [
      { id: 'ceiling', points: '0,0 1531,1 1226,239 332,239', labelPos: { x: 960, y: 200 } },
      { id: 'left-wall', points: '0,47 319,269 321,768 0,884', labelPos: { x: 350, y: 700 } },
      { id: 'back-wall', points: '317,269 1238,274 1240,759 317,773', labelPos: { x: 960, y: 700 } },
      { id: 'right-wall', points: '1601,19 1236,271 1238,759 1597,912', labelPos: { x: 1550, y: 700 } },
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
            if (!ctx) {
                return reject(new Error('Failed to get canvas context'));
            }
            ctx.drawImage(img, 0, 0);
            try {
                const dataUrl = canvas.toDataURL('image/jpeg');
                // remove the data:image/jpeg;base64, part
                resolve(dataUrl.substring(dataUrl.indexOf(',') + 1));
            } catch (e) {
                reject(new Error("Couldn't convert canvas to data URL. The image server may not allow cross-origin requests."));
            }
        };
        img.onerror = (err) => reject(new Error(`Failed to load image from URL: ${url}. Error: ${err}`));
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
        gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
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
    swatchLabLabel: {
        fontSize: '11px',
        color: '#777',
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
        transition: 'fill 0.2s',
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
};

// --- REACT COMPONENTS ---

const Header = () => (
    <header style={styles.header}>
        <h1 style={styles.headerTitle}>Phối màu Lavis Brothers Coating</h1>
    </header>
);

const StepIndicator = ({ currentStep }: { currentStep: number }) => {
    const steps = ['1. Chọn ảnh', '2. Chọn màu', '3. Phối màu & Tải về'];
    return (
        <div style={styles.stepIndicatorContainer}>
            {steps.map((step, index) => (
                <div key={step} style={{ ...styles.step, ...(currentStep === index + 1 ? styles.stepActive : {}) }}>
                    {step}
                </div>
            ))}
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


const Step2_ColorSelection = ({ onColorsSelect }: { onColorsSelect: (colors: Color[]) => void }) => {
    const [selectedColors, setSelectedColors] = useState<Color[]>([]);
    const [activeTab, setActiveTab] = useState<string>(Object.keys(colorData)[0]);
    const [visibleCount, setVisibleCount] = useState(100);
    const PALETTE_PAGE_SIZE = 100;

    useEffect(() => {
        setVisibleCount(PALETTE_PAGE_SIZE);
    }, [activeTab]);

    const toggleColor = (color: Color) => {
        setSelectedColors(prev =>
            prev.find(c => c.id === color.id) ? prev.filter(c => c.id !== color.id) : [...prev, color]
        );
    };
    
    const handleNextStep = () => {
        if (selectedColors.length > 0) {
            onColorsSelect(selectedColors);
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
                            <div key={color.id} style={styles.swatchContainer} onClick={() => toggleColor(color)}>
                                <div style={{ ...styles.swatch, backgroundColor: hex, ...(isSelected ? styles.swatchSelected : {}) }}></div>
                                <span style={styles.swatchLabel}>{color.id}</span>
                                <span style={styles.swatchLabLabel}>{`L:${color.l} a:${color.a} b:${color.b}`}</span>
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
                        <span style={styles.swatchLabLabel}>{`L:${color.l} a:${color.a} b:${color.b}`}</span>
                    </div>
                ))}
                </div>
            </div>
            
            <button onClick={handleNextStep} style={styles.primaryButton}>Tiếp tục</button>
        </div>
    );
};

const Step3_ColorMixing = ({ image, selectedColors, onReset }: { image: PredefinedImage, selectedColors: Color[], onReset: () => void }) => {
  const [activeColor, setActiveColor] = useState<string>(lab2rgb(selectedColors[0].l, selectedColors[0].a, selectedColors[0].b));
  const [isLoading, setIsLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<any[]>([]);
  const [areaColors, setAreaColors] = useState<Record<string, string>>({});
  const finalImageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Reset colors to the first selected color when the image changes
    const init: Record<string, string> = {};
    const firstColor = lab2rgb(selectedColors[0].l, selectedColors[0].a, selectedColors[0].b);
    setActiveColor(firstColor);
    image.areas.forEach(a => {
        if (a.id !== 'window-area' && a.id !== 'floor') { // Filter window and floor
            init[a.id] = firstColor;
        }
    });
    setAreaColors(init);
  }, [image.id, selectedColors]);


  // Download function
  const handleDownload = async () => {
    const { default: html2canvas } = await import('html2canvas');
    if (!finalImageRef.current) return;
    try {
      const canvas = await html2canvas(finalImageRef.current, { useCORS: true, allowTaint: true });
      const link = document.createElement('a');
      link.download = 'phoi-mau-lavis.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Error generating image:', error);
      alert('Không thể tải ảnh. Vui lòng thử lại.');
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
    image.areas
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
          <div
            ref={finalImageRef}
            style={{
              position: 'relative',
              width: '100%',
              overflow: 'visible',
            }}
          >
            <img
              src={image.url}
              alt={image.name}
              style={{
                display: 'block',
                width: '100%',
                height: 'auto',
                pointerEvents: 'none',
                userSelect: 'none',
              }}
            />
            <svg
              viewBox={image.viewBox}
              preserveAspectRatio="none"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '120%', 
                height: '120%',
                pointerEvents: 'auto',
                overflow: 'visible',
                zIndex: 5,
              }}
            >
              {image.areas.filter(area => area.id !== 'floor').map(area => (
                <g key={area.id} onClick={() => setAreaColors(prev => ({ ...prev, [area.id]: activeColor }))}>
                  <polygon
                    points={area.points}
                    style={{
                      ...styles.clickableArea,
                     fill: areaColors[area.id]
  ? hexToRgba(areaColors[area.id], 0.40)
  : 'rgba(255, 0, 0, 0.05)',
                      stroke: areaColors[area.id] || area.id === 'window-area'
                        ? 'transparent'
                        : 'red',
                      strokeWidth:
                        areaColors[area.id] || area.id === 'window-area' ? 0 : 3,
                    }}
                  />
                   {area.id !== 'window-area' && !areaColors[area.id] && (
                        <text
                            x={area.labelPos.x}
                            y={area.labelPos.y}
                            style={styles.areaLabel}
                        >
                            +
                        </text>
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
                  <div key={color.id} style={styles.swatchContainer} onClick={() => setActiveColor(hex)}>
                    <div style={{ ...styles.swatch, backgroundColor: hex, width: 60, height: 60, ...(activeColor === hex ? styles.swatchSelected : {}) }} />
                    <span style={styles.swatchLabel}>{color.id}</span>
                  </div>
                );
              })}
            </div>
          </div>

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

    const handleImageSelect = (image: PredefinedImage) => {
        setSelectedImage(image);
        setCurrentStep(2);
    };

    const handleColorsSelect = (colors: Color[]) => {
        setSelectedColors(colors);
        setCurrentStep(3);
    };

    const handleReset = () => {
        setCurrentStep(1);
        setSelectedImage(null);
        setSelectedColors([]);
    };

    const renderStep = () => {
        switch (currentStep) {
            case 1:
                return <Step1_ImageSelection onImageSelect={handleImageSelect} />;
            case 2:
                return <Step2_ColorSelection onColorsSelect={handleColorsSelect} />;
            case 3:
                if (selectedImage && selectedColors.length > 0) {
                    return <Step3_ColorMixing image={selectedImage} selectedColors={selectedColors} onReset={handleReset} />;
                }
                handleReset();
                return null;
            default:
                return <Step1_ImageSelection onImageSelect={handleImageSelect} />;
        }
    };

    return (
        <div style={styles.container}>
            <Header />
            <main style={styles.main}>
                <StepIndicator currentStep={currentStep} />
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