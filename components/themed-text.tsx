import { Text, type TextProps } from 'react-native';

import { Theme } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link' | 'caption' | 'label';
  variant?: keyof typeof Theme.typography.body | keyof typeof Theme.typography.heading | keyof typeof Theme.typography.display;
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'default',
  variant,
  ...rest
}: ThemedTextProps) {
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');

  // Map legacy 'type' prop to new system if 'variant' is not provided
  let textStyle = {};

  if (variant) {
    // If explicit variant is provided, try to find it in typography groups
    // This is a simplified lookup, ideally we'd type 'variant' more strictly or namespace it
    if (variant in Theme.typography.display) textStyle = Theme.typography.display[variant as keyof typeof Theme.typography.display];
    else if (variant in Theme.typography.heading) textStyle = Theme.typography.heading[variant as keyof typeof Theme.typography.heading];
    else if (variant in Theme.typography.body) textStyle = Theme.typography.body[variant as keyof typeof Theme.typography.body];
  } else {
    // Legacy mapping
    switch (type) {
      case 'title':
        textStyle = Theme.typography.heading.h2;
        break;
      case 'defaultSemiBold':
        textStyle = { ...Theme.typography.body.medium, fontWeight: Theme.fontWeight.semibold };
        break;
      case 'subtitle':
        textStyle = Theme.typography.heading.h4;
        break;
      case 'link':
        textStyle = { ...Theme.typography.body.medium, color: Theme.colors.light.link }; // Link color will need dynamic handling if we want theme support inside this object, but color is applied via style array below
        break;
      case 'caption':
        textStyle = Theme.typography.label.small;
        break;
      case 'label':
        textStyle = Theme.typography.label.medium;
        break;
      case 'default':
      default:
        textStyle = Theme.typography.body.medium;
        break;
    }
  }

  // Handle specific link color requiring a hook lookup if we want it to adapt
  const linkColor = useThemeColor({ light: lightColor, dark: darkColor }, 'link');

  return (
    <Text
      style={[
        { color },
        type === 'link' ? { color: linkColor } : undefined,
        textStyle,
        style,
      ]}
      {...rest}
    />
  );
}
