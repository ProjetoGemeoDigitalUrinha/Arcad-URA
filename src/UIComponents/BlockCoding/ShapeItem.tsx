import { CodeBlockShape, getCommandLabel } from "./CodeCanvas";

export const ShapeItem: React.FC<{
  shape: CodeBlockShape;
  isMain: boolean;
  onDelete: (id: number) => void;
  onUpdateValue: (id: number, val: number) => void;
}> = ({ shape, isMain, onDelete, onUpdateValue }) => (
  <div
    className={`shape-item ${isMain ? "is-main" : ""}`}
    style={{ borderLeft: `4px solid ${shape.color}` }}
  >
    <div className="shape-info">
      <span className="id-badge">{getCommandLabel(shape.type).toUpperCase()}</span>
      {shape.type !== "Start" && (
        <input
          type="number"
          className="block-input"
          value={shape.value}
          onChange={(e) =>
            onUpdateValue(shape.id, parseInt(e.target.value) || 0)
          }
        />
      )}
    </div>
    {shape.type !== "Start" && (
      <button className="delete-btn" onClick={() => onDelete(shape.id)}>
        &times;
      </button>
    )}
  </div>
);
