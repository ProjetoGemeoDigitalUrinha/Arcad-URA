/* eslint-disable @typescript-eslint/no-explicit-any */
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, Button, Stack, Typography } from "@mui/material";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import StopCircleOutlinedIcon from "@mui/icons-material/StopCircleOutlined";
import TurnLeftIcon from "@mui/icons-material/TurnLeft";
import TurnRightIcon from "@mui/icons-material/TurnRight";
import { ActionLabels } from "../../store/ActionsLabels";
import { useStore } from "../../store/Store";

export type CommandType =
	| "Forward"
	| "Back"
	| "Left"
	| "Right"
	| "Start"
	| "Stop";

export interface CodeBlockShape {
	id: number;
	type: CommandType;
	value: number;
	x: number;
	y: number;
	width: number;
	height: number;
	color: string;
	nextId?: number | null;
	isLocked?: boolean;
}

export const COLORS: Record<CommandType, string> = {
	Start: "#1e293b",
	Forward: "#3b82f6",
	Back: "#ef4444",
	Left: "#10b981",
	Right: "#f59e0b",
	Stop: "#475569",
};

export const getCommandLabel = (type: CommandType) =>
	({
		Start: "Início",
		Forward: "Avançar",
		Back: "Recuar",
		Left: "Esquerda",
		Right: "Direita",
		Stop: "Parar",
	})[type];

