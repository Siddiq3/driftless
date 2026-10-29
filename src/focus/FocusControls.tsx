import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
  useWindowDimensions,
  type TextProps,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeIn,
  FadeOut,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Icon, AppIcon, type IconName } from '@/ui/Icon';
import { useReducedMotion } from '@/ui/motion';
import { protectionStatus } from '@/billing/protectionStatus';
import type { FocusSettings } from './useFocusSettings';
import { ProtectionStatus } from './components';
import { focusTheme as f, focusType, focusStyles as s } from './theme';

const c = f.color;
const LIMITS = [15, 20, 30, 45, 60, 90, 120] as const;

export function FocusCanvas({ children }: { children: ReactNode }) {
  return (
    <LinearGradient
      colors={[c.canvasWarm, c.canvasMid, c.background]}
      locations={[0, 0.4, 1]}
      start={{ x: 1, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={s.canvas}
    >
      {children}
    </LinearGradient>
  );
}

export function FocusText({
  variant = 'body',
  muted = false,
  style,
  ...props
}: TextProps & { variant?: keyof typeof focusType; muted?: boolean }) {
  return (
    <Text
      {...props}
      allowFontScaling
      style={[focusType[variant], { color: muted ? c.muted : c.text, flexShrink: 1 }, style]}
    />
  );
}

export function FocusSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={s.section}>
      <FocusText variant="section" muted accessibilityRole="header">
        {title.toUpperCase()}
      </FocusText>
      {children}
    </View>
  );
}

export function PrimaryAction({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [s.primary, { opacity: pressed ? f.opacity.pressed : 1 }]}
    >
      <FocusText variant="label" style={{ color: c.onAccent, textAlign: 'center' }}>
        {label}
      </FocusText>
    </Pressable>
  );
}

function MasterSwitch({ value, onChange }: { value: boolean; onChange: (value: boolean) => void }) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(value ? 1 : 0);
  useEffect(() => {
    progress.set(withTiming(value ? 1 : 0, { duration: reduced ? 0 : f.motion.selection }));
  }, [value, progress, reduced]);
  const track = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [c.offTrack, c.accent]),
  }));
  const thumb = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * f.switch.travel }],
  }));
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel="Pause apps"
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      style={({ pressed }) => [
        s.touch,
        { width: f.switch.width, opacity: pressed ? f.opacity.pressed : 1 },
      ]}
    >
      <Animated.View
        style={[
          {
            width: f.switch.width,
            height: f.switch.trackHeight,
            padding: f.switch.inset,
            borderRadius: f.radius.pill,
          },
          track,
        ]}
      >
        <Animated.View
          style={[
            {
              width: f.switch.thumb,
              height: f.switch.thumb,
              borderRadius: f.radius.pill,
              backgroundColor: c.onAccent,
              alignItems: 'center',
              justifyContent: 'center',
            },
            thumb,
          ]}
        >
          <Icon name="check" size={f.size.smallIcon} color={c.accent} />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

