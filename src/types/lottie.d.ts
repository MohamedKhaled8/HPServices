
import React from 'react';

declare global {
    namespace JSX {
        interface IntrinsicElements {
            'lottie-player': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
                src?: string;
                background?: string;
                speed?: string;
                hover?: boolean;
                loop?: boolean;
                autoplay?: boolean;
                renderer?: string;
                style?: React.CSSProperties;
            };
        }
    }
}
