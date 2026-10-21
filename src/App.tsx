import "./styles/App.scss";
import { Button } from "@mui/material";
import SensorsIcon from "@mui/icons-material/Sensors";
import { ActionLabels } from "./store/ActionsLabels";
import { useStore } from "./store/Store";
import { CodeCanvas, CodeCommandPalette } from "./UIComponents/BlockCoding/CodeCanvas";
import { ModalContainer } from "./UIComponents/ModalContainer";
import { RightSideBar } from "./UIComponents/RightSideBar";
import Simulation from "./UIComponents/Simulation/Simulation";
import { TopNavBar } from "./UIComponents/TopNavBar";
import { Viewer } from "./Viewer";

function App() {
	const mode = useStore((store) => store.mode);
	const triggerAction = useStore((store) => store.triggerAction);

	return (
		<div className={`app-shell app-shell--${mode}`}>
			<TopNavBar />
			<div className="workspace">
				<main className="workspace__main">
					{mode === "realtime" && (
						<div className="realtime-scene">
							<Button
								className="realtime-connect"
								variant="contained"
								startIcon={<SensorsIcon />}
								onClick={() =>
									triggerAction(
										ActionLabels.TOGGLE_MQTT_CONNECTION_MODAL,
										"mqttConnectionModal",
									)
								}
							>
								Conectar robô
							</Button>
							<Viewer />
						</div>
					)}
					{mode === "code" && (
						<div className="coding-workspace">
							<CodeCommandPalette />
							<CodeCanvas />
						</div>
					)}
					{mode === "simulation" && <Simulation />}
				</main>
				<aside className="workspace__sidebar">
					<RightSideBar />
				</aside>
			</div>
			<ModalContainer />
		</div>
	);
}

export default App;
