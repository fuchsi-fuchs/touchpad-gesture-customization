import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import Mtk from 'gi://Mtk';
import St from 'gi://St';
import GObject from 'gi://GObject';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Utils from 'resource:///org/gnome/shell/misc/util.js';
import {SwipeTracker} from 'resource:///org/gnome/shell/ui/swipeTracker.js';
import {ExtSettings} from '../constants.js';
import {
	createSwipeTracker,
	TouchpadSwipeGesture,
	SwipeDirection,
} from './swipeTracker.js';
import {easeActor, easeAdjustment} from './utils/environment.js';
import {getVirtualKeyboard, IVirtualKeyboard} from './utils/keyboard.js';

const WINDOW_ANIMATION_TIME = 200;
const UPDATED_WINDOW_ANIMATION_TIME = 150;
const TRIGGER_THRESHOLD = 0.1;

export enum WindowSnappingMode {
	MAXIMIZE,
	MINIMIZE,
	REDUCE,
	ENLARGE,
	FULLSCREEN,
	SNAP_LEFT,
	SNAP_RIGHT,
}

export interface IGestureAction extends St.Widget {
	/**
	 * @brief check if this action is currently valid and available
	 * @note all other functions are only called if this returned true before prepare was called
	 */
	isAvailable(): boolean;

	/**
	 * @brief prepare preview and variables (eg. current focused window or workspace)
	 * @note is always called before preview or finish
	 * @param progress range 0.0 - 1.0
	 */
	prepare(progress: number): void;

	/**
	 * @brief preview action
	 * @note always preceded by prepare(1.0)
	 * @param progress range -1.0 - 1.0
	 */
	preview(progress: number): void;

	/**
	 * @brief perform action with given final progress
	 * @note always preceded by preview(...)
	 * @param finalProgress (raw) progress at the end of gesture
	 */
	finish(finalProgress: number): void;

	/**
	 * @brief cancel preview and action
	 * @note might be called after prepare instead of preview
	 */
	cancel(): void;
}

