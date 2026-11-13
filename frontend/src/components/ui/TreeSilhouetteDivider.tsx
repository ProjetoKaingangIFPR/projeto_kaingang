import React from 'react';

interface TreeSilhouetteDividerProps {
  className?: string;
  fillColor?: string;
  bgColor?: string;
}

export const TreeSilhouetteDivider: React.FC<TreeSilhouetteDividerProps> = ({
  className = '',
  fillColor = '#274431',
  bgColor = '#F7F4EC',
}) => {
  return (
    <div
      className={`relative w-full overflow-hidden select-none leading-none ${className}`}
      style={{ backgroundColor: bgColor }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 1440 130"
        className="w-full h-16 sm:h-20 md:h-28 block preserve-3d"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Background Sky / Upper Cream Field */}
        <rect width="1440" height="130" fill={bgColor} />

        {/* Forest and Tent Skyline Path */}
        <path
          fill={fillColor}
          d="
            M0,130
            L0,90
            C25,88 45,95 70,86
            C95,78 115,88 140,82
            C150,68 165,60 180,68
            C195,62 205,75 220,80
            C235,84 250,78 270,85
            C285,62 305,52 325,60
            C345,55 360,70 375,82
            C395,85 410,75 435,78
            C445,60 460,50 480,52
            C495,48 510,62 525,75
            C545,78 560,65 585,70
            C600,60 615,50 635,52
            C650,45 665,60 675,72
            
            /* Central Tent / Oca structure at ~720px */
            C680,68 685,55 690,45
            C695,30 710,24 720,24
            C730,24 745,30 750,45
            C755,55 760,68 765,72

            C775,60 790,45 805,52
            C825,50 840,60 855,70
            C880,65 895,78 915,75
            C930,62 945,48 960,52
            C980,50 995,60 1005,78
            C1030,75 1045,85 1065,82
            C1080,70 1095,55 1115,60
            C1135,52 1155,62 1170,85
            C1190,78 1205,84 1220,80
            C1235,75 1245,62 1260,68
            C1275,60 1290,68 1300,82
            C1325,88 1345,78 1370,86
            C1395,95 1415,88 1440,90
            L1440,130
            Z
          "
        />

        {/* Distinctive stylized tree crowns for visual depth matching Frame 17 */}
        {/* Left trees */}
        <circle cx="330" cy="58" r="14" fill={fillColor} />
        <circle cx="310" cy="64" r="10" fill={fillColor} />
        <circle cx="350" cy="66" r="11" fill={fillColor} />
        <rect x="328" y="70" width="4" height="20" fill={fillColor} />

        <circle cx="485" cy="54" r="16" fill={fillColor} />
        <circle cx="465" cy="62" r="12" fill={fillColor} />
        <circle cx="505" cy="63" r="12" fill={fillColor} />
        <rect x="483" y="68" width="5" height="20" fill={fillColor} />

        {/* Tent details */}
        <path
          d="M710,75 L720,40 L730,75 Z"
          fill="#1E3827"
          opacity="0.6"
        />

        {/* Right trees */}
        <circle cx="955" cy="54" r="16" fill={fillColor} />
        <circle cx="935" cy="62" r="12" fill={fillColor} />
        <circle cx="975" cy="63" r="12" fill={fillColor} />
        <rect x="953" y="68" width="5" height="20" fill={fillColor} />

        <circle cx="1110" cy="58" r="14" fill={fillColor} />
        <circle cx="1090" cy="64" r="10" fill={fillColor} />
        <circle cx="1130" cy="66" r="11" fill={fillColor} />
        <rect x="1108" y="70" width="4" height="20" fill={fillColor} />
      </svg>
    </div>
  );
};
