import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {SwipeTracker} from 'resource:///org/gnome/shell/ui/swipeTracker.js';
import {PinchDirection, TouchpadPinchGesture} from './pinchTracker.js';
import {createSwipeTracker, SwipeDirection} from './swipeTracker.js';
import {IGestureAction} from '../actions/gestureAction.js';

export enum WindowSnappingMode {
	MAXIMIZE,
	MINIMIZE,
	REDUCE,
	ENLARGE,
	FULLSCREEN,
	SNAP_LEFT,
	SNAP_RIGHT,
}

export class SwipeGesture implements ISubExtension {
	private _swipeTracker: typeof SwipeTracker.prototype;
	private _connectors: number[] = [];
	private _action: IGestureAction;
	private _uiGroupAddedActorId: number;

	constructor(
		nfingers: number[],
		swipeDirection: SwipeDirection,
		action: IGestureAction
	) {
		this._swipeTracker = createSwipeTracker(
			global.stage,
			nfingers,
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

export class PinchGesture implements ISubExtension {
	private _pinchTracker: typeof TouchpadPinchGesture.prototype;
	private _connectors: number[] = [];
	private _action: IGestureAction;
	private _uiGroupAddedActorId: number;

	constructor(
		nfingers: number[],
		direction: PinchDirection,
		action: IGestureAction
	) {
		this._pinchTracker = new TouchpadPinchGesture({
			nfingers: nfingers,
			direction: direction,
			allowedModes: Shell.ActionMode.NORMAL,
		});

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
			this._pinchTracker.connect('begin', this._gestureBegin.bind(this))
		);
		this._connectors.push(
			this._pinchTracker.connect('update', this._gestureUpdate.bind(this))
		);
		this._connectors.push(
			this._pinchTracker.connect('end', this._gestureEnd.bind(this))
		);
	}

	destroy(): void {
		if (this._uiGroupAddedActorId) {
			Main.layoutManager.uiGroup.disconnect(this._uiGroupAddedActorId);
			this._uiGroupAddedActorId = 0;
		}

		this._connectors.forEach(connector =>
			this._pinchTracker.disconnect(connector)
		);
		Main.layoutManager.uiGroup.remove_child(this._action);
		this._pinchTracker.destroy();
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

// import Clutter from 'gi://Clutter';
// import GObject from 'gi://GObject';
// import Shell from 'gi://Shell';
// import {WorkspaceAnimationController} from 'resource:///org/gnome/shell/ui/workspaceAnimation.js';
// import {
// 	SwipeTracker,
// 	CustomEventType,
// 	TouchpadGesture,
// } from 'resource:///org/gnome/shell/ui/swipeTracker.js';
// import {OverviewAdjustment} from 'resource:///org/gnome/shell/ui/overviewControls.js';
// import * as Main from 'resource:///org/gnome/shell/ui/main.js';
// import {ExtSettings, OverviewControlsState} from '../constants.js';
// import {
// 	createSwipeTracker,
// 	TouchpadSwipeGesture,
// 	SwipeDirection,
// } from './swipeTracker.js';

// interface ShallowSwipeTracker {
// 	orientation: Clutter.Orientation;
// 	confirmSwipe(
// 		distance: number,
// 		snapPoints: number[],
// 		currentProgress: number,
// 		cancelProgress: number
// 	): void;
// }

// declare type TouchPadSwipeTracker = Required<SwipeTracker>['_touchpadGesture'];
// declare interface ShellSwipeTracker {
// 	swipeTracker: SwipeTracker;
// 	nfingers: number[];
// 	disableOldGesture: boolean;
// 	modes: Shell.ActionMode;
// 	followNaturalScroll: boolean;
// 	gestureSpeed?: number;
// 	checkAllowedGesture?: (event: CustomEventType) => boolean;
// }

// /**
//  *
//  * @param tracker
//  */
// function connectTouchpadEventToTracker(tracker: TouchPadSwipeTracker) {
// 	// eslint-disable-next-line @typescript-eslint/no-explicit-any
// 	(global.stage as any).connectObject(
// 		'captured-event::touchpad',
// 		tracker._handleEvent.bind(tracker),
// 		tracker
// 	);
// }

// /**
//  *
//  * @param tracker
//  */
// function disconnectTouchpadEventFromTracker(tracker: TouchPadSwipeTracker) {
// 	// eslint-disable-next-line @typescript-eslint/no-explicit-any
// 	(global.stage as any).disconnectObject(tracker);
// }

// abstract class SwipeTrackerEndPointsModifer {
// 	protected _firstVal = 0;
// 	protected _lastVal = 0;

// 	protected abstract _swipeTracker: SwipeTracker;

// 	public apply(): void {
// 		this._swipeTracker.connect('begin', this._gestureBegin.bind(this));
// 		this._swipeTracker.connect('update', this._gestureUpdate.bind(this));
// 		this._swipeTracker.connect('end', this._gestureEnd.bind(this));
// 	}

// 	protected abstract _gestureBegin(
// 		tracker: SwipeTracker,
// 		monitor: never
// 	): void;

// 	protected abstract _gestureUpdate(
// 		tracker: SwipeTracker,
// 		progress: number
// 	): void;

// 	protected abstract _gestureEnd(
// 		tracker: SwipeTracker,
// 		duration: number,
// 		progress: number
// 	): void;

// 	protected _modifySnapPoints(
// 		tracker: SwipeTracker,
// 		callback: (tracker: ShallowSwipeTracker) => void
// 	) {
// 		const _tracker: ShallowSwipeTracker = {
// 			orientation: tracker.orientation,
// 			confirmSwipe: (
// 				distance,
// 				snapPoints,
// 				currentProgress,
// 				cancelProgress
// 			) => {
// 				this._firstVal = snapPoints[0];
// 				this._lastVal = snapPoints[snapPoints.length - 1];

// 				snapPoints.unshift(this._firstVal - 1);
// 				snapPoints.push(this._lastVal + 1);

// 				tracker.confirmSwipe(
// 					distance,
// 					snapPoints,
// 					currentProgress,
// 					cancelProgress
// 				);
// 			},
// 		};

// 		callback(_tracker);
// 	}

// 	public destroy(): void {
// 		if (this._swipeTracker) {
// 			this._swipeTracker.enabled = false;
// 		}
// 	}
// }

// class WorkspaceAnimationModifier extends SwipeTrackerEndPointsModifer {
// 	private _workspaceAnimation: WorkspaceAnimationController;
// 	protected _swipeTracker: SwipeTracker;

// 	constructor(
// 		nfingers: number[],
// 		wm: typeof Main.wm,
// 		direction: SwipeDirection
// 	) {
// 		super();
// 		this._workspaceAnimation = wm._workspaceAnimation;
// 		this._swipeTracker = createSwipeTracker(
// 			global.stage,
// 			nfingers,
// 			Shell.ActionMode.NORMAL,
// 			direction,
// 			ExtSettings.FOLLOW_NATURAL_SCROLL,
// 			1,
// 			{allowTouch: false}
// 		);
// 	}

// 	apply(): void {
// 		if (this._workspaceAnimation._swipeTracker._touchpadGesture)
// 			disconnectTouchpadEventFromTracker(
// 				this._workspaceAnimation._swipeTracker._touchpadGesture
// 			);

// 		super.apply();
// 	}

// 	protected _gestureBegin(tracker: SwipeTracker, monitor: number): void {
// 		super._modifySnapPoints(tracker, shallowTracker => {
// 			this._workspaceAnimation._switchWorkspaceBegin(
// 				shallowTracker,
// 				monitor
// 			);
// 		});
// 	}

// 	protected _gestureUpdate(tracker: SwipeTracker, progress: number): void {
// 		if (progress < this._firstVal)
// 			progress = this._firstVal - (this._firstVal - progress) * 0.05;
// 		else if (progress > this._lastVal)
// 			progress = this._lastVal + (progress - this._lastVal) * 0.05;

// 		this._workspaceAnimation._switchWorkspaceUpdate(tracker, progress);
// 	}

// 	protected _gestureEnd(
// 		tracker: SwipeTracker,
// 		duration: number,
// 		progress: number
// 	): void {
// 		progress = Math.clamp(progress, this._firstVal, this._lastVal);
// 		this._workspaceAnimation._switchWorkspaceEnd(
// 			tracker,
// 			duration,
// 			progress
// 		);
// 	}

// 	destroy(): void {
// 		this._swipeTracker.destroy();
// 		const swipeTracker = this._workspaceAnimation._swipeTracker;
// 		if (swipeTracker._touchpadGesture)
// 			connectTouchpadEventToTracker(swipeTracker._touchpadGesture);

// 		super.destroy();
// 	}
// }

// export class GestureExtension implements ISubExtension {
// 	private _stateAdjustment: OverviewAdjustment;
// 	private _swipeTrackers: ShellSwipeTracker[];
// 	private _verticalWorkspaceAnimationModifier?: WorkspaceAnimationModifier;
// 	private _horizontalWorkspaceAnimationModifier?: WorkspaceAnimationModifier;

// 	constructor() {
// 		this._stateAdjustment =
// 			Main.overview._overview._controls._stateAdjustment;

// 		this._swipeTrackers = [
// 			{
// 				swipeTracker:
// 					Main.overview._overview._controls._workspacesDisplay
// 						._swipeTracker,
// 				nfingers: [3, 4],
// 				disableOldGesture: true,
// 				followNaturalScroll: ExtSettings.FOLLOW_NATURAL_SCROLL,
// 				modes: Shell.ActionMode.OVERVIEW,
// 				gestureSpeed: 1,
// 				checkAllowedGesture: (event: CustomEventType) => {
// 					if (
// 						Main.overview._overview._controls._searchController
// 							.searchActive
// 					)
// 						return false;

// 					if (event.get_touchpad_gesture_finger_count() === 4)
// 						return true;
// 					else
// 						return (
// 							this._stateAdjustment.value ===
// 							OverviewControlsState.WINDOW_PICKER
// 						);
// 				},
// 			},
// 			{
// 				swipeTracker:
// 					Main.overview._overview._controls._appDisplay._swipeTracker,
// 				nfingers: [3],
// 				disableOldGesture: true,
// 				followNaturalScroll: ExtSettings.FOLLOW_NATURAL_SCROLL,
// 				modes: Shell.ActionMode.OVERVIEW,
// 				checkAllowedGesture: () => {
// 					if (
// 						Main.overview._overview._controls._searchController
// 							.searchActive
// 					)
// 						return false;

// 					return (
// 						this._stateAdjustment.value ===
// 						OverviewControlsState.APP_GRID
// 					);
// 				},
// 			},
// 		];
// 	}

// 	setVerticalWorkspceAnimationModifier(nfingers: number[]) {
// 		this._verticalWorkspaceAnimationModifier =
// 			new WorkspaceAnimationModifier(
// 				nfingers,
// 				Main.wm,
// 				SwipeDirection.UP
// 			);
// 	}

// 	setHorizontalWorkspaceAnimationModifier(nfingers: number[]) {
// 		this._horizontalWorkspaceAnimationModifier =
// 			new WorkspaceAnimationModifier(
// 				nfingers,
// 				Main.wm,
// 				SwipeDirection.RIGHT
// 			);
// 	}

// 	apply(): void {
// 		this._verticalWorkspaceAnimationModifier?.apply();
// 		this._horizontalWorkspaceAnimationModifier?.apply();

// 		this._swipeTrackers.forEach(entry => {
// 			const {
// 				swipeTracker,
// 				nfingers,
// 				disableOldGesture,
// 				followNaturalScroll,
// 				modes,
// 				checkAllowedGesture,
// 			} = entry;

// 			const gestureSpeed = entry.gestureSpeed ?? 1;
// 			const touchpadGesture = new TouchpadSwipeGesture(
// 				nfingers,
// 				modes,
// 				SwipeDirection.UP, // TODO
// 				followNaturalScroll,
// 				checkAllowedGesture,
// 				gestureSpeed
// 			);

// 			this._attachGestureToTracker(
// 				swipeTracker,
// 				touchpadGesture,
// 				disableOldGesture
// 			);
// 		});
// 	}

// 	destroy(): void {
// 		this._swipeTrackers.reverse().forEach(entry => {
// 			const {swipeTracker, disableOldGesture} = entry;
// 			swipeTracker._touchpadGesture?.destroy();
// 			swipeTracker._touchpadGesture = swipeTracker._oldTouchpadGesture;
// 			swipeTracker._oldTouchpadGesture = undefined;
// 			if (swipeTracker._touchpadGesture && disableOldGesture)
// 				connectTouchpadEventToTracker(swipeTracker._touchpadGesture);
// 		});

// 		this._verticalWorkspaceAnimationModifier?.destroy();
// 		this._horizontalWorkspaceAnimationModifier?.destroy();
// 	}

// 	_attachGestureToTracker(
// 		swipeTracker: SwipeTracker,
// 		touchpadSwipeGesture:
// 			| typeof TouchpadSwipeGesture.prototype
// 			| TouchpadGesture,
// 		disablePrevious: boolean
// 	): void {
// 		if (swipeTracker._touchpadGesture && disablePrevious) {
// 			disconnectTouchpadEventFromTracker(swipeTracker._touchpadGesture);
// 			swipeTracker._oldTouchpadGesture = swipeTracker._touchpadGesture;
// 		}

// 		swipeTracker._touchpadGesture = touchpadSwipeGesture as TouchpadGesture;
// 		swipeTracker._touchpadGesture.connect(
// 			'begin',
// 			swipeTracker._beginGesture.bind(swipeTracker)
// 		);
// 		swipeTracker._touchpadGesture.connect(
// 			'update',
// 			swipeTracker._updateGesture.bind(swipeTracker)
// 		);
// 		swipeTracker._touchpadGesture.connect(
// 			'end',
// 			swipeTracker._endTouchpadGesture.bind(swipeTracker)
// 		);
// 		swipeTracker.bind_property(
// 			'enabled',
// 			swipeTracker._touchpadGesture,
// 			'enabled',
// 			0
// 		);
// 		swipeTracker.bind_property(
// 			'orientation',
// 			swipeTracker._touchpadGesture,
// 			'orientation',
// 			GObject.BindingFlags.SYNC_CREATE
// 		);
// 	}
// }
