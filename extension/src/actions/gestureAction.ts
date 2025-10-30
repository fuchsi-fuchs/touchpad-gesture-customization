import St from 'gi://St';

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