export function StatusHero({ settings }: { settings: FocusSettings }) {
  const { cfg, health, goal, goalLoaded, saving, error } = settings;
  if (!cfg) return null;
  const status = health ? protectionStatus(cfg, health, goal) : null;
  const ready =
    cfg.enabled &&
    !error &&
    Boolean(health) &&
    (!cfg.enforceVideoGoal || goalLoaded) &&
    status?.tone === 'info';
  const state = !cfg.enabled
    ? 'Protection is off'
    : ready
      ? 'Protection is on'
      : 'Protection needs attention';
  const context = !cfg.enabled
    ? 'Your choices are saved for when you turn it on.'
    : cfg.dailyMinutes !== null
      ? ready
        ? `Pausing ${cfg.feedOnly ? 'selected feeds' : 'selected apps'} after ${cfg.dailyMinutes} min per app, per day.`
        : `Saved limit: ${cfg.dailyMinutes} min per app, per day.`
      : cfg.schedules.length
        ? 'App pauses follow your saved focus times.'
        : 'App pauses follow your saved feed rules.';
  return (
    <LinearGradient
      colors={[c.heroHighlight, c.hero]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={s.hero}
    >
      <View style={s.heroState} accessibilityLiveRegion="polite">
        <View style={s.statusMark}>
          <Icon name="shield" size={f.size.icon} color={ready ? c.accent : c.muted} />
        </View>
        <FocusText variant="state" accessibilityRole="header" style={{ flex: 1 }}>
          {state}
        </FocusText>
      </View>
      <FocusText muted>{context}</FocusText>
      <ProtectionStatus settings={settings} inline />
      {cfg.enabled ? (
        <View style={s.masterRow}>
          <View style={s.copy}>
            <FocusText variant="row">App pauses</FocusText>
            <FocusText muted>{saving ? 'Saving changes…' : 'Turn off anytime'}</FocusText>
          </View>
          <MasterSwitch value={cfg.enabled} onChange={(enabled) => settings.update({ enabled })} />
        </View>
      ) : (
        <PrimaryAction
          label="Turn on app pauses"
          onPress={() => settings.update({ enabled: true })}
        />
      )}
    </LinearGradient>
  );
}

export function AppTile({
  label,
  selected = false,
  onPress,
  add = false,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  add?: boolean;
}) {
  const { fontScale } = useWindowDimensions();
  const reduced = useReducedMotion();
  const progress = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    progress.set(withTiming(selected ? 1 : 0, { duration: reduced ? 0 : f.motion.selection }));
  }, [selected, progress, reduced]);
  const border = useAnimatedStyle(() => ({
    borderColor: interpolateColor(progress.value, [0, 1], [c.border, c.accent]),
    backgroundColor: interpolateColor(progress.value, [0, 1], [c.surface, c.selected]),
  }));
  return (
    <Animated.View style={[s.tile, { width: f.size.appTile * Math.max(1, fontScale) }, border]}>
      <Pressable
        accessibilityRole={add ? 'button' : 'checkbox'}
        accessibilityLabel={label}
        accessibilityState={add ? undefined : { checked: selected }}
        onPress={onPress}
        style={({ pressed }) => ({
          gap: f.space.md,
          flex: 1,
          opacity: pressed ? f.opacity.pressed : 1,
        })}
      >
        <View style={s.tileTop}>
          {add ? (
            <Icon name="plus" size={f.size.appIcon} color={c.muted} />
          ) : (
            <AppIcon name={label} size={f.size.appIcon} />
          )}
          {selected && (
            <View style={s.check}>
              <Icon name="check" size={f.size.smallIcon} color={c.onAccent} />
            </View>
          )}
        </View>
        <FocusText variant="label">{label}</FocusText>
      </Pressable>
    </Animated.View>
  );
}