export const CodeCanvas: React.FC = () => {
	// Read selections from store
	const codeBlocks = useStore((s) => s.codeBlocks);
	const setCodeBlocks = useStore((s) => s.setCodeBlocks);
	const setBlockOrder = useStore((s) => s.setBlockOrder);
	const addAction = useStore((s) => s.addAction);
	const triggerAction = useStore((s) => s.triggerAction);

	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const containerRef = useRef<HTMLDivElement | null>(null);
	const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

	const [shapes, setShapes] = useState<CodeBlockShape[]>([
		{
			id: 0,
			type: "Start",
			value: 0,
			x: 80,
			y: 250,
			width: 140,
			height: 60,
			color: COLORS.Start,
			isLocked: false,
		},
	]);

	const [dragState, setDragState] = useState<{
		id: number;
		ox: number;
		oy: number;
		transform: { x: number; y: number; scale: number };
	} | null>(null);

	const SNAP_THRESHOLD = 30;

	// --- SYNC STORE TO LOCAL STATE ---
	// Watch for external changes (like imports) to codeBlocks and update canvas
	const codeBlocksString = JSON.stringify(codeBlocks);
	useEffect(() => {
		if (codeBlocks && codeBlocks.length > 0) {
			setShapes((prevShapes) => {
				const prevString = JSON.stringify(prevShapes);
				if (prevString !== codeBlocksString) {
					return codeBlocks;
				}
				return prevShapes;
			});
		}
	}, [codeBlocks, codeBlocksString]);

	// --- LOGIC: Program Chain ---
	const mainThread = useMemo(() => {
		const thread: number[] = [];
		let currentId: number | null | undefined = 0;
		const visited = new Set<number>();

		while (
			currentId !== null &&
			currentId !== undefined &&
			!visited.has(currentId)
		) {
			const shape = shapes.find((s) => {
				return s.id === currentId;
			});

			if (!shape) {
				break;
			}

			thread.push(currentId);
			visited.add(currentId);
			currentId = shape.nextId;
		}
		return thread;
	}, [shapes]);

	const canvasTransform = useMemo(() => {
		const width = canvasSize.width;
		const height = canvasSize.height;
		if (shapes.length === 0 || width === 0 || height === 0) {
			return { scale: 1, x: 0, y: 0 };
		}

		const minX = Math.min(...shapes.map((shape) => shape.x));
		const maxX = Math.max(...shapes.map((shape) => shape.x + shape.width));
		const minY = Math.min(...shapes.map((shape) => shape.y));
		const maxY = Math.max(...shapes.map((shape) => shape.y + shape.height));
		const contentWidth = maxX - minX;
		const contentHeight = maxY - minY;
		const scale = Math.min(
			1,
			(width - 72) / Math.max(contentWidth, 140),
			(height - 72) / Math.max(contentHeight, 60),
		);

		return {
			scale,
			x: (width - contentWidth * scale) / 2 - minX * scale,
			y: (height - contentHeight * scale) / 2 - minY * scale,
		};
	}, [canvasSize, shapes]);
	const viewTransform = dragState?.transform ?? canvasTransform;

	// --- PUSH LOCAL STATE TO STORE ---
	useEffect(() => {
		// Prevent pushing an empty array if shapes hasn't initialized fully
		if (shapes && shapes.length > 0) {
			setCodeBlocks(shapes);
			setBlockOrder(mainThread);
		}
	}, [shapes, mainThread, setCodeBlocks, setBlockOrder]);

	useEffect(() => {
		addAction({
			target: "canvasCode",
			trigger: ActionLabels.ADD_CODE_BLOCK,
			cb: (type: CommandType) => {
				setShapes((prev) => {
					let lastBlock = prev.find((shape) => shape.id === 0);
					if (!lastBlock) return prev;

					const visited = new Set<number>();
					while (lastBlock.nextId != null && !visited.has(lastBlock.id)) {
						visited.add(lastBlock.id);
						const nextBlock = prev.find((shape) => shape.id === lastBlock?.nextId);
						if (!nextBlock) break;
						lastBlock = nextBlock;
					}

					const newId = Math.max(Date.now(), ...prev.map((shape) => shape.id + 1));
					const newShape: CodeBlockShape = {
						id: newId,
						type,
						value: 1000,
						x: lastBlock.x + lastBlock.width + 36,
						y: lastBlock.y,
						width: 140,
						height: 60,
						color: COLORS[type],
					};

					return [
						...prev.map((shape) => shape.id === lastBlock?.id ? { ...shape, nextId: newId } : shape),
						newShape,
					];
				});
			},
		});

		addAction({
			target: "canvasCode",
			trigger: ActionLabels.DELETE_CODE_BLOCK,
			cb: (id: number) => {
				setShapes((prev) => {
					return prev
						.filter((s) => {
							return s.id !== id;
						})
						.map((s) => {
							if (s.nextId === id) {
								return { ...s, nextId: null };
							}
							return s;
						});
				});
			},
		});

		addAction({
			target: "canvasCode",
			trigger: ActionLabels.UPDATE_CODE_BLOCK_VALUES,
			cb: ({ id, val }: { id: number; val: number }) => {
				setShapes((prev) => {
					return prev.map((s) => {
						if (s.id === id) {
							return { ...s, value: val };
						}
						return s;
					});
				});
			},
		});
	}, [addAction]);

	const drawBlockPath = (
		ctx: CanvasRenderingContext2D,
		x: number,
		y: number,
		w: number,
		h: number,
		isStart: boolean,
	) => {
		const tabH = 20;
		const tabY = y + (h - tabH) / 2;

		ctx.beginPath();
		ctx.moveTo(x, y);
		ctx.lineTo(x + w, y);

		// Right tab (Outwards)
		ctx.lineTo(x + w, tabY);
		ctx.arc(x + w, tabY + tabH / 2, tabH / 2, -Math.PI / 2, Math.PI / 2);
		ctx.lineTo(x + w, y + h);
		ctx.lineTo(x, y + h);

		// Left tab (Inwards - Cutout)
		if (!isStart) {
			ctx.lineTo(x, tabY + tabH);
			ctx.arc(x, tabY + tabH / 2, tabH / 2, Math.PI / 2, -Math.PI / 2, true);
		}

		ctx.lineTo(x, y);
		ctx.closePath();
	};

	// biome-ignore lint/correctness/useExhaustiveDependencies: todo
	const draw = useCallback(() => {
		const canvas = canvasRef.current;
		const ctx = canvas?.getContext("2d");

		if (!canvas || !ctx) {
			return;
		}

		const dpr = window.devicePixelRatio || 1;
		const cw = canvas.width / dpr;
		const ch = canvas.height / dpr;

		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, cw, ch);
		ctx.fillStyle = "#f8fafc";
		ctx.fillRect(0, 0, cw, ch);
		ctx.fillStyle = "#f4f7fb";
		ctx.strokeStyle = "#94a3b8";
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.roundRect(20, 20, cw - 40, ch - 40, 8);
		ctx.fill();
		ctx.stroke();

		for (let index = 0; index < mainThread.length - 1; index++) {
			const current = shapes.find((shape) => shape.id === mainThread[index]);
			const next = shapes.find((shape) => shape.id === mainThread[index + 1]);
			if (!current || !next) continue;

			const startX = viewTransform.x + (current.x + current.width) * viewTransform.scale;
			const endX = viewTransform.x + next.x * viewTransform.scale;
			const centerY = viewTransform.y + (current.y + current.height / 2) * viewTransform.scale;
			ctx.save();
			ctx.strokeStyle = "#64748b";
			ctx.fillStyle = "#64748b";
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.moveTo(startX + 3, centerY);
			ctx.lineTo(endX - 8, centerY);
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(endX - 8, centerY - 5);
			ctx.lineTo(endX, centerY);
			ctx.lineTo(endX - 8, centerY + 5);
			ctx.stroke();
			ctx.restore();
		}

		// Draw Active Canvas Shapes
		[...shapes]
			.sort((a) => {
				if (a.id === dragState?.id) {
					return 1;
				}
				return -1;
			})
			.forEach((s) => {
				const isMain = mainThread.includes(s.id);

				ctx.save();
				ctx.globalAlpha =
					isMain || dragState?.id === s.id || s.id === 0 ? 1 : 0.4;

				const x = viewTransform.x + s.x * viewTransform.scale;
				const y = viewTransform.y + s.y * viewTransform.scale;
				const width = s.width * viewTransform.scale;
				const height = s.height * viewTransform.scale;
				ctx.fillStyle = s.color;
				drawBlockPath(ctx, x, y, width, height, s.type === "Start");
				ctx.fill();

				// Active Blocks styling matching the image (dashed border for all active components)
				ctx.setLineDash([4, 4]);
				ctx.strokeStyle = "#000";
				ctx.lineWidth = isMain ? 2 : 1;
				ctx.stroke();

				ctx.fillStyle = "#fff";
				ctx.font = `bold ${Math.max(10, 13 * viewTransform.scale)}px sans-serif`;
				ctx.textAlign = "center";
				ctx.fillText(
					getCommandLabel(s.type).toUpperCase(),
					x + width / 2,
					y + (s.id === 0 ? 35 : 25) * viewTransform.scale,
				);

				ctx.restore();
			});
	}, [shapes, mainThread, dragState, viewTransform]);

	useEffect(() => {
		const observer = new ResizeObserver(() => {
			const canvas = canvasRef.current;
			const container = containerRef.current;

			if (!canvas || !container) {
				return;
			}

			const dpr = window.devicePixelRatio || 1;
			const rect = container.getBoundingClientRect();
			setCanvasSize((current) =>
				current.width === rect.width && current.height === rect.height
					? current
					: { width: rect.width, height: rect.height },
			);

			if (
				canvas.width !== rect.width * dpr ||
				canvas.height !== rect.height * dpr
			) {
				canvas.width = rect.width * dpr;
				canvas.height = rect.height * dpr;
				canvas.style.width = `${rect.width}px`;
				canvas.style.height = `${rect.height}px`;
				draw();
			}
		});

		if (containerRef.current) {
			observer.observe(containerRef.current);
		}

		return () => {
			observer.disconnect();
		};
	}, [draw]);

	useEffect(() => {
		draw();
	}, [draw]);

	const handleMouseDown = (e: React.MouseEvent) => {
		if (!canvasRef.current) {
			return;
		}
		const rect = canvasRef.current.getBoundingClientRect();
		const mx = (e.clientX - rect.left - canvasTransform.x) / canvasTransform.scale;
		const my = (e.clientY - rect.top - canvasTransform.y) / canvasTransform.scale;

		const target = [...shapes].reverse().find((s) => {
			return (
				!s.isLocked &&
				mx >= s.x &&
				mx <= s.x + s.width &&
				my >= s.y &&
				my <= s.y + s.height
			);
		});

		if (target) {
			setDragState({
				id: target.id,
				ox: mx - target.x,
				oy: my - target.y,
				transform: canvasTransform,
			});
		}
	};

	const handleMouseMove = (e: React.MouseEvent) => {
		if (!dragState || !canvasRef.current) {
			return;
		}

		const rect = canvasRef.current.getBoundingClientRect();
		const mx = e.clientX - rect.left;
		const my = e.clientY - rect.top;

		let nx = (mx - dragState.transform.x) / dragState.transform.scale - dragState.ox;
		let ny = (my - dragState.transform.y) / dragState.transform.scale - dragState.oy;

		for (const o of shapes) {
			if (o.id === dragState.id) {
				continue;
			}

			const dx = Math.abs(nx - (o.x + o.width));
			const dy = Math.abs(ny - o.y);

			// Snap to right edge of another block
			if (dx < SNAP_THRESHOLD && dy < SNAP_THRESHOLD) {
				nx = o.x + o.width;
				ny = o.y;
				break;
			}
		}

		setShapes((prev) => {
			return prev.map((s) => {
				if (s.id === dragState.id) {
					return { ...s, x: nx, y: ny };
				}
				return s;
			});
		});
	};

	const handleMouseUp = () => {
		if (!dragState || !canvasRef.current) {
			return;
		}

		setShapes((prev) => {
			const active = prev.find((s) => {
				return s.id === dragState.id;
			});

			if (!active) {
				return prev;
			}

			const parent = prev.find((o) => {
				return (
					o.id !== dragState.id &&
					Math.abs(active.x - (o.x + o.width)) < 5 &&
					Math.abs(active.y - o.y) < 5
				);
			});

			return prev.map((s) => {
				const u = { ...s };
				if (u.nextId === dragState.id) {
					u.nextId = null;
				}
				if (parent && u.id === parent.id) {
					u.nextId = dragState.id;
				}
				return u;
			});
		});

		setDragState(null);
	};

	return (
		<div className="code-canvas-workspace">
			<Box className="code-instructions">
				<Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Para programar o robô:</Typography>
				<Typography variant="body2">Monte sua sequência de movimentos: escolha os blocos, defina o tempo de execução de cada ação e finalize com o bloco Parar.</Typography>
			</Box>
			<Typography className="code-flow-title" variant="subtitle2">Fluxo do programa</Typography>
			<div className="code-canvas-frame" ref={containerRef}>
				<canvas
					ref={canvasRef}
					onMouseDown={handleMouseDown}
					onMouseMove={handleMouseMove}
					onMouseUp={handleMouseUp}
					onMouseLeave={handleMouseUp}
					className="code-flow-canvas"
				/>
				<div className="code-canvas-duration-layer" style={{ width: canvasSize.width, height: canvasSize.height }}>
					{shapes.filter((shape) => shape.id !== 0 && mainThread.includes(shape.id)).map((shape) => {
						const scale = viewTransform.scale;
						return (
							<input
								key={shape.id}
								aria-label={`Duração de ${getCommandLabel(shape.type)}`}
								type="number"
								className="code-canvas-duration"
								style={{
									left: viewTransform.x + (shape.x + shape.width / 2) * scale - 28 * scale,
									top: viewTransform.y + (shape.y + 34) * scale,
									width: 56 * scale,
									height: 18 * scale,
									fontSize: Math.max(10, 12 * scale),
								}}
								value={shape.value}
								onChange={(event) => triggerAction(ActionLabels.UPDATE_CODE_BLOCK_VALUES, "canvasCode", { id: shape.id, val: Number.parseInt(event.target.value, 10) || 0 })}
							/>
						);
					})}
				</div>
				<Typography className="code-flow-estimate" variant="caption">Duração estimada: {Math.round(shapes.filter((shape) => mainThread.includes(shape.id) && shape.id !== 0).reduce((total, shape) => total + shape.value, 0) / 1000)} s</Typography>
			</div>
		</div>
	);
};

