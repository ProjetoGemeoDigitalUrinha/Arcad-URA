/** biome-ignore-all lint/suspicious/noArrayIndexKey: todo */
import { Box, ButtonBase, Chip, Divider, LinearProgress, Paper, Stack, TextField, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { ActionLabels } from "../../store/ActionsLabels";
import { useStore } from "../../store/Store";

// Metadata structure to link the UI options to the store IDs and model parts
const DEVICE_METADATA: Record<
	string,
	{ name: string; type: string; partName: string | null; keys: string[]; unit: string; description: string }
> = {
	hc04: {
		name: "Sensor ultrassônico HC-04",
		type: "Sensor",
		partName: "ultrasonic",
		keys: ["hc04", "ultrassonic", "ultrasonic"],
		unit: "cm",
		description: "Mede a distância entre o robô e os obstáculos.",
	},
	motorLeft: {
		name: "Motor esquerdo",
		type: "Atuador",
		partName: "leftMotor",
		keys: ["motorLeft", "leftMotor"],
		unit: "RPM",
		description: "Controla a rotação da roda esquerda.",
	},
	motorRight: {
		name: "Motor direito",
		type: "Atuador",
		partName: "rightMotor",
		keys: ["motorDir", "motorRight", "rightMotor"],
		unit: "RPM",
		description: "Controla a rotação da roda direita.",
	},
	esp32: {
		name: "ESP-32",
		type: "Controlador",
		partName: null,
		keys: ["esp32Voltage", "esp32", "ESP-32"],
		unit: "V",
		description: "Controlador responsável pela comunicação com o robô.",
	},
	battery: {
		name: "Bateria",
		type: "Alimentação",
		partName: null,
		keys: ["batteryVoltage", "battery", "Battery"],
		unit: "V",
		description: "Fonte de alimentação dos componentes do robô.",
	},
};

const getLatestValue = (
	history: Record<string, { value: unknown; timestamp: number }[]>,
	keys: string[],
) => {
	for (const key of keys) {
		const records = history[key];
		if (records?.length) return records[records.length - 1].value;
	}
	return null;
};

// Helper function to format the timestamp to match the previous UI style
const formatTimestamp = (timestamp: number) => {
	const d = new Date(timestamp);
	const pad = (n: number) => {
		return n.toString().padStart(2, "0");
	};
	return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} às ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

export const RealtimeSideBar = () => {
	const triggerAction = useStore((store) => store.triggerAction);
	const sensorConfigs = useStore((store) => store.sensorConfigs);
	const setSensorConfig = useStore((store) => store.setSensorConfig);
	const sensorHistory = useStore((store) => store.sensorHistory);

	const [selectedId, setSelectedId] = useState<string | null>("hc04");

	// States to handle the editable configurations
	const [minValue, setMinValue] = useState<number | string>("");
	const [maxValue, setMaxValue] = useState<number | string>("");
	const [minColor, setMinColor] = useState<string>("#000000");
	const [maxColor, setMaxColor] = useState<string>("#000000");

	// Sync local configuration state whenever the selection changes
	useEffect(() => {
		if (selectedId !== null) {
			const config = sensorConfigs[selectedId];
			if (config !== undefined) {
				setMinValue(config.minValue);
				setMaxValue(config.maxValue);
				setMinColor(config.minColor);
				setMaxColor(config.maxColor);
			} else {
				// Reset to defaults if no configuration exists in the store yet
				setMinValue("");
				setMaxValue("");
				setMinColor("#000000");
				setMaxColor("#ffffff");
			}
		}
	}, [selectedId, sensorConfigs]);

	// Update the store configuration safely
	// biome-ignore lint/suspicious/noExplicitAny: generic value handler
	const handleConfigUpdate = (key: string, value: any) => {
		if (selectedId === null || DEVICE_METADATA[selectedId].type !== "Sensor") {
			return;
		}

		const currentConfig = sensorConfigs[selectedId] || {
			partName: DEVICE_METADATA[selectedId].partName,
			minValue: 0,
			maxValue: 100,
			minColor: "#000000",
			maxColor: "#ffffff",
		};

		const newConfig = { ...currentConfig, [key]: value };
		setSensorConfig(selectedId, newConfig);
	};

	const handleSelect = (id: string) => {
		if (selectedId === id) {
			return;
		}

		if (selectedId !== null && selectedId !== id) {
			const prevPart = DEVICE_METADATA[selectedId].partName;
			if (prevPart) {
				triggerAction(ActionLabels.DESELECT_FROM_REALTIME_LIST, "realtimeList", {
					selected: prevPart,
				});
			}
		}

		setSelectedId(id);

		const newPart = DEVICE_METADATA[id].partName;
		if (newPart) {
			triggerAction(
				ActionLabels.TOGGLE_SELECT_FROM_REALTIME_LIST,
				"realtimeList",
				{ selected: newPart },
			);
		}
	};

	const selectedData = selectedId !== null ? DEVICE_METADATA[selectedId] : null;
	const mqttInstance = useStore((store) => store.mqttInstance);
	const currentValue = selectedData ? getLatestValue(sensorHistory, selectedData.keys) : null;

	// Retrieve and sort the history array (newest first)
	let currentHistory: { value: any; timestamp: number }[] = [];
	if (selectedId !== null) {
		const historyKeys = DEVICE_METADATA[selectedId].keys;
		const historyKey = historyKeys.find((key) => sensorHistory[key] !== undefined);
		if (historyKey !== undefined) {
			currentHistory = [...sensorHistory[historyKey]];
			currentHistory.sort((a, b) => {
				return b.timestamp - a.timestamp;
			});
		}
	}

	const config = selectedId === "hc04" ? sensorConfigs[selectedId] : undefined;
	const range = config ? config.maxValue - config.minValue : 0;
	const numericValue = currentValue === null ? null : Number(currentValue);
	const progress = config && numericValue !== null && !Number.isNaN(numericValue) && range > 0
		? Math.min(100, Math.max(0, ((numericValue - config.minValue) / range) * 100))
		: 0;
	const isConnected = Boolean(mqttInstance?.connected);
	const renderComponent = (id: string) => {
		const component = DEVICE_METADATA[id];
		const value = getLatestValue(sensorHistory, component.keys);
		return (
			<ButtonBase
				key={id}
				className={`realtime-panel__component ${selectedId === id ? "is-selected" : ""}`}
				onClick={() => handleSelect(id)}
			>
				<Box>
					<Typography variant="body2" sx={{ fontWeight: 700 }}>{component.name}</Typography>
					<Typography variant="caption" color="text.secondary">
						{value === null ? "Aguardando dados" : `${String(value)} ${component.unit}`}
					</Typography>
				</Box>
				<Chip label={value === null ? "Sem dados" : "Normal"} size="small" variant="outlined" color={value === null ? "default" : "success"} />
			</ButtonBase>
		);
	};

	return (
		<Stack className="realtime-panel" spacing={0}>
			<Box className="realtime-panel__status">
				<Chip label={isConnected ? "Robô conectado" : "Robô desconectado"} color={isConnected ? "success" : "default"} size="small" />
			</Box>
			<Box className="realtime-panel__section">
				<Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
					<Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Componentes</Typography>
					<Typography variant="caption" color="text.secondary">5 monitorados</Typography>
				</Stack>
				<Typography className="realtime-panel__eyebrow">Atuadores</Typography>
				{["motorLeft", "motorRight"].map(renderComponent)}
				<Typography className="realtime-panel__eyebrow">Sensores</Typography>
				{renderComponent("hc04")}
				<Typography className="realtime-panel__eyebrow">Controle e alimentação</Typography>
				{["esp32", "battery"].map(renderComponent)}
			</Box>
			<Divider />
			{selectedData && (
				<Box className="realtime-inspector">
					<Typography className="realtime-panel__eyebrow">Inspetor</Typography>
					<Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{selectedData.name}</Typography>
					<Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>{selectedData.description}</Typography>
					<Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
						<Chip label={currentValue === null ? "Sem telemetria" : "Normal"} color={currentValue === null ? "default" : "success"} size="small" />
						<Chip label={selectedData.type} variant="outlined" size="small" />
					</Stack>
					<Paper className="realtime-reading" elevation={0}>
						<Typography variant="caption">Leitura atual</Typography>
						<Typography className="realtime-reading__value">{currentValue === null ? "--" : String(currentValue)} <small>{selectedData.unit}</small></Typography>
						{config && <LinearProgress variant="determinate" value={progress} />}
						{currentHistory[0] && <Typography className="realtime-reading__time" variant="caption">Atualizado às {formatTimestamp(currentHistory[0].timestamp)}</Typography>}
					</Paper>
					{config && (
						<>
							<Typography variant="subtitle2" sx={{ fontWeight: 700, mt: 2, mb: 1 }}>Configuração da escala</Typography>
							<Stack direction="row" spacing={1}>
								<TextField label="Mínimo" type="number" size="small" value={minValue} onChange={(e) => { setMinValue(e.target.value); handleConfigUpdate("minValue", Number(e.target.value)); }} />
								<TextField label="Máximo" type="number" size="small" value={maxValue} onChange={(e) => { setMaxValue(e.target.value); handleConfigUpdate("maxValue", Number(e.target.value)); }} />
							</Stack>
							<Stack direction="row" spacing={2} sx={{ mt: 1.5 }}>
								<label className="realtime-color"><span>Cor mínima</span><input type="color" value={minColor} onChange={(e) => { setMinColor(e.target.value); handleConfigUpdate("minColor", e.target.value); }} /></label>
								<label className="realtime-color"><span>Cor máxima</span><input type="color" value={maxColor} onChange={(e) => { setMaxColor(e.target.value); handleConfigUpdate("maxColor", e.target.value); }} /></label>
							</Stack>
						</>
					)}
					<Typography variant="subtitle2" sx={{ fontWeight: 700, mt: 2 }}>Últimas leituras</Typography>
					<Box className="realtime-history">
						{currentHistory.length === 0 ? <Typography variant="caption" color="text.secondary">Nenhuma leitura recebida.</Typography> : currentHistory.slice(0, 8).map((record, index) => <Typography key={`${record.timestamp}-${index}`} variant="caption">{formatTimestamp(record.timestamp)}: {String(record.value)} {selectedData.unit}</Typography>)}
					</Box>
				</Box>
			)}
		</Stack>
	);
};
