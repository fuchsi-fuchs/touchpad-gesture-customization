import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';
import Mtk from 'gi://Mtk';
import St from 'gi://St';
import GObject from 'gi://GObject';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Utils from 'resource:///org/gnome/shell/misc/util.js';
import {IGestureAction} from './gestureAction.js';
import {easeActor, easeAdjustment} from '../utils/environment.js';
import {getVirtualKeyboard, IVirtualKeyboard} from '../utils/keyboard.js';

const WINDOW_ANIMATION_TIME = 200;
const UPDATED_WINDOW_ANIMATION_TIME = 150;

export enum WindowSnappingMode {
	MAXIMIZE,
	MINIMIZE,
	REDUCE,
	ENLARGE,
	FULLSCREEN,
	SNAP_LEFT,
	SNAP_RIGHT,
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