export const WindowManipulationAction = GObject.registerClass(
	class WindowManipulationAction extends St.Widget implements IGestureAction {
		private _adjustment: St.Adjustment;
		private _window?: Meta.Window;
		private _startBox?: Mtk.Rectangle;
		private _endBox?: Mtk.Rectangle;
		private _mode: WindowSnappingMode;
		private _virtualDevice: IVirtualKeyboard;

		constructor(mode: WindowSnappingMode) {
			super({
				reactive: false,
				style_class: 'tile-preview',
				visible: false,
			});

			this._mode = mode;

			this.add_style_class_name('gie-tile-window-preview');

			this._adjustment = new St.Adjustment({
				actor: this,
				value: 0,
				lower: -1,
				upper: 1,
			});

			this._adjustment.connect(
				'notify::value',
				this._valueChanged.bind(this)
			);
			this._virtualDevice = getVirtualKeyboard();
		}

		isAvailable(): boolean {
			const window =
				global.display.get_focus_window() as Meta.Window | null;

			if (!window) {
				return false;
			}

			switch (this._mode) {
				case WindowSnappingMode.MAXIMIZE:
					if (!window.can_maximize()) return false;
					break;
				case WindowSnappingMode.MINIMIZE:
					if (!window.can_minimize()) return false;
					break;
				case WindowSnappingMode.REDUCE:
					if (
						window.get_maximized() !== Meta.MaximizeFlags.BOTH &&
						!window.can_minimize()
					)
						return false;
					break;
				case WindowSnappingMode.ENLARGE:
					if (!window.can_maximize()) return false;
					break;
				case WindowSnappingMode.FULLSCREEN:
					if (!window.can_maximize()) return false;
					break;
				case WindowSnappingMode.SNAP_LEFT:
					if (!window.can_maximize()) return false;
					break;
				case WindowSnappingMode.SNAP_RIGHT:
					if (!window.can_maximize()) return false;
					break;
				default:
					console.error('Unknown window snapping mode:', this._mode);
					return false;
			}

			return true;
		}

		_determineEndBox(): void {
			switch (this._mode) {
				case WindowSnappingMode.MAXIMIZE:
					this._endBox = this.getMaximizedBox();
					break;
				case WindowSnappingMode.MINIMIZE:
					this._endBox = this.getMinimizedBox();
					break;
				case WindowSnappingMode.REDUCE:
					this._endBox = this.getReducedBox();
					break;
				case WindowSnappingMode.ENLARGE:
					if (
						this._window?.get_maximized() ===
						Meta.MaximizeFlags.BOTH
					) {
						this._endBox = this.getFullscreenBox();
					} else {
						this._endBox = this.getMaximizedBox();
					}

					break;
				case WindowSnappingMode.FULLSCREEN:
					this._endBox = this.getFullscreenBox();
					break;
				case WindowSnappingMode.SNAP_LEFT:
					this._endBox = this.getMaximizedBox();
					this._endBox.width /= 2;
					break;
				case WindowSnappingMode.SNAP_RIGHT:
					this._endBox = this.getMaximizedBox();
					this._endBox.width /= 2;
					this._endBox.x += this._endBox.width;
					break;
				default:
					console.error('Unknown window snapping mode:', this._mode);
					return;
			}
		}

		prepare(progress: number): void {
			this._window = global.display.get_focus_window() as
				| Meta.Window
				| undefined;

			if (!this._window) {
				// this check is just a safety, as this function should only be called if isAvailable() is true
				return;
			}

			if (!this.visible) {
				this._startBox = this._window.get_frame_rect();
				this._determineEndBox();
				this._adjustment.value = 0;
				this.visible = true;
			}

			this.opacity = 255 * progress;
		}

		_valueChanged(): void {
			const progress = this._adjustment.value;

			if (progress < 0) {
				this.opacity = 0;
				return;
			} else {
				this.opacity = 255;
			}

			if (!this._startBox || !this._endBox) {
				return;
			}

			const [x, y] = [
				Utils.lerp(this._startBox!.x, this._endBox!.x, progress),
				Utils.lerp(this._startBox!.y, this._endBox!.y, progress),
			];

			const [width, height] = [
				Utils.lerp(this._startBox.width, this._endBox.width, progress),
				Utils.lerp(
					this._startBox.height,
					this._endBox.height,
					progress
				),
			];

			this.set_position(x, y);
			this.set_size(width, height);
		}

		preview(progress: number): void {
			this._adjustment.value = progress;
		}

		_easeOpacity(value: number, callback?: () => void) {
			easeActor(this as St.Widget, {
				opacity: value,
				duration: UPDATED_WINDOW_ANIMATION_TIME,
				mode: Clutter.AnimationMode.EASE_OUT_QUAD,
				onStopped: () => {
					if (callback) callback();
				},
			});
		}

		finish(finalProgress: number): void {
			const snappedProgress = finalProgress < 0.5 ? 0 : 1;

			const callback = () => {
				if (!this.visible) return;

				this._easeOpacity(0, () => (this.visible = false));

				if (snappedProgress == 0) return;

				if (!this._window) return;

				switch (this._mode) {
					case WindowSnappingMode.MAXIMIZE:
						this._window.maximize(Meta.MaximizeFlags.BOTH);
						break;
					case WindowSnappingMode.MINIMIZE:
						if (this._window.is_fullscreen())
							this._window.unmake_fullscreen();
						this._window.minimize();
						break;
					case WindowSnappingMode.REDUCE:
						if (this._window.is_fullscreen())
							this._window.unmake_fullscreen();
						else if (
							this._window.get_maximized() ===
							Meta.MaximizeFlags.BOTH
						) {
							this._window.unmaximize(Meta.MaximizeFlags.BOTH);
						} else {
							this._window.minimize();
						}

						break;
					case WindowSnappingMode.ENLARGE:
						if (
							this._window.get_maximized() ===
							Meta.MaximizeFlags.BOTH
						) {
							this._window.make_fullscreen();
						} else {
							this._window.maximize(Meta.MaximizeFlags.BOTH);
						}

						break;
					case WindowSnappingMode.FULLSCREEN:
						this._window.make_fullscreen();
						break;
					case WindowSnappingMode.SNAP_LEFT:
						if (this._window.is_fullscreen())
							this._window.unmake_fullscreen();

						{
							const keys = [
								Clutter.KEY_Super_L,
								Clutter.KEY_Left,
							];
							this._virtualDevice.sendKeys(keys);
						}

						break;
					case WindowSnappingMode.SNAP_RIGHT:
						if (this._window.is_fullscreen())
							this._window.unmake_fullscreen();

						{
							const keys = [
								Clutter.KEY_Super_L,
								Clutter.KEY_Right,
							];
							this._virtualDevice.sendKeys(keys);
						}

						break;
					default:
						console.error(
							'Unknown window snapping mode:',
							this._mode
						);
						break;
				}

				this._window = undefined;
			};

			easeAdjustment(this._adjustment, snappedProgress, {
				duration: WINDOW_ANIMATION_TIME,
				mode: Clutter.AnimationMode.EASE_OUT_QUAD,
				onStopped: callback,
			});
		}

		cancel(): void {
			this._easeOpacity(0, () => {
				this.visible = false;
				this._window = undefined;
				this._startBox = undefined;
				this._endBox = undefined;
			});
		}

		private getMinimizedBox() {
			if (!this._window) return new Mtk.Rectangle();

			const [has_icon, icon_geometry] = this._window.get_icon_geometry();
			if (has_icon) return icon_geometry;

			const rect = this._window.get_frame_rect();
			rect.x += rect.width / 2;
			rect.width = 0;
			rect.y += rect.height / 2;
			rect.height = 0;
			return rect;
		}

		private getMaximizedBox() {
			if (!this._window) return new Mtk.Rectangle();

			const monitor = this._window.get_monitor();
			const maximizedBox =
				Main.layoutManager.getWorkAreaForMonitor(monitor);
			return maximizedBox;
		}

		private getReducedBox() {
			if (!this._window) return new Mtk.Rectangle();

			if (this._window.is_fullscreen()) {
				return this.getMaximizedBox();
			}

			if (this._window.get_maximized() !== Meta.MaximizeFlags.BOTH) {
				return this.getMinimizedBox();
			}

			const normalBox = this._window.get_frame_rect();

			const [width, height] = [
				Math.round(normalBox.width * 0.05),
				Math.round(normalBox.height * 0.05),
			];

			normalBox.x += width;
			normalBox.width -= 2 * width;
			normalBox.y += height;
			normalBox.height -= 2 * height;
			return normalBox;
		}

		private getFullscreenBox() {
			if (!this._window) return new Mtk.Rectangle();
			return global.display.get_monitor_geometry(
				this._window.get_monitor()
			);
		}
	}
);

