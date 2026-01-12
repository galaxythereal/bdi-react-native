declare module '@react-native-community/slider' {
    import { ViewStyle, StyleProp } from 'react-native';
    import React from 'react';

    interface SliderProps {
        style?: StyleProp<ViewStyle>;
        value?: number;
        minimumValue?: number;
        maximumValue?: number;
        step?: number;
        minimumTrackTintColor?: string;
        maximumTrackTintColor?: string;
        thumbTintColor?: string;
        thumbImage?: number;
        trackImage?: number;
        minimumTrackImage?: number;
        maximumTrackImage?: number;
        disabled?: boolean;
        onValueChange?: (value: number) => void;
        onSlidingStart?: (value: number) => void;
        onSlidingComplete?: (value: number) => void;
        testID?: string;
        inverted?: boolean;
        vertical?: boolean;
        tapToSeek?: boolean;
        thumbStyle?: StyleProp<ViewStyle>;
        trackStyle?: StyleProp<ViewStyle>;
        accessibilityUnits?: string;
        accessibilityIncrements?: string[];
    }

    const Slider: React.FC<SliderProps>;
    export default Slider;
}
