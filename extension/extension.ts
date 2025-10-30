import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {
	Extension,
	ExtensionMetadata,
} from 'resource:///org/gnome/shell/extensions/extension.js';
import {AllSettingsKeys, ActionType} from './common/settings.js';
import * as Constants from './constants.js';
import * as VKeyboard from './src/utils/keyboard.js';
import {SwipeGesture, PinchGesture} from './src/gestures/gestures.js';
import {
	WindowSnappingMode,
	WindowManipulationAction,
} from './src/actions/windowSnapping.js';
import {SwipeDirection} from './src/gestures/swipeTracker.js';
import {PinchDirection} from './src/gestures/pinchTracker.js';
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

	_createAction(_action: ActionType) {
		switch (_action) {
			case ActionType.WINDOW_FULLSCREEN:
				return new WindowManipulationAction(
					WindowSnappingMode.FULLSCREEN
				);
			case ActionType.WINDOW_MAXIMIZE:
				return new WindowManipulationAction(
					WindowSnappingMode.MAXIMIZE
				);
			case ActionType.WINDOW_ENLARGE:
				return new WindowManipulationAction(WindowSnappingMode.ENLARGE);
			case ActionType.WINDOW_REDUCE:
				return new WindowManipulationAction(WindowSnappingMode.REDUCE);
			case ActionType.WINDOW_MINIMIZE:
				return new WindowManipulationAction(
					WindowSnappingMode.MINIMIZE
				);
			case ActionType.WINDOW_SNAP_LEFT:
				return new WindowManipulationAction(
					WindowSnappingMode.SNAP_LEFT
				);
			case ActionType.WINDOW_SNAP_RIGHT:
				return new WindowManipulationAction(
					WindowSnappingMode.SNAP_RIGHT
				);
			default:
				console.error(
					`creating action of type ${_action} not implemented!`
				);
				break;
		}
	}

	_createSwipeGesture(
		_propertyName: string,
		_nfingers: number,
		_direction: SwipeDirection
	) {
		const act: ActionType = this.settings!.get_enum(_propertyName);

		if (act != ActionType.NONE) {
			console.debug(
				`ATG: Creating action ${ActionType[act]} for ${_nfingers}-finger ${SwipeDirection[_direction]} gesture`
			);
			const action = this._createAction(act);
			if (!action) return;
			const gesture = new SwipeGesture([_nfingers], _direction, action);
			this._extensions.push(gesture);
		}
	}

	_createPinchGesture(
		_propertyName: string,
		_nfingers: number,
		_direction: PinchDirection
	) {
		const act: ActionType = this.settings!.get_enum(_propertyName);

		if (act != ActionType.NONE) {
			console.debug(
				`ATG: Creating action ${ActionType[act]} for ${_nfingers}-finger pinch ${PinchDirection[_direction]} gesture`
			);
			const action = this._createAction(act);
			if (!action) return;
			const gesture = new PinchGesture([_nfingers], _direction, action);
			this._extensions.push(gesture);
		}
	}

	_enable() {
		this._initializeSettings();
		this._extensions = [];
		if (this.settings === undefined) return;

		if (
			Main.overview._swipeTracker.enabled ||
			Main.wm._workspaceAnimation._swipeTracker.enabled
		) {
			console.debug(
				'ATG: Disabling built-in overview and workspace swiping gestures'
			);
			this._builtinDisabled = true;
			Main.overview._swipeTracker.enabled = false;
			Main.wm._workspaceAnimation._swipeTracker.enabled = false;
		}

		this._createSwipeGesture('swipe-3-finger-up', 3, SwipeDirection.UP);
		this._createSwipeGesture('swipe-3-finger-down', 3, SwipeDirection.DOWN);
		this._createSwipeGesture('swipe-3-finger-left', 3, SwipeDirection.LEFT);
		this._createSwipeGesture(
			'swipe-3-finger-right',
			3,
			SwipeDirection.RIGHT
		);

		this._createSwipeGesture('swipe-4-finger-up', 4, SwipeDirection.UP);
		this._createSwipeGesture('swipe-4-finger-down', 4, SwipeDirection.DOWN);
		this._createSwipeGesture('swipe-4-finger-left', 4, SwipeDirection.LEFT);
		this._createSwipeGesture(
			'swipe-4-finger-right',
			4,
			SwipeDirection.RIGHT
		);

		this._createPinchGesture('pinch-3-finger-open', 3, PinchDirection.OPEN);
		this._createPinchGesture(
			'pinch-3-finger-close',
			3,
			PinchDirection.CLOSE
		);

		this._createPinchGesture('pinch-4-finger-open', 4, PinchDirection.OPEN);
		this._createPinchGesture(
			'pinch-4-finger-close',
			4,
			PinchDirection.CLOSE
		);

		this._extensions.forEach(extension => extension.apply?.());

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
			console.debug(
				'ATG: Re-enabling built-in overview and workspace swiping gestures'
			);
			this._builtinDisabled = false;
			Main.overview._swipeTracker.enabled = true;
			Main.wm._workspaceAnimation._swipeTracker.enabled = true;
		}
	}
}