export class SwipeGesture implements ISubExtension {
	private _swipeTracker: typeof SwipeTracker.prototype;
	private _connectors: number[] = [];
	private _action: IGestureAction;
	private _uiGroupAddedActorId: number;

	constructor(
		nfingerss: number[],
		swipeDirection: SwipeDirection,
		action: IGestureAction
	) {
		this._swipeTracker = createSwipeTracker(
			global.stage,
			nfingerss,
			Shell.ActionMode.NORMAL,
			swipeDirection,
			true,
			1,
			{allowTouch: true} // TODO: setting
		);

		this._swipeTracker.allowLongSwipes = true;
		this._action = action;

		Main.layoutManager.uiGroup.add_child(this._action);
		this._uiGroupAddedActorId = Main.layoutManager.uiGroup.connect(
			'child-added',
			() => {
				Main.layoutManager.uiGroup.set_child_above_sibling(
					this._action,
					null
				);
			}
		);

		Main.layoutManager.uiGroup.set_child_above_sibling(this._action, null);
	}

	apply(): void {
		this._connectors.push(
			this._swipeTracker.connect('begin', this._gestureBegin.bind(this))
		);
		this._connectors.push(
			this._swipeTracker.connect('update', this._gestureUpdate.bind(this))
		);
		this._connectors.push(
			this._swipeTracker.connect('end', this._gestureEnd.bind(this))
		);
	}

	destroy(): void {
		if (this._uiGroupAddedActorId) {
			Main.layoutManager.uiGroup.disconnect(this._uiGroupAddedActorId);
			this._uiGroupAddedActorId = 0;
		}

		this._connectors.forEach(connector =>
			this._swipeTracker.disconnect(connector)
		);
		Main.layoutManager.uiGroup.remove_child(this._action);
		this._swipeTracker.destroy();
		this._action.destroy();
	}

	_gestureBegin(
		tracker: typeof SwipeTracker.prototype,
		monitor: number
	): void {
		if (!this._action.isAvailable()) return;

		const window = global.display.get_focus_window() as Meta.Window | null;

		// window is on different monitor
		if (!window || window.get_monitor() !== monitor) {
			return;
		}

		const currentMonitor = window.get_monitor();
		const monitorArea = global.display.get_monitor_geometry(currentMonitor);

		this._action.prepare(1.0);
		tracker.confirmSwipe(monitorArea.height, [-1, 0, 1], 0, 0);
	}

	_gestureUpdate(_tracker: never, progress: number): void {
		this._action.preview(progress);
	}

	_gestureEnd(_tracker: never, duration: number, progress: number): void {
		this._action.finish(progress);
	}
}
