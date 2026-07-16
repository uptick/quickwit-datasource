import { dateTime } from '@grafana/data';
import { sceneGraph, SceneObject } from '@grafana/scenes';

function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element) {
    return false;
  }
  return element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.isContentEditable;
}

/**
 * Scene behavior: ctrl+z / cmd+z zooms the time range out (2×, centered),
 * matching Grafana's dashboard hotkey. Ignored while typing in an input or
 * the query editor.
 */
export function zoomOutHotkeyBehavior(scene: SceneObject) {
  const onKeyDown = (event: KeyboardEvent) => {
    if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z' || isTypingTarget(event.target)) {
      return;
    }
    event.preventDefault();
    const timeRange = sceneGraph.getTimeRange(scene);
    const { from, to } = timeRange.state.value;
    const span = to.valueOf() - from.valueOf();
    const center = (to.valueOf() + from.valueOf()) / 2;
    const newFrom = dateTime(center - span);
    const newTo = dateTime(center + span);
    timeRange.onTimeRangeChange({ from: newFrom, to: newTo, raw: { from: newFrom, to: newTo } });
  };

  window.addEventListener('keydown', onKeyDown);
  return () => window.removeEventListener('keydown', onKeyDown);
}
