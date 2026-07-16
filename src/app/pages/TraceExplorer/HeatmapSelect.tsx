import React from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { SceneComponentProps, SceneObjectBase, SceneObjectState, VizPanel } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';

export interface HeatmapSelection {
  /** Fraction of the plot width, left/right edge of the selection (0..1). */
  fx0: number;
  fx1: number;
  /** Fraction of the plot height, top/bottom edge of the selection (0..1, 0 = top). */
  fyTop: number;
  fyBottom: number;
  /** Set when the drag was flat in one dimension. */
  timeOnly: boolean;
  durationOnly: boolean;
}

export interface HeatmapSelectState extends SceneObjectState {
  panel: VizPanel;
}

const MIN_DRAG_PX = 12;

/**
 * Wraps the duration heatmap and replaces the panel's built-in time-only drag
 * zoom with a rectangular selection: horizontal extent narrows the time range,
 * vertical extent sets the span-duration filter. A flat drag selects only the
 * dimension it covers.
 */
export class HeatmapSelect extends SceneObjectBase<HeatmapSelectState> {
  static Component = HeatmapSelectRenderer;

  /** Assigned by the scene that owns the query bar and time range. */
  public onSelect?: (selection: HeatmapSelection) => void;
}

interface DragState {
  startX: number;
  startY: number;
  plotRect: DOMRect;
  wrapRect: DOMRect;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function HeatmapSelectRenderer({ model }: SceneComponentProps<HeatmapSelect>) {
  const { panel } = model.useState();
  const styles = useStyles2(getStyles);
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const dragRef = React.useRef<DragState | null>(null);
  const [rect, setRect] = React.useState<{ left: number; top: number; width: number; height: number } | null>(null);

  const onMouseDown = (event: React.MouseEvent) => {
    const wrap = wrapRef.current;
    if (!wrap || event.button !== 0) {
      return;
    }
    // Only take over drags that start inside the uPlot drawing area.
    const over = wrap.querySelector('.u-over');
    if (!over) {
      return;
    }
    const plotRect = over.getBoundingClientRect();
    if (
      event.clientX < plotRect.left ||
      event.clientX > plotRect.right ||
      event.clientY < plotRect.top ||
      event.clientY > plotRect.bottom
    ) {
      return;
    }
    // Stop uPlot's own drag-to-zoom from starting.
    event.preventDefault();
    event.stopPropagation();

    const wrapRect = wrap.getBoundingClientRect();
    dragRef.current = { startX: event.clientX, startY: event.clientY, plotRect, wrapRect };

    const onMove = (moveEvent: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) {
        return;
      }
      const x0 = clamp(Math.min(drag.startX, moveEvent.clientX), drag.plotRect.left, drag.plotRect.right);
      const x1 = clamp(Math.max(drag.startX, moveEvent.clientX), drag.plotRect.left, drag.plotRect.right);
      const y0 = clamp(Math.min(drag.startY, moveEvent.clientY), drag.plotRect.top, drag.plotRect.bottom);
      const y1 = clamp(Math.max(drag.startY, moveEvent.clientY), drag.plotRect.top, drag.plotRect.bottom);
      setRect({ left: x0 - drag.wrapRect.left, top: y0 - drag.wrapRect.top, width: x1 - x0, height: y1 - y0 });
    };

    const onUp = (upEvent: MouseEvent) => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      const drag = dragRef.current;
      dragRef.current = null;
      setRect(null);
      if (!drag) {
        return;
      }

      const dx = Math.abs(upEvent.clientX - drag.startX);
      const dy = Math.abs(upEvent.clientY - drag.startY);
      if (dx < MIN_DRAG_PX && dy < MIN_DRAG_PX) {
        return; // Just a click.
      }

      const { plotRect } = drag;
      const x0 = clamp(Math.min(drag.startX, upEvent.clientX), plotRect.left, plotRect.right);
      const x1 = clamp(Math.max(drag.startX, upEvent.clientX), plotRect.left, plotRect.right);
      const y0 = clamp(Math.min(drag.startY, upEvent.clientY), plotRect.top, plotRect.bottom);
      const y1 = clamp(Math.max(drag.startY, upEvent.clientY), plotRect.top, plotRect.bottom);

      model.onSelect?.({
        fx0: (x0 - plotRect.left) / plotRect.width,
        fx1: (x1 - plotRect.left) / plotRect.width,
        fyTop: (y0 - plotRect.top) / plotRect.height,
        fyBottom: (y1 - plotRect.top) / plotRect.height,
        timeOnly: dy < MIN_DRAG_PX,
        durationOnly: dx < MIN_DRAG_PX,
      });
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <div ref={wrapRef} className={styles.wrapper} onMouseDownCapture={onMouseDown}>
      <panel.Component model={panel} />
      {rect && (
        <div
          className={styles.selection}
          style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
        />
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    position: relative;
    width: 100%;
    height: 100%;
  `,
  selection: css`
    position: absolute;
    pointer-events: none;
    border: 1px solid ${theme.colors.primary.border};
    background: ${theme.colors.primary.transparent};
  `,
});
