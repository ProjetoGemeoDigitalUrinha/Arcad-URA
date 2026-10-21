/** biome-ignore-all lint/suspicious/noArrayIndexKey: <explanation> */
/** biome-ignore-all lint/a11y/noStaticElementInteractions: <explanation> */
import { useCallback, useEffect, useState } from "react";
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import CodeOutlinedIcon from "@mui/icons-material/CodeOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import SendIcon from "@mui/icons-material/Send";
import StopIcon from "@mui/icons-material/Stop";
import { useStore } from "../../store/Store";
import { ActionLabels } from "../../store/ActionsLabels";
import { ConvertJSONToCodeBlocks } from "../../utils/ConvertCodeBlock";

// Default fallbacks to prevent crashes if the store isn't populated yet
const defaultPartValues: Record<string, any> = {
	"Wheel Left": { mA: -1, v: -1, value: 0 },
	"Wheel Right": { mA: -1, v: -1, value: 0 },
	"Motor Left": { mA: 1000, v: 4.8, value: 0 },
	"Motor Right": { mA: 1000, v: 4.8, value: 0 },
	"HC-04": { mA: 15, v: 5, value: 0 },
	L9110: { mA: 2000, v: 6.5, value: -1 },
	"ESP-32": { mA: 240, v: 6.5, value: 1 },
	Battery: { mA: 5000, v: 3.7, value: -1 },
	MT3608: { mA: 240, v: 6.5, value: -1 },
};

const PART_LABELS: Record<string, string> = {
	"Wheel Left": "Roda esquerda",
	"Wheel Right": "Roda direita",
	"Motor Left": "Motor esquerdo",
	"Motor Right": "Motor direito",
	"HC-04": "Sensor ultrassônico",
	"ESP-32": "ESP-32",
	Battery: "Bateria",
	MT3608: "MT3608",
	L9110: "L9110",
};

const MEASUREMENT_LABELS: Record<string, string> = {
	RPM: "Rotação",
	Distance: "Distância",
};

const COMMAND_LABELS: Record<string, string> = {
	F: "Avançar",
	B: "Recuar",
	L: "Virar à esquerda",
	R: "Virar à direita",
	S: "Parar",
};

const Connection = ({
	x1,
	y1,
	x2,
	y2,
	active,
}: {
	x1: string;
	y1: string;
	x2: string;
	y2: string;
	active: boolean;
}) => {
	let strokeColor = "#000000";
	let dashArray = "none";

	if (!active) {
		strokeColor = "#ef4444";
	}

	if (!active) {
		dashArray = "5,5";
	}

	return (
		<line
			x1={x1}
			y1={y1}
			x2={x2}
			y2={y2}
			stroke={strokeColor}
			strokeWidth="2.5"
			strokeDasharray={dashArray}
			className="transition-all duration-300"
		/>
	);
};

const Node = ({ title, top, left, state, label }: any) => {
	const { simulationParts } = useStore((store) => {
		return store;
	});
	const partData = simulationParts?.[title] ||
		defaultPartValues[title] || { mA: -1, v: -1, value: -1 };

	let displayVal = partData.value;
	let bgClass = "bg-[#cbd5e1] border-[#94a3b8]";

	if (state === "off") {
		if (typeof partData.value === "number") {
			displayVal = 0;
		}
		bgClass = "bg-gray-300 border-gray-400";
	}

	if (state === "brownout" || state === "error") {
		if (typeof partData.value === "number") {
			displayVal = Math.floor(Math.random() * 300);
		} else {
			displayVal = 0;
		}
		bgClass = "bg-[#fca5a5] border-[#f87171]";
	}

	return (
		<div
			className={`absolute transform -translate-x-1/2 -translate-y-1/2 border-[2.5px] border-dashed rounded-xl p-2.5 flex flex-col items-start justify-center shadow-[2px_2px_5px_rgba(0,0,0,0.15)] font-bold text-[11px] text-black z-10 w-[100px] ${bgClass}`}
			style={{ top, left }}
		>
			<h4 className="w-full text-center border-b border-black/20 pb-1 mb-1 whitespace-nowrap">
				{PART_LABELS[title] ?? title}
			</h4>
			{label && partData.value !== -1 && (
				<p>
					{MEASUREMENT_LABELS[label] ?? label}: {displayVal}
				</p>
			)}
			{partData.mA !== -1 && <p>mA: {partData.mA}</p>}
			{partData.v !== -1 && <p>V: {partData.v}</p>}
		</div>
	);
};

