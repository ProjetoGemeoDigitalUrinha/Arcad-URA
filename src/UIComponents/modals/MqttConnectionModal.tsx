import mqtt from "mqtt";
import { Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField } from "@mui/material";
import LinkIcon from "@mui/icons-material/Link";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import { useEffect, useState } from "react";
import { ActionLabels } from "../../store/ActionsLabels";
import { useStore } from "../../store/Store";

export const MqttConnectionModal = () => {
	const triggerAction = useStore((store) => store.triggerAction);
	const mqttInstance = useStore((store) => store.mqttInstance);
	const setMqttInstance = useStore((store) => store.setMqttInstance);
	const pushToPayloadHistory = useStore((store) => store.pushToPayloadHistory);

	const [brokerEndpoint, setBrokerEndpoint] = useState<string>(
		"ws://192.168.0.4:9001",
	);
	const [subscribeChannel, setSubscribeChannel] =
		useState<string>("oribot/publish");
	const [publishChannel, setPublishChannel] = useState<string>("arcad/publish");
	const [connected, setConnected] = useState<boolean>(false);

	const handleOnConnect = () => {
		if (!brokerEndpoint.trim() || !subscribeChannel.trim()) {
			return;
		}

		const instance = mqtt.connect(brokerEndpoint, {
			clean: true,
			connectTimeout: 4000,
			reconnectPeriod: 1000,
		});

		instance.on("connect", () => {
			console.log("Conectado ao broker MQTT");
			setConnected(true);
			instance.subscribe(subscribeChannel, (err) => {
				if (!err) {
					instance.publish(publishChannel, "Cliente web conectado.");
				}
			});
		});

		instance.on("message", (_topic, payload) => {
			pushToPayloadHistory(payload.toString());
		});

		instance.on("close", () => {
			console.log("Conexão encerrada.");
			setConnected(false);
		});

		instance.on("error", (err) => {
			console.error("Erro de conexão:", err);
			instance.end();
			setConnected(false);
		});

		instance.on("end", () => {
			console.log("Conexão finalizada.");
			setConnected(false);
		});

		setMqttInstance(instance);
	};

	const handleOnDisconnect = () => {
		if (!mqttInstance) {
			return;
		}

		mqttInstance.end();
		setConnected(false);
	};

	useEffect(() => {
		if (mqttInstance) {
			setConnected(mqttInstance.connected);
		}
	}, [mqttInstance]);

	return (
		<Dialog open onClose={() => triggerAction(ActionLabels.TOGGLE_MQTT_CONNECTION_MODAL, "mqttConnectionModal")} fullWidth maxWidth="sm">
			<DialogTitle>Conexão MQTT</DialogTitle>
			<DialogContent dividers>
				<Stack spacing={2} sx={{ pt: 1 }}>
					<Chip label={connected ? "Robô conectado" : "Robô desconectado"} color={connected ? "success" : "default"} sx={{ alignSelf: "flex-start" }} />
					<TextField label="Endereço do broker" placeholder="ws://localhost:9001" value={brokerEndpoint} onChange={(e) => setBrokerEndpoint(e.target.value)} fullWidth />
					<TextField label="Tópico para receber" value={subscribeChannel} onChange={(e) => setSubscribeChannel(e.target.value)} fullWidth />
					<TextField label="Tópico para enviar" value={publishChannel} onChange={(e) => setPublishChannel(e.target.value)} fullWidth />
				</Stack>
			</DialogContent>
			<DialogActions sx={{ p: 2 }}>
				<Button startIcon={<LinkOffIcon />} color="error" onClick={handleOnDisconnect} disabled={!connected}>Desconectar</Button>
				<Button startIcon={<LinkIcon />} variant="contained" onClick={handleOnConnect} disabled={!brokerEndpoint.trim() || !subscribeChannel.trim() || connected}>Conectar</Button>
			</DialogActions>
		</Dialog>
	);
};
