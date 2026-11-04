// Inline line icons (24px grid, stroke = currentColor). No icon font, no extra download.

import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { title?: string };

function Icon({ title, children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

export const WalkIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="13" cy="4" r="1.6" />
    <path d="M10 21l2-6 3 3v3M9 12l2-4 3 1 2 3h2M11 8l-2 6" />
  </Icon>
);

export const BusIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="5" y="3" width="14" height="14" rx="2" />
    <path d="M5 10h14M8 17v3M16 17v3" />
    <circle cx="8.5" cy="13.5" r=".8" />
    <circle cx="15.5" cy="13.5" r=".8" />
  </Icon>
);

export const MetroIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="6" y="3" width="12" height="13" rx="3" />
    <path d="M6 10h12M9 20l-2 2M15 20l2 2M9 16l-1 4h8l-1-4" />
  </Icon>
);

export const BikeIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="6" cy="16" r="3.5" />
    <circle cx="18" cy="16" r="3.5" />
    <path d="M6 16l4-7h5l3 7M10 9L8.5 6H7M13 16l2-7" />
  </Icon>
);

export const MixIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 7h11l-3-3M20 17H9l3 3" />
  </Icon>
);

export const SwapIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8 4v16l-3-3M16 20V4l3 3" />
  </Icon>
);

export const LocateIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="6" />
    <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
    <circle cx="12" cy="12" r="1.5" />
  </Icon>
);

export const ShareIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
  </Icon>
);

export const RadarIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5" />
    <path d="M12 12l6-6" />
  </Icon>
);

export const CloseIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icon>
);

export const ChevronIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 9l6 6 6-6" />
  </Icon>
);
