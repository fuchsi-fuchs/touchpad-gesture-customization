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

const SnapPreview = GObject.registerClass(
	class SnapPreview extends St.Widget {
		private _adjustment: St.Adjustment;
		private _window?: Meta.Window;
		private _startBox?: Mtk.Rectangle;
		private _endBox?: Mtk.Rectangle;
		private _mode?: WindowSnappingMode;
		private _virtualDevice: IVirtualKeyboard;

		constructor() {
			super({
				reactive: false,
				style_class: 'tile-preview',
				visible: false,
			});

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

		open(window: Meta.Window, mode: WindowSnappingMode): boolean {
			if (this.visible) {
				return false;
			}

			this._mode = mode;
			this._window = window;
			this._startBox = window.get_frame_rect();

			switch (mode) {
				case WindowSnappingMode.MAXIMIZE:
					this._endBox = this.getMaximizedBox(window);
					break;
				case WindowSnappingMode.MINIMIZE:
					this._endBox = this.getMinimizedBox(window);
					break;
				case WindowSnappingMode.REDUCE:
					this._endBox = this.getReducedBox(window);
					break;
				case WindowSnappingMode.ENLARGE:
					if (window.get_maximized() === Meta.MaximizeFlags.BOTH) {
						this._endBox = this.getFullscreenBox(window);
					} else {
						this._endBox = this.getMaximizedBox(window);
					}

					break;
				case WindowSnappingMode.FULLSCREEN:
					this._endBox = this.getFullscreenBox(window);
					break;
				case WindowSnappingMode.SNAP_LEFT:
					this._endBox = this.getMaximizedBox(window);
					this._endBox.width /= 2;
					break;
				case WindowSnappingMode.SNAP_RIGHT:
					this._endBox = this.getMaximizedBox(window);
					this._endBox.width /= 2;
					this._endBox.x += this._endBox.width;
					break;
				default:
					console.error('Unknown window snapping mode:', mode);
					return false;
			}

			this.opacity = 0;
			this._adjustment.value = 0;
			this._valueChanged();
			this.visible = true;
			return true;
		}

		finish(duration: number, state: number): void {
			const callback = () => {
				if (!this.visible) return;

				this.easeOpacity(0, () => (this.visible = false));

				if (!this._window || state <= 0) return;

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

			easeAdjustment(this._adjustment, state, {
				duration: duration,
				mode: Clutter.AnimationMode.EASE_OUT_QUAD,
				onStopped: callback,
			});
		}

		_valueChanged(): void {
			const progress = this._adjustment.value;

			if (progress < 0) {
				this.opacity = 0;
				this.visible = false;
				return;
			} else {
				this.opacity = 255;
				this.visible = true;
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

		easeOpacity(value: number, callback?: () => void) {
			easeActor(this as St.Widget, {
				opacity: value,
				duration: UPDATED_WINDOW_ANIMATION_TIME,
				mode: Clutter.AnimationMode.EASE_OUT_QUAD,
				onStopped: () => {
					if (callback) callback();
				},
			});
		}

		get adjustment(): St.Adjustment {
			return this._adjustment;
		}

		private getMinimizedBox(window: Meta.Window) {
			const [has_icon, icon_geometry] = window.get_icon_geometry();
			if (has_icon) return icon_geometry;

			const rect = window.get_frame_rect();
			rect.x += rect.width / 2;
			rect.width = 0;
			rect.y += rect.height / 2;
			rect.height = 0;
			return rect;
		}

		private getMaximizedBox(window: Meta.Window) {
			const monitor = window.get_monitor();
			const maximizedBox =
				Main.layoutManager.getWorkAreaForMonitor(monitor);
			return maximizedBox;
		}

		private getReducedBox(window: Meta.Window) {
			if (window.is_fullscreen()) {
				return this.getMaximizedBox(window);
			}

			if (window.get_maximized() !== Meta.MaximizeFlags.BOTH) {
				return this.getMinimizedBox(window);
			}

			const normalBox = window.get_frame_rect();

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

		private getFullscreenBox(window: Meta.Window) {
			return global.display.get_monitor_geometry(window.get_monitor());
		}
	}
);

export class SnapWindowExtension implements ISubExtension {
	private _swipeTracker: typeof SwipeTracker.prototype;
	private _swipeDirection: SwipeDirection;
	private _connectors: number[] = [];
	private _tilePreview: typeof SnapPreview.prototype;
	private _touchpadSwipeGesture: typeof TouchpadSwipeGesture.prototype;
	private _uiGroupAddedActorId: number;
	private _mode: WindowSnappingMode;

	constructor(
		nfingerss: number[],
		swipeDirection: SwipeDirection,
		mode: WindowSnappingMode
	) {
		this._swipeTracker = createSwipeTracker(
			global.stage,
			nfingerss,
			Shell.ActionMode.NORMAL,
			swipeDirection,
			true,
			1,
			{allowTouch: false}
		);

		this._swipeTracker.allowLongSwipes = true;
		this._swipeDirection = swipeDirection;
		this._mode = mode;
		this._touchpadSwipeGesture = this._swipeTracker
			._touchpadGesture as typeof TouchpadSwipeGesture.prototype;
		this._tilePreview = new SnapPreview();
		Main.layoutManager.uiGroup.add_child(this._tilePreview);
		this._uiGroupAddedActorId = Main.layoutManager.uiGroup.connect(
			'child-added',
			() => {
				Main.layoutManager.uiGroup.set_child_above_sibling(
					this._tilePreview,
					null
				);
			}
		);

		Main.layoutManager.uiGroup.set_child_above_sibling(
			this._tilePreview,
			null
		);
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
		Main.layoutManager.uiGroup.remove_child(this._tilePreview);
		this._swipeTracker.destroy();
		this._tilePreview.destroy();
	}

	_gestureBegin(
		tracker: typeof SwipeTracker.prototype,
		monitor: number
	): void {
		const window = global.display.get_focus_window() as Meta.Window | null;

		// window is on different monitor
		if (!window || window.get_monitor() !== monitor) {
			return;
		}

		const currentMonitor = window.get_monitor();
		const monitorArea = global.display.get_monitor_geometry(currentMonitor);

		switch (this._mode) {
			case WindowSnappingMode.MAXIMIZE:
				if (!window.can_maximize()) return;
				break;
			case WindowSnappingMode.MINIMIZE:
				if (!window.can_minimize()) return;
				break;
			case WindowSnappingMode.REDUCE:
				if (
					window.get_maximized() !== Meta.MaximizeFlags.BOTH &&
					!window.can_minimize()
				)
					return;
				break;
			case WindowSnappingMode.ENLARGE:
				if (!window.can_maximize()) return;
				break;
			case WindowSnappingMode.FULLSCREEN:
				if (!window.can_maximize()) return;
				break;
			case WindowSnappingMode.SNAP_LEFT:
				if (!window.can_maximize()) return;
			case WindowSnappingMode.SNAP_RIGHT:
				if (!window.can_maximize()) return;
				break;
			default:
				console.error('Unknown window snapping mode:', this._mode);
				return;
		}

		if (this._tilePreview.open(window, this._mode)) {
			tracker.confirmSwipe(monitorArea.height, [-1, 0, 1], 0, 0);
		}
	}

	_gestureUpdate(_tracker: never, progress: number): void {
		this._tilePreview.adjustment.value = progress;
	}

	_gestureEnd(_tracker: never, duration: number, progress: number): void {
		this._tilePreview.finish(duration, progress);
	}
}
