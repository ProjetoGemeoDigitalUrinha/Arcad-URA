import { AppBar, Box, IconButton, Tab, Tabs, Toolbar, Tooltip, Typography } from "@mui/material";
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";
import WifiTetheringIcon from "@mui/icons-material/WifiTethering";
import { ActionLabels } from "../store/ActionsLabels";
import { useStore } from "../store/Store";

export const TopNavBar = () => {
	const triggerAction = useStore((store) => store.triggerAction);
	const mode = useStore((store) => store.mode);
	const setMode = useStore((store) => store.setMode);

	return (
		<AppBar position="static" elevation={0} className="topbar">
			<Toolbar className="topbar__toolbar" disableGutters>
				<Box className="topbar__brand">
					<SmartToyOutlinedIcon className="topbar__robot-icon" />
					<Typography component="h1" className="topbar__wordmark">
						ORITWin
					</Typography>
				</Box>
				<Tabs
					className="topbar__tabs"
					value={mode}
					onChange={(_event, value: string) => setMode(value)}
					aria-label="Modos do ORITWin"
				>
					<Tab value="realtime" label="Tempo Real" />
					<Tab value="code" label="Codificação" />
					<Tab value="simulation" label="Laboratório de Simulação" />
				</Tabs>
				<Tooltip title="Configurar conexão do robô">
					<IconButton
						className="topbar__connect"
						aria-label="Configurar conexão do robô"
						 onClick={() =>
							triggerAction(
								ActionLabels.TOGGLE_MQTT_CONNECTION_MODAL,
								"mqttConnectionModal",
							)
						}
					>
						<WifiTetheringIcon />
					</IconButton>
				</Tooltip>
			</Toolbar>
		</AppBar>
	);
};
