import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

// NOTE: this definition is duplicated in the schema and in the ui/gestures.ui file.
// TODO: how the fuck can we change this to have a single source of truth?
export enum ActionType {
	NONE = 0,
	WINDOW_FULLSCREEN = 1,
	WINDOW_MAXIMIZE = 2,
	WINDOW_ENLARGE = 3,
	WINDOW_REDUCE = 4,
	WINDOW_MINIMIZE = 5,
	WINDOW_SNAP_LEFT = 6,
	WINDOW_SNAP_RIGHT = 7,
}

export enum OverviewNavigationState {
	CYCLIC = 0,
	GNOME = 1,
	WINDOW_PICKER_ONLY = 2,
}

export enum ForwardBackKeyBinds {
	Default = 0,
	'Forward/Backward' = 1,
	'Page Up/Down' = 2,
	'Right/Left' = 3,
	'Audio Next/Prev' = 4,
	'Tab Next/Prev' = 5,
}

export type BooleanSettingsKeys =
	| 'allow-minimize-window'
	| 'follow-natural-scroll'
	| 'invert-volume-gesture-direction'
	| 'invert-brightness-gesture-direction'
	| 'enable-forward-back-gesture'
	| 'default-overview-gesture-direction'
	| 'enable-vertical-app-gesture';

export type IntegerSettingsKeys = 'alttab-delay' | 'hold-swipe-delay-duration';

export type DoubleSettingsKeys =
	| 'touchpad-speed-scale'
	| 'touchpad-pinch-speed'
	| 'volume-control-speed'
	| 'brightness-control-speed';

export const ActionNames = [
	'pinch-3-finger-open',
	'pinch-3-finger-close',
	'pinch-4-finger-open',
	'pinch-4-finger-close',
	'swipe-3-finger-up',
	'swipe-3-finger-down',
	'swipe-3-finger-left',
	'swipe-3-finger-right',
	'swipe-4-finger-up',
	'swipe-4-finger-down',
	'swipe-4-finger-left',
	'swipe-4-finger-right',
] as const;

export type ActionKeys = (typeof ActionNames)[number];

export type EnumSettingsKeys = ActionKeys | 'overview-navigation-states';

export type MiscSettingsKeys = 'forward-back-application-keyboard-shortcuts';

export type AllSettingsKeys =
	| BooleanSettingsKeys
	| IntegerSettingsKeys
	| DoubleSettingsKeys
	| EnumSettingsKeys
	| MiscSettingsKeys;

export type UIPageObjectIds = 'gestures_page' | 'customizations_page';

export type AllUIObjectKeys =
	| UIPageObjectIds
	| AllSettingsKeys
	| 'touchpad-speed-scale_display-value'
	| 'touchpad-pinch-speed_display-value'
	| 'volume-control-speed_display-value'
	| 'brightness-control-speed_display-value';

type Enum_Functions<K extends EnumSettingsKeys, T> = {
	get_enum(key: K): T;
	set_enum(key: K, value: T): void;
};

type SettingsEnumFunctions = Enum_Functions<ActionKeys, ActionType> &
	Enum_Functions<'overview-navigation-states', OverviewNavigationState>;

type Misc_Functions<K extends MiscSettingsKeys, T extends string> = {
	get_value(key: K): GLib.Variant<T>;
	set_value(key: K, value: GLib.Variant<T>): void;
};

type SettingsMiscFunctions = Misc_Functions<
	'forward-back-application-keyboard-shortcuts',
	'a{s(ib)}'
>;

export type GioSettings = Omit<
	Gio.Settings,
	KeysThatStartsWith<keyof Gio.Settings, 'get_' | 'set_'>
> & {
	get_boolean(key: BooleanSettingsKeys): boolean;
	get_int(key: IntegerSettingsKeys): number;
	get_double(key: DoubleSettingsKeys): number;
	set_double(key: DoubleSettingsKeys, value: number): void;
} & SettingsEnumFunctions &
	SettingsMiscFunctions;
