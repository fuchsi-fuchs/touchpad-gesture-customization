import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {
	Extension,
	ExtensionMetadata,
} from 'resource:///org/gnome/shell/extensions/extension.js';
import {AllSettingsKeys, ActionType} from './common/settings.js';
import * as Constants from './constants.js';
import * as VKeyboard from './src/utils/keyboard.js';
import {SnapWindowExtension, WindowSnappingMode} from './src/windowSnapping.js';
import {SwipeDirection} from './src/swipeTracker.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export default class TouchpadGestureCustomization extends Extension {
	private _extensions: ISubExtension[];
	settings?: Gio.Settings;
	private _settingChangedId = 0;
	private _reloadWaitId = 0;
	private _addReloadDelayFor: AllSettingsKeys[];
	private _builtinDisabled = false;

	constructor(metadata: ExtensionMetadata) {
		super(metadata);

		this._extensions = [];
		this._addReloadDelayFor = [
			'touchpad-speed-scale',
			'alttab-delay',
			'touchpad-pinch-speed',
			'volume-control-speed',
			'brightness-control-speed',
		];
	}

	enable() {
		this.settings = this.getSettings();
		this._settingChangedId = this.settings.connect(
			'changed',
			this.reload.bind(this)
		);
		this._enable();
	}

	disable() {
		if (this.settings) this.settings.disconnect(this._settingChangedId);

		if (this._reloadWaitId !== 0) {
			GLib.source_remove(this._reloadWaitId);
			this._reloadWaitId = 0;
		}

		this.settings = undefined;

		this._disable();
	}

	reload(_settings: never, key: AllSettingsKeys) {
		if (this._reloadWaitId !== 0) GLib.source_remove(this._reloadWaitId);

		this._reloadWaitId = GLib.timeout_add(
			GLib.PRIORITY_DEFAULT,
			this._addReloadDelayFor.includes(key) ? Constants.RELOAD_DELAY : 0,
			() => {
				this._disable();
				this._enable();
				this._reloadWaitId = 0;
				return GLib.SOURCE_REMOVE;
			}
		);
	}

	_createAction(
		_action: ActionType,
		_nfingers: number,
		_direction: SwipeDirection
	) {
		switch (_action) {
			case ActionType.WINDOW_FULLSCREEN:
				return new SnapWindowExtension(
					[_nfingers],
					_direction,
					WindowSnappingMode.FULLSCREEN
				);
			case ActionType.WINDOW_MAXIMIZE:
				return new SnapWindowExtension(
					[_nfingers],
					_direction,
					WindowSnappingMode.MAXIMIZE
				);
			case ActionType.WINDOW_ENLARGE:
				return new SnapWindowExtension(
					[_nfingers],
					_direction,
					WindowSnappingMode.ENLARGE
				);
			case ActionType.WINDOW_REDUCE:
				return new SnapWindowExtension(
					[_nfingers],
					_direction,
					WindowSnappingMode.REDUCE
				);
			case ActionType.WINDOW_MINIMIZE:
				return new SnapWindowExtension(
					[_nfingers],
					_direction,
					WindowSnappingMode.MINIMIZE
				);
			case ActionType.WINDOW_SNAP_LEFT:
				return new SnapWindowExtension(
					[_nfingers],
					_direction,
					WindowSnappingMode.SNAP_LEFT
				);
			case ActionType.WINDOW_SNAP_RIGHT:
				return new SnapWindowExtension(
					[_nfingers],
					_direction,
					WindowSnappingMode.SNAP_RIGHT
				);
			default:
				console.error(
					`creating action of type ${_action} not implemented!`
				);
				break;
		}
	}

	_createGesture(
		_propertyName: string,
		_nfingers: number,
		_direction: SwipeDirection
	) {
		const act: ActionType = this.settings!.get_enum(_propertyName);

		if (act != ActionType.NONE) {
			console.debug(`ATG: Creating action ${ActionType[act]} for ${_nfingers}-finger ${SwipeDirection[_direction]} gesture`);
			const action = this._createAction(act, _nfingers, _direction);
			this._extensions.push(action!);
		}
	}

	_enable() {
		this._initializeSettings();
		this._extensions = [];
		if (this.settings === undefined) return;

		this._createGesture('swipe-3-finger-up', 3, SwipeDirection.UP);
		this._createGesture('swipe-3-finger-down', 3, SwipeDirection.DOWN);
		this._createGesture('swipe-3-finger-left', 3, SwipeDirection.LEFT);
		this._createGesture('swipe-3-finger-right', 3, SwipeDirection.RIGHT);

		this._createGesture('swipe-4-finger-up', 4, SwipeDirection.UP);
		this._createGesture('swipe-4-finger-down', 4, SwipeDirection.DOWN);
		this._createGesture('swipe-4-finger-left', 4, SwipeDirection.LEFT);
		this._createGesture('swipe-4-finger-right', 4, SwipeDirection.RIGHT);

		this._extensions.forEach(extension => extension.apply?.());

		if (Main.overview._swipeTracker.enabled || Main.wm._workspaceAnimation._swipeTracker.enabled) {
			console.debug('ATG: Disabling built-in overview and workspace swiping gestures');
			this._builtinDisabled = true;
			Main.overview._swipeTracker.enabled = false;
			Main.wm._workspaceAnimation._swipeTracker.enabled = false;
		}

		/**
		 * App Gestures
		 */
		// if (this.settings.get_boolean('enable-forward-back-gesture')) {
		// 	const appForwardBackKeyBinds: AppForwardBackKeyBinds = this.settings
		// 		.get_value('forward-back-application-keyboard-shortcuts')
		// 		.deepUnpack();

		// 	this._extensions.push(
		// 		new ForwardBackGestureExtension(
		// 			appForwardBackKeyBinds,
		// 			this.metadata.dir.get_uri(),
		// 			this.settings.get_boolean('enable-vertical-app-gesture')
		// 		)
		// 	);
		// }
	}

	_initializeSettings() {
		if (this.settings) {
			Constants.ExtSettings.ALLOW_MINIMIZE_WINDOW =
				this.settings.get_boolean('allow-minimize-window');
			Constants.ExtSettings.FOLLOW_NATURAL_SCROLL =
				this.settings.get_boolean('follow-natural-scroll');
			Constants.ExtSettings.DEFAULT_OVERVIEW_GESTURE_DIRECTION =
				this.settings.get_boolean('default-overview-gesture-direction');
			Constants.ExtSettings.INVERT_VOLUME_DIRECTION =
				this.settings.get_boolean('invert-volume-gesture-direction');
			Constants.ExtSettings.INVERT_BRIGHTNESS_DIRECTION =
				this.settings.get_boolean(
					'invert-brightness-gesture-direction'
				);
			Constants.ExtSettings.APP_GESTURES = this.settings.get_boolean(
				'enable-forward-back-gesture'
			);

			Constants.TouchpadConstants.SWIPE_MULTIPLIER =
				Constants.TouchpadConstants.DEFAULT_SWIPE_MULTIPLIER *
				this.settings.get_double('touchpad-speed-scale');
			Constants.TouchpadConstants.PINCH_MULTIPLIER =
				Constants.TouchpadConstants.DEFAULT_PINCH_MULTIPLIER *
				this.settings.get_double('touchpad-pinch-speed');
			Constants.TouchpadConstants.VOLUME_CONTROL_MULTIPLIER =
				Constants.TouchpadConstants.DEFAULT_VOLUME_CONTROL_MULTIPLIER *
				this.settings.get_double('volume-control-speed');
			Constants.TouchpadConstants.BRIGHTNESS_CONTROL_MULTIPLIER =
				Constants.TouchpadConstants
					.DEFAULT_BRIGHTNESS_CONTROL_MULTIPLIER *
				this.settings.get_double('brightness-control-speed');
			Constants.AltTabConstants.DELAY_DURATION =
				this.settings.get_int('alttab-delay');
			Constants.TouchpadConstants.HOLD_SWIPE_DELAY_DURATION =
				this.settings.get_int('hold-swipe-delay-duration');
		}
	}

	_disable() {
		console.debug('ATG: Disabling extension');
		VKeyboard.extensionCleanup();
		this._extensions.reverse().forEach(extension => extension.destroy());
		this._extensions = [];
		if (this._builtinDisabled) {
			console.debug('ATG: Re-enabling built-in overview and workspace swiping gestures');
			this._builtinDisabled = false;
			Main.overview._swipeTracker.enabled = true;
			Main.wm._workspaceAnimation._swipeTracker.enabled = true;
		}
	}
}