export const CodeCommandPalette = () => {
	const triggerAction = useStore((store) => store.triggerAction);
	const commands = [
		{ type: "Forward" as const, icon: <ArrowUpwardIcon />, color: "#3b82f6", hint: "Mover para frente" },
		{ type: "Back" as const, icon: <ArrowDownwardIcon />, color: "#ef4444", hint: "Mover para trás" },
		{ type: "Left" as const, icon: <TurnLeftIcon />, color: "#10b981", hint: "Virar à esquerda" },
		{ type: "Right" as const, icon: <TurnRightIcon />, color: "#f59e0b", hint: "Virar à direita" },
		{ type: "Stop" as const, icon: <StopCircleOutlinedIcon />, color: "#64748b", hint: "Interromper o movimento" },
	];

	return (
		<Box className="code-command-palette">
			<Typography variant="overline" sx={{ fontWeight: 700 }}>Comandos disponíveis</Typography>
			<Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 2 }}>Clique para adicionar ao fluxo</Typography>
			<Stack spacing={1.25}>
				{commands.map((command) => (
					<Button
						key={command.type}
						className="code-command-palette__button"
						startIcon={command.icon}
						onClick={() => triggerAction(ActionLabels.ADD_CODE_BLOCK, "canvasCode", command.type)}
						sx={{ backgroundColor: command.color, "&:hover": { backgroundColor: command.color, filter: "brightness(.94)" } }}
					>
						<Box className="code-command-palette__label">
							<strong>{getCommandLabel(command.type).toUpperCase()}</strong>
							<small>{command.hint}</small>
						</Box>
					</Button>
				))}
			</Stack>
		</Box>
	);
};
