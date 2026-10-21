/** biome-ignore-all lint/a11y/useButtonType: <explanation> */
import { useEffect, useRef, useState } from "react";
import { Accordion, AccordionDetails, AccordionSummary, Box, Button, Divider, Paper, Slider, Stack, TextField, Typography } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import FileUploadOutlinedIcon from "@mui/icons-material/FileUploadOutlined";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import SummarizeOutlinedIcon from "@mui/icons-material/SummarizeOutlined";
import type { SimulationPartConfig } from "../../store/AppSlice";
import { useStore } from "../../store/Store";

const defaultPartValues: Record<string, SimulationPartConfig> = {
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
	"HC-04": "Sensor ultrassônico HC-04",
	"ESP-32": "ESP-32",
	Battery: "Bateria",
	MT3608: "MT3608",
	L9110: "L9110",
};

export const SimulationSideBar = () => {
	const partsList = [
		"Wheel Left",
		"Wheel Right",
		"Motor Left",
		"Motor Right",
		"HC-04",
		"L9110",
		"ESP-32",
		"Battery",
		"MT3608",
	];

	const { simulationParts, setSimulationParts } = useStore((store) => store);
	const [selectedPart, setSelectedPart] = useState("HC-04");

	// States synced from Simulation via events
	const [hasImportedCode, setHasImportedCode] = useState(false);
	const [hasRecordedCommands, setHasRecordedCommands] = useState(false);
	const [hasReportData, setHasReportData] = useState(false);

	const fileInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const handleStateUpdate = (e: any) => {
			setHasImportedCode(e.detail.hasCode);
			setHasRecordedCommands(e.detail.hasRecorded);
		};

		const handleTelemetryUpdate = () => {
			setHasReportData(true);
		};

		window.addEventListener("SIM_STATE_UPDATE", handleStateUpdate);
		window.addEventListener("SIM_TELEMETRY_UPDATE", handleTelemetryUpdate);

		return () => {
			window.removeEventListener("SIM_STATE_UPDATE", handleStateUpdate);
			window.removeEventListener("SIM_TELEMETRY_UPDATE", handleTelemetryUpdate);
		};
	}, []);

	const handleValueChange = (val: number, prop: keyof SimulationPartConfig) => {
		const currentPartState =
			simulationParts?.[selectedPart] || defaultPartValues[selectedPart];
		setSimulationParts(selectedPart, {
			...currentPartState,
			[prop]: val,
		});
	};

	const handleResetToDefault = () => {
		setSimulationParts(selectedPart, { ...defaultPartValues[selectedPart] });
	};

	const handleImportCode = (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = (e) => {
			try {
				const parsedData = JSON.parse(e.target?.result as string);
				window.dispatchEvent(
					new CustomEvent("SIM_LOAD_CODE", { detail: parsedData }),
				);
			} catch (error) {
				console.error("Parse Error", error);
			}
		};
		reader.readAsText(file);
		event.target.value = "";
	};

	const generatePDFReport = () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const telemetry = (window as any).__LAST_TELEMETRY__;
		if (!telemetry || telemetry.length === 0) {
			alert("Não há dados de simulação. Execute uma simulação primeiro.");
			return;
		}

		// Kinematics Calculation
		let x = 0,
			y = 0,
			theta = 0;
		const pathPoints = [{ x: 0, y: 0, theta: 0 }];

		telemetry.forEach((t: any) => {
			if (t.command === "L") theta += Math.PI / 2;
			else if (t.command === "R") theta -= Math.PI / 2;
			else {
				// Assuming 1s duration, calculate displacement
				const v = 5; // Velocity constant for demo
				x += v * Math.cos(theta);
				y += v * Math.sin(theta);
			}
			pathPoints.push({ x, y, theta });
		});

		const printWindow = window.open("", "_blank");
		if (!printWindow) return;

		printWindow.document.write(`
            <html>
                <head>
                    <style>
                        body { font-family: sans-serif; padding: 40px; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                        th, td { border: 1px solid #000; padding: 8px; text-align: left; }
                        th { background-color: #f2f2f2; }
                    </style>
                </head>
                <body>
					<h1>Relatório da simulação</h1>
                    <canvas id="c" width="500" height="400"></canvas>
					<h2>Telemetria</h2>
                    <table>
						<tr><th>Comando</th><th>Duração</th><th>mA</th><th>V</th></tr>
                        ${telemetry.map((t: any) => `<tr><td>${t.command}</td><td>${t.duration}</td><td>${t.mA_draw}</td><td>${t.v_level}</td></tr>`).join("")}
                    </table>
                   <script>
						const ctx = document.getElementById('c').getContext('2d');
						const path = ${JSON.stringify(pathPoints)};
						ctx.translate(250, 200);

						// Draw trajectory path
						ctx.beginPath();
						ctx.moveTo(0,0);
						path.forEach(p => ctx.lineTo(p.x * 20, -p.y * 20));
						ctx.strokeStyle = '#3b82f6';
						ctx.lineWidth = 3;
						ctx.stroke();

						// Draw Starting Circle (Green)
						ctx.fillStyle = 'green';
						ctx.beginPath();
						ctx.arc(0, 0, 6, 0, Math.PI * 2);
						ctx.fill();

						// Draw End Circle (Red)
						const end = path[path.length - 1];
						ctx.fillStyle = 'red';
						ctx.beginPath();
						ctx.arc(end.x * 20, -end.y * 20, 6, 0, Math.PI * 2);
						ctx.fill();

						setTimeout(() => window.print(), 500);
					</script>
                </body>
            </html>
        `);
		printWindow.document.close();
	};

	const currentPart =
		simulationParts?.[selectedPart] || defaultPartValues[selectedPart];
	const defaultPartInfo = defaultPartValues[selectedPart];
	const selectedValueUnit = selectedPart === "HC-04"
		? "cm"
		: selectedPart.includes("Motor") || selectedPart.includes("Wheel")
			? "RPM"
			: "";
	const selectedDescription = selectedPart === "HC-04"
		? "Simula a distância detectada entre o robô e um obstáculo."
		: selectedPart.includes("Motor") || selectedPart.includes("Wheel")
			? "Ajuste a rotação para observar o comportamento do conjunto."
			: "Ajuste os parâmetros elétricos deste componente.";

	return (
		<Stack className="simulation-panel" spacing={1.5}>
			<Paper className="simulation-sidebar__section" elevation={0}>
				<Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
					<Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Sensores e atuadores</Typography>
					<Typography variant="caption" color="text.secondary">9 componentes</Typography>
				</Stack>
				<Box className="simulation-sidebar__parts">
					{partsList.map((part) => (
						<Button key={part} variant={selectedPart === part ? "contained" : "outlined"} onClick={() => setSelectedPart(part)}>
							{PART_LABELS[part] ?? part}
						</Button>
					))}
				</Box>
			</Paper>

			<Paper className="simulation-sidebar__section" elevation={0}>
				<Typography variant="overline" sx={{ fontWeight: 700 }}>Componente selecionado</Typography>
				<Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{PART_LABELS[selectedPart] ?? selectedPart}</Typography>
				<Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>{selectedDescription}</Typography>
				{defaultPartInfo.value !== -1 && (
					<Box className="simulation-sidebar__value">
						<Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "baseline" }}>
							<Typography variant="caption" sx={{ fontWeight: 700 }}>Valor simulado</Typography>
							<Typography variant="caption">{selectedValueUnit}</Typography>
						</Stack>
						<Typography className="simulation-sidebar__value-number">{currentPart.value}</Typography>
						<Slider
							value={currentPart.value}
							min={selectedPart === "HC-04" ? 0 : -255}
							max={selectedPart === "HC-04" ? 100 : 255}
							aria-label="Valor simulado"
							onChange={(_event, value) => handleValueChange(Array.isArray(value) ? value[0] : value, "value")}
						/>
					</Box>
				)}
				<Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
					{defaultPartInfo.mA !== -1 && <TextField label="Corrente (mA)" type="number" size="small" value={currentPart.mA} onChange={(e) => handleValueChange(Number(e.target.value), "mA")} />}
					{defaultPartInfo.v !== -1 && <TextField label="Tensão (V)" type="number" size="small" value={currentPart.v} onChange={(e) => handleValueChange(Number(e.target.value), "v")} />}
				</Stack>
				<Button variant="outlined" startIcon={<RestartAltIcon />} fullWidth sx={{ mt: 1.5 }} onClick={handleResetToDefault}>Restaurar valores padrão</Button>
			</Paper>

			<Accordion className="simulation-sidebar__accordion" disableGutters>
				<AccordionSummary expandIcon={<ExpandMoreIcon />}><Stack direction="row" spacing={1} sx={{ alignItems: "center" }}><SummarizeOutlinedIcon fontSize="small" /><Typography>Relatório</Typography></Stack></AccordionSummary>
				<AccordionDetails>
					<Button variant="outlined" startIcon={<FileDownloadOutlinedIcon />} fullWidth disabled={!hasReportData} onClick={generatePDFReport}>Ver e exportar relatório</Button>
				</AccordionDetails>
			</Accordion>

			<Accordion className="simulation-sidebar__accordion" disableGutters>
				<AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography>Gravações e programas</Typography></AccordionSummary>
				<AccordionDetails>
					<Stack spacing={1}>
						<Button variant="outlined" startIcon={<PlayArrowIcon />} disabled={!hasRecordedCommands} onClick={() => window.dispatchEvent(new CustomEvent("SIM_RUN_RECORDED"))}>Executar gravação</Button>
						<Button variant="text" startIcon={<FileDownloadOutlinedIcon />} disabled={!hasRecordedCommands} onClick={() => window.dispatchEvent(new CustomEvent("SIM_EXPORT_RECORDED"))}>Exportar gravação</Button>
						<Divider />
						<Button variant="contained" startIcon={<PlayArrowIcon />} disabled={!hasImportedCode} onClick={() => window.dispatchEvent(new CustomEvent("SIM_RUN_CODE"))}>Executar programa</Button>
						<Button variant="outlined" startIcon={<FileUploadOutlinedIcon />} onClick={() => fileInputRef.current?.click()}>Importar programa</Button>
						<input type="file" ref={fileInputRef} hidden onChange={handleImportCode} />
					</Stack>
				</AccordionDetails>
			</Accordion>
		</Stack>
	);
};