export default function Simulation() {
	const { simulationParts } = useStore((store) => {
		return store;
	});
	const setCodeBlocks = useStore((store) => store.setCodeBlocks);
	const setBlockOrder = useStore((store) => store.setBlockOrder);
	const setMode = useStore((store) => store.setMode);
	const mqttInstance = useStore((store) => store.mqttInstance);
	const triggerAction = useStore((store) => store.triggerAction);

	const [glitchTicker, setGlitchTicker] = useState(0);
	const [isExecuting, setIsExecuting] = useState(false);

	const [recordedCommands, setRecordedCommands] = useState<
		{ m: string; t: number }[]
	>([]);
	const [importedCode, setImportedCode] = useState<{ m: string; t: number }[]>(
		[],
	);
	const [isRecording, setIsRecording] = useState(false);
	const [sendDialogOpen, setSendDialogOpen] = useState(false);

	// Forces a fast re-render to simulate fluctuating values during a brownout
	useEffect(() => {
		const interval = setInterval(() => {
			setGlitchTicker((prev) => {
				return prev + 1;
			});
		}, 100);

		return () => {
			clearInterval(interval);
		};
	}, []);

	const batteryData =
		simulationParts?.["Battery"] || defaultPartValues["Battery"];
	const batteryV = batteryData.v;
	const batteryI = batteryData.mA;

	// Calculate total required current based on execution state
	let totalCurrentDraw = 0;

	// Base draw of the ESP32
	totalCurrentDraw += (
		simulationParts?.["ESP-32"] || defaultPartValues["ESP-32"]
	).mA;

	if (isExecuting) {
		// Add motor draw if executing
		totalCurrentDraw += (
			simulationParts?.["Motor Left"] || defaultPartValues["Motor Left"]
		).mA;
		totalCurrentDraw += (
			simulationParts?.["Motor Right"] || defaultPartValues["Motor Right"]
		).mA;
	}

	// State Calculation Logic
	let mt3608State = "off";
	let esp32State = "off";
	let l9110State = "off";

	if (batteryV >= 2.0) {
		mt3608State = "normal";
	}

	if (mt3608State === "normal") {
		if (batteryI >= totalCurrentDraw) {
			esp32State = "normal";
		} else {
			if (batteryI > 0) {
				esp32State = "brownout";
			}
		}
	}

	if (mt3608State === "normal") {
		if (batteryI >= totalCurrentDraw) {
			l9110State = "normal";
		} else {
			if (batteryI > 0) {
				l9110State = "brownout";
			}
		}
	}

	// Hardware Crash Logic
	useEffect(() => {
		if (esp32State !== "normal") {
			if (isExecuting) {
				setIsExecuting(false);
				console.warn(
					"Falha de hardware: energia insuficiente durante a execução.",
				);
			}
		}
	}, [esp32State, isExecuting]);

	// Command Simulation Execution
	const executeSequence = useCallback(
		async (commands: { m: string; t: number }[]) => {
			if (esp32State !== "normal" || l9110State !== "normal") {
				alert("Falha de hardware: verifique os limites da fonte de alimentação.");
				return;
			}

			setIsExecuting(true);
			const telemetry: any = [];
			let currentTime = 0;

			for (const cmd of commands) {
				if (esp32State !== "normal") {
					break;
				}

				let lRpm = 0;
				let rRpm = 0;

				if (cmd.m === "F") {
					lRpm = 126;
					rRpm = 126;
				} else if (cmd.m === "B") {
					lRpm = -126;
					rRpm = -126;
				} else if (cmd.m === "L") {
					lRpm = -126;
					rRpm = 126;
				} else if (cmd.m === "R") {
					lRpm = 126;
					rRpm = -126;
				} else if (cmd.m === "S") {
					lRpm = 0;
					rRpm = 0;
				}

				telemetry.push({
					command: cmd.m,
					duration: cmd.t,
					startTime: currentTime,
					mA_draw: totalCurrentDraw,
					v_level: batteryV,
					left_rpm: lRpm,
					right_rpm: rRpm,
				});

				await new Promise((resolve) => {
					setTimeout(resolve, cmd.t);
				});
				currentTime += cmd.t;
			}

			setIsExecuting(false);

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(window as any).__LAST_TELEMETRY__ = telemetry;
			window.dispatchEvent(new CustomEvent("SIM_TELEMETRY_UPDATE"));
		},
		[esp32State, l9110State, totalCurrentDraw, batteryV],
	);

	// Event Listeners from Sidebar
	useEffect(() => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const handleLoadCode = (e: any) => {
			setImportedCode(e.detail.steps);
		};
		const handleRunCode = () => {
			executeSequence(importedCode);
		};
		const handleRunRecorded = () => {
			executeSequence(recordedCommands);
		};
		const handleExportRecorded = () => {
			const dataStr =
				"data:text/json;charset=utf-8," +
				encodeURIComponent(
					JSON.stringify({ mode: "code", steps: recordedCommands }),
				);
			const anchor = document.createElement("a");
			anchor.setAttribute("href", dataStr);
			anchor.setAttribute("download", "comandos_gravados.json");
			document.body.appendChild(anchor);
			anchor.click();
			anchor.remove();
		};

		window.addEventListener("SIM_LOAD_CODE", handleLoadCode);
		window.addEventListener("SIM_RUN_CODE", handleRunCode);
		window.addEventListener("SIM_RUN_RECORDED", handleRunRecorded);
		window.addEventListener("SIM_EXPORT_RECORDED", handleExportRecorded);

		return () => {
			window.removeEventListener("SIM_LOAD_CODE", handleLoadCode);
			window.removeEventListener("SIM_RUN_CODE", handleRunCode);
			window.removeEventListener("SIM_RUN_RECORDED", handleRunRecorded);
			window.removeEventListener("SIM_EXPORT_RECORDED", handleExportRecorded);
		};
	}, [executeSequence, importedCode, recordedCommands]);

	// Sync state back to sidebar UI
	useEffect(() => {
		window.dispatchEvent(
			new CustomEvent("SIM_STATE_UPDATE", {
				detail: {
					hasCode: importedCode.length > 0,
					hasRecorded: recordedCommands.length > 0,
				},
			}),
		);
	}, [importedCode, recordedCommands]);

	const toggleRecording = () => {
		if (isRecording) {
			// Stopping recording -> Immediately generate telemetry so the Report button activates
			const telemetry = recordedCommands.map((cmd, index) => {
				let lRpm = 0;
				let rRpm = 0;

				if (cmd.m === "F") {
					lRpm = 126;
					rRpm = 126;
				} else if (cmd.m === "B") {
					lRpm = -126;
					rRpm = -126;
				} else if (cmd.m === "L") {
					lRpm = -126;
					rRpm = 126;
				} else if (cmd.m === "R") {
					lRpm = 126;
					rRpm = -126;
				}

				return {
					command: cmd.m,
					duration: cmd.t,
					startTime: index * 1000,
					mA_draw: totalCurrentDraw,
					v_level: batteryV,
					left_rpm: lRpm,
					right_rpm: rRpm,
				};
			});
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(window as any).__LAST_TELEMETRY__ = telemetry;
			window.dispatchEvent(new CustomEvent("SIM_TELEMETRY_UPDATE"));
		}
		setIsRecording(!isRecording);
	};

	const handlePress = (dir: string) => {
		if (!isRecording || esp32State !== "normal") {
			return;
		}
		// Fixed 1000ms per command
		setRecordedCommands((prev) => {
			return [...prev, { m: dir, t: 1000 }];
		});
	};

	const removeRecordedCommand = (commandIndex: number) => {
		setRecordedCommands((commands) => commands.filter((_, index) => index !== commandIndex));
	};

	const clearRecordedCommands = () => {
		setRecordedCommands([]);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(window as any).__LAST_TELEMETRY__ = null;
	};

	const convertRecordedCommands = () => {
		const steps = recordedCommands.at(-1)?.m === "S"
			? recordedCommands
			: [...recordedCommands, { m: "S", t: 0 }];
		const converted = ConvertJSONToCodeBlocks({ mode: "code", steps });
		setCodeBlocks(converted.shapes);
		setBlockOrder(converted.blockOrder);
		setMode("code");
	};

	const sendRecordedCommands = () => {
		if (!mqttInstance?.connected) {
			setSendDialogOpen(false);
			triggerAction(ActionLabels.TOGGLE_MQTT_CONNECTION_MODAL, "mqttConnectionModal");
			return;
		}

		mqttInstance.publish("arcad/publish", JSON.stringify({ mode: "code", steps: recordedCommands }));
		setSendDialogOpen(false);
	};

	const hasMainPower = batteryV > 0;
	const mtPowerActive = mt3608State !== "off";
	const espPowerActive = esp32State !== "off";
	const l91PowerActive = l9110State !== "off";
	const batteryPercentage = Math.min(100, Math.max(0, Math.round((batteryV / 3.7) * 100)));
	const cpuPercentage = isExecuting ? 68 : 12;

	return (
		<div className="simulation-layout">
			<div className="simulation-visual">
				<div className="simulation-metrics">
					<span>BATERIA <strong>{batteryPercentage}%</strong></span>
					<span>CPU <strong>{cpuPercentage}%</strong></span>
				</div>
			<div style={{ position: "absolute", inset: 0, display: "flex", justifyContent: "center", alignItems: "center" }}>
				<img
					src="/robotVector 1.png"
					alt="Chassi do robô"
					className="robot-chassis-image"
				/>
			</div>

			{/* SVG Connections Layer */}
			<svg className="absolute inset-0 w-full h-full z-0 pointer-events-none">
				<title>Conexões</title>
				<Connection x1="25%" y1="78%" x2="35%" y2="64%" active={hasMainPower} />
				<Connection
					x1="35%"
					y1="64%"
					x2="50%"
					y2="38%"
					active={mtPowerActive}
				/>
				<Connection
					x1="35%"
					y1="64%"
					x2="50%"
					y2="61%"
					active={mtPowerActive}
				/>
				<Connection
					x1="50%"
					y1="38%"
					x2="50%"
					y2="61%"
					active={l91PowerActive}
				/>
				<Connection
					x1="38%"
					y1="30%"
					x2="48%"
					y2="38%"
					active={espPowerActive}
				/>
				<Connection
					x1="50%"
					y1="18%"
					x2="50%"
					y2="38%"
					active={espPowerActive}
				/>
				<Connection
					x1="65%"
					y1="30%"
					x2="50%"
					y2="38%"
					active={espPowerActive}
				/>
				<Connection
					x1="30%"
					y1="46%"
					x2="50%"
					y2="61%"
					active={l91PowerActive}
				/>
				<Connection
					x1="68%"
					y1="46%"
					x2="50%"
					y2="61%"
					active={l91PowerActive}
				/>
			</svg>

			{/* Hardware Nodes */}
			<Node
				title="Wheel Left"
				top="30%"
				left="35%"
				state={esp32State}
				label="RPM"
			/>
			<Node
				title="HC-04"
				top="22%"
				left="50%"
				state={esp32State}
				label="Distance"
			/>
			<Node
				title="Wheel Right"
				top="30%"
				left="65%"
				state={esp32State}
				label="RPM"
			/>
			<Node
				title="Motor Left"
				top="46%"
				left="32%"
				state={l9110State}
				label="RPM"
			/>
			<Node title="ESP-32" top="38%" left="50%" state={esp32State} />
			<Node
				title="Motor Right"
				top="46%"
				left="68%"
				state={l9110State}
				label="RPM"
			/>
			<Node title="MT3608" top="64%" left="36%" state={mt3608State} />
			<Node title="L9110" top="61%" left="50%" state={l9110State} />
			<Node title="Battery" top="80%" left="25%" state={l9110State} />
			</div>

			<aside className="simulation-controls">
				<div className="simulation-controls__actions">
					<header className="simulation-controls__header">
						<Typography variant="subtitle2" sx={{ fontWeight: 700 }}>CONTROLE E GRAVAÇÃO</Typography>
						<Typography variant="caption" color="text.secondary">Clique nas setas para registrar movimentos</Typography>
					</header>
					<div className="simulation-controls__pad">
						<div className="simulation-dpad" aria-label="Controles direcionais do robô">
							<IconButton aria-label="Avançar" className="simulation-dpad__up" disabled={!isRecording} onClick={() => handlePress("F")}><ArrowUpwardIcon /></IconButton>
							<IconButton aria-label="Virar à esquerda" className="simulation-dpad__left" disabled={!isRecording} onClick={() => handlePress("L")}><ArrowBackIcon /></IconButton>
							<IconButton aria-label="Parar" className="simulation-dpad__stop" disabled={!isRecording} onClick={() => handlePress("S")}><StopIcon /></IconButton>
							<IconButton aria-label="Virar à direita" className="simulation-dpad__right" disabled={!isRecording} onClick={() => handlePress("R")}><ArrowForwardIcon /></IconButton>
							<IconButton aria-label="Recuar" className="simulation-dpad__down" disabled={!isRecording} onClick={() => handlePress("B")}><ArrowDownwardIcon /></IconButton>
						</div>
					</div>
					<Stack className="simulation-record-actions" direction="row" spacing={1}>
						<Button variant="outlined" color={isRecording ? "error" : "primary"} onClick={() => { if (!isRecording) toggleRecording(); }} disabled={isRecording}>Gravar comandos</Button>
						<Button variant="outlined" startIcon={<StopIcon />} onClick={() => { if (isRecording) toggleRecording(); }} disabled={!isRecording}>Parar gravação</Button>
					</Stack>
					<Divider />
					<section className="simulation-controls__recorded">
						<Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mb: 1 }}>
							<Typography variant="overline" sx={{ fontWeight: 700 }}>Comandos de registro atual</Typography>
							<Tooltip title="Limpar comandos">
								<span><IconButton aria-label="Limpar comandos" size="small" onClick={clearRecordedCommands} disabled={recordedCommands.length === 0}><DeleteOutlineIcon fontSize="small" /></IconButton></span>
							</Tooltip>
						</Stack>
						<div className="simulation-recorded-list">
							{recordedCommands.length === 0 ? (
								<Typography variant="caption" color="text.secondary">Nenhum comando gravado. Pressione Gravar e use os controles.</Typography>
							) : recordedCommands.map((command, index) => (
								<div className="simulation-recorded-item" key={`${command.m}-${index}`}>
									<Typography variant="caption">{COMMAND_LABELS[command.m] ?? command.m}</Typography>
									<Typography variant="caption" color="text.secondary">{command.t / 1000} s</Typography>
									<IconButton aria-label={`Remover ${COMMAND_LABELS[command.m] ?? "comando"}`} size="small" onClick={() => removeRecordedCommand(index)}><DeleteOutlineIcon fontSize="small" /></IconButton>
								</div>
							))}
						</div>
					</section>
					<Stack className="simulation-program-actions" direction="row" spacing={1}>
						<Button variant="outlined" startIcon={<CodeOutlinedIcon />} disabled={!recordedCommands.length} onClick={convertRecordedCommands}>Converter em código</Button>
						<Button variant="contained" startIcon={<SendIcon />} disabled={!recordedCommands.length} onClick={() => setSendDialogOpen(true)}>Enviar</Button>
					</Stack>
				</div>
			</aside>
			<Dialog open={sendDialogOpen} onClose={() => setSendDialogOpen(false)} fullWidth maxWidth="sm">
				<DialogTitle>Enviar programa ao robô físico?</DialogTitle>
				<DialogContent>
					<Alert severity="warning" sx={{ mb: 2 }}>Esta ação pode movimentar o hardware conectado. Verifique a área ao redor do robô antes de continuar.</Alert>
					<Typography>O programa contém {recordedCommands.length} comandos e tem duração estimada de {Math.round(recordedCommands.reduce((duration, command) => duration + command.t, 0) / 1000)} segundos.</Typography>
					{!mqttInstance?.connected && <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Será necessário configurar a conexão MQTT antes do envio.</Typography>}
				</DialogContent>
				<DialogActions>
					<Button onClick={() => setSendDialogOpen(false)}>Cancelar</Button>
					<Button variant="contained" onClick={sendRecordedCommands}>Confirmar envio</Button>
				</DialogActions>
			</Dialog>
		</div>
	);
}
