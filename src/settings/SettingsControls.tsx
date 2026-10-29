import type { ReactNode } from 'react';
import { Pressable, Text, View, type TextProps } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon, type IconName } from '@/ui/Icon';
import { settingsTheme as t, settingsStyles as s } from './theme';

export function SettingsText({
  variant = 'body',
  muted,
  style,
  ...props
}: TextProps & {
  variant?: keyof typeof t.type;
  muted?: boolean;
}) {
  return (
    <Text
      {...props}
      allowFontScaling
      style={[
        t.type[variant],
        { color: muted ? t.color.muted : t.color.text, flexShrink: 1 },
        style,
      ]}
    />
  );
}

export function SettingsCanvas({ children }: { children: ReactNode }) {
  return (
    <LinearGradient
      colors={[t.color.canvasWarm, t.color.canvasMid, t.color.background]}
      locations={[0, 0.4, 1]}
      style={s.canvas}
    >
      {children}
    </LinearGradient>
  );
}

export function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={s.section}>
      <SettingsText variant="section" muted accessibilityRole="header">
        {title.toUpperCase()}
      </SettingsText>
      <View style={s.group}>{children}</View>
    </View>
  );
}

export function SettingsRow({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: IconName;
  title: string;
  subtitle?: string;
  onPress?: () => void;
}) {
  const content = (
    <>
      <View style={s.icon}>
        <Icon name={icon} size={t.size.icon} color={t.color.muted} />
      </View>
      <View style={s.copy}>
        <SettingsText variant="row">{title}</SettingsText>
        {subtitle && <SettingsText muted>{subtitle}</SettingsText>}
      </View>
      {onPress && <Icon name="chevron" size={t.size.smallIcon} color={t.color.muted} />}
    </>
  );
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [s.row, { opacity: pressed ? t.opacity.pressed : 1 }]}
    >
      {content}
    </Pressable>
  ) : (
    <View style={s.row}>{content}</View>
  );
}

export function SettingsDivider() {
  return <View style={s.divider} />;
}
