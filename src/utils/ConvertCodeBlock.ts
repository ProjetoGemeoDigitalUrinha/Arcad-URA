import {
	COLORS,
	type CodeBlockShape,
	type CommandType,
} from "../UIComponents/BlockCoding/CodeCanvas";

export type CodeStep = {
	m: string;
	t: number;
};

export const ConvertCodeBlockToJSON = (
	blockOrder: number[],
	shapes: CodeBlockShape[],
) => {
	const orderedCodeBlocks = blockOrder.map((id) =>
		shapes.find((s) => s.id === id),
	);

	const finalJson: { mode: string; steps: CodeStep[] } = {
		mode: "code",
		steps: [],
	};

	orderedCodeBlocks.forEach((block) => {
		if (!block || block.type === "Start") {
			return;
		}

		finalJson.steps.push({
			m: block.type[0].toUpperCase(),
			t: block.value,
		});
	});

	return finalJson;
};

export const ConvertJSONToCodeBlocks = (parsedData: {
	mode: string;
	steps: CodeStep[];
}) => {
	const newShapes: CodeBlockShape[] = [];
	const newBlockOrder: number[] = [];

	// Starting dimensions based on your example
	let currentX = 80;
	const startY = 250;
	const blockWidth = 140;
	const blockHeight = 60;

	// Recreate the Start block exactly as your default state
	const startBlock: CodeBlockShape = {
		id: 0, // Store expects Start to be 0
		type: "Start",
		value: 0,
		x: currentX,
		y: startY,
		width: blockWidth,
		height: blockHeight,
		color: COLORS.Start,
		nextId: null,
		isLocked: false,
	};

	newShapes.push(startBlock);
	newBlockOrder.push(startBlock.id);

	let previousBlock = startBlock;

	parsedData.steps.forEach((step, index) => {
		// Move X to the right by the width of the block so they snap horizontally
		currentX += blockWidth + 36;

		const blockType = getCommandTypeFromChar(step.m);
		// Ensure unique IDs, offset by 1 since 0 is Start
		const newId = index + 1;

		const newBlock: CodeBlockShape = {
			id: newId,
			type: blockType,
			value: step.t,
			x: currentX,
			y: startY,
			width: blockWidth,
			height: blockHeight,
			color: COLORS[blockType], // Correct color mapping applied here
			nextId: null,
			isLocked: false,
		};

		// Link the previous block to this new block to establish the chain
		previousBlock.nextId = newBlock.id;

		newShapes.push(newBlock);
		newBlockOrder.push(newBlock.id);

		// Update previousBlock for the next iteration
		previousBlock = newBlock;
	});

	return { shapes: newShapes, blockOrder: newBlockOrder };
};

const getCommandTypeFromChar = (char: string): CommandType => {
	if (char === "F") {
		return "Forward";
	}

	if (char === "B") {
		return "Back";
	}

	if (char === "L") {
		return "Left";
	}

	if (char === "R") {
		return "Right";
	}

	if (char === "S") {
		return "Stop"; // Assuming exported 'S' means Stop, since Start was filtered out
	}

	return "Forward"; // Default fallback
};
