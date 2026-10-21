import type { ChangeEvent } from "react";
import { useState } from "react";
import { Accordion, AccordionDetails, AccordionSummary, Alert, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Stack, Typography } from "@mui/material";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import DeviceHubIcon from "@mui/icons-material/DeviceHub";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import FileUploadOutlinedIcon from "@mui/icons-material/FileUploadOutlined";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import { ActionLabels } from "../../store/ActionsLabels";
import { useStore } from "../../store/Store";
import {
	type CodeStep,
	ConvertCodeBlockToJSON,
	ConvertJSONToCodeBlocks,
} from "../../utils/ConvertCodeBlock";

export const CodeSideBar = () => {
	const shapes = useStore((s) => s.codeBlocks);
	const blockOrder = useStore((s) => s.blockOrder);
	const setCodeBlocks = useStore((s) => s.setCodeBlocks);
	const setBlockOrder = useStore((s) => s.setBlockOrder);
	const triggerAction = useStore((s) => s.triggerAction);
	const mqttInstance = useStore((s) => s.mqttInstance);
	const setMode = useStore((s) => s.setMode);
	const [validationAttempted, setValidationAttempted] = useState(false);
	const [isValid, setIsValid] = useState(false);
	const [sendDialogOpen, setSendDialogOpen] = useState(false);
	const lastBlock = shapes.find((shape) => shape.id === blockOrder[blockOrder.length - 1]);
	const totalDuration = shapes
		.filter((shape) => blockOrder.includes(shape.id) && shape.id !== 0)
		.reduce((duration, shape) => duration + shape.value, 0);

	const HandleConfirmSend = () => {
		const json = ConvertCodeBlockToJSON(blockOrder, shapes);

		if (mqttInstance) {
			mqttInstance.publish("arcad/publish", JSON.stringify(json));
		}
		setSendDialogOpen(false);
	};

	const HandleSendClick = () => {
		if (!mqttInstance?.connected) {
			triggerAction(ActionLabels.TOGGLE_MQTT_CONNECTION_MODAL, "mqttConnectionModal");
			return;
		}
		setSendDialogOpen(true);
	};

	const HandleValidate = () => {
		const valid = blockOrder.length > 1 && lastBlock?.type === "Stop";
		setValidationAttempted(true);
		setIsValid(valid);
	};

	const HandleTestSimulation = () => {
		const program = ConvertCodeBlockToJSON(blockOrder, shapes);
		setMode("simulation");
		window.setTimeout(() => {
			window.dispatchEvent(new CustomEvent("SIM_LOAD_CODE", { detail: program }));
		}, 0);
	};

	const HandleImport = (event: ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];

		if (!file) {
			return;
		}

		const reader = new FileReader();

		reader.onload = (e) => {
			try {
				const jsonString = e.target?.result as string;
				const parsedData = JSON.parse(jsonString) as {
					mode: string;
					steps: CodeStep[];
				};

				if (parsedData.mode !== "code") {
					throw new Error("Modo de arquivo inválido. Era esperado 'code'.");
				}

				const { shapes, blockOrder } = ConvertJSONToCodeBlocks(parsedData);

				setCodeBlocks(shapes);
				setBlockOrder(blockOrder);
			} catch (error) {
				console.error("Não foi possível interpretar o arquivo de blocos.", error);
			}
		};

		reader.onerror = () => {
			console.error("Não foi possível ler o arquivo.");
		};

		reader.readAsText(file);

		// Clear the input so the user can import the same file again if they want
		event.target.value = "";
	};

	const HandleExport = () => {
		const code = ConvertCodeBlockToJSON(blockOrder, shapes);
		const jsonString = JSON.stringify(code, null, 2);
		const blob = new Blob([jsonString], { type: "application/json" });
		const url = URL.createObjectURL(blob);

		// Create a temporary anchor element to trigger the download
		const link = document.createElement("a");
		link.href = url;
		link.download = "oribotCode.json";

		// Append, click, and clean up the DOM
		document.body.appendChild(link);
		link.click();

		document.body.removeChild(link);
		URL.revokeObjectURL(url);
	};

	return (
		<div className="code-panel">
			<Stack sx={{ justifyContent: "space-between" }}>
				<Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Status do programa</Typography>
				<Chip size="small" label={mqttInstance?.connected ? "Robô conectado" : "Desconectado"} color={mqttInstance?.connected ? "success" : "default"} />
			</Stack>
			{validationAttempted && isValid ? (
				<Alert severity="success" icon={<CheckCircleOutlinedIcon />}>Sequência válida</Alert>
			) : (
				<Alert severity={validationAttempted ? "warning" : "info"}>
					{validationAttempted ? "Finalize o fluxo com o bloco Parar." : "Valide o fluxo antes de executar."}
				</Alert>
			)}
			<Stack spacing={1.25}>
				<Button variant="outlined" startIcon={<CheckCircleOutlinedIcon />} onClick={HandleValidate}>Validar programa</Button>
				<Button variant="contained" color="info" startIcon={<PlayArrowIcon />} onClick={HandleTestSimulation} disabled={!isValid}>Testar na simulação</Button>
				<Button variant="contained" startIcon={<DeviceHubIcon />} onClick={HandleSendClick} disabled={!isValid}>Enviar ao robô físico</Button>
			</Stack>
			<div className="code-panel__footer">
				<Divider sx={{ mb: 2 }} />
				<Stack spacing={1.5}>
					<Stack sx={{ justifyContent: "space-between", alignItems: "center" }}>
						<Typography variant="caption">Duração total</Typography>
						<Typography variant="caption" sx={{ fontWeight: 700 }}>{Math.round(totalDuration / 1000)} s</Typography>
					</Stack>
					<Stack sx={{ justifyContent: "space-between", alignItems: "center" }}>
						<Typography variant="caption">Dados</Typography>
						<Typography variant="caption" sx={{ fontWeight: 700 }}>Simulados</Typography>
					</Stack>
					<Button variant="outlined" startIcon={<SaveOutlinedIcon />} onClick={HandleExport}>Salvar rascunho</Button>
					<Accordion className="code-panel__summary" disableGutters>
						<AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography variant="body2">Importar ou exportar</Typography></AccordionSummary>
						<AccordionDetails>
							<Stack spacing={1}>
								<Button component="label" variant="outlined" startIcon={<FileUploadOutlinedIcon />}>Importar programa<input hidden type="file" accept=".json" onChange={HandleImport} /></Button>
								<Button variant="text" startIcon={<FileDownloadOutlinedIcon />} onClick={HandleExport}>Exportar programa</Button>
							</Stack>
						</AccordionDetails>
					</Accordion>
				</Stack>
			</div>
			<Dialog open={sendDialogOpen} onClose={() => setSendDialogOpen(false)} fullWidth maxWidth="sm">
				<DialogTitle>Enviar programa ao robô físico?</DialogTitle>
				<DialogContent>
					<Alert severity="warning" sx={{ mb: 2 }}>Esta ação pode movimentar o hardware conectado. Verifique a área ao redor do robô antes de continuar.</Alert>
					<Typography>O programa contém {Math.max(0, blockOrder.length - 1)} comandos e tem duração estimada de {Math.round(totalDuration / 1000)} segundos.</Typography>
				</DialogContent>
				<DialogActions>
					<Button onClick={() => setSendDialogOpen(false)}>Cancelar</Button>
					<Button variant="contained" onClick={HandleConfirmSend}>Confirmar envio</Button>
				</DialogActions>
			</Dialog>
		</div>
	);
};