export function SettingRow({
  label,
  subtitle,
  icon,
  value,
  onChange,
  onPress,
  disabled = false,
}: {
  label: string;
  subtitle?: string;
  icon?: IconName;
  value?: boolean;
  onChange?: (value: boolean) => void;
  onPress?: () => void;
  disabled?: boolean;
}) {
  const { fontScale } = useWindowDimensions();
  return (
    <View
      style={[
        s.setting,
        {
          flexDirection: fontScale > 1.2 ? 'column' : 'row',
          alignItems: fontScale > 1.2 ? 'stretch' : 'center',
          opacity: disabled ? f.opacity.disabled : 1,
        },
      ]}
    >
      <View style={s.settingContent}>
        {icon && <Icon name={icon} size={f.size.icon} color={c.muted} />}
        <View style={s.copy}>
          <FocusText variant="row">{label}</FocusText>
          {subtitle && <FocusText muted>{subtitle}</FocusText>}
        </View>
      </View>
      <View style={s.settingActions}>
        {onChange && (
          <View style={s.touch}>
            <Switch
              accessibilityLabel={label}
              accessibilityState={{ disabled }}
              value={value}
              disabled={disabled}
              onValueChange={onChange}
              trackColor={{ false: c.offTrack, true: c.accent }}
              thumbColor={value ? c.onAccent : c.muted}
              style={{ minHeight: f.size.touch, minWidth: f.size.touch }}
            />
          </View>
        )}
        {onPress && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Review ${label.toLowerCase()}`}
            accessibilityState={{ disabled }}
            disabled={disabled}
            onPress={onPress}
            style={({ pressed }) => [s.touch, { opacity: pressed ? f.opacity.pressed : 1 }]}
          >
            <Icon name="chevron" size={f.size.smallIcon} color={c.muted} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

export function ActionRow({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon?: IconName;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [s.textLink, { opacity: pressed ? f.opacity.pressed : 1 }]}
    >
      {icon && <Icon name={icon} size={f.size.icon} color={c.muted} />}
      <FocusText variant="row" style={{ flex: 1 }}>
        {label}
      </FocusText>
      <Icon name="chevron" size={f.size.smallIcon} color={c.muted} />
    </Pressable>
  );
}

export function Choices({
  label,
  values,
  value,
  unit = '',
  onChange,
}: {
  label: string;
  values: readonly number[];
  value: number;
  unit?: string;
  onChange: (value: number) => void;
}) {
  const ref = useRef<ScrollView>(null);
  useEffect(() => {
    const index = values.indexOf(value);
    if (index >= 0)
      ref.current?.scrollTo({
        x: Math.max(0, index - 1) * (f.size.step + f.space.lg),
        animated: false,
      });
  }, [values, value]);
  return (
    <View style={s.inline}>
      <FocusText muted>{label}</FocusText>
      <ScrollView
        ref={ref}
        horizontal
        showsHorizontalScrollIndicator
        contentContainerStyle={s.choices}
        accessibilityRole="radiogroup"
        accessibilityLabel={label}
      >
        {values.map((choice) => (
          <Pressable
            key={choice}
            accessibilityRole="radio"
            accessibilityLabel={`${label}: ${choice}${unit}`}
            accessibilityState={{ selected: choice === value }}
            onPress={() => onChange(choice)}
            style={({ pressed }) => [
              s.choice,
              unit.length > 2 && s.choiceWide,
              {
                backgroundColor: choice === value ? c.accent : c.surface,
                borderColor: choice === value ? c.accent : c.border,
                opacity: pressed ? f.opacity.pressed : 1,
              },
            ]}
          >
            <FocusText variant="label" style={{ color: choice === value ? c.onAccent : c.text }}>
              {choice}
              {unit}
            </FocusText>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

export function LimitSelector({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  const { fontScale } = useWindowDimensions();
  const options: number[] = [...LIMITS];
  if (value !== null && !options.includes(value)) options.push(value);
  options.sort((a, b) => a - b);
  const index = value === null ? -1 : options.indexOf(value);
  const change = (direction: number) => {
    const next = options[index + direction];
    if (next !== undefined) onChange(next);
  };
  return (
    <View style={s.section}>
      <View style={s.numberRow}>
        <View style={s.numberCopy}>
          <View style={s.number}>
            <FocusText variant="number" style={{ color: value === null ? c.muted : c.accent }}>
              {value ?? 'Off'}
            </FocusText>
            {value !== null && (
              <FocusText variant="row" muted>
                min
              </FocusText>
            )}
          </View>
          <FocusText muted>
            {value === null ? 'Schedules and feed rules can still apply.' : 'Per app, per day'}
          </FocusText>
        </View>
        {value !== null && (
          <View style={s.stepper}>
            {([-1, 1] as const).map((direction) => {
              const disabled = options[index + direction] === undefined;
              return (
                <Pressable
                  key={direction}
                  accessibilityRole="button"
                  accessibilityLabel={
                    direction < 0 ? 'Decrease daily limit' : 'Increase daily limit'
                  }
                  accessibilityState={{ disabled }}
                  disabled={disabled}
                  onPress={() => change(direction)}
                  style={({ pressed }) => [
                    s.step,
                    { opacity: disabled ? f.opacity.disabled : pressed ? f.opacity.pressed : 1 },
                  ]}
                >
                  <Icon name={direction < 0 ? 'minus' : 'plus'} color={c.text} size={f.size.icon} />
                </Pressable>
              );
            })}
          </View>
        )}
      </View>
      <View
        style={[s.row, fontScale > 1.2 && { flexDirection: 'column', alignItems: 'flex-start' }]}
      >
        <FocusText muted style={s.copy}>
          15–120 min
        </FocusText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={value === null ? 'Enable daily limit' : 'Turn off daily limit'}
          onPress={() => onChange(value === null ? 30 : null)}
          style={({ pressed }) => [s.textLink, { opacity: pressed ? f.opacity.pressed : 1 }]}
        >
          <FocusText variant="label">
            {value === null ? 'Enable daily limit' : 'Turn off daily limit'}
          </FocusText>
        </Pressable>
      </View>
    </View>
  );
}

export function SegmentedControl({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Pause scope" style={s.segmented}>
      {[
        { label: 'Just the feed', value: true },
        { label: 'Whole app', value: false },
      ].map((option) => (
        <Pressable
          key={option.label}
          accessibilityRole="radio"
          accessibilityLabel={option.label}
          accessibilityState={{ selected: option.value === value }}
          onPress={() => onChange(option.value)}
          style={({ pressed }) => [
            s.segment,
            {
              backgroundColor: value === option.value ? c.accent : c.transparent,
              opacity: pressed ? f.opacity.pressed : 1,
            },
          ]}
        >
          {value === option.value && (
            <Icon name="check" size={f.size.smallIcon} color={c.onAccent} />
          )}
          <FocusText
            variant="label"
            style={{ color: value === option.value ? c.onAccent : c.text, textAlign: 'center' }}
          >
            {option.label}
          </FocusText>
        </Pressable>
      ))}
    </View>
  );
}

export function CollapsibleSection({
  title,
  icon,
  children,
  open: controlledOpen,
  onToggle,
}: {
  title: string;
  icon?: IconName;
  children: ReactNode;
  open?: boolean;
  onToggle?: () => void;
}) {
  const [localOpen, setOpen] = useState(false);
  const [contentHeight, setContentHeight] = useState(0);
  const open = controlledOpen ?? localOpen;
  const reduced = useReducedMotion();
  // Animate the measured body, not the section's position in the parent ScrollView.
  const bodyStyle = useAnimatedStyle(() => ({
    height: withTiming(open ? contentHeight : 0, { duration: reduced ? 0 : f.motion.expand }),
  }));
  return (
    <View style={s.collapse}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded: open }}
        onPress={onToggle ?? (() => setOpen(!open))}
        style={({ pressed }) => [s.collapseHeader, { opacity: pressed ? f.opacity.pressed : 1 }]}
      >
        {icon && <Icon name={icon} size={f.size.icon} color={c.muted} />}
        <FocusText variant="row" style={{ flex: 1 }}>
          {title}
        </FocusText>
        <View style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}>
          <Icon name="chevron" size={f.size.smallIcon} color={c.muted} />
        </View>
      </Pressable>
      <Animated.View
        style={[{ overflow: 'hidden' }, bodyStyle]}
        pointerEvents={open ? 'auto' : 'none'}
        accessibilityElementsHidden={!open}
        importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
      >
        {open && (
          <Animated.View
            entering={reduced ? undefined : FadeIn.duration(f.motion.fade)}
            exiting={reduced ? undefined : FadeOut.duration(f.motion.fade)}
            onLayout={(event) => setContentHeight(event.nativeEvent.layout.height)}
            style={[s.collapseBody, { position: 'absolute', top: 0, width: '100%' }]}
          >
            {children}
          </Animated.View>
        )}
      </Animated.View>
    </View>
  );
}
